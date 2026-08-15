import { afterEach, describe, expect, it, vi } from "vitest";
import { buildServer } from "./app.js";

describe("Console account security", () => {
  const apps: Array<ReturnType<typeof buildServer>> = [];
  afterEach(async () => Promise.all(apps.splice(0).map((app) => app.close())));

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
});
