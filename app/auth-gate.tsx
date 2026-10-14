'use client';

import {FormEvent, useEffect, useState} from 'react';
import {configured, currentUser, login, register} from '../lib/api';

export default function AuthGate({children}:{children:React.ReactNode}) {
  const [ready,setReady] = useState(false);
  const [signed,setSigned] = useState(false);
  const [mode,setMode] = useState('login');
  const [message,setMessage] = useState('');
  const [busy,setBusy] = useState(false);

  useEffect(() => {
    if (!configured) {
      setReady(true);
      return;
    }
    currentUser().then(user => {
      setSigned(!!user);
      setReady(true);
    }).catch(() => setReady(true));
  }, []);

  async function submit(e:FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setMessage('');
    const f = new FormData(e.currentTarget);

    try {
      const email = String(f.get('email') || '');
      const password = String(f.get('password') || '');

      if (mode === 'register') {
        await register(String(f.get('name') || ''), email, password);
      } else {
        await login(email, password);
      }

      setSigned(true);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'No se pudo iniciar sesión.');
    } finally {
      setBusy(false);
    }
  }

  if (!ready) return <div className="auth-wrap"><p>Cargando mediateca…</p></div>;
  if (signed) return children;

  return <div className="auth-wrap">
    <section className="auth-card">
      <a className="brand" href="/">
        <img src="/logo.png" alt="Logo CSLB"/>
        <span>CSLB<span className="brand-sub">MEDIATECA</span></span>
      </a>

      <span className="eyebrow">CREAR · COMPARTIR · APRENDER</span>

      <h1>{!configured ? 'Estamos preparando tu mediateca.' : mode === 'login' ? 'Bienvenido a tu comunidad.' : 'Tus ideas tienen un lugar.'}</h1>

      {!configured ? <>
        <p>Falta configurar la dirección del servidor del NAS.</p>
      </> : <>
        <p>{mode === 'login'
          ? 'Ingresa para compartir y explorar los trabajos de tu colegio.'
          : 'Crea tu cuenta. Los permisos de profesor los asigna el administrador.'}
        </p>

        <form onSubmit={submit}>
          {mode === 'register' && <label>
            Tu nombre
            <input name="name" required maxLength={80} autoComplete="name"/>
          </label>}

          <label>
            Correo electrónico
            <input name="email" type="email" required autoComplete="email"/>
          </label>

          <label>
            Contraseña
            <input
              name="password"
              type="password"
              minLength={10}
              maxLength={128}
              required
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            />
          </label>

          <button disabled={busy} className="primary full">
            {busy ? 'Un momento…' : mode === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}
          </button>
        </form>

        <p className="auth-switch">
          <button onClick={() => {
            setMode(mode === 'login' ? 'register' : 'login');
            setMessage('');
          }}>
            {mode === 'login' ? '¿Primera vez? Crea tu cuenta' : 'Ya tengo una cuenta'}
          </button>
        </p>

        {message && <p className="alert" role="status">{message}</p>}
      </>}

      <small>Un espacio para aprender juntos.</small>
    </section>
  </div>;
}
