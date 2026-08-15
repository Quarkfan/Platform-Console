export async function api<T = any>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(path, {
    credentials: "include",
    ...init,
    headers: {
      ...(init?.body ? { "content-type": "application/json" } : {}),
      ...init?.headers,
    },
  });
  const text = await response.text();
  let body: any;
  try {
    body = JSON.parse(text);
  } catch {
    body = { error: { message: text } };
  }
  if (!response.ok)
    throw new Error(body?.error?.message ?? `HTTP ${response.status}`);
  return body.data as T;
}
export const center = <T = any>(
  name: string,
  path: string,
  init?: RequestInit,
) => api<T>(`/api/center/${name}${path}`, init);
