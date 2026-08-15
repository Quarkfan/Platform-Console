import { beforeEach, describe, expect, it, vi } from "vitest";

const centerFetch = vi.hoisted(() => vi.fn());
vi.mock("./centers.js", async (load) => ({
  ...(await load<typeof import("./centers.js")>()),
  centerFetch,
}));

import {
  exportConfiguration,
  importConfiguration,
  previewConfiguration,
} from "./configuration.js";

const ids = {
  provider: "00000000-0000-4000-8000-000000000001",
  deployment: "00000000-0000-4000-8000-000000000002",
  policy: "00000000-0000-4000-8000-000000000003",
  channel: "00000000-0000-4000-8000-000000000004",
  sink: "00000000-0000-4000-8000-000000000005",
  route: "00000000-0000-4000-8000-000000000006",
  source: "00000000-0000-4000-8000-000000000007",
  contextBinding: "00000000-0000-4000-8000-000000000008",
  pkg: "00000000-0000-4000-8000-000000000009",
  capabilityBinding: "00000000-0000-4000-8000-000000000010",
  task: "00000000-0000-4000-8000-000000000011",
};
const data = {
  "mh:/v1/providers": [
    {
      id: ids.provider,
      name: "OpenAI",
      protocol: "openai",
      baseUrl: "https://api.openai.com/v1",
      credentialRef: "env:OPENAI_API_KEY",
      enabled: true,
      priority: 1,
      weight: 1,
      headers: {},
      status: "healthy",
      createdAt: "2026-08-16T00:00:00.000Z",
      updatedAt: "2026-08-16T00:00:00.000Z",
    },
  ],
  "mh:/v1/models": [
    {
      id: ids.deployment,
      providerId: ids.provider,
      modelId: "gpt-5",
      name: "GPT-5",
      kind: "chat",
      enabled: true,
      capabilities: ["tools"],
      metadata: {},
      createdAt: "2026-08-16T00:00:00.000Z",
      updatedAt: "2026-08-16T00:00:00.000Z",
    },
  ],
  "mh:/v1/routing-policies": [
    {
      id: ids.policy,
      name: "default",
      mode: "round-robin",
      deploymentIds: [ids.deployment],
      failoverOnFailure: true,
      maxAttempts: 2,
      enabled: true,
      cursor: 7,
      createdAt: "2026-08-16T00:00:00.000Z",
      updatedAt: "2026-08-16T00:00:00.000Z",
    },
  ],
  "runtime:/v1/bots?tenantId=tenant-a": [
    {
      id: "bot-a",
      tenantId: "tenant-a",
      name: "Assistant",
      enabled: true,
      runtime: "openai-agents",
      modelPolicyId: ids.policy,
      maxConcurrentExecutions: 1,
      autonomousReplyBeta: true,
      historyBackfillBeta: true,
      maxBackfillMessages: 100,
      createdAt: "2026-08-16T00:00:00.000Z",
      updatedAt: "2026-08-16T00:00:00.000Z",
    },
    {
      id: "platform-system-assistant-managed",
      tenantId: "tenant-a",
      name: "System Assistant",
      enabled: true,
      runtime: "model-tool-loop",
      purpose: "system-assistant",
      effectMode: "read-only",
      capabilityPolicy: "none",
      maxConcurrentExecutions: 4,
      autonomousReplyBeta: false,
      historyBackfillBeta: false,
      maxBackfillMessages: 0,
    },
  ],
  "mg:/v1/channels": [
    {
      id: ids.channel,
      tenantId: "tenant-a",
      channel: "lark",
      accountId: "cli_test",
      botId: "bot-a",
      name: "Lark",
      enabled: true,
      credentialRef: "governance:tenant-a:lark-secret",
      config: { transport: "long-connection" },
      status: "healthy",
      capabilities: ["messages.receive"],
      createdAt: "2026-08-16T00:00:00.000Z",
      updatedAt: "2026-08-16T00:00:00.000Z",
    },
    { id: "other", tenantId: "tenant-b" },
  ],
  "mg:/v1/sinks": [
    {
      id: ids.sink,
      name: "Runtime",
      kind: "runtime",
      endpoint: "http://runtime-center:4105/v1/executions",
      authTokenRef: "env:QFT_RUNTIME_SINK",
      enabled: true,
      timeoutMs: 300000,
      maxAttempts: 5,
      createdAt: "2026-08-16T00:00:00.000Z",
      updatedAt: "2026-08-16T00:00:00.000Z",
    },
  ],
  "mg:/v1/routes": [
    {
      id: ids.route,
      name: "route",
      botId: "bot-a",
      channelAccountId: ids.channel,
      sinkId: ids.sink,
      enabled: true,
      allowBotMessages: false,
      requireMention: true,
      autonomousReply: true,
      conversationTypes: ["dm", "group"],
      createdAt: "2026-08-16T00:00:00.000Z",
      updatedAt: "2026-08-16T00:00:00.000Z",
    },
  ],
  "ch:/v1/sources": [
    {
      id: ids.source,
      name: "Knowledge",
      kind: "manual",
      enabled: true,
      scope: { tenantId: "tenant-a", botIds: ["bot-a"] },
      config: {},
      status: "ready",
      createdAt: "2026-08-16T00:00:00.000Z",
      updatedAt: "2026-08-16T00:00:00.000Z",
    },
  ],
  "ch:/v1/bindings": [
    {
      id: ids.contextBinding,
      sourceId: ids.source,
      botId: "bot-a",
      enabled: true,
      priority: 1,
      tags: [],
      createdAt: "2026-08-16T00:00:00.000Z",
      updatedAt: "2026-08-16T00:00:00.000Z",
    },
  ],
  "cr:/v1/packages": [
    {
      id: ids.pkg,
      name: "tools",
      version: "1.0.0",
      source: { type: "builtin", ref: "platform" },
      contentHash: "hash-1",
      state: "enabled",
      installedAt: "2026-08-16T00:00:00.000Z",
      updatedAt: "2026-08-16T00:00:00.000Z",
      metadata: {},
    },
  ],
  "cr:/v1/capabilities": [
    {
      id: "tool.browser",
      packageId: ids.pkg,
      name: "Browser",
      description: "Browser tool",
      kind: "browser",
      version: "1.0.0",
      inputSchema: {},
      outputSchema: {},
      runtime: { type: "center", requirements: [] },
      permissions: ["browser.use"],
      risk: "medium",
      enabled: true,
      tags: [],
      createdAt: "2026-08-16T00:00:00.000Z",
      updatedAt: "2026-08-16T00:00:00.000Z",
    },
  ],
  "cr:/v1/bindings": [
    {
      id: ids.capabilityBinding,
      capabilityId: "tool.browser",
      botId: "bot-a",
      enabled: true,
      config: {},
      credentialRefs: ["governance:tenant-a:browser-secret"],
      allowedTriggers: ["agent"],
      createdAt: "2026-08-16T00:00:00.000Z",
      updatedAt: "2026-08-16T00:00:00.000Z",
    },
  ],
  "scheduler:/v1/tasks?tenantId=tenant-a": [
    {
      id: ids.task,
      tenantId: "tenant-a",
      botId: "bot-a",
      name: "Daily",
      enabled: true,
      schedule: { type: "daily", time: "08:00" },
      timezone: "Asia/Shanghai",
      target: { type: "runtime", payload: { prompt: "run" } },
      retry: { maxAttempts: 2, delaySeconds: 30 },
      misfire: "run-once",
      maxBackfill: 100,
      lastRunAt: "2026-08-16T00:00:00.000Z",
      nextRunAt: "2026-08-17T00:00:00.000Z",
      createdAt: "2026-08-16T00:00:00.000Z",
      updatedAt: "2026-08-16T00:00:00.000Z",
    },
  ],
} as Record<string, unknown>;

