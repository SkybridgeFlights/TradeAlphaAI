#!/usr/bin/env python3
"""
runtime_supervisor.py — VPS service supervisor for EA_AI platform.

Reads runtime/service-manifest.json, checks every configured service,
detects failures, restarts if restart_policy allows, and writes health reports.

Modes: --status | --start | --stop | --restart-failed | --watch
"""
from __future__ import annotations

import argparse
import json
import os
import platform
import socket
import subprocess
import sys
import time
import urllib.request
import urllib.error
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MANIFEST_PATH    = ROOT / "runtime" / "service-manifest.json"
HEALTH_PATH      = ROOT / "runtime" / "runtime-health.json"
EVENTS_PATH      = ROOT / "runtime" / "service-events.jsonl"
PIDS_DIR         = ROOT / "runtime" / "pids"
LOGS_DIR         = ROOT / "runtime" / "logs"
RESTART_REGISTRY = ROOT / "runtime" / "restart-counts.json"

IS_WINDOWS = platform.system() == "Windows"

# ── Helpers ───────────────────────────────────────────────────────────────────

def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")

def read_json(path: Path, fallback=None):
    if fallback is None:
        fallback = {}
    if not path.exists():
        return fallback
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return fallback

def write_json(path: Path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2, default=str) + "\n", encoding="utf-8")

def append_event(event: dict):
    EVENTS_PATH.parent.mkdir(parents=True, exist_ok=True)
    with EVENTS_PATH.open("a", encoding="utf-8") as f:
        f.write(json.dumps(event, default=str) + "\n")

def load_manifest() -> dict:
    manifest = read_json(MANIFEST_PATH, {})
    services = manifest.get("services", [])
    # Merge optional_services that are enabled
    for svc in manifest.get("optional_services", []):
        if svc.get("enabled"):
            services.append(svc)
    return services

# ── PID management ────────────────────────────────────────────────────────────

def read_pid(pid_file: str) -> int | None:
    pid_path = ROOT / pid_file
    if not pid_path.exists():
        return None
    try:
        return int(pid_path.read_text().strip())
    except Exception:
        return None

def write_pid(pid_file: str, pid: int):
    pid_path = ROOT / pid_file
    pid_path.parent.mkdir(parents=True, exist_ok=True)
    pid_path.write_text(str(pid))

def remove_pid(pid_file: str):
    pid_path = ROOT / pid_file
    if pid_path.exists():
        pid_path.unlink()

def is_pid_alive(pid: int) -> bool:
    try:
        if IS_WINDOWS:
            result = subprocess.run(
                ["tasklist", "/FI", f"PID eq {pid}", "/NH", "/FO", "CSV"],
                capture_output=True, text=True, timeout=5
            )
            return str(pid) in result.stdout
        else:
            os.kill(pid, 0)
            return True
    except Exception:
        return False

# ── Health checks ─────────────────────────────────────────────────────────────

def check_port(target: str) -> bool:
    try:
        port = int(target)
        with socket.create_connection(("localhost", port), timeout=3):
            return True
    except Exception:
        return False

def check_http(target: str) -> bool:
    try:
        req = urllib.request.urlopen(target, timeout=5)
        return req.status < 500
    except Exception:
        return False

def check_process(target: str) -> bool:
    """Check if a process matching the target name/command is running."""
    try:
        if IS_WINDOWS:
            result = subprocess.run(
                ["tasklist", "/NH", "/FO", "CSV"],
                capture_output=True, text=True, timeout=10
            )
            return target.lower() in result.stdout.lower()
        else:
            result = subprocess.run(["pgrep", "-f", target], capture_output=True, text=True, timeout=5)
            return bool(result.stdout.strip())
    except Exception:
        return False

def check_log(target: str, max_age_seconds: int = 300) -> bool:
    log_path = ROOT / target
    if not log_path.exists():
        return False
    mtime = log_path.stat().st_mtime
    age = time.time() - mtime
    return age <= max_age_seconds

def run_health_check(svc: dict) -> tuple[bool, str]:
    hc = svc.get("health_check", {})
    hc_type = hc.get("type", "process")
    target   = hc.get("target", "")

    if hc_type == "port":
        ok = check_port(target)
        return ok, f"port:{target}"
    elif hc_type == "http":
        ok = check_http(target)
        return ok, f"http:{target}"
    elif hc_type == "process":
        # First try PID file
        pid = read_pid(svc.get("pid_file", ""))
        if pid and is_pid_alive(pid):
            return True, f"pid:{pid}"
        # Fallback: process name scan
        ok = check_process(target)
        return ok, f"process:{target}"
    elif hc_type == "log":
        max_age = hc.get("max_age_seconds", 300)
        ok = check_log(target, max_age)
        return ok, f"log:{target}(age<{max_age}s)"
    return False, "unknown_health_check_type"

