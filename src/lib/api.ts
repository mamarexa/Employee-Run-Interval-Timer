import { useAuthStore } from '../store/useAuthStore';

const BASE = '';

function getHeaders(isAdmin = false): HeadersInit {
  const store = useAuthStore.getState();
  const token = store.token;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  void isAdmin; // admin uses the same JWT mechanism, just signed differently
  return headers;
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((body as { error?: string }).error ?? res.statusText);
  }
  return res.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string) =>
    fetch(`${BASE}${path}`, { headers: getHeaders() }).then(r => handleResponse<T>(r)),

  post: <T>(path: string, body?: unknown) =>
    fetch(`${BASE}${path}`, {
      method: 'POST',
      headers: getHeaders(),
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }).then(r => handleResponse<T>(r)),

  patch: <T>(path: string, body?: unknown) =>
    fetch(`${BASE}${path}`, {
      method: 'PATCH',
      headers: getHeaders(),
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }).then(r => handleResponse<T>(r)),

  del: <T>(path: string) =>
    fetch(`${BASE}${path}`, { method: 'DELETE', headers: getHeaders() }).then(r => handleResponse<T>(r)),

  // Admin-specific helper that uses the admin JWT stored separately
  adminPost: <T>(path: string, body?: unknown) =>
    fetch(`${BASE}${path}`, {
      method: 'POST',
      headers: (() => {
        const adminToken = sessionStorage.getItem('wt_admin');
        return {
          'Content-Type': 'application/json',
          ...(adminToken ? { Authorization: `Bearer ${adminToken}` } : {}),
        };
      })(),
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }).then(r => handleResponse<T>(r)),
};

/** Verify a magic link pass token and store auth state */
export async function verifyPass(pass: string): Promise<boolean> {
  try {
    const result = await fetch(`/api/auth/verify?pass=${encodeURIComponent(pass)}`).then(r =>
      handleResponse<{ token: string; user: { id: string; name: string } }>(r)
    );
    useAuthStore.getState().setAuth(pass, result.token, result.user);
    return true;
  } catch {
    return false;
  }
}

/** Silently refresh the JWT using the stored pass token */
export async function silentRefresh(): Promise<boolean> {
  const { pass } = useAuthStore.getState();
  if (!pass) return false;
  return verifyPass(pass);
}
