# Despliega el stack "mindflow" desde esta máquina usando solo el AWS CLI (no requiere SAM CLI).
# La Lambda solo usa el AWS SDK incluido en el runtime de Node, así que no hay paso de build.
# Uso: powershell -ExecutionPolicy Bypass -File infra\deploy.ps1 [-AwsProfile perfil] [-Region us-east-1]
param(
  [string]$AwsProfile = '',
  [string]$Region = '',
  [string]$StackName = 'mindflow'
)

function Invoke-Aws {
  aws @args
  if ($LASTEXITCODE -ne 0) { throw "Falló: aws $args" }
}

if ($AwsProfile) { $env:AWS_PROFILE = $AwsProfile }
if (-not $Region) { $Region = aws configure get region }
if (-not $Region) { $Region = 'us-east-1' }
$env:AWS_REGION = $Region
$env:AWS_DEFAULT_REGION = $Region

$account = Invoke-Aws sts get-caller-identity --query Account --output text
Write-Host "Cuenta $account, región $Region, stack $StackName"

# Bucket privado donde "cloudformation package" sube el código de la Lambda
$bucket = "mindflow-deploy-$account-$Region"
aws s3api head-bucket --bucket $bucket *> $null
if ($LASTEXITCODE -ne 0) {
  Write-Host "Creando bucket de artefactos $bucket"
  Invoke-Aws s3 mb "s3://$bucket" --region $Region
}

$out = Join-Path $PSScriptRoot '.aws-sam'
New-Item -ItemType Directory -Force $out | Out-Null
$packaged = Join-Path $out 'packaged.yaml'

Invoke-Aws cloudformation package `
  --template-file (Join-Path $PSScriptRoot 'template.yaml') `
  --s3-bucket $bucket `
  --s3-prefix $StackName `
  --output-template-file $packaged

Invoke-Aws cloudformation deploy `
  --template-file $packaged `
  --stack-name $StackName `
  --capabilities CAPABILITY_IAM CAPABILITY_AUTO_EXPAND `
  --no-fail-on-empty-changeset

Invoke-Aws cloudformation describe-stacks --stack-name $StackName --query 'Stacks[0].Outputs' --output table
