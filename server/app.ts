import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import { fromNodeHeaders } from "better-auth/node";
import { join } from "node:path";
import { z } from "zod";
import type { ConsoleAuth } from "./auth.js";
import { runSystemAssistant } from "./assistant.js";
import {
  assertConsoleProxyPath,
  centerFetch,
  centerUrls,
  isCenter,
} from "./centers.js";
import {
  exportConfiguration,
  importConfiguration,
  previewConfiguration,
} from "./configuration.js";
const mutating = new Set(["POST", "PUT", "PATCH", "DELETE"]);
export function buildServer(o: {
  auth: ConsoleAuth;
  loopbackAuth?: ConsoleAuth;
  internalToken: string;
  staticRoot?: string;
  larkOAuthRedirectBaseUrl?: string;
  passwordChangeRequired?: (userId: string) => Promise<boolean>;
  markPasswordChanged?: (userId: string) => Promise<void>;
}) {
  const app = Fastify({
    logger: true,
    trustProxy: true,
    bodyLimit: 32 * 1024 * 1024,
  });
  const isLoopbackHost = (host?: string) => {
    if (!host) return false;
    try {
      const hostname = new URL(`http://${host}`).hostname;
      return (
        hostname === "localhost" ||
        hostname === "127.0.0.1" ||
        hostname === "[::1]"
      );
    } catch {
      return false;
    }
  };
  const authFor = (request: any) =>
    isLoopbackHost(request.headers.host) && o.loopbackAuth
      ? o.loopbackAuth
      : o.auth;
  const authHeaders = (request: any) => {
    const headers = fromNodeHeaders(request.headers);
    if (!headers.has("x-forwarded-for"))
      headers.set("x-forwarded-for", request.ip);
    return headers;
  };
  app.get("/healthz", async () => ({
    ok: true,
    data: { service: "platform-console", status: "ok" },
  }));
  app.get("/version", async () => ({
    ok: true,
    data: { service: "platform-console", version: "0.1.0" },
  }));
  app.route({
    method: ["GET", "POST"],
    url: "/api/auth/*",
    async handler(request, reply) {
      const url = new URL(
        request.url,
        `${request.protocol}://${request.headers.host}`,
      );
      const response = await authFor(request).handler(
        new Request(url, {
          method: request.method,
          headers: authHeaders(request),
          ...(request.body ? { body: JSON.stringify(request.body) } : {}),
        }),
      );
      reply.status(response.status);
      response.headers.forEach((value, key) => reply.header(key, value));
      return reply.send(response.body ? await response.text() : null);
    },
  });
  const session = async (
    request: any,
    reply: any,
    allowPasswordChange = false,
  ) => {
    const value = await authFor(request).api.getSession({
      headers: authHeaders(request),
    });
    if (!value) {
      reply.code(401).send({ ok: false, error: { code: "UNAUTHORIZED" } });
      return null;
    }
    const required = (await o.passwordChangeRequired?.(value.user.id)) ?? false;
    if (required && !allowPasswordChange) {
      reply.code(428).send({
        ok: false,
        error: { code: "PASSWORD_CHANGE_REQUIRED" },
      });
      return null;
    }
    return {
      ...value,
      user: { ...value.user, mustChangePassword: required },
    } as typeof value & {
      user: { role?: string; mustChangePassword: boolean };
    };
  };
  const writeAllowed = (role?: string) =>
    role === "operator" || role === "admin";
  const sameOrigin = (request: any) => {
    if (request.headers["sec-fetch-site"] === "cross-site") return false;
    const origin = request.headers.origin;
    if (!origin) return true;
    return new URL(origin).host === request.headers.host;
  };
  const resolveOAuthRedirectBase = (request: any) => {
    const normalize = (value?: string) => {
      if (!value) return undefined;
      try {
        const candidate = new URL(value);
        if (
          ["http:", "https:"].includes(candidate.protocol) &&
          !candidate.username &&
          !candidate.password
        )
          return `${candidate.protocol}//${candidate.host}`;
      } catch {
        return undefined;
      }
      return undefined;
    };
    const firstHeaderValue = (value?: string | string[]) =>
      Array.isArray(value) ? value[0] : value;
    const takeFirst = (value?: string) =>
      typeof value === "string" ? value.split(",")[0]?.trim() : undefined;
    const headerHost = takeFirst(
      firstHeaderValue(request.headers["x-forwarded-host"]),
    );
    const headerProto = takeFirst(
      firstHeaderValue(request.headers["x-forwarded-proto"]),
    );
    const hostFromForwarded = normalize(
      headerHost && headerProto
        ? `${headerProto}://${headerHost}`
        : undefined,
    );
    if (hostFromForwarded) return hostFromForwarded;
    return (
      hostFromForwarded ??
      normalize(o.larkOAuthRedirectBaseUrl) ??
      (typeof request.headers.host === "string"
        ? `${request.protocol}://${request.headers.host}`
        : undefined)
    );
  };
  const audit = (
    request: any,
    current: any,
    action: string,
    tenantId: string,
    outcome: "success" | "failure",
    details: Record<string, unknown> = {},
  ) =>
    centerFetch("governance", "/v1/audit", o.internalToken, {
      method: "POST",
      body: JSON.stringify({
        tenantId,
        actorId: current.user.id,
        action,
        resourceType: "platform-configuration",
        resourceId: tenantId,
        outcome,
        correlationId: request.id,
        details,
      }),
    }).catch(() => undefined);
  const configurationError = (reply: any, error: unknown) => {
    const statusCode =
      error instanceof z.ZodError
        ? 400
        : typeof (error as any)?.statusCode === "number"
          ? (error as any).statusCode
          : 502;
    return reply.code(statusCode).send({
      ok: false,
      error: {
        code:
          error instanceof z.ZodError
            ? "INVALID_CONFIGURATION"
            : "CONFIGURATION_OPERATION_FAILED",
        message:
          error instanceof Error
            ? error.message
            : "Configuration operation failed",
      },
    });
  };
  app.get("/api/me", async (request, reply) => {
    const value = await session(request, reply, true);
    return value ? { ok: true, data: value } : reply;
  });
  app.post("/api/account/change-password", async (request, reply) => {
    const current = await session(request, reply, true);
    if (!current) return reply;
    if (!sameOrigin(request))
      return reply
        .code(403)
        .send({ ok: false, error: { code: "ORIGIN_REJECTED" } });
    const body = z
      .object({
        currentPassword: z.string().min(1).max(128),
        newPassword: z.string().min(12).max(128),
      })
      .refine((value) => value.currentPassword !== value.newPassword, {
        message: "新密码不能与当前密码相同",
      })
      .parse(request.body);
    try {
      await authFor(request).api.changePassword({
        headers: authHeaders(request),
        body: { ...body, revokeOtherSessions: true },
      });
      await o.markPasswordChanged?.(current.user.id);
      void audit(
        request,
        current,
        "console.account.change-password",
        "default",
        "success",
      );
      return { ok: true, data: { changed: true } };
    } catch (error) {
      return reply.code(Number((error as any)?.statusCode ?? 400)).send({
        ok: false,
        error: {
          code: "PASSWORD_CHANGE_FAILED",
          message: error instanceof Error ? error.message : "密码修改失败",
        },
      });
    }
  });
  app.get("/api/centers/status", async (request, reply) => {
    if (!(await session(request, reply))) return reply;
    const entries = await Promise.all(
      Object.entries(centerUrls).map(async ([name]) => {
        const started = Date.now();
        const probe = (path: string) =>
          centerFetch(name as any, path, o.internalToken, {
            signal: AbortSignal.timeout(3_000),
          });
        const [healthResult, readinessResult, versionResult] =
          await Promise.allSettled([
            probe("/healthz"),
            probe("/readyz"),
            probe("/version"),
          ]);
        const health =
            healthResult.status === "fulfilled"
              ? healthResult.value
              : undefined,
          readiness =
            readinessResult.status === "fulfilled"
              ? readinessResult.value
              : undefined,
          versionResponse =
            versionResult.status === "fulfilled"
              ? versionResult.value
              : undefined,
          versionBody = versionResponse
            ? await versionResponse.json().catch(() => undefined)
            : undefined,
          rejected = [healthResult, readinessResult, versionResult].find(
            (result) => result.status === "rejected",
          );
        return [
          name,
          {
            ok: health?.ok ?? false,
            ready: readiness?.ok ?? false,
            status: health?.status ?? 0,
            readinessStatus: readiness?.status ?? 0,
            version: versionBody?.data?.version ?? versionBody?.version,
            latencyMs: Date.now() - started,
            ...(rejected?.status === "rejected"
              ? {
                  error:
                    rejected.reason instanceof Error
                      ? rejected.reason.message
                      : "unavailable",
                }
              : {}),
          },
        ];
      }),
    );
    return { ok: true, data: Object.fromEntries(entries) };
  });
  app.post("/api/assistant/query", async (request, reply) => {
    const current = await session(request, reply);
    if (!current) return reply;
    if (!sameOrigin(request))
      return reply
        .code(403)
        .send({ ok: false, error: { code: "ORIGIN_REJECTED" } });
    const body = z
      .object({
        tenantId: z.string().min(1).max(100).default("default"),
        question: z.string().trim().min(1).max(10000),
      })
      .parse(request.body);
    try {
      const result = await runSystemAssistant({
        ...body,
        actorRole: current.user.role ?? "viewer",
        internalToken: o.internalToken,
      });
      void centerFetch("governance", "/v1/audit", o.internalToken, {
        method: "POST",
        body: JSON.stringify({
          tenantId: body.tenantId,
          actorId: current.user.id,
          action: "console.system-assistant.query",
          resourceType: "system-assistant",
          resourceId: result.executionId,
          outcome: "success",
          correlationId: request.id,
          details: {
            navigation: result.navigation?.page,
            hasDraft: !!result.draft,
          },
        }),
      }).catch(() => undefined);
      return { ok: true, data: result };
    } catch (error) {
      const statusCode = Number((error as any)?.statusCode ?? 502);
      return reply.code(statusCode).send({
        ok: false,
        error: {
          code: String((error as any)?.code ?? "ASSISTANT_FAILED"),
          message: error instanceof Error ? error.message : "系统助手执行失败",
        },
      });
    }
  });
  app.post("/api/oauth/lark/start", async (request, reply) => {
    const current = await session(request, reply);
    if (!current) return reply;
    if (!sameOrigin(request))
      return reply
        .code(403)
        .send({ ok: false, error: { code: "ORIGIN_REJECTED" } });
    if (!writeAllowed(current.user.role))
      return reply.code(403).send({ ok: false, error: { code: "FORBIDDEN" } });
    const body = z
      .object({
        channelId: z.string().uuid(),
        scopes: z.array(z.string()).max(50).default([]),
      })
      .parse(request.body);
    const base = resolveOAuthRedirectBase(request);
    if (!base)
      return reply.code(503).send({
        ok: false,
        error: {
          code: "OAUTH_REDIRECT_NOT_CONFIGURED",
          message: "LARK_OAUTH_REDIRECT_BASE_URL 尚未配置",
        },
      });
    const redirectUri = new URL("/api/oauth/lark/callback", base).toString();
    const response = await centerFetch(
      "mg",
      `/v1/channels/${body.channelId}/oauth/lark/start`,
      o.internalToken,
      {
        method: "POST",
        body: JSON.stringify({
          actorId: current.user.id,
          redirectUri,
          scopes: body.scopes,
        }),
      },
    );
    const payload = await response.json();
    void audit(
      request,
      current,
      "console.lark-oauth.start",
      "default",
      response.ok ? "success" : "failure",
      { channelId: body.channelId, status: response.status },
    );
    return reply.code(response.status).send(payload);
  });
  app.get("/api/oauth/lark/callback", async (request, reply) => {
    const current = await session(request, reply);
    if (!current) return reply;
    const query = z
      .object({
        code: z.string().min(1).optional(),
        state: z.string().min(1).optional(),
        error: z.string().optional(),
      })
      .parse(request.query);
    if (query.error || !query.code || !query.state)
      return reply.redirect("/?larkOAuth=denied#channels");
    const response = await centerFetch(
      "mg",
      "/v1/oauth/lark/callback",
      o.internalToken,
      {
        method: "POST",
        body: JSON.stringify({
          code: query.code,
          state: query.state,
          actorId: current.user.id,
        }),
      },
    );
    const payload = (await response.json()) as any;
    void audit(
      request,
      current,
      "console.lark-oauth.callback",
      "default",
      response.ok ? "success" : "failure",
      { status: response.status, oauthStatus: payload?.data?.status },
    );
    return reply.redirect(
      `/?larkOAuth=${response.ok ? encodeURIComponent(payload?.data?.status ?? "authorized") : "failed"}#channels`,
    );
  });
  app.post("/api/oauth/lark/refresh", async (request, reply) => {
    const current = await session(request, reply);
    if (!current) return reply;
    if (!sameOrigin(request))
      return reply
        .code(403)
        .send({ ok: false, error: { code: "ORIGIN_REJECTED" } });
    if (!writeAllowed(current.user.role))
      return reply.code(403).send({ ok: false, error: { code: "FORBIDDEN" } });
    const { channelId } = z
      .object({ channelId: z.string().uuid() })
      .parse(request.body);
    const response = await centerFetch(
      "mg",
      `/v1/channels/${channelId}/oauth/lark/refresh`,
      o.internalToken,
      {
        method: "POST",
        body: JSON.stringify({ actorId: current.user.id }),
      },
    );
    const payload = await response.json();
    void audit(
      request,
      current,
      "console.lark-oauth.refresh",
      "default",
      response.ok ? "success" : "failure",
      { channelId, status: response.status },
    );
    return reply.code(response.status).send(payload);
  });
  app.get("/api/config/export", async (request, reply) => {
    const current = await session(request, reply);
    if (!current) return reply;
    if (current.user.role !== "admin")
      return reply
        .code(403)
        .send({ ok: false, error: { code: "ADMIN_REQUIRED" } });
    let tenantId = "default";
    try {
      tenantId = z
        .object({ tenantId: z.string().min(1).max(100).default("default") })
        .parse(request.query).tenantId;
      const bundle = await exportConfiguration(tenantId, o.internalToken);
      void audit(
        request,
        current,
        "console.configuration.export",
        tenantId,
        "success",
        {
          checksum: bundle.checksum,
        },
      );
      return reply
        .type("application/json; charset=utf-8")
        .header(
          "content-disposition",
          `attachment; filename="quarkfantools-${tenantId.replace(/[^a-zA-Z0-9._-]/g, "_")}-configuration.json"`,
        )
        .send(JSON.stringify(bundle, null, 2));
    } catch (error) {
      void audit(
        request,
        current,
        "console.configuration.export",
        tenantId,
        "failure",
      );
      return configurationError(reply, error);
    }
  });
  app.post("/api/config/import/preview", async (request, reply) => {
    const current = await session(request, reply);
    if (!current) return reply;
    if (current.user.role !== "admin")
      return reply
        .code(403)
        .send({ ok: false, error: { code: "ADMIN_REQUIRED" } });
    if (!sameOrigin(request))
      return reply
        .code(403)
        .send({ ok: false, error: { code: "ORIGIN_REJECTED" } });
    try {
      const preview = await previewConfiguration(
        z.object({ bundle: z.unknown() }).parse(request.body).bundle,
        o.internalToken,
      );
      return { ok: true, data: preview };
    } catch (error) {
      return configurationError(reply, error);
    }
  });
  app.post("/api/config/import", async (request, reply) => {
    const current = await session(request, reply);
    if (!current) return reply;
    if (current.user.role !== "admin")
      return reply
        .code(403)
        .send({ ok: false, error: { code: "ADMIN_REQUIRED" } });
    if (!sameOrigin(request))
      return reply
        .code(403)
        .send({ ok: false, error: { code: "ORIGIN_REJECTED" } });
    let tenantId = "unknown";
    try {
      const body = z
        .object({ bundle: z.unknown(), confirm: z.literal(true) })
        .parse(request.body);
      tenantId = String((body.bundle as any)?.tenantId ?? "unknown");
      const result = await importConfiguration(body.bundle, o.internalToken);
      await audit(
        request,
        current,
        "console.configuration.import",
        tenantId,
        "success",
        {
          imported: result.imported,
        },
      );
      return { ok: true, data: result };
    } catch (error) {
      await audit(
        request,
        current,
        "console.configuration.import",
        tenantId,
        "failure",
        {
          message: error instanceof Error ? error.message : "unknown",
        },
      );
      return configurationError(reply, error);
    }
  });
  app.route({
    method: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    url: "/api/center/:center/*",
    async handler(request, reply) {
      const current = await session(request, reply);
      if (!current) return reply;
      if (mutating.has(request.method)) {
        if (!sameOrigin(request))
          return reply
            .code(403)
            .send({ ok: false, error: { code: "ORIGIN_REJECTED" } });
        if (!writeAllowed(current.user.role))
          return reply
            .code(403)
            .send({ ok: false, error: { code: "FORBIDDEN" } });
      }
      const params = request.params as { center: string; "*": string };
      if (!isCenter(params.center))
        return reply
          .code(404)
          .send({ ok: false, error: { code: "CENTER_NOT_FOUND" } });
      if (
        current.user.role !== "admin" &&
        params.center === "governance" &&
        mutating.has(request.method)
      )
        return reply
          .code(403)
          .send({ ok: false, error: { code: "ADMIN_REQUIRED" } });
      const query = request.url.includes("?")
        ? request.url.slice(request.url.indexOf("?"))
        : "";
      const upstreamPath = `/${params["*"]}${query}`;
      if (
        current.user.role !== "admin" &&
        mutating.has(request.method) &&
        /^\/v1\/(?:runtime-providers|extensions)\/[^/]+\/lifecycle\//.test(
          upstreamPath,
        )
      )
        return reply
          .code(403)
          .send({ ok: false, error: { code: "ADMIN_REQUIRED" } });
      try {
        assertConsoleProxyPath(params.center, upstreamPath);
      } catch (error) {
        return reply.code(403).send({
          ok: false,
          error: {
            code: "SENSITIVE_PATH_REJECTED",
            message: error instanceof Error ? error.message : "Path rejected",
          },
        });
      }
      const response = await centerFetch(
        params.center,
        upstreamPath,
        o.internalToken,
        {
          method: request.method,
          body: request.body ? JSON.stringify(request.body) : undefined,
        },
      );
      const payload = Buffer.from(await response.arrayBuffer());
      reply
        .code(response.status)
        .type(response.headers.get("content-type") ?? "application/json");
      if (mutating.has(request.method))
        void centerFetch("governance", "/v1/audit", o.internalToken, {
          method: "POST",
          body: JSON.stringify({
            tenantId: "default",
            actorId: current.user.id,
            action: `console.${request.method.toLowerCase()}`,
            resourceType: params.center,
            resourceId: params["*"],
            outcome: response.ok ? "success" : "failure",
            correlationId: request.id,
            details: { status: response.status },
          }),
        }).catch(() => undefined);
      return reply.send(payload);
    },
  });
  if (o.staticRoot) {
    void app.register(fastifyStatic, {
      root: o.staticRoot,
      wildcard: false,
      index: false,
    });
    app.setNotFoundHandler((request, reply) => {
      if (request.url.startsWith("/api/"))
        return reply.code(404).send({ ok: false });
      return reply.sendFile("index.html");
    });
  }
  return app;
}
