'use client';

import {FormEvent, useEffect, useState} from 'react';
import QRCode from 'qrcode';
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
  const [otpauthUri,setOtpauthUri] = useState('');
  const [qrData,setQrData] = useState('');

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

  useEffect(() => {
    let cancelled = false;

    if (!otpauthUri) {
      setQrData('');
      return;
    }

    QRCode.toDataURL(otpauthUri, {
      width: 240,
      margin: 2,
      errorCorrectionLevel: 'M',
    }).then(url => {
      if (!cancelled) setQrData(url);
    }).catch(() => {
      if (!cancelled) setQrData('');
    });

    return () => {
      cancelled = true;
    };
  }, [otpauthUri]);

  function handleAuthResult(result:AuthResult) {
    if ('token' in result) {
      setSigned(true);
      return;
    }

    setChallenge(result.challenge);

    if ('requires2faSetup' in result) {
      setSecret(result.secret);
      setOtpauthUri(result.otpauthUri);
      setStage('2fa-setup');
    } else {
      setSecret('');
      setOtpauthUri('');
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

  function resetAuth() {
    setStage('auth');
    setChallenge('');
    setSecret('');
    setOtpauthUri('');
    setQrData('');
    setMessage('');
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
            Escanea este código QR con Google Authenticator. Después escribe el código de 6 dígitos
            que aparece en la aplicación para terminar la configuración.
          </p>

          <div style={{
            display:'grid',
            placeItems:'center',
            margin:'20px 0',
          }}>
            {qrData ? (
              <div style={{
                background:'#fff',
                padding:'14px',
                border:'1px solid #d8e3db',
                borderRadius:'14px',
                boxShadow:'0 8px 30px #1232'
              }}>
                <img
                  src={qrData}
                  width={240}
                  height={240}
                  alt="Código QR para configurar Google Authenticator"
                  style={{display:'block',maxWidth:'100%',height:'auto'}}
                />
              </div>
            ) : (
              <div style={{
                width:240,
                height:240,
                display:'grid',
                placeItems:'center',
                background:'#f4f8f5',
                border:'1px solid #d8e3db',
                borderRadius:'14px',
                color:'#71807d',
                fontSize:'12px',
                textAlign:'center',
                padding:'20px'
              }}>
                Generando código QR…
              </div>
            )}
          </div>

          <p style={{textAlign:'center',fontSize:'12px'}}>
            Google Authenticator → <b>+</b> → <b>Escanear código QR</b>
          </p>

          <details style={{
            margin:'18px 0',
            border:'1px solid #e2e9e4',
            borderRadius:'8px',
            padding:'12px'
          }}>
            <summary style={{cursor:'pointer',fontSize:'12px',fontWeight:600}}>
              No puedo escanear el QR
            </summary>
            <p style={{fontSize:'12px'}}>
              También puedes usar la clave de configuración manual:
            </p>
            <div style={{
              padding:'12px',
              border:'1px solid #d8e3db',
              borderRadius:'8px',
              background:'#f4f8f5',
              fontFamily:'monospace',
              letterSpacing:'2px',
              textAlign:'center',
              wordBreak:'break-all',
              fontSize:'12px'
            }}>{secret}</div>
          </details>
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
          <button onClick={resetAuth}>Volver al inicio de sesión</button>
        </p>
      </>}

      {message && <p className="alert" role="status">{message}</p>}
      <small>Un espacio para aprender juntos.</small>
    </section>
  </div>;
}
