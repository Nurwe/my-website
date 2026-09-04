[CmdletBinding()]
param(
    [string]$SourcePath = 'C:\Users\narag\Desktop\Brasil - Nico',
    [string]$WebsiteRoot,
    [string]$Remote = 'origin',
    [string]$Branch = 'main',
    [switch]$LocalOnly
)

$ErrorActionPreference = 'Stop'

if ([string]::IsNullOrWhiteSpace($WebsiteRoot)) {
    $WebsiteRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
}

$syncScript = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot 'sync-brazil.ps1')).Path
$powerShellExe = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'

& $powerShellExe `
    -NoProfile `
    -NonInteractive `
    -ExecutionPolicy Bypass `
    -File $syncScript `
    -SourcePath $SourcePath `
    -WebsiteRoot $WebsiteRoot
if ($LASTEXITCODE -ne 0) {
    throw "Brazil sync failed with exit code $LASTEXITCODE; nothing was published."
}

if ($LocalOnly) {
    Write-Output 'Local Brazil sync complete; GitHub publication was skipped.'
    exit 0
}

Push-Location $WebsiteRoot
try {
    $branchActual = (& git branch --show-current).Trim()
    if ($LASTEXITCODE -ne 0 -or $branchActual -ne $Branch) {
        throw "Expected Git branch '$Branch', found '$branchActual'."
    }

    $changes = @(& git status --porcelain -- brazil)
    if ($LASTEXITCODE -ne 0) {
        throw 'Could not inspect synchronized Brazil files with Git.'
    }
    if (-not $changes.Count) {
        Write-Output 'Brazil publication is already current; no Git commit was needed.'
        exit 0
    }

    & git add -- brazil
    if ($LASTEXITCODE -ne 0) {
        throw 'Could not stage synchronized Brazil files.'
    }

    & git diff --cached --quiet -- brazil
    $diffExitCode = $LASTEXITCODE
    if ($diffExitCode -eq 0) {
        Write-Output 'Brazil publication is already current; no Git commit was needed.'
        exit 0
    }
    if ($diffExitCode -ne 1) {
        throw 'Could not validate the staged Brazil publication.'
    }

    $message = 'Update Brazil forecasts {0}' -f (Get-Date).ToString('yyyy-MM-dd')
    & git commit -m $message -- brazil
    if ($LASTEXITCODE -ne 0) {
        throw 'Could not commit synchronized Brazil files.'
    }

    & git push $Remote $Branch
    if ($LASTEXITCODE -ne 0) {
        throw "The Brazil update was committed locally but could not be pushed to $Remote/$Branch."
    }

    Write-Output "Brazil publication pushed to $Remote/$Branch."
}
finally {
    Pop-Location
}
