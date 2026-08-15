import { createHash } from "node:crypto";
import { z } from "zod";
import { centerFetch, type CenterName } from "./centers.js";

type CenterCaller = (
  center: CenterName,
  path: string,
  token: string,
  init?: RequestInit,
) => Promise<Response>;

const pages = new Set([
  "overview",
  "bots",
  "channels",
  "messages",
  "context",
  "models",
  "capabilities",
  "executions",
  "schedules",
  "resources",
  "browser",
  "governance",
  "accounts",
  "settings",
]);

const answerSchema = z.object({
  answer: z.string().min(1).max(20000),
  navigation: z
    .object({ page: z.string(), label: z.string().min(1).max(80) })
    .optional(),
  draft: z
    .object({
      kind: z.string().min(1).max(80),
      title: z.string().min(1).max(160),
      changes: z.array(z.unknown()).max(100),
    })
    .optional(),
});

const systemPrompt = `You are QuarkfanTools Platform System Assistant (Beta).
Answer platform configuration, operation, diagnostics, and navigation questions from the supplied read-only snapshot.
Never claim to have changed configuration. Never ask for or reveal credentials, tokens, secrets, raw payloads, prompts, or user data.
You have no tools and cannot perform side effects. For requested changes, return a reviewable draft only.
Return JSON only: {"answer":"...","navigation":{"page":"allowed page id","label":"..."},"draft":{"kind":"...","title":"...","changes":[]}}.
Omit navigation or draft when unnecessary. Allowed page ids: ${[...pages].join(", ")}.`;

const itemProjection: Record<string, string[]> = {
  channels: ["id", "name", "type", "provider", "enabled", "status", "identity"],
  bots: ["id", "name", "description", "enabled", "runtime", "purpose"],
  providers: ["id", "name", "protocol", "enabled", "status"],
  models: ["id", "name", "modelId", "kind", "enabled", "status"],
  policies: ["id", "name", "kind", "mode", "enabled", "deploymentIds"],
  capabilities: ["id", "name", "kind", "enabled", "status", "supportLevel"],
  tasks: ["id", "name", "enabled", "status", "lastRunAt", "nextRunAt"],
  resources: ["id", "kind", "mediaType", "status", "size", "createdAt"],
  approvals: ["id", "action", "status", "createdAt", "expiresAt"],
};

function project(items: unknown, fields: string[]) {
  if (!Array.isArray(items)) return [];
  return items.slice(0, 20).map((item) => {
    if (!item || typeof item !== "object") return {};
    return Object.fromEntries(
      fields.flatMap((field) =>
        field in item
          ? [[field, (item as Record<string, unknown>)[field]]]
          : [],
      ),
    );
  });
}

function collection(items: unknown, fields: string[]) {
  return {
    count: Array.isArray(items) ? items.length : 0,
    items: project(items, fields),
    truncated: Array.isArray(items) && items.length > 20,
  };
}

async function data(
  call: CenterCaller,
  center: CenterName,
  path: string,
  token: string,
  init?: RequestInit,
) {
  const response = await call(center, path, token, init);
  const body = (await response.json()) as any;
  if (!response.ok)
    throw Object.assign(
      new Error(`${center}${path} failed (${response.status})`),
      {
        statusCode: 502,
      },
    );
  return body.data;
}

async function optionalData(
  call: CenterCaller,
  center: CenterName,
  path: string,
  token: string,
) {
  try {
    return await data(call, center, path, token);
  } catch {
    return [];
  }
}

function parseAnswer(value: string) {
  const candidate = value
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  try {
    const parsed = answerSchema.parse(JSON.parse(candidate));
    if (parsed.navigation && !pages.has(parsed.navigation.page))
      delete parsed.navigation;
    return parsed;
  } catch {
    const marker = value.search(/\n\s*Read-only platform snapshot:/i);
    const visible = (marker >= 0 ? value.slice(0, marker) : value).trim();
    return {
      answer: visible.slice(0, 4000) || "系统助手未返回可显示的内容。",
    };
  }
}

