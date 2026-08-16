import { afterEach, describe, expect, it, vi } from "vitest";
import { buildServer } from "./app.js";

describe("Console account security", () => {
  const apps: Array<ReturnType<typeof buildServer>> = [];
  afterEach(async () => {
    vi.unstubAllGlobals();
    await Promise.all(apps.splice(0).map((app) => app.close()));
  });

  it("blocks control-plane access until the bootstrap password is changed", async () => {
    let required = true;
    const changePassword = vi.fn(async () => ({ user: { id: "user-1" } }));
    const app = buildServer({
      auth: {
        handler: vi.fn(),
        api: {
          getSession: vi.fn(async () => ({
            session: { id: "session-1" },
            user: { id: "user-1", name: "admin", role: "admin" },
          })),
          changePassword,
        },
      } as any,
      internalToken: "test",
      passwordChangeRequired: async () => required,
      markPasswordChanged: async () => {
        required = false;
      },
    });
    apps.push(app);
    const me = await app.inject({ method: "GET", url: "/api/me" });
    expect(me.statusCode).toBe(200);
    expect(me.json().data.user.mustChangePassword).toBe(true);
    const blocked = await app.inject({
      method: "GET",
      url: "/api/centers/status",
    });
    expect(blocked.statusCode).toBe(428);
    expect(blocked.json().error.code).toBe("PASSWORD_CHANGE_REQUIRED");
    const changed = await app.inject({
      method: "POST",
      url: "/api/account/change-password",
      headers: { host: "console.test", origin: "http://console.test" },
      payload: {
        currentPassword: "initial-password",
        newPassword: "replacement-password",
      },
    });
    expect(changed.statusCode).toBe(200);
    expect(changePassword).toHaveBeenCalledOnce();
    expect(required).toBe(false);
  });

  it("reports liveness, readiness, version and bounded probe latency", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request) => {
        const path = new URL(String(input)).pathname;
        if (path === "/version")
          return Response.json({ ok: true, data: { version: "0.1.0" } });
        return Response.json({ ok: true, data: {} });
      }),
    );
    const app = buildServer({
      auth: {
        handler: vi.fn(),
        api: {
          getSession: vi.fn(async () => ({
            session: { id: "session-1" },
            user: { id: "user-1", name: "operator", role: "operator" },
          })),
        },
      } as any,
      internalToken: "test",
      passwordChangeRequired: async () => false,
    });
    apps.push(app);
    const response = await app.inject({
      method: "GET",
      url: "/api/centers/status",
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().data.mg).toMatchObject({
      ok: true,
      ready: true,
      version: "0.1.0",
    });
  });

  it("reserves extension lifecycle mutations for administrators", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const app = buildServer({
      auth: {
        handler: vi.fn(),
        api: {
          getSession: vi.fn(async () => ({
            session: { id: "session-1" },
            user: { id: "user-1", name: "operator", role: "operator" },
          })),
        },
      } as any,
      internalToken: "test",
      passwordChangeRequired: async () => false,
    });
    apps.push(app);
    const response = await app.inject({
      method: "POST",
      url: "/api/center/runtime/v1/runtime-providers/runtime.model-tool-loop/lifecycle/disabled",
      headers: { host: "console.test", origin: "http://console.test" },
      payload: {},
    });
    expect(response.statusCode).toBe(403);
    expect(response.json().error.code).toBe("ADMIN_REQUIRED");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("uses an isolated non-secure auth instance only for loopback hosts", async () => {
    const publicSession = vi.fn(async () => ({
      session: { id: "public-session" },
      user: { id: "public-user", name: "public", role: "admin" },
    }));
    const loopbackSession = vi.fn(async () => ({
      session: { id: "loopback-session" },
      user: { id: "loopback-user", name: "loopback", role: "admin" },
    }));
    const app = buildServer({
      auth: {
        handler: vi.fn(),
        api: { getSession: publicSession },
      } as any,
      loopbackAuth: {
        handler: vi.fn(),
        api: { getSession: loopbackSession },
      } as any,
      internalToken: "test",
      passwordChangeRequired: async () => false,
    });
    apps.push(app);

    const local = await app.inject({
      method: "GET",
      url: "/api/me",
      headers: { host: "127.0.0.1:8080" },
    });
    expect(local.statusCode).toBe(200);
    expect(local.json().data.user.id).toBe("loopback-user");
    expect(loopbackSession).toHaveBeenCalledOnce();
    expect(publicSession).not.toHaveBeenCalled();

    const publicResponse = await app.inject({
      method: "GET",
      url: "/api/me",
      headers: { host: "tool.quarkfan.com" },
    });
    expect(publicResponse.statusCode).toBe(200);
    expect(publicResponse.json().data.user.id).toBe("public-user");
    expect(publicSession).toHaveBeenCalledOnce();
  });
});
