export const centerUrls = {
  mg: process.env.MG_URL ?? "http://127.0.0.1:4101",
  ch: process.env.CH_URL ?? "http://127.0.0.1:4102",
  mh: process.env.MH_URL ?? "http://127.0.0.1:4103",
  cr: process.env.CR_URL ?? "http://127.0.0.1:4104",
  runtime: process.env.RUNTIME_URL ?? "http://127.0.0.1:4105",
  scheduler: process.env.SCHEDULER_URL ?? "http://127.0.0.1:4106",
  resource: process.env.RESOURCE_URL ?? "http://127.0.0.1:4107",
  governance: process.env.GOVERNANCE_URL ?? "http://127.0.0.1:4108",
  browser: process.env.BROWSER_URL ?? "http://127.0.0.1:4110",
} as const;
export type CenterName = keyof typeof centerUrls;
export const isCenter = (value: string): value is CenterName =>
  value in centerUrls;
export function assertCenterPath(path: string) {
  if (!/^\/(healthz|readyz|version|v1(?:\/|$))/.test(path))
    throw Object.assign(new Error("Center path is not allowed"), {
      statusCode: 403,
    });
  return path;
}
export function assertConsoleProxyPath(center: CenterName, path: string) {
  assertCenterPath(path);
  const pathname = path.split("?", 1)[0];
  if (
    center === "governance" &&
    /^\/v1\/credentials\/[^/]+\/resolve\/?$/.test(pathname)
  )
    throw Object.assign(
      new Error("Sensitive credential resolution is not exposed by Console"),
      { statusCode: 403 },
    );
  if (
    center === "mg" &&
    (/^\/v1\/oauth\/lark\/callback\/?$/.test(pathname) ||
      /^\/v1\/channels\/[^/]+\/oauth\/lark\/(start|refresh)\/?$/.test(pathname))
  )
    throw Object.assign(
      new Error(
        "Lark OAuth is exposed only through the identity-bound Console flow",
      ),
      { statusCode: 403 },
    );
  return path;
}
export async function centerFetch(
  center: CenterName,
  path: string,
  token: string,
  init?: RequestInit,
) {
  assertCenterPath(path);
  return fetch(`${centerUrls[center]}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${token}`,
      ...(init?.body ? { "content-type": "application/json" } : {}),
      ...init?.headers,
    },
    signal: AbortSignal.timeout(300000),
  });
}
