$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$portableNodeRoot = "C:\Users\Victus\AppData\Local\Programs\node-v22.22.3-win-x64"
$portableNode = Join-Path $portableNodeRoot "node.exe"
$portableNpm = Join-Path $portableNodeRoot "npm.cmd"
$programFilesNode = "C:\Program Files\nodejs\node.exe"
$programFilesNpm = "C:\Program Files\nodejs\npm.cmd"

if (Test-Path $portableNode) {
    $node = $portableNode
    $npm = $portableNpm
    $env:Path = "$portableNodeRoot;$env:Path"
} elseif (Test-Path $programFilesNode) {
    $node = $programFilesNode
    $npm = $programFilesNpm
} else {
    throw "Node.js was not found. Install Node.js or restore the portable Node folder used by the other apps."
}

function Read-EnvFile {
    param([string]$Path)
    if (-not (Test-Path $Path)) {
        return
    }
    Get-Content -LiteralPath $Path | ForEach-Object {
        $line = $_.Trim()
        if (-not $line -or $line.StartsWith("#") -or -not $line.Contains("=")) {
            return
        }
        $parts = $line.Split("=", 2)
        $name = $parts[0].Trim()
        $value = $parts[1].Trim().Trim('"').Trim("'")
        [Environment]::SetEnvironmentVariable($name, $value, "Process")
    }
}

Push-Location $root
try {
    if (-not (Test-Path ".env") -and (Test-Path ".env.example")) {
        Copy-Item ".env.example" ".env"
        Write-Host "Created .env from .env.example. Update DATABASE_URL for a real PostgreSQL database." -ForegroundColor Yellow
    }

    Read-EnvFile (Join-Path $root ".env")

    if (-not $env:JWT_ACCESS_SECRET -or $env:JWT_ACCESS_SECRET -eq "replace-with-a-long-access-secret") {
        $env:JWT_ACCESS_SECRET = "local-dev-access-secret-change-before-production"
    }
    if (-not $env:JWT_REFRESH_SECRET -or $env:JWT_REFRESH_SECRET -eq "replace-with-a-long-refresh-secret") {
        $env:JWT_REFRESH_SECRET = "local-dev-refresh-secret-change-before-production"
    }
    if (-not $env:WEB_ORIGIN) {
        $env:WEB_ORIGIN = "http://127.0.0.1:5173"
    }
    $env:VITE_API_URL = "http://127.0.0.1:3000/api/v1"

    if (-not (Test-Path "node_modules")) {
        & $npm install
    }

    & $npm run db:generate
    & $npm run build

    $apiProcess = $null
    $dbReady = $false

    if ($env:DATABASE_URL -and -not $env:DATABASE_URL.StartsWith("postgresql://pjlj:pjlj_dev_password@localhost:5432")) {
        if (-not $env:DIRECT_URL) {
            $env:DIRECT_URL = $env:DATABASE_URL
        }
        try {
            & $npm run db:migrate
            & $npm run db:seed
            $dbReady = $true
        } catch {
            Write-Host "Database migration/seed failed. The web app will still start, but API login needs a working DATABASE_URL." -ForegroundColor Yellow
            Write-Host $_.Exception.Message -ForegroundColor Yellow
        }
    } else {
        Write-Host "DATABASE_URL still points to the example local PostgreSQL. Configure a real PostgreSQL URL in .env to start the API." -ForegroundColor Yellow
    }

    if ($dbReady) {
        $apiProcess = Start-Process -FilePath $node `
            -ArgumentList "apps\api\dist\main.js" `
            -WorkingDirectory $root `
            -WindowStyle Hidden `
            -PassThru
    }

    $webProcess = Start-Process -FilePath $node `
        -ArgumentList ".\node_modules\vite\bin\vite.js", "--host", "127.0.0.1", "--port", "5173" `
        -WorkingDirectory (Join-Path $root "apps\web") `
        -WindowStyle Hidden `
        -PassThru

    Start-Sleep -Seconds 4
    Start-Process "http://127.0.0.1:5173"

    Write-Host "PJ&LJ Salon Manager is running locally." -ForegroundColor Green
    Write-Host "Web:      http://127.0.0.1:5173"
    if ($dbReady) {
        Write-Host "API:      http://127.0.0.1:3000/api/v1/health"
        Write-Host "Swagger:  http://127.0.0.1:3000/api/docs"
        Write-Host "Verify:   npm.cmd run foundation:verify"
        Write-Host "Login:    $($env:SEED_ADMIN_EMAIL) / value from SEED_ADMIN_PASSWORD"
    } else {
        Write-Host "API:      not started because PostgreSQL is not configured."
        Write-Host "Next:     set DATABASE_URL in .env, then run this launcher again."
    }
    Write-Host ""
    Write-Host "Press Enter to stop local services."
    [void](Read-Host)

    if ($webProcess -and -not $webProcess.HasExited) {
        Stop-Process -Id $webProcess.Id -Force
    }
    if ($apiProcess -and -not $apiProcess.HasExited) {
        Stop-Process -Id $apiProcess.Id -Force
    }
} finally {
    Pop-Location
}
