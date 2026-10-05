export const BASE = import.meta.env.VITE_API_URL || 'https://dispatch-server-wcdx.onrender.com';

async function handleResponse(res: Response) {
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Request failed');
  return data;
}

function getHeaders(customHeaders?: HeadersInit): HeadersInit {
  const token = localStorage.getItem('token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(customHeaders as Record<string, string>),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

export const api = {
  get: (url: string) =>
    fetch(`${BASE}${url}`, {
      credentials: 'include',
      headers: getHeaders(),
    }).then(handleResponse),
  post: (url: string, body?: unknown) =>
    fetch(`${BASE}${url}`, {
      method: 'POST',
      headers: getHeaders(),
      credentials: 'include',
      body: body ? JSON.stringify(body) : undefined,
    }).then(handleResponse),
  put: (url: string, body?: unknown) =>
    fetch(`${BASE}${url}`, {
      method: 'PUT',
      headers: getHeaders(),
      credentials: 'include',
      body: body ? JSON.stringify(body) : undefined,
    }).then(handleResponse),
  delete: (url: string) =>
    fetch(`${BASE}${url}`, {
      method: 'DELETE',
      headers: getHeaders(),
      credentials: 'include',
    }).then(handleResponse),
};
