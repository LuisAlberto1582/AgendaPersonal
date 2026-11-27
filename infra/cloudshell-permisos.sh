#!/usr/bin/env bash
# Ejecutar en AWS CloudShell con un usuario administrador. Se puede correr varias veces.
#  1. Crea el rol de ejecución de la Lambda (mindflow-api-role): solo logs + GetItem/PutItem en la tabla.
#  2. Agrega a la política inline "gymtracker-deploy" de Developer1 lo que falta para desplegar MindFlow.
#     No crea políticas nuevas ni toca las secciones de gymtracker. S3, API Gateway y DynamoDB ya los cubren
#     AmazonS3FullAccess, AmazonAPIGatewayAdministrator y AmazonDynamoDBFullAccess.
#     Developer1 NO recibe permisos para crear roles (evita que pueda escalar a administrador).
set -euo pipefail

ACCOUNT=043484001203
REGION=us-east-1
USER_NAME=Developer1
POLICY_NAME=gymtracker-deploy
ROLE_NAME=mindflow-api-role

if [ "$(aws sts get-caller-identity --query Account --output text)" != "$ACCOUNT" ]; then
  echo "Esta sesión no es de la cuenta $ACCOUNT" >&2; exit 1
fi

# --- 1. Rol de la Lambda ---
if aws iam get-role --role-name "$ROLE_NAME" >/dev/null 2>&1; then
  echo "El rol $ROLE_NAME ya existe"
else
  aws iam create-role --role-name "$ROLE_NAME" \
    --description "Ejecucion de la Lambda de MindFlow" \
    --assume-role-policy-document '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"lambda.amazonaws.com"},"Action":"sts:AssumeRole"}]}' \
    >/dev/null
  echo "Rol $ROLE_NAME creado"
fi
aws iam attach-role-policy --role-name "$ROLE_NAME" \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole
aws iam put-role-policy --role-name "$ROLE_NAME" --policy-name mindflow-state-table --policy-document "{
  \"Version\": \"2012-10-17\",
  \"Statement\": [{
    \"Effect\": \"Allow\",
    \"Action\": [\"dynamodb:GetItem\", \"dynamodb:PutItem\"],
    \"Resource\": \"arn:aws:dynamodb:$REGION:$ACCOUNT:table/mindflow-*\"
  }]
}"
echo "Permisos del rol listos (logs + GetItem/PutItem en tablas mindflow-*)"

# --- 2. Agregar MindFlow a la política inline existente ---
backup=~/"$POLICY_NAME.respaldo-$(date +%Y%m%d-%H%M%S).json"
aws iam get-user-policy --user-name "$USER_NAME" --policy-name "$POLICY_NAME" \
  --query PolicyDocument --output json > "$backup"
echo "Respaldo de la política actual: $backup"

cat > /tmp/mindflow-statements.json <<EOF
[
  {
    "Sid": "MindflowStack",
    "Effect": "Allow",
    "Action": ["cloudformation:Describe*", "cloudformation:GetTemplate", "cloudformation:*ChangeSet"],
    "Resource": [
      "arn:aws:cloudformation:$REGION:$ACCOUNT:stack/mindflow/*",
      "arn:aws:cloudformation:$REGION:aws:transform/Serverless-2016-10-31"
    ]
  },
  {
    "Sid": "MindflowPasarRolALambda",
    "Effect": "Allow",
    "Action": "iam:PassRole",
    "Resource": "arn:aws:iam::$ACCOUNT:role/$ROLE_NAME",
    "Condition": {"StringEquals": {"iam:PassedToService": "lambda.amazonaws.com"}}
  },
  {
    "Sid": "MindflowLambda",
    "Effect": "Allow",
    "Action": [
      "lambda:CreateFunction", "lambda:DeleteFunction", "lambda:GetFunction",
      "lambda:UpdateFunctionCode", "lambda:UpdateFunctionConfiguration",
      "lambda:GetPolicy", "lambda:AddPermission", "lambda:RemovePermission", "lambda:*Tag*"
    ],
    "Resource": "arn:aws:lambda:$REGION:$ACCOUNT:function:mindflow-*"
  },
  {
    "Sid": "MindflowCrearUserPool",
    "Effect": "Allow",
    "Action": "cognito-idp:CreateUserPool",
    "Resource": "*"
  },
  {
    "Sid": "MindflowUserPool",
    "Effect": "Allow",
    "Action": [
      "cognito-idp:DescribeUserPool", "cognito-idp:UpdateUserPool",
      "cognito-idp:*UserPoolClient", "cognito-idp:*UserPoolMfaConfig", "cognito-idp:*Tag*"
    ],
    "Resource": "arn:aws:cognito-idp:$REGION:$ACCOUNT:userpool/*"
  }
]
EOF

python3 - "$backup" /tmp/mindflow-statements.json /tmp/merged-policy.json <<'PY'
import json, sys
current = json.load(open(sys.argv[1]))
new = json.load(open(sys.argv[2]))
# Quita versiones anteriores de MindFlow (si el script ya se corrió) y conserva todo lo demás tal cual
kept = [s for s in current['Statement'] if not str(s.get('Sid', '')).startswith('Mindflow')]
current['Statement'] = kept + new
size = len(json.dumps(current, separators=(',', ':')))
print(f"Secciones conservadas: {[s.get('Sid') for s in kept]}")
print(f"Secciones de MindFlow: {[s['Sid'] for s in new]}")
print(f"Tamaño: {size} de 2048 caracteres permitidos para políticas inline de un usuario")
if size > 2048:
    sys.exit("Se pasa del límite; no se aplicó nada")
json.dump(current, open(sys.argv[3], 'w'), indent=2)
PY

aws iam put-user-policy --user-name "$USER_NAME" --policy-name "$POLICY_NAME" \
  --policy-document file:///tmp/merged-policy.json
echo "Política $POLICY_NAME actualizada"

# --- Estado del stack (para saber cómo hacer el primer despliegue) ---
status=$(aws cloudformation describe-stacks --stack-name mindflow --region "$REGION" \
  --query 'Stacks[0].StackStatus' --output text 2>/dev/null || echo NO_EXISTE)
echo "Stack mindflow: $status"
