// Conexión con el backend de AWS (Cognito + API /state).
// Los valores vienen de variables de Vite en tiempo de build; si faltan, la app funciona solo con localStorage.
import { Amplify } from 'aws-amplify';
import { fetchAuthSession } from 'aws-amplify/auth';

const env = import.meta.env;
const apiUrl = (env.VITE_API_URL || '').replace(/\/+$/, '');
const userPoolId = env.VITE_COGNITO_USER_POOL_ID || '';
const userPoolClientId = env.VITE_COGNITO_CLIENT_ID || '';

export const cloudEnabled = Boolean(apiUrl && userPoolId && userPoolClientId);

if (cloudEnabled) {
  Amplify.configure({ Auth: { Cognito: { userPoolId, userPoolClientId } } });
}

// La sesión ya no es válida (refresh token vencido o revocado): hay que volver a iniciar sesión
export class AuthLostError extends Error {}

async function request(method, body) {
  const { tokens } = await fetchAuthSession();
  const idToken = tokens?.idToken?.toString();
  if (!idToken) throw new AuthLostError('sin sesión');

  const res = await fetch(`${apiUrl}/state`, {
    method,
    headers: { authorization: idToken, ...(body && { 'content-type': 'application/json' }) },
    body,
  });
  if (res.status === 401) throw new AuthLostError('token rechazado');
  return res;
}

// → { state, updatedAt } (state es null si todavía no hay nada guardado)
export async function getState() {
  const res = await request('GET');
  if (!res.ok) throw new Error(`GET /state ${res.status}`);
  return res.json();
}

// stateJson: el estado ya serializado. baseUpdatedAt: la versión de la nube sobre la que se hicieron los cambios.
// → { updatedAt } si se guardó, o { conflict: true, state, updatedAt } si otro dispositivo guardó antes.
export async function putState(stateJson, baseUpdatedAt) {
  const res = await request('PUT', `{"state":${stateJson},"baseUpdatedAt":${JSON.stringify(baseUpdatedAt)}}`);
  if (res.status === 409) return { conflict: true, ...(await res.json()) };
  if (!res.ok) throw new Error(`PUT /state ${res.status}`);
  return res.json();
}
