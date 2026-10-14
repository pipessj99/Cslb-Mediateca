const API_BASE =
  (process.env.NEXT_PUBLIC_API_URL || 'https://mycloudex2ultra.tail905e79.ts.net').replace(/\/+$/, '');

const TOKEN_KEY = 'cslb_mediateca_token';

export const configured = !!API_BASE;

function token() {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem(TOKEN_KEY) || '';
}

function setToken(value: string) {
  if (typeof window === 'undefined') return;
  if (value) localStorage.setItem(TOKEN_KEY, value);
  else localStorage.removeItem(TOKEN_KEY);
}

async function request(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers || {});
  const t = token();
  if (t) headers.set('Authorization', `Bearer ${t}`);

  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
    cache: 'no-store',
  });

  const type = res.headers.get('content-type') || '';
  const data = type.includes('application/json') ? await res.json() : await res.text();

  if (!res.ok) {
    const message =
      typeof data === 'object' && data && 'error' in data
        ? String((data as {error?: unknown}).error || 'Error')
        : String(data || `Error ${res.status}`);
    throw new Error(message);
  }
  return data;
}

export async function register(name: string, email: string, password: string) {
  const data = await request('/api/auth/register', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({name, email, password}),
  }) as {token: string; user: unknown};
  setToken(data.token);
  return data.user;
}

export async function login(email: string, password: string) {
  const data = await request('/api/auth/login', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({email, password}),
  }) as {token: string; user: unknown};
  setToken(data.token);
  return data.user;
}

export async function currentUser() {
  if (!token()) return null;
  try {
    const data = await request('/api/me') as {user: unknown};
    return data.user;
  } catch {
    setToken('');
    return null;
  }
}

export async function signOut() {
  try {
    if (token()) await request('/api/auth/logout', {method: 'POST'});
  } finally {
    setToken('');
    window.location.reload();
  }
}

export async function loadLibrary() {
  return request('/api/library');
}

export async function mediaUrl(idOrPath: string) {
  const data = await request(`/api/media/${encodeURIComponent(idOrPath)}/url`) as {url: string};
  return data.url;
}

export async function saveLibrary(body: FormData | any) {
  if (body instanceof FormData) {
    return request('/api/media/upload', {
      method: 'POST',
      body,
    });
  }

  if (body.action === 'category') {
    return request('/api/category', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({name: body.name, description: body.description}),
    });
  }

  if (body.action === 'comment') {
    return request('/api/comment', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({media: body.media, body: body.body}),
    });
  }

  if (body.action === 'teacher') {
    return request('/api/teacher', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({email: body.email, remove: !!body.remove}),
    });
  }

  if (body.action === 'delete') {
    return request(`/api/media/${encodeURIComponent(body.id)}`, {
      method: 'DELETE',
    });
  }

  throw new Error('Acción no válida.');
}
