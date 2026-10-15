'use client';

import {FormEvent, useEffect, useState} from 'react';
import {configured, currentUser, login, register, verify2fa, type AuthResult} from '../lib/api';

type Stage = 'auth' | '2fa' | '2fa-setup';

export default function AuthGate({children}:{children:React.ReactNode}) {
  const [ready,setReady] = useState(false);
  const [signed,setSigned] = useState(false);
  const [mode,setMode] = useState<'login'|'register'>('login');
  const [stage,setStage] = useState<Stage>('auth');
  const [message,setMessage] = useState('');
  const [busy,setBusy] = useState(false);
  const [challenge,setChallenge] = useState('');
  const [secret,setSecret] = useState('');

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

  function handleAuthResult(result:AuthResult) {
    if ('token' in result) {
      setSigned(true);
      return;
    }
    setChallenge(result.challenge);
    if ('requires2faSetup' in result) {
      setSecret(result.secret);
      setStage('2fa-setup');
    } else {
      setStage('2fa');
    }
  }

  async function submit(e:FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setMessage('');
    const f = new FormData(e.currentTarget);

    try {
      const email = String(f.get('email') || '');
      const password = String(f.get('password') || '');

      if (mode === 'register') {
        handleAuthResult(await register(String(f.get('name') || ''), email, password));
      } else {
        handleAuthResult(await login(email, password));
      }
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'No se pudo iniciar sesión.');
    } finally {
      setBusy(false);
    }
  }

  async function submit2fa(e:FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      const code = String(new FormData(e.currentTarget).get('code') || '');
      await verify2fa(challenge, code);
      setSigned(true);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Código incorrecto.');
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

      {stage === 'auth' ? <>
        <h1>{!configured ? 'Estamos preparando tu mediateca.' : mode === 'login' ? 'Bienvenido a tu comunidad.' : 'Tus ideas tienen un lugar.'}</h1>

        {!configured ? <p>Falta configurar la dirección del servidor del NAS.</p> : <>
          <p>{mode === 'login'
            ? 'Ingresa para ver y gestionar tus propios trabajos.'
            : 'Crea tu cuenta de estudiante. Los profesores se autorizan desde administración.'}
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
        </>}
      </> : <>
        <h1>{stage === '2fa-setup' ? 'Protege tu cuenta administradora.' : 'Código de administrador.'}</h1>

        {stage === '2fa-setup' ? <>
          <p>
            Esta cuenta tiene permisos de profesor/administrador. Abre Google Authenticator,
            pulsa <b>+</b> → <b>Introducir clave de configuración</b> y usa esta clave:
          </p>
          <div style={{
            padding:'14px',
            border:'1px solid #d8e3db',
            borderRadius:'8px',
            background:'#f4f8f5',
            fontFamily:'monospace',
            letterSpacing:'2px',
            textAlign:'center',
            wordBreak:'break-all',
            margin:'16px 0'
          }}>{secret}</div>
          <p>Google Authenticator generará un código de 6 dígitos que cambia cada 30 segundos.</p>
        </> : <p>Escribe el código de 6 dígitos que aparece en Google Authenticator.</p>}

        <form onSubmit={submit2fa}>
          <label>
            Código de 6 dígitos
            <input
              name="code"
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              minLength={6}
              autoComplete="one-time-code"
              placeholder="000000"
              required
              autoFocus
            />
          </label>
          <button disabled={busy} className="primary full">
            {busy ? 'Verificando…' : stage === '2fa-setup' ? 'Activar y entrar' : 'Verificar código'}
          </button>
        </form>

        <p className="auth-switch">
          <button onClick={() => {
            setStage('auth');
            setChallenge('');
            setSecret('');
            setMessage('');
          }}>Volver al inicio de sesión</button>
        </p>
      </>}

      {message && <p className="alert" role="status">{message}</p>}
      <small>Un espacio para aprender juntos.</small>
    </section>
  </div>;
}
