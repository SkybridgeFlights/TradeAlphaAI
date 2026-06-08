#Requires -Version 5.1
<#
.SYNOPSIS
    Start EA_AI services from service-manifest.json safely.
.PARAMETER DryRun
    Print actions without starting any processes.
.PARAMETER Service
    Start only the named service(s). Default: all enabled.
#>
param(
    [switch]$DryRun,
    [string[]]$Service
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot

function Get-Manifest {
    $manifestPath = Join-Path $Root "runtime\service-manifest.json"
    if (-not (Test-Path $manifestPath)) {
        Write-Host "[ERROR] service-manifest.json not found at $manifestPath" -ForegroundColor Red
        exit 1
    }
    $manifest = Get-Content $manifestPath -Raw | ConvertFrom-Json
    $services = @($manifest.services)
    foreach ($svc in $manifest.optional_services) {
        if ($svc.enabled) { $services += $svc }
    }
    return $services
}

function Get-Pid-File($svc) {
    return Join-Path $Root ($svc.pid_file -replace "/", "\")
}

function Get-Log-File($svc) {
    return Join-Path $Root ($svc.log_file -replace "/", "\")
}

function Is-Running($svc) {
    $pidFile = Get-Pid-File $svc
    if (Test-Path $pidFile) {
        $pid = [int](Get-Content $pidFile -Raw).Trim()
        $proc = Get-Process -Id $pid -ErrorAction SilentlyContinue
        if ($proc) { return $true }
        # Stale PID — remove it
        Remove-Item $pidFile -Force -ErrorAction SilentlyContinue
    }
    return $false
}

function Start-Service-Safe($svc) {
    $name     = $svc.name
    $command  = $svc.command
    $workDir  = if ($svc.working_dir) { $svc.working_dir } else { $Root }
    $title    = $svc.window_title
    $pidFile  = Get-Pid-File $svc
    $logFile  = Get-Log-File $svc

    # Ensure dirs exist
    $pidDir = Split-Path -Parent $pidFile
    $logDir = Split-Path -Parent $logFile
    if (-not (Test-Path $pidDir)) { New-Item -ItemType Directory -Force $pidDir | Out-Null }
    if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Force $logDir | Out-Null }

    if ($DryRun) {
        Write-Host "  [DRY-RUN] Would start: $name" -ForegroundColor Cyan
        Write-Host "    Command:  $command"
        Write-Host "    Dir:      $workDir"
        Write-Host "    Window:   $title"
        return
    }

    $proc = Start-Process -FilePath "cmd.exe" `
        -ArgumentList "/k title $title & $command" `
        -WorkingDirectory $workDir `
        -PassThru `
        -WindowStyle Normal

    if ($proc) {
        $proc.Id | Out-File -FilePath $pidFile -Encoding ascii -Force
        Write-Host "  [started] $name  pid=$($proc.Id)" -ForegroundColor Green
    } else {
        Write-Host "  [ERROR] Failed to start $name" -ForegroundColor Red
    }
}

# ── Main ──────────────────────────────────────────────────────────────────────

$services = Get-Manifest

Write-Host ""
Write-Host "======================================================"
Write-Host "  EA_AI Service Startup" -ForegroundColor Cyan
Write-Host "  $(Get-Date -Format 'yyyy-MM-ddTHH:mm:ss')"
if ($DryRun) { Write-Host "  MODE: DRY-RUN" -ForegroundColor Yellow }
Write-Host "======================================================"
Write-Host ""

$table = @()
foreach ($svc in $services) {
    if (-not $svc.enabled) { continue }
    if ($Service -and $svc.name -notin $Service) { continue }

    $running = Is-Running $svc
    $row = [PSCustomObject]@{
        Service  = $svc.name
        Required = if ($svc.required) {"yes"} else {"no"}
        Status   = if ($running) {"RUNNING"} else {"STOPPED"}
        Action   = if ($running) {"skip"} else {"start"}
    }
    $table += $row

    if ($running) {
        Write-Host "  [skip] $($svc.name): already running" -ForegroundColor Gray
    } else {
        Start-Service-Safe $svc
    }
}

Write-Host ""
Write-Host "======================================================"
Write-Host "  Startup Summary"
Write-Host "======================================================"
$table | Format-Table -AutoSize
Write-Host ""
