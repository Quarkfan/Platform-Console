import { describe, expect, it } from "vitest";
import { runSystemAssistant } from "./assistant.js";

const response = (data: unknown, status = 200) =>
  new Response(JSON.stringify({ ok: status < 400, data }), {
    status,
    headers: { "content-type": "application/json" },
  });

describe("system assistant orchestration", () => {
  it("uses a read-only zero-capability bot and sends only projected center data", async () => {
    const requests: Array<{ center: string; path: string; body?: any }> = [];
    const call = async (
      center: any,
      path: string,
      _token: string,
      init?: RequestInit,
    ) => {
      const body = init?.body ? JSON.parse(String(init.body)) : undefined;
      requests.push({ center, path, body });
      if (center === "mh" && path === "/v1/routing-policies")
        return response([
          {
            id: "00000000-0000-4000-8000-000000000001",
            name: "chat",
            enabled: true,
          },
        ]);
      if (center === "mg")
        return response([
          {
            id: "c1",
            name: "Feishu",
            credentialRef: "secret-ref",
            appSecret: "never",
          },
        ]);
      if (center === "runtime" && path.startsWith("/v1/bots?") && !init)
        return response([]);
      if (center === "runtime" && path === "/v1/bots")
        return response(body, 201);
      if (center === "runtime" && path === "/v1/executions")
        return response({ id: "execution-1", status: "queued" }, 202);
      if (center === "runtime" && path === "/v1/executions/execution-1")
        return response({
          id: "execution-1",
          status: "succeeded",
          response: JSON.stringify({
            answer: "飞书通道已配置。",
            navigation: { page: "channels", label: "查看通道" },
            draft: { kind: "channel", title: "调整通道", changes: [] },
          }),
        });
      return response([]);
    };
    const result = await runSystemAssistant({
      tenantId: "default",
      question: "飞书通道怎么样？",
      actorRole: "viewer",
      internalToken: "internal-secret",
      call,
      sleep: async () => undefined,
      maxPolls: 1,
    });
    const bot = requests.find(
      (item) =>
        item.center === "runtime" && item.path === "/v1/bots" && item.body,
    );
    expect(bot?.body).toMatchObject({
      purpose: "system-assistant",
      effectMode: "read-only",
      capabilityPolicy: "none",
    });
    const execution = requests.find(
      (item) => item.path === "/v1/executions",
    )?.body;
    expect(execution.prompt).toContain('"name":"Feishu"');
    expect(execution.prompt).not.toContain("secret-ref");
    expect(execution.prompt).not.toContain("never");
    expect(result).toMatchObject({
      answer: "飞书通道已配置。",
      navigation: { page: "channels" },
      executionId: "execution-1",
    });
  });

  it("rejects use until a chat model policy exists", async () => {
    await expect(
      runSystemAssistant({
        tenantId: "default",
        question: "status",
        actorRole: "admin",
        internalToken: "token",
        call: async () => response([]),
      }),
    ).rejects.toMatchObject({
      code: "ASSISTANT_MODEL_POLICY_REQUIRED",
      statusCode: 409,
    });
  });
});
