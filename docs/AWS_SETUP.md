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

## Qué protege qué
- El rol de despliegue solo lo puede asumir el workflow de la rama `main` de este repo.
- Ese rol tiene una política que **niega** leer o escribir items de DynamoDB: despliega infraestructura, no toca datos.
- La API exige un token JWT de Cognito. Cada registro se guarda con el `sub` del usuario, así que solo se lee lo propio.
- CORS permite únicamente `https://luisalberto1582.github.io`.
- La tabla tiene cifrado en reposo, respaldo con recuperación a un punto en el tiempo y no se borra si se elimina el stack.

## API
- `GET /state` → `{ state, updatedAt }` (`state: null` si aún no hay nada)
- `PUT /state` con `{ "state": { ... } }` → `{ ok, updatedAt }` (máx. 300 KB)

Ambas con el encabezado `Authorization: <IdToken de Cognito>`.

## Pendiente
Conectar el frontend: login con Cognito y sincronizar `mf_routines`, `mf_inbox`, `mf_schedule` con `/state`
(hoy solo usa `localStorage`).
