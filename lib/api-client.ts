/** Web keeps same-origin fetch. The mobile entry installs its native transport. */
export type ApiTransport = (url: string, options?: RequestInit) => Promise<Response>;

let baseUrl = "";
let transport: ApiTransport = (url, options) => fetch(url, options);

export function configureApi(url: string, request: ApiTransport) {
  const parsed = new URL(url);
  if (!/^https?:$/.test(parsed.protocol) || parsed.username || parsed.password || parsed.search || parsed.hash || parsed.pathname !== "/") {
    throw new Error("API base URL must be an HTTP(S) origin without credentials, path, query or fragment.");
  }
  baseUrl = parsed.origin;
  transport = request;
}

export function apiFetch(path: string, options?: RequestInit): Promise<Response> {
  if (!/^\/api\//.test(path) || path.includes("\\") || path.includes("..")) {
    throw new Error("Expected an application API path.");
  }
  return transport(`${baseUrl}${path}`, options);
}