export async function runSystemAssistant(input: {
  tenantId: string;
  question: string;
  actorRole: string;
  internalToken: string;
  call?: CenterCaller;
  sleep?: (milliseconds: number) => Promise<void>;
  maxPolls?: number;
}) {
  const call = input.call ?? centerFetch;
  const tenant = encodeURIComponent(input.tenantId);
  const [
    channels,
    bots,
    providers,
    models,
    policies,
    capabilities,
    tasks,
    resources,
    approvals,
  ] = await Promise.all([
    optionalData(call, "mg", "/v1/channels", input.internalToken),
    optionalData(
      call,
      "runtime",
      `/v1/bots?tenantId=${tenant}`,
      input.internalToken,
    ),
    optionalData(call, "mh", "/v1/providers", input.internalToken),
    optionalData(call, "mh", "/v1/models", input.internalToken),
    data(call, "mh", "/v1/routing-policies", input.internalToken),
    optionalData(call, "cr", "/v1/capabilities", input.internalToken),
    optionalData(
      call,
      "scheduler",
      `/v1/tasks?tenantId=${tenant}`,
      input.internalToken,
    ),
    optionalData(
      call,
      "resource",
      `/v1/resources?tenantId=${tenant}`,
      input.internalToken,
    ),
    optionalData(
      call,
      "governance",
      `/v1/approvals?tenantId=${tenant}`,
      input.internalToken,
    ),
  ]);
  const policy = (Array.isArray(policies) ? policies : []).find(
    (item: any) =>
      item.enabled !== false && (!item.kind || item.kind === "chat"),
  );
  if (!policy?.id)
    throw Object.assign(
      new Error("系统助手需要一个已启用的聊天模型使用策略，请先在模型页配置。"),
      { statusCode: 409, code: "ASSISTANT_MODEL_POLICY_REQUIRED" },
    );

  const botId = `platform-system-assistant-${createHash("sha256")
    .update(input.tenantId)
    .digest("hex")
    .slice(0, 12)}`;
  await data(call, "runtime", "/v1/bots", input.internalToken, {
    method: "POST",
    body: JSON.stringify({
      id: botId,
      tenantId: input.tenantId,
      name: "系统助手",
      description: "Console 只读诊断、问答、导航和配置草稿助手",
      enabled: true,
      runtime: "model-tool-loop",
      modelPolicyId: policy.id,
      systemPrompt,
      purpose: "system-assistant",
      effectMode: "read-only",
      capabilityPolicy: "none",
      maxConcurrentExecutions: 4,
      autonomousReplyBeta: false,
      historyBackfillBeta: false,
      maxBackfillMessages: 0,
    }),
  });

  const snapshot = {
    generatedAt: new Date().toISOString(),
    tenantId: input.tenantId,
    actorRole: input.actorRole,
    channels: collection(channels, itemProjection.channels),
    bots: collection(
      Array.isArray(bots)
        ? bots.filter((item: any) => item.id !== botId)
        : bots,
      itemProjection.bots,
    ),
    providers: collection(providers, itemProjection.providers),
    models: collection(models, itemProjection.models),
    policies: collection(policies, itemProjection.policies),
    capabilities: collection(capabilities, itemProjection.capabilities),
    tasks: collection(tasks, itemProjection.tasks),
    resources: collection(resources, itemProjection.resources),
    approvals: collection(approvals, itemProjection.approvals),
  };
  const execution = await data(
    call,
    "runtime",
    "/v1/executions",
    input.internalToken,
    {
      method: "POST",
      body: JSON.stringify({
        tenantId: input.tenantId,
        botId,
        prompt: `User question:\n${input.question}\n\nRead-only platform snapshot:\n${JSON.stringify(snapshot)}`,
        conversationId: `console-system-assistant:${input.tenantId}`,
        source: { type: "console-system-assistant" },
      }),
    },
  );
  const sleep =
    input.sleep ??
    ((milliseconds) =>
      new Promise((resolve) => setTimeout(resolve, milliseconds)));
  for (let index = 0; index < (input.maxPolls ?? 120); index += 1) {
    const current = await data(
      call,
      "runtime",
      `/v1/executions/${encodeURIComponent(execution.id)}`,
      input.internalToken,
    );
    if (current.status === "succeeded")
      return {
        ...parseAnswer(String(current.response ?? "")),
        executionId: current.id,
      };
    if (["failed", "cancelled"].includes(current.status))
      throw Object.assign(
        new Error(current.error ?? `系统助手执行${current.status}`),
        {
          statusCode: 502,
          code: "ASSISTANT_EXECUTION_FAILED",
        },
      );
    await sleep(500);
  }
  throw Object.assign(new Error("系统助手响应超时，可在执行页继续查看状态。"), {
    statusCode: 504,
    code: "ASSISTANT_TIMEOUT",
  });
}
