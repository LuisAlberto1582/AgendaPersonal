// Pide iniciar sesión con Cognito antes de mostrar la agenda.
// Si la nube no está configurada, muestra la agenda directamente (modo solo local).
import React, { useEffect, useState } from 'react';
import { confirmSignIn, getCurrentUser, signIn, signOut } from 'aws-amplify/auth';
import { Loader2, LogIn, Sparkles } from 'lucide-react';
import { cloudEnabled } from './cloud.js';

const ERROR_MESSAGES = {
  NotAuthorizedException: 'Correo o contraseña incorrectos.',
  UserNotFoundException: 'Correo o contraseña incorrectos.',
  InvalidPasswordException: 'La contraseña nueva no cumple la política: mínimo 12 caracteres, con mayúsculas, minúsculas y números.',
  LimitExceededException: 'Demasiados intentos. Espera unos minutos.',
  TooManyRequestsException: 'Demasiados intentos. Espera unos minutos.',
  NetworkError: 'Sin conexión. Revisa tu internet.',
};

const errorText = (err) => ERROR_MESSAGES[err?.name] || err?.message || 'No se pudo iniciar sesión.';

export default function AuthGate({ children }) {
  if (!cloudEnabled) return children(null);
  return <CloudAuthGate>{children}</CloudAuthGate>;
}

function CloudAuthGate({ children }) {
  const [user, setUser] = useState(undefined); // undefined: revisando sesión guardada

  useEffect(() => {
    getCurrentUser().then(setUser, () => setUser(null));
  }, []);

  if (user === undefined) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  if (!user) return <LoginScreen onSignedIn={setUser} />;

  return children({
    email: user.signInDetails?.loginId || user.username,
    signOut: async () => {
      try {
        await signOut();
      } finally {
        setUser(null);
      }
    },
    onAuthLost: () => setUser(null),
  });
}

function LoginScreen({ onSignedIn }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [needsNewPassword, setNeedsNewPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const handleStep = async ({ isSignedIn, nextStep }) => {
    if (isSignedIn) {
      onSignedIn(await getCurrentUser());
    } else if (nextStep.signInStep === 'CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED') {
      setNeedsNewPassword(true);
    } else {
      setError(`Paso de inicio de sesión no soportado: ${nextStep.signInStep}`);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (needsNewPassword) {
        await handleStep(await confirmSignIn({ challengeResponse: newPassword }));
      } else {
        await handleStep(await signIn({ username: email.trim(), password }));
      }
    } catch (err) {
      if (err?.name === 'UserAlreadyAuthenticatedException') onSignedIn(await getCurrentUser());
      else setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  const inputClass = 'w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center px-4 font-sans">
      <form onSubmit={submit} className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-tr from-indigo-600 to-purple-600 p-2.5 rounded-xl text-white">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-bold text-lg text-white leading-tight">MindFlow Agenda</h1>
            <p className="text-xs text-slate-400">
              {needsNewPassword ? 'Elige una contraseña nueva para tu cuenta' : 'Inicia sesión para sincronizar tu agenda'}
            </p>
          </div>
        </div>

        {needsNewPassword ? (
          <label className="block space-y-1">
            <span className="text-xs text-slate-400">Contraseña nueva (mín. 12, mayúsculas, minúsculas y números)</span>
            <input type="password" autoComplete="new-password" required minLength={12} value={newPassword}
              onChange={e => setNewPassword(e.target.value)} className={inputClass} autoFocus />
          </label>
        ) : (
          <>
            <label className="block space-y-1">
              <span className="text-xs text-slate-400">Correo</span>
              <input type="email" autoComplete="username" required value={email}
                onChange={e => setEmail(e.target.value)} className={inputClass} autoFocus />
            </label>
            <label className="block space-y-1">
              <span className="text-xs text-slate-400">Contraseña</span>
              <input type="password" autoComplete="current-password" required value={password}
                onChange={e => setPassword(e.target.value)} className={inputClass} />
            </label>
          </>
        )}

        {error && <p className="text-xs text-rose-400">{error}</p>}

        <button type="submit" disabled={busy}
          className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white text-sm font-semibold rounded-lg py-2.5">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
          {needsNewPassword ? 'Guardar contraseña y entrar' : 'Entrar'}
        </button>
      </form>
    </div>
  );
}
