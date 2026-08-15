import { createHash } from "node:crypto";
import { z } from "zod";
import { centerFetch, type CenterName } from "./centers.js";

const schemaVersion = "quarkfantools.config.v1" as const;
const dataSchema = z.object({
  modelProviders: z.array(z.record(z.string(), z.unknown())),
  modelDeployments: z.array(z.record(z.string(), z.unknown())),
  modelPolicies: z.array(z.record(z.string(), z.unknown())),
  bots: z.array(z.record(z.string(), z.unknown())),
  channels: z.array(z.record(z.string(), z.unknown())),
  sinks: z.array(z.record(z.string(), z.unknown())),
  routes: z.array(z.record(z.string(), z.unknown())),
  contextSources: z.array(z.record(z.string(), z.unknown())),
  contextBindings: z.array(z.record(z.string(), z.unknown())),
  capabilityPackages: z.array(z.record(z.string(), z.unknown())),
  capabilityManifests: z.array(z.record(z.string(), z.unknown())),
  capabilityBindings: z.array(z.record(z.string(), z.unknown())),
  scheduledTasks: z.array(z.record(z.string(), z.unknown())),
});
const bundleSchema = z.object({
  schemaVersion: z.literal(schemaVersion),
  exportedAt: z.string().datetime(),
  tenantId: z.string().min(1),
  checksum: z.string().regex(/^[a-f0-9]{64}$/),
  secrets: z.object({
    included: z.literal(false),
    requirements: z.array(z.string()),
  }),
  data: dataSchema,
});
export type ConfigurationBundle = z.infer<typeof bundleSchema>;

const checksum = (value: unknown) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");
const call = async (
  center: CenterName,
  path: string,
  token: string,
  init?: RequestInit,
) => {
  const response = await centerFetch(center, path, token, init),
    body = (await response.json()) as { data?: unknown; error?: unknown };
  if (!response.ok)
    throw new Error(`${center}${path} failed (${response.status})`);
  return body.data as any;
};
const omit = (value: Record<string, unknown>, fields: string[]) =>
  Object.fromEntries(
    Object.entries(value).filter(([key]) => !fields.includes(key)),
  );
const runtimeFields = ["createdAt", "updatedAt"];
const observedFields = [
  ...runtimeFields,
  "status",
  "lastHeartbeatAt",
  "lastError",
  "lastIngestedAt",
  "cursor",
];

export async function exportConfiguration(
  tenantId: string,
  token: string,
): Promise<ConfigurationBundle> {
  const [
    modelProviders,
    modelDeployments,
    modelPolicies,
    bots,
    allChannels,
    sinks,
    allRoutes,
    allSources,
    allContextBindings,
    capabilityPackages,
    capabilityManifests,
    allCapabilityBindings,
    scheduledTasks,
  ] = await Promise.all([
    call("mh", "/v1/providers", token),
    call("mh", "/v1/models", token),
    call("mh", "/v1/routing-policies", token),
    call("runtime", `/v1/bots?tenantId=${encodeURIComponent(tenantId)}`, token),
    call("mg", "/v1/channels", token),
    call("mg", "/v1/sinks", token),
    call("mg", "/v1/routes", token),
    call("ch", "/v1/sources", token),
    call("ch", "/v1/bindings", token),
    call("cr", "/v1/packages", token),
    call("cr", "/v1/capabilities", token),
    call("cr", "/v1/bindings", token),
    call(
      "scheduler",
      `/v1/tasks?tenantId=${encodeURIComponent(tenantId)}`,
      token,
    ),
  ]);
  const exportableBots = bots.filter(
      (item: any) => item.purpose !== "system-assistant",
    ),
    channels = allChannels.filter((item: any) => item.tenantId === tenantId),
    botIds = new Set(exportableBots.map((item: any) => item.id)),
    routes = allRoutes.filter((item: any) => botIds.has(item.botId)),
    sinkIds = new Set(routes.map((item: any) => item.sinkId)),
    selectedSinks = sinks.filter((item: any) => sinkIds.has(item.id)),
    contextSources = allSources.filter(
      (item: any) => item.scope?.tenantId === tenantId,
    ),
    sourceIds = new Set(contextSources.map((item: any) => item.id)),
    contextBindings = allContextBindings.filter((item: any) =>
      sourceIds.has(item.sourceId),
    ),
    capabilityBindings = allCapabilityBindings.filter((item: any) =>
      botIds.has(item.botId),
    ),
    capabilityIds = new Set(
      capabilityBindings.map((item: any) => item.capabilityId),
    ),
    selectedManifests = capabilityManifests.filter((item: any) =>
      capabilityIds.has(item.id),
    ),
    packageIds = new Set(selectedManifests.map((item: any) => item.packageId)),
    selectedPackages = capabilityPackages.filter((item: any) =>
      packageIds.has(item.id),
    ),
    requirements = [
      ...channels.map((item: any) => item.credentialRef),
      ...modelProviders.map((item: any) => item.credentialRef),
      ...selectedSinks.map((item: any) => item.authTokenRef),
      ...capabilityBindings.flatMap((item: any) => item.credentialRefs ?? []),
    ].filter((item): item is string => typeof item === "string" && !!item),
    data = {
      modelProviders: modelProviders.map((item: any) =>
        omit(item, observedFields),
      ),
      modelDeployments: modelDeployments.map((item: any) =>
        omit(item, runtimeFields),
      ),
      modelPolicies: modelPolicies.map((item: any) =>
        omit(item, observedFields),
      ),
      bots: exportableBots.map((item: any) => omit(item, runtimeFields)),
      channels: channels.map((item: any) => omit(item, observedFields)),
      sinks: selectedSinks.map((item: any) => omit(item, runtimeFields)),
      routes: routes.map((item: any) => omit(item, runtimeFields)),
      contextSources: contextSources.map((item: any) =>
        omit(item, observedFields),
      ),
      contextBindings: contextBindings.map((item: any) =>
        omit(item, runtimeFields),
      ),
      capabilityPackages: selectedPackages.map((item: any) =>
        omit(item, ["state", "installedAt", "updatedAt"]),
      ),
      capabilityManifests: selectedManifests.map((item: any) =>
        omit(item, runtimeFields),
      ),
      capabilityBindings: capabilityBindings.map((item: any) =>
        omit(item, ["id", ...runtimeFields]),
      ),
      scheduledTasks: scheduledTasks.map((item: any) =>
        omit(item, [
          "createdAt",
          "updatedAt",
          "lastRunAt",
          "nextRunAt",
          "runningRunId",
        ]),
      ),
    };
  return {
    schemaVersion,
    exportedAt: new Date().toISOString(),
    tenantId,
    checksum: checksum(data),
    secrets: { included: false, requirements: [...new Set(requirements)] },
    data,
  };
}

