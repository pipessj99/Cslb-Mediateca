const API_BASE =
  (process.env.NEXT_PUBLIC_API_URL || 'https://mycloudex2ultra.tail905e79.ts.net').replace(/\/+$/, '');

const TOKEN_KEY = 'cslb_mediateca_token';

export const configured = !!API_BASE;

type AuthUser = {
  id:string;
  name:string;
  email:string;
  owner:boolean;
  teacher:boolean;
  twoFactorEnabled?:boolean;
  mustChangePassword?:boolean;
};

export type AuthResult =
  | {token:string; user:AuthUser}
  | {requiresPasswordChange:true; challenge:string; user:AuthUser}
  | {requires2fa:true; challenge:string; user:AuthUser}
  | {requires2faSetup:true; challenge:string; secret:string; otpauthUri:string; user:AuthUser};

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

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers,
      cache: 'no-store',
    });
  } catch {
    throw new Error('No se pudo conectar con el NAS. Revisa que el servidor y Tailscale estén encendidos.');
  }

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

function saveAuthResult(data: AuthResult) {
  if ('token' in data && data.token) setToken(data.token);
  return data;
}

export async function register(name: string, email: string, password: string) {
  const data = await request('/api/auth/register', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({name, email, password}),
  }) as AuthResult;
  return saveAuthResult(data);
}

export async function login(email: string, password: string) {
  const data = await request('/api/auth/login', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({email, password}),
  }) as AuthResult;
  return saveAuthResult(data);
}

export async function changeTemporaryPassword(challenge:string, newPassword:string) {
  const data = await request('/api/auth/change-temp-password', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({challenge, newPassword}),
  }) as AuthResult;
  return saveAuthResult(data);
}

export async function verify2fa(challenge:string, code:string) {
  const data = await request('/api/auth/2fa', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({challenge, code}),
  }) as {token:string; user:AuthUser};
  setToken(data.token);
  return data.user;
}

export async function currentUser() {
  if (!token()) return null;
  try {
    const data = await request('/api/me') as {user:AuthUser};
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

export async function mediaUrl(id: string) {
  const data = await request(`/api/media/${encodeURIComponent(id)}/url`) as {url: string};
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
      body: JSON.stringify({
        name: body.name,
        description: body.description,
        parent: body.parent || null,
      }),
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
      body: JSON.stringify({
        name: body.name || '',
        email: body.email,
        password: body.password || '',
        remove: !!body.remove,
      }),
    });
  }

  if (body.action === 'password') {
    return request('/api/account/password', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        currentPassword: body.currentPassword,
        newPassword: body.newPassword,
      }),
    });
  }

  if (body.action === 'delete') {
    return request(`/api/media/${encodeURIComponent(body.id)}`, {
      method: 'DELETE',
    });
  }

  throw new Error('Acción no válida.');
}
