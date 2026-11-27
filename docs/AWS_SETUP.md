# Backend en AWS (DynamoDB + Lambda + Cognito)

El backend guarda el estado de la agenda de forma privada. GitHub Pages sigue sirviendo solo el frontend.
Nunca se guardan llaves de AWS en el repo ni en GitHub: Actions usa credenciales temporales (OIDC).

```
Pages (frontend) → API Gateway (JWT) → Lambda → DynamoDB
                          ↑
                  Cognito (login)
```

## Pasos (los haces tú, una sola vez)

1. **Crear el rol de despliegue.** En la consola de AWS → CloudFormation → *Create stack* → sube
   `infra/bootstrap-oidc.yaml`, nombre del stack `mindflow-bootstrap`. Marca la casilla de que crea recursos IAM.
   - Si tu cuenta ya tiene el proveedor `token.actions.githubusercontent.com`, pon `CreateOidcProvider = false`.
   - Al terminar, copia el valor `RoleArn` de la pestaña *Outputs*.
2. **Guardar el ARN en GitHub.** Repo → Settings → Secrets and variables → Actions → pestaña **Variables** →
   `AWS_ROLE_ARN` (el ARN) y, si no usas `us-east-1`, `AWS_REGION`. El ARN no es secreto, por eso es una variable.
3. **Desplegar.** Actions → *Desplegar backend en AWS* → *Run workflow* (después se despliega solo al fusionar
   cambios de `infra/` a `main`). Al terminar, el log de `sam deploy` muestra `ApiUrl`, `UserPoolId` y `UserPoolClientId`.
4. **Crear tu usuario.** Consola de AWS → Cognito → User pools → `mindflow-users` → *Create user* (tu correo).
   El registro abierto está desactivado.
5. **Presupuesto.** AWS Billing → Budgets → crea una alerta mensual (por ejemplo 5 USD).

## Alternativa: desplegar desde tu máquina
Solo necesitas el AWS CLI v2 (no SAM CLI).

1. **Permisos (una vez, como administrador en CloudShell).** Sube `infra/cloudshell-permisos.sh` a CloudShell
   (*Actions → Upload file*) y ejecútalo con `bash cloudshell-permisos.sh`. El script:
   - Crea el rol de la Lambda `mindflow-api-role`, que solo puede escribir logs y hacer `GetItem`/`PutItem` en tablas `mindflow-*`.
   - Agrega a la política inline `gymtracker-deploy` de `Developer1` las secciones `Mindflow*`
     (las mismas de `infra/local-deploy-policy.json`). No crea políticas nuevas, no toca las de gymtracker y
     guarda un respaldo en `~/gymtracker-deploy.respaldo-*.json`.
   - S3, API Gateway y DynamoDB no se agregan: ya los dan `AmazonS3FullAccess`, `AmazonAPIGatewayAdministrator` y
     `AmazonDynamoDBFullAccess`.
   - `Developer1` **no** puede crear roles: solo pasar `mindflow-api-role` a Lambda. Así no puede escalar a administrador.
2. Ejecuta desde la raíz del repo:
   ```powershell
   powershell -ExecutionPolicy Bypass -File infra\deploy.ps1            # perfil y región por defecto
   powershell -ExecutionPolicy Bypass -File infra\deploy.ps1 -AwsProfile otro -Region us-east-1
   ```
   El script crea (una vez) el bucket privado `mindflow-deploy-<cuenta>-<región>` para el código de la Lambda,
   despliega el stack `mindflow` y muestra `ApiUrl`, `UserPoolId` y `UserPoolClientId`.
3. Sigue con los pasos 4 y 5 de arriba.

El stack es el mismo que crea GitHub Actions, así que puedes alternar entre ambos métodos. Si el stack ya existía
con el rol que SAM creaba antes, el primer despliegue con `mindflow-api-role` debe borrar ese rol viejo: hazlo desde
GitHub Actions (su rol sí puede borrar roles `mindflow-*`), no con `Developer1`.

## Qué protege qué
- El rol de despliegue solo lo puede asumir el workflow de la rama `main` de este repo.
- Ese rol tiene una política que **niega** leer o escribir items de DynamoDB: despliega infraestructura, no toca datos.
- La API exige un token JWT de Cognito. Cada registro se guarda con el `sub` del usuario, así que solo se lee lo propio.
- CORS permite únicamente `https://luisalberto1582.github.io`.
- La tabla tiene cifrado en reposo, respaldo con recuperación a un punto en el tiempo y no se borra si se elimina el stack.

## API
- `GET /state` → `{ state, updatedAt }` (`state: null` si aún no hay nada)
- `PUT /state` con `{ "state": { ... }, "baseUpdatedAt": "<versión>" | null }` → `{ ok, updatedAt }` (máx. 300 KB).
  Si la nube ya no está en `baseUpdatedAt` responde `409` con `{ state, updatedAt }` actuales.
  Sin `baseUpdatedAt` sobrescribe sin revisar.

Ambas con el encabezado `Authorization: <IdToken de Cognito>`.

## Conectar el frontend
La app lee la configuración en tiempo de build. Sin ella funciona como antes (solo `localStorage`, sin login).

1. Copia las salidas del stack `mindflow` (CloudFormation → *Outputs*, o el final de `deploy.ps1`).
2. GitHub → Settings → Secrets and variables → Actions → pestaña **Variables**:
   | Variable | Toma el valor de la salida | Ejemplo de formato |
   |---|---|---|
   | `MINDFLOW_API_URL` | `ApiUrl` | `https://abc123xyz0.execute-api.us-east-1.amazonaws.com` |
   | `MINDFLOW_USER_POOL_ID` | `UserPoolId` | `us-east-1_AbCdEfGhI` |
   | `MINDFLOW_USER_POOL_CLIENT_ID` | `UserPoolClientId` | `1a2b3c4d5e6f7g8h9i0j1k2l3m` |

   Pega el **valor** de cada salida, no su nombre. Si el formato no es válido, la app se queda en modo local.

   No son secretos: terminan dentro del JavaScript público. La API exige el token de Cognito de todos modos.
3. Actions → *Publicar en GitHub Pages* → *Run workflow* para recompilar con esos valores.
4. Abre la página e inicia sesión con el usuario del paso 4. La primera vez Cognito pide cambiar la contraseña
   temporal; la app muestra ese paso.

Para probar en local: copia `.env.example` como `.env.local`, pon los mismos valores y ejecuta `npm run dev`
(CORS ya permite `http://localhost:5173`).

### Cómo sincroniza
- Se sincronizan rutinas (con sus días, bloques y tiempos medidos), la bandeja de tareas (con fecha y hora),
  el horario fijo y el registro diario de lo hecho (calendario de cumplimiento). La rutina paso a paso
  en curso se queda en el dispositivo donde empezó.
- `localStorage` sigue siendo la copia de trabajo: la app funciona sin conexión y sube los cambios al reconectar.
- Cada cambio se sube 1.5 s después de la última edición. Al volver a la pestaña se revisa si otro dispositivo
  guardó algo.
- Cada guardado indica sobre qué versión de la nube se hizo (`baseUpdatedAt`). Si otro dispositivo guardó antes,
  la API responde `409` y la app pregunta cuál versión conservar, en vez de sobrescribir en silencio.
- La primera vez que inicias sesión en un dispositivo que ya tenía datos: si la nube está vacía se suben; si no,
  la app pregunta cuál conservar.
- El indicador bajo el título muestra el estado (*En la nube*, *Guardando…*, *Sin conexión*, *Error*) y el botón *Salir*.