# ── Restart tracking ──────────────────────────────────────────────────────────

def get_restart_count(name: str) -> int:
    registry = read_json(RESTART_REGISTRY, {})
    entry = registry.get(name, {})
    hour_key = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H")
    return entry.get(hour_key, 0)

def increment_restart_count(name: str) -> int:
    registry = read_json(RESTART_REGISTRY, {})
    if name not in registry:
        registry[name] = {}
    hour_key = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H")
    registry[name][hour_key] = registry[name].get(hour_key, 0) + 1
    # Keep only last 24 hours per service
    for svc_name in list(registry.keys()):
        registry[svc_name] = {k: v for k, v in registry[svc_name].items()
                               if k >= datetime.now(timezone.utc).strftime("%Y-%m-%dT%H")[:-2] + "00"}
    write_json(RESTART_REGISTRY, registry)
    return registry[name][hour_key]

# ── Service control ───────────────────────────────────────────────────────────

def start_service(svc: dict, dry_run: bool = False) -> bool:
    name     = svc["name"]
    command  = svc.get("command", "")
    work_dir = svc.get("working_dir", str(ROOT))
    log_file = ROOT / svc.get("log_file", f"runtime/logs/{name.lower()}.log")
    pid_file = svc.get("pid_file", f"runtime/pids/{name.lower()}.pid")
    title    = svc.get("window_title", name)

    log_file.parent.mkdir(parents=True, exist_ok=True)
    print(f"  [start] {name}: {command}")

    if dry_run:
        print(f"  [dry-run] Would start {name} in {work_dir}")
        return True

    try:
        if IS_WINDOWS:
            full_cmd = f'start "{title}" /D "{work_dir}" cmd /k "{command} >> {log_file} 2>&1"'
            subprocess.Popen(full_cmd, shell=True, cwd=work_dir)
        else:
            with open(log_file, "a") as lf:
                proc = subprocess.Popen(
                    command.split(),
                    cwd=work_dir,
                    stdout=lf, stderr=lf,
                    start_new_session=True
                )
                write_pid(pid_file, proc.pid)

        append_event({"timestamp": now_iso(), "event": "started", "service": name})
        print(f"  [started] {name}")
        return True
    except Exception as e:
        print(f"  [ERROR] Failed to start {name}: {e}")
        append_event({"timestamp": now_iso(), "event": "start_failed", "service": name, "error": str(e)})
        return False

def stop_service(svc: dict, dry_run: bool = False) -> bool:
    name     = svc["name"]
    pid_file = svc.get("pid_file", "")
    pid      = read_pid(pid_file)

    if dry_run:
        print(f"  [dry-run] Would stop {name} (pid={pid})")
        return True

    if pid and is_pid_alive(pid):
        try:
            if IS_WINDOWS:
                subprocess.run(["taskkill", "/PID", str(pid), "/F"], capture_output=True, timeout=10)
            else:
                os.kill(pid, 15)
                time.sleep(1)
                if is_pid_alive(pid):
                    os.kill(pid, 9)
            remove_pid(pid_file)
            append_event({"timestamp": now_iso(), "event": "stopped", "service": name, "pid": pid})
            print(f"  [stopped] {name} (pid={pid})")
            return True
        except Exception as e:
            print(f"  [ERROR] Failed to stop {name}: {e}")
            return False
    else:
        print(f"  [info] {name} not running (pid={pid})")
        remove_pid(pid_file)
        return True

# ── Status collection ─────────────────────────────────────────────────────────

def collect_status(services: list[dict]) -> list[dict]:
    results = []
    for svc in services:
        if not svc.get("enabled", True):
            continue
        name = svc["name"]
        ok, detail = run_health_check(svc)
        pid = read_pid(svc.get("pid_file", ""))
        results.append({
            "name":     name,
            "healthy":  ok,
            "required": svc.get("required", False),
            "detail":   detail,
            "pid":      pid,
        })
    return results

def write_health_report(results: list[dict]):
    healthy  = [r for r in results if r["healthy"]]
    degraded = [r for r in results if not r["healthy"] and not r["required"]]
    failed   = [r for r in results if not r["healthy"] and r["required"]]

    if failed:
        overall = "failed"
    elif degraded:
        overall = "degraded"
    else:
        overall = "healthy"

    report = {
        "timestamp":      now_iso(),
        "overall_status": overall,
        "healthy_count":  len(healthy),
        "degraded_count": len(degraded),
        "failed_count":   len(failed),
        "services":       results,
        "failed_services":  [r["name"] for r in failed],
        "degraded_services":[r["name"] for r in degraded],
    }
    write_json(HEALTH_PATH, report)
    return report

