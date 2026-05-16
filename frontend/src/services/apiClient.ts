const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api";

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

const getAuthHeaders = (): HeadersInit => {
  const token = localStorage.getItem("npis_token");
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
};

const getMultipartHeaders = (): HeadersInit => {
  const token = localStorage.getItem("npis_token");
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
};

const handleUnauthorized = (): void => {
  localStorage.removeItem("npis_token");
  localStorage.removeItem("npis_session");
  window.location.href = "/";
};

const parseResponse = async <T>(res: Response): Promise<T> => {
  if (res.status === 401) {
    handleUnauthorized();
    throw new ApiError("Unauthorized", 401);
  }
  // 204 No Content has no body. Treat as success and return an empty object
  // so res.json() is never called on an empty stream. 304 is intentionally
  // NOT handled here — callers issue cached GETs with cache: 'no-store' to
  // avoid 304s, because a 304 has no body and would erase response fields.
  if (res.status === 204) {
    return {} as T;
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(
      (body as { message?: string }).message ||
        `Request failed with status ${res.status}`,
      res.status,
    );
  }
  return body as T;
};

export const apiClient = {
  get: <T>(path: string): Promise<T> =>
    fetch(`${API_BASE_URL}${path}`, {
      headers: getAuthHeaders(),
      cache: "no-store",
    }).then(parseResponse<T>),

  post: <T>(path: string, body: unknown): Promise<T> =>
    fetch(`${API_BASE_URL}${path}`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(body),
    }).then(parseResponse<T>),

  put: <T>(path: string, body: unknown): Promise<T> =>
    fetch(`${API_BASE_URL}${path}`, {
      method: "PUT",
      headers: getAuthHeaders(),
      body: JSON.stringify(body),
    }).then(parseResponse<T>),

  patch: <T>(path: string, body: unknown): Promise<T> =>
    fetch(`${API_BASE_URL}${path}`, {
      method: "PATCH",
      headers: getAuthHeaders(),
      body: JSON.stringify(body),
    }).then(parseResponse<T>),

  postForm: <T>(path: string, body: FormData): Promise<T> =>
    fetch(`${API_BASE_URL}${path}`, {
      method: "POST",
      headers: getMultipartHeaders(),
      body,
    }).then(parseResponse<T>),
};