export async function previewConfiguration(bundle: unknown, token: string) {
  const parsed = bundleSchema.parse(bundle),
    validChecksum = checksum(parsed.data) === parsed.checksum,
    credentials = (await call(
      "governance",
      `/v1/credentials?tenantId=${encodeURIComponent(parsed.tenantId)}`,
      token,
    )) as Array<{ id: string }>,
    available = new Set(
      credentials.flatMap((item) => [
        item.id,
        `governance:${parsed.tenantId}:${item.id}`,
      ]),
    ),
    missingSecrets = parsed.secrets.requirements.filter(
      (requirement) =>
        requirement.startsWith("governance:") && !available.has(requirement),
    ),
    environmentSecrets = parsed.secrets.requirements.filter((requirement) =>
      requirement.startsWith("env:"),
    );
  return {
    valid: validChecksum,
    schemaVersion: parsed.schemaVersion,
    tenantId: parsed.tenantId,
    counts: Object.fromEntries(
      Object.entries(parsed.data).map(([key, values]) => [key, values.length]),
    ),
    missingSecrets,
    warnings: [
      ...(missingSecrets.length
        ? [
            "Missing credentials must be configured before dependent features work",
          ]
        : []),
      ...(environmentSecrets.length
        ? [
            `Environment credentials cannot be verified by the Console: ${environmentSecrets.join(", ")}`,
          ]
        : []),
      "Configuration import is cross-center and cannot be rolled back atomically",
    ],
  };
}

export async function importConfiguration(bundle: unknown, token: string) {
  const parsed = bundleSchema.parse(bundle);
  if (checksum(parsed.data) !== parsed.checksum)
    throw Object.assign(new Error("Configuration checksum mismatch"), {
      statusCode: 400,
    });
  const completed: Array<{ center: string; kind: string; id?: unknown }> = [];
  const save = async (
    center: CenterName,
    path: string,
    value: Record<string, unknown>,
    kind: string,
  ) => {
    const result = await call(center, path, token, {
      method: "POST",
      body: JSON.stringify(value),
    });
    completed.push({ center, kind, id: result?.id ?? result?.package?.id });
    return result;
  };
  for (const value of parsed.data.modelProviders)
    await save("mh", "/v1/providers", value, "model-provider");
  for (const value of parsed.data.modelDeployments)
    await save("mh", "/v1/models", value, "model-deployment");
  for (const value of parsed.data.modelPolicies)
    await save("mh", "/v1/routing-policies", value, "model-policy");
  for (const value of parsed.data.bots)
    await save("runtime", "/v1/bots", value, "bot");
  for (const value of parsed.data.sinks)
    await save("mg", "/v1/sinks", value, "message-sink");
  for (const value of parsed.data.channels)
    await save("mg", "/v1/channels", value, "channel");
  for (const value of parsed.data.routes)
    await save("mg", "/v1/routes", value, "message-route");
  for (const value of parsed.data.contextSources)
    await save("ch", "/v1/sources", value, "context-source");
  for (const value of parsed.data.contextBindings)
    await save("ch", "/v1/bindings", value, "context-binding");
  for (const pkg of parsed.data.capabilityPackages) {
    const manifests = parsed.data.capabilityManifests
      .filter((item) => item.packageId === pkg.id)
      .map((item) => omit(item, ["packageId"]));
    if (!manifests.length)
      throw Object.assign(
        new Error(
          `Capability package ${String(pkg.name ?? pkg.id)} has no manifests`,
        ),
        { statusCode: 400 },
      );
    await save(
      "cr",
      "/v1/import",
      {
        pkg: omit(pkg, ["id"]),
        manifests,
        strategy: "new",
      },
      "capability-package",
    );
  }
  for (const value of parsed.data.capabilityBindings)
    await save("cr", "/v1/bindings", value, "capability-binding");
  for (const value of parsed.data.scheduledTasks)
    await save("scheduler", "/v1/tasks", value, "scheduled-task");
  return { imported: completed.length, completed };
}