# ── Command implementations ───────────────────────────────────────────────────

def cmd_status(services):
    print("[supervisor] Checking service health...")
    results = collect_status(services)
    report  = write_health_report(results)

    print(f"\n{'Service':<22} {'Status':<10} {'Required':<10} {'Detail'}")
    print("-" * 70)
    for r in results:
        icon = "✓" if r["healthy"] else "✗"
        print(f"  {icon} {r['name']:<20} {'OK' if r['healthy'] else 'FAIL':<10} {'yes' if r['required'] else 'no':<10} {r['detail']}")

    print(f"\n[supervisor] Overall: {report['overall_status'].upper()} — "
          f"{report['healthy_count']} healthy, {report['degraded_count']} degraded, "
          f"{report['failed_count']} failed")
    write_json(HEALTH_PATH, report)

def cmd_restart_failed(services, dry_run: bool = False):
    print("[supervisor] Checking for failed services to restart...")
    results = collect_status(services)
    failed  = [r for r in results if not r["healthy"]]

    for r in failed:
        svc = next((s for s in services if s["name"] == r["name"]), None)
        if not svc:
            continue
        policy = svc.get("restart_policy", {})
        if not policy.get("enabled", True):
            print(f"  [skip] {r['name']}: restart disabled by policy")
            continue

        max_per_hour = policy.get("max_restarts_per_hour", 5)
        restarts     = get_restart_count(r["name"])
        if restarts >= max_per_hour:
            print(f"  [skip] {r['name']}: restart limit reached ({restarts}/{max_per_hour}/hr)")
            append_event({
                "timestamp": now_iso(), "event": "restart_limit_reached",
                "service": r["name"], "count": restarts
            })
            continue

        print(f"  [restart] {r['name']} (restarts this hour: {restarts+1}/{max_per_hour})")
        if not dry_run:
            increment_restart_count(r["name"])
            append_event({"timestamp": now_iso(), "event": "restarting", "service": r["name"]})
        start_service(svc, dry_run=dry_run)

    write_health_report(collect_status(services))

def cmd_watch(services, interval: int = 60, dry_run: bool = False):
    print(f"[supervisor] Starting watch loop (interval={interval}s, dry_run={dry_run})")
    while True:
        cmd_restart_failed(services, dry_run=dry_run)
        time.sleep(interval)

def cmd_start(services, names: list[str] | None = None, dry_run: bool = False):
    for svc in services:
        if names and svc["name"] not in names:
            continue
        if not svc.get("enabled", True):
            print(f"  [skip] {svc['name']}: disabled")
            continue
        ok, detail = run_health_check(svc)
        if ok:
            print(f"  [skip] {svc['name']}: already running ({detail})")
            continue
        start_service(svc, dry_run=dry_run)

def cmd_stop(services, names: list[str] | None = None, dry_run: bool = False):
    for svc in services:
        if names and svc["name"] not in names:
            continue
        stop_service(svc, dry_run=dry_run)

# ── Entry point ───────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="EA_AI Runtime Supervisor")
    parser.add_argument("mode", nargs="?", choices=["--status","--start","--stop","--restart-failed","--watch","status","start","stop","restart-failed","watch"], default="--status")
    parser.add_argument("--service", nargs="*", help="Specific service name(s)")
    parser.add_argument("--interval", type=int, default=60, help="Watch interval in seconds")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    mode = (args.mode or "--status").lstrip("-")
    if mode == "status":    mode = "status"
    elif mode == "start":   mode = "start"
    elif mode == "stop":    mode = "stop"
    elif mode == "restart-failed": mode = "restart-failed"
    elif mode == "watch":   mode = "watch"
    else:                   mode = "status"

    services = load_manifest()
    if not services:
        print(f"[supervisor] ERROR: No services found in {MANIFEST_PATH}")
        sys.exit(1)

    if mode == "status":
        cmd_status(services)
    elif mode == "start":
        cmd_start(services, names=args.service, dry_run=args.dry_run)
        cmd_status(services)
    elif mode == "stop":
        cmd_stop(services, names=args.service, dry_run=args.dry_run)
    elif mode == "restart-failed":
        cmd_restart_failed(services, dry_run=args.dry_run)
    elif mode == "watch":
        cmd_watch(services, interval=args.interval, dry_run=args.dry_run)

if __name__ == "__main__":
    main()