const response = (value: unknown, status = 200) =>
  new Response(JSON.stringify({ ok: status < 400, data: value }), {
    status,
    headers: { "content-type": "application/json" },
  });

describe("platform configuration bundles", () => {
  beforeEach(() => {
    centerFetch.mockReset();
    centerFetch.mockImplementation((center: string, path: string) =>
      Promise.resolve(response(data[`${center}:${path}`] ?? [])),
    );
  });

  it("exports a tenant-scoped, secret-free and restorable bundle", async () => {
    const bundle = await exportConfiguration("tenant-a", "token");

    expect(bundle.schemaVersion).toBe("quarkfantools.config.v1");
    expect(bundle.data.channels).toHaveLength(1);
    expect(bundle.data.bots).toHaveLength(1);
    expect(bundle.data.bots[0].id).toBe("bot-a");
    expect(bundle.data.channels[0].status).toBeUndefined();
    expect(bundle.data.capabilityManifests[0].packageId).toBe(ids.pkg);
    expect(bundle.data.scheduledTasks[0].lastRunAt).toBeUndefined();
    expect(bundle.secrets.included).toBe(false);
    expect(bundle.secrets.requirements).toEqual(
      expect.arrayContaining([
        "env:OPENAI_API_KEY",
        "env:QFT_RUNTIME_SINK",
        "governance:tenant-a:lark-secret",
        "governance:tenant-a:browser-secret",
      ]),
    );
    expect(JSON.stringify(bundle)).not.toContain("appSecret");
  });

  it("previews missing governance and unverifiable environment credentials", async () => {
    const bundle = await exportConfiguration("tenant-a", "token");
    centerFetch.mockImplementation((center: string, path: string) =>
      Promise.resolve(
        response(
          center === "governance" && path.startsWith("/v1/credentials")
            ? [{ id: "lark-secret" }]
            : [],
        ),
      ),
    );

    const preview = await previewConfiguration(bundle, "token");

    expect(preview.valid).toBe(true);
    expect(preview.missingSecrets).toEqual([
      "governance:tenant-a:browser-secret",
    ]);
    expect(preview.warnings.join(" ")).toContain("OPENAI_API_KEY");
    expect(preview.counts.bots).toBe(1);
  });

  it("rejects tampering before writing and imports package manifests together", async () => {
    const bundle = await exportConfiguration("tenant-a", "token");
    const tampered = structuredClone(bundle);
    tampered.data.bots[0].name = "Changed";
    await expect(importConfiguration(tampered, "token")).rejects.toThrow(
      "checksum",
    );

    centerFetch.mockReset();
    centerFetch.mockImplementation(
      (center: string, path: string, _token: string, init?: RequestInit) => {
        const body = init?.body ? JSON.parse(String(init.body)) : {};
        return Promise.resolve(
          response(
            path === "/v1/import"
              ? { package: { id: ids.pkg }, received: body }
              : { id: body.id ?? `${center}-${path}` },
            201,
          ),
        );
      },
    );

    const result = await importConfiguration(bundle, "token");
    const importCall = centerFetch.mock.calls.find(
      ([center, path]) => center === "cr" && path === "/v1/import",
    );
    const importBody = JSON.parse(String(importCall?.[3]?.body));

    expect(result.imported).toBe(12);
    expect(importBody.pkg.id).toBeUndefined();
    expect(importBody.manifests).toHaveLength(1);
    expect(importBody.manifests[0].id).toBe("tool.browser");
    expect(importBody.manifests[0].packageId).toBeUndefined();
    expect(
      centerFetch.mock.calls.map(([center, path]) => `${center}:${path}`),
    ).toEqual([
      "mh:/v1/providers",
      "mh:/v1/models",
      "mh:/v1/routing-policies",
      "runtime:/v1/bots",
      "mg:/v1/sinks",
      "mg:/v1/channels",
      "mg:/v1/routes",
      "ch:/v1/sources",
      "ch:/v1/bindings",
      "cr:/v1/import",
      "cr:/v1/bindings",
      "scheduler:/v1/tasks",
    ]);
  });
});
