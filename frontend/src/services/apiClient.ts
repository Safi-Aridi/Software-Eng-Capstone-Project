// TODO: Replace mock implementations in all services with calls through this client
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000/api";

export class ApiError extends Error {
  statusCode: number;
  field?: string;

  constructor(message: string, statusCode: number, field?: string) {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
    this.field = field;
  }
}

const getAuthHeaders = (): HeadersInit => {
  const session = localStorage.getItem("npis_user");
  if (!session) return { "Content-Type": "application/json" };
  try {
    const { token } = JSON.parse(session);
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    };
  } catch {
    return { "Content-Type": "application/json" };
  }
};

const parseResponse = async <T>(res: Response): Promise<T> => {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(
      (body as { message?: string }).message ||
        `Request failed with status ${res.status}`,
      res.status,
      (body as { field?: string }).field,
    );
  }
  return body as T;
};

export const apiClient = {
  get: <T>(path: string): Promise<T> =>
    fetch(`${API_BASE_URL}${path}`, { headers: getAuthHeaders() }).then(
      parseResponse<T>,
    ),

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
};
