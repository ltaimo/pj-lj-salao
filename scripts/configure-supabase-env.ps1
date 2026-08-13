param(
    [Parameter(Mandatory = $true)]
    [string]$ProjectRef,

    [Parameter(Mandatory = $true)]
    [string]$DatabasePassword,

    [string]$RegionHost = "aws-1-eu-west-1.pooler.supabase.com"
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$envPath = Join-Path $root ".env"

if (-not (Test-Path $envPath)) {
    Copy-Item (Join-Path $root ".env.example") $envPath
}

$databaseUrl = "postgresql://postgres.$ProjectRef:$DatabasePassword@$RegionHost:5432/postgres?schema=public&sslmode=require&connection_limit=1"
$directUrl = $databaseUrl

$values = [ordered]@{
    NODE_ENV = "development"
    DATABASE_URL = $databaseUrl
    DIRECT_URL = $directUrl
    JWT_ACCESS_SECRET = "local-dev-access-secret-change-before-production"
    JWT_REFRESH_SECRET = "local-dev-refresh-secret-change-before-production"
    JWT_ACCESS_TTL = "15m"
    JWT_REFRESH_TTL = "7d"
    SEED_ADMIN_EMAIL = "admin@pjlj.local"
    SEED_ADMIN_PASSWORD = "change-me-before-production"
    WEB_ORIGIN = "http://127.0.0.1:5173"
    API_PORT = "3000"
}

$content = $values.GetEnumerator() | ForEach-Object { "$($_.Key)=$($_.Value)" }
Set-Content -LiteralPath $envPath -Value $content -Encoding UTF8

Write-Host ".env configured for Supabase project $ProjectRef" -ForegroundColor Green
Write-Host "DATABASE_URL and DIRECT_URL use the Supabase session pooler with connection_limit=1."
