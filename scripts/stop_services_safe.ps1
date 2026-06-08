#Requires -Version 5.1
<#
.SYNOPSIS
    Stop EA_AI services safely using PID files from service-manifest.json.
.PARAMETER DryRun
    Print actions without stopping any processes.
.PARAMETER Service
    Stop only the named service(s). Default: all.
#>
param(
    [switch]$DryRun,
    [string[]]$Service
)

$ErrorActionPreference = "Continue"
$Root = Split-Path -Parent $PSScriptRoot

function Get-Manifest {
    $manifestPath = Join-Path $Root "runtime\service-manifest.json"
    if (-not (Test-Path $manifestPath)) {
        Write-Host "[ERROR] service-manifest.json not found." -ForegroundColor Red
        exit 1
    }
    $manifest = Get-Content $manifestPath -Raw | ConvertFrom-Json
    $services = @($manifest.services)
    foreach ($svc in $manifest.optional_services) {
        if ($svc.enabled) { $services += $svc }
    }
    return $services
}

function Stop-Service-Safe($svc) {
    $name    = $svc.name
    $pidFile = Join-Path $Root ($svc.pid_file -replace "/", "\")

    if (-not (Test-Path $pidFile)) {
        Write-Host "  [skip] $name: no PID file found" -ForegroundColor Gray
        return
    }

    $pidVal = [int](Get-Content $pidFile -Raw).Trim()

    if ($DryRun) {
        Write-Host "  [DRY-RUN] Would stop: $name (pid=$pidVal)" -ForegroundColor Cyan
        return
    }

    $proc = Get-Process -Id $pidVal -ErrorAction SilentlyContinue
    if ($proc) {
        Stop-Process -Id $pidVal -Force -ErrorAction SilentlyContinue
        Write-Host "  [stopped] $name (pid=$pidVal)" -ForegroundColor Yellow
    } else {
        Write-Host "  [stale-pid] $name (pid=$pidVal not running)" -ForegroundColor Gray
    }
    Remove-Item $pidFile -Force -ErrorAction SilentlyContinue
}

# ── Main ──────────────────────────────────────────────────────────────────────

$services = Get-Manifest

Write-Host ""
Write-Host "======================================================"
Write-Host "  EA_AI Service Shutdown" -ForegroundColor Yellow
Write-Host "  $(Get-Date -Format 'yyyy-MM-ddTHH:mm:ss')"
if ($DryRun) { Write-Host "  MODE: DRY-RUN" -ForegroundColor Cyan }
Write-Host "======================================================"
Write-Host ""

foreach ($svc in $services) {
    if ($Service -and $svc.name -notin $Service) { continue }
    Stop-Service-Safe $svc
}

Write-Host ""
Write-Host "[stop] All requested services stopped."
Write-Host ""
