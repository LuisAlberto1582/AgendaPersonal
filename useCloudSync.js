// Sincroniza el estado de la agenda con la nube.
// localStorage sigue siendo la copia de trabajo (funciona sin conexión); la nube es el respaldo compartido entre dispositivos.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AuthLostError, getState, putState } from './cloud.js';

const META_KEY = 'mf_sync_meta';
const SAVE_DELAY_MS = 1500;

// serverUpdatedAt: versión de la nube con la que coincidía este dispositivo la última vez.
// dirty: hay cambios locales que aún no se suben.
const readMeta = () => {
  try {
    const saved = JSON.parse(localStorage.getItem(META_KEY));
    if (saved && typeof saved === 'object') return saved;
  } catch {}
  // Primera sincronización en este dispositivo: si ya se usaba la app, sus datos cuentan como cambios sin subir
  return { serverUpdatedAt: null, dirty: localStorage.getItem('mf_routines') !== null || localStorage.getItem('mf_inbox') !== null };
};

const askKeepCloud = (reason) => window.confirm(
  `${reason}\n\nAceptar: usar los datos de la nube (se descartan los de este dispositivo).\nCancelar: conservar los de este dispositivo y sobrescribir la nube.`
);

/**
 * enabled: hay sesión iniciada.
 * state: objeto memoizado con lo que se sincroniza.
 * applyRemote(state): reemplaza el estado local con el de la nube.
 * onAuthLost(): la sesión venció.
 * Devuelve el estado: 'off' | 'loading' | 'saving' | 'synced' | 'offline' | 'error'
 */
export function useCloudSync({ enabled, state, applyRemote, onAuthLost }) {
  const [status, setStatus] = useState(enabled ? 'loading' : 'off');
  const json = useMemo(() => JSON.stringify(state), [state]);

  const jsonRef = useRef(json);
  jsonRef.current = json;
  const initialJsonRef = useRef(json);
  const metaRef = useRef(null);
  if (metaRef.current === null) metaRef.current = readMeta();
  const lastJsonRef = useRef(null); // lo que tiene la nube según este dispositivo
  const readyRef = useRef(false);   // ya terminó la primera lectura de la nube
  const busyRef = useRef(false);
  const pendingPushRef = useRef(false);
  const callbacks = useRef({ applyRemote, onAuthLost });
  callbacks.current = { applyRemote, onAuthLost };

  const saveMeta = (meta) => {
    metaRef.current = meta;
    localStorage.setItem(META_KEY, JSON.stringify(meta));
  };

  const adoptRemote = (remote) => {
    lastJsonRef.current = JSON.stringify(remote.state);
    saveMeta({ serverUpdatedAt: remote.updatedAt, dirty: false });
    callbacks.current.applyRemote(remote.state);
  };

  // Sube los cambios locales hasta que la nube quede igual que este dispositivo
  const pushLoop = async () => {
    while (jsonRef.current !== lastJsonRef.current) {
      const body = jsonRef.current;
      setStatus('saving');
      const res = await putState(body, metaRef.current.serverUpdatedAt);
      if (res.conflict) {
        if (res.state && askKeepCloud('Otro dispositivo guardó cambios en la nube mientras editabas aquí.')) {
          adoptRemote(res);
          return;
        }
        // Conservar lo local: reintentar sobre la versión actual de la nube
        saveMeta({ serverUpdatedAt: res.updatedAt, dirty: true });
        continue;
      }
      lastJsonRef.current = body;
      saveMeta({ serverUpdatedAt: res.updatedAt, dirty: jsonRef.current !== body });
    }
  };

  // Ejecuta una tarea de sincronización a la vez y traduce los errores a un estado visible.
  // Una subida pedida mientras había otra tarea en curso se reintenta al terminar.
  const run = useCallback(async (task, isPush = false) => {
    if (busyRef.current) {
      if (isPush) pendingPushRef.current = true;
      return;
    }
    busyRef.current = true;
    try {
      await task();
      setStatus('synced');
    } catch (err) {
      if (err instanceof AuthLostError) {
        callbacks.current.onAuthLost();
        return;
      }
      console.error('Sincronización con la nube:', err);
      // fetch lanza TypeError si no hay red; Amplify lanza NetworkError si no pudo renovar el token
      const offline = !navigator.onLine || err instanceof TypeError || err?.name === 'NetworkError';
      setStatus(offline ? 'offline' : 'error');
    } finally {
      busyRef.current = false;
    }
    if (pendingPushRef.current) {
      pendingPushRef.current = false;
      // Con pausa, para que React ya haya aplicado los datos de la nube si se adoptaron
      setTimeout(() => run(pushLoop, true), SAVE_DELAY_MS);
    }
  }, []);

  // Trae la versión de la nube y decide si se usa, se ignora o se sobrescribe
  const pull = useCallback(() => run(async () => {
    const remote = await getState();
    const meta = metaRef.current;
    readyRef.current = true;

    if (remote.state && JSON.stringify(remote.state) === jsonRef.current) {
      lastJsonRef.current = jsonRef.current;
      saveMeta({ serverUpdatedAt: remote.updatedAt, dirty: false });
      return;
    }
    if (remote.state && remote.updatedAt !== meta.serverUpdatedAt) {
      // La nube cambió desde la última vez
      if (!meta.dirty || askKeepCloud('Hay datos en la nube distintos a los de este dispositivo.')) {
        adoptRemote(remote);
        return;
      }
      saveMeta({ serverUpdatedAt: remote.updatedAt, dirty: true });
    } else if (!remote.state) {
      // Nube vacía (primera vez): se sube lo de este dispositivo
      saveMeta({ serverUpdatedAt: null, dirty: true });
    } else if (!meta.dirty) {
      // Nube sin cambios y nada pendiente aquí
      lastJsonRef.current = jsonRef.current;
      return;
    }
    await pushLoop();
  }), [run]);

  // Primera lectura al iniciar sesión, y de nuevo al volver a la pestaña o recuperar la conexión
  useEffect(() => {
    if (!enabled) return;
    pull();
    const onVisible = () => document.visibilityState === 'visible' && pull();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', pull);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', pull);
    };
  }, [enabled, pull]);

  // Cambios locales: se marcan como pendientes al instante y se suben tras una pausa.
  // Si la nube aún no responde (sin conexión al abrir), solo se marcan y se suben al reconectar.
  useEffect(() => {
    if (!enabled) return;
    if (json === (readyRef.current ? lastJsonRef.current : initialJsonRef.current)) return;
    if (!metaRef.current.dirty) saveMeta({ ...metaRef.current, dirty: true });
    if (!readyRef.current) return;
    const id = setTimeout(() => run(pushLoop, true), SAVE_DELAY_MS);
    return () => clearTimeout(id);
  }, [enabled, json, run]);

  return enabled ? status : 'off';
}
