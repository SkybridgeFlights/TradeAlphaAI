#!/usr/bin/env python3
"""
startup_health_check.py — EA_AI runtime startup health checker.

Checks required services, ports, Telegram bots, API endpoints, and writes
runtime/startup-health.json. Does not expose secrets.

Output: runtime/startup-health.json
"""
from __future__ import annotations

import json
import platform
import socket
import subprocess
import sys
import time
import urllib.request
import urllib.error
from datetime import datetime, timezone
from pathlib import Path

ROOT        = Path(__file__).resolve().parent.parent
MANIFEST    = ROOT / "runtime" / "service-manifest.json"
HEALTH_OUT  = ROOT / "runtime" / "startup-health.json"
RUNTIME_H   = ROOT / "runtime" / "runtime-health.json"
INTEL_H     = ROOT / "data" / "system-status" / "intelligence-health.json"

IS_WINDOWS  = platform.system() == "Windows"

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

def write_json(path: Path, data: dict):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2, default=str) + "\n", encoding="utf-8")

# ── Individual checks ─────────────────────────────────────────────────────────

def check_port(port: int, host: str = "localhost", timeout: float = 3.0) -> tuple[bool, str]:
    try:
        with socket.create_connection((host, port), timeout=timeout):
            return True, f"port {port} responding"
    except Exception as e:
        return False, f"port {port} not responding: {e}"

def check_http(url: str, timeout: float = 5.0) -> tuple[bool, str]:
    try:
        req = urllib.request.urlopen(url, timeout=timeout)
        return req.status < 500, f"HTTP {req.status}"
    except urllib.error.HTTPError as e:
        return e.code < 500, f"HTTP {e.code}"
    except Exception as e:
        return False, str(e)

def check_process(target: str) -> tuple[bool, str]:
    try:
        if IS_WINDOWS:
            result = subprocess.run(
                ["tasklist", "/NH", "/FO", "CSV"],
                capture_output=True, text=True, timeout=10
            )
            found = target.lower() in result.stdout.lower()
            return found, f"process '{target}' {'found' if found else 'not found'}"
        else:
            result = subprocess.run(["pgrep", "-f", target], capture_output=True, text=True, timeout=5)
            found = bool(result.stdout.strip())
            return found, f"process '{target}' {'found' if found else 'not found'}"
    except Exception as e:
        return False, str(e)

def check_log_heartbeat(log_path: Path, max_age_seconds: int = 300) -> tuple[bool, str]:
    if not log_path.exists():
        return False, f"log not found: {log_path.name}"
    age = time.time() - log_path.stat().st_mtime
    ok = age <= max_age_seconds
    return ok, f"log age {int(age)}s (max {max_age_seconds}s)"

def check_telegram_bot(pid_file: str) -> tuple[bool, str]:
    pid_path = ROOT / pid_file
    if not pid_path.exists():
        return False, "PID file missing"
    try:
        pid = int(pid_path.read_text().strip())
        if IS_WINDOWS:
            result = subprocess.run(
                ["tasklist", "/FI", f"PID eq {pid}", "/NH", "/FO", "CSV"],
                capture_output=True, text=True, timeout=5
            )
            alive = str(pid) in result.stdout
        else:
            import os
            try:
                os.kill(pid, 0)
                alive = True
            except ProcessLookupError:
                alive = False
        return alive, f"pid={pid} {'alive' if alive else 'dead'}"
    except Exception as e:
        return False, str(e)

# ── Build report ──────────────────────────────────────────────────────────────

def build_report() -> dict:
    manifest = read_json(MANIFEST, {})
    all_services = manifest.get("services", [])
    runtime_h    = read_json(RUNTIME_H, {})
    intel_h      = read_json(INTEL_H, {})

    checks = {}

    # ── Required services from manifest ──────────────────────────────────────
    for svc in all_services:
        if not svc.get("enabled", True) or not svc.get("required", False):
            continue
        name = svc["name"]
        hc   = svc.get("health_check", {})
        t    = hc.get("type", "process")
        tgt  = hc.get("target", "")

        if t == "port":
            ok, detail = check_port(int(tgt))
        elif t == "http":
            ok, detail = check_http(tgt)
        elif t == "log":
            max_age = hc.get("max_age_seconds", 300)
            ok, detail = check_log_heartbeat(ROOT / tgt, max_age)
        else:
            # process
            ok, detail = check_process(tgt)

        checks[name] = {"ok": ok, "detail": detail, "required": True}

    # ── Telegram bots (check process alive, not credentials) ─────────────────
    bot_names = ["EA_ADMIN_BOT", "EA_CUSTOMER_BOT", "SIGNALS_BOT"]
    for svc in all_services:
        if svc.get("name") in bot_names and svc.get("enabled"):
            name = svc["name"]
            ok, detail = check_telegram_bot(svc.get("pid_file", ""))
            checks[name] = {"ok": ok, "detail": detail, "required": False}

    # ── Intelligence health ────────────────────────────────────────────────────
    intel_status = intel_h.get("status", "unknown")
    intel_ok     = intel_status in ("ok", "degraded")
    checks["intelligence_engine"] = {
        "ok": intel_ok,
        "detail": f"status={intel_status} severity={intel_h.get('severity', 'UNKNOWN')}",
        "required": False,
    }

    # ── Supervisor health ─────────────────────────────────────────────────────
    rt_status = runtime_h.get("overall_status", "unknown")
    rt_ok     = rt_status in ("healthy", "degraded")
    checks["runtime_supervisor"] = {
        "ok": rt_ok,
        "detail": f"status={rt_status} healthy={runtime_h.get('healthy_count',0)} failed={runtime_h.get('failed_count',0)}",
        "required": False,
        "last_checked": runtime_h.get("timestamp"),
    }

    # ── Aggregate ─────────────────────────────────────────────────────────────
    required_checks = [v for v in checks.values() if v.get("required")]
    failed_required = [k for k, v in checks.items() if v.get("required") and not v["ok"]]
    failed_optional = [k for k, v in checks.items() if not v.get("required") and not v["ok"]]

    if failed_required:
        overall = "offline"
    elif failed_optional:
        overall = "degraded"
    else:
        overall = "healthy"

    return {
        "timestamp":       now_iso(),
        "overall_status":  overall,
        "checks":          checks,
        "failed_required": failed_required,
        "failed_optional": failed_optional,
        "summary": {
            "total":    len(checks),
            "passing":  sum(1 for v in checks.values() if v["ok"]),
            "failing":  sum(1 for v in checks.values() if not v["ok"]),
        },
    }

def main():
    print("[startup-health] Running startup health check...")
    report = build_report()
    write_json(HEALTH_OUT, report)

    print(f"\n{'Check':<26} {'Status':<10} Detail")
    print("-" * 70)
    for name, result in report["checks"].items():
        icon = "✓" if result["ok"] else "✗"
        req  = "[required]" if result.get("required") else ""
        print(f"  {icon} {name:<24} {'OK' if result['ok'] else 'FAIL':<10} {result['detail']} {req}")

    print(f"\n[startup-health] Overall: {report['overall_status'].upper()} — "
          f"{report['summary']['passing']}/{report['summary']['total']} checks passing")

    if report["failed_required"]:
        print(f"[startup-health] CRITICAL: Required services not healthy: {', '.join(report['failed_required'])}")

    write_json(HEALTH_OUT, report)
    print(f"[startup-health] Written → runtime/startup-health.json")

    # Exit non-zero only if required services are down
    sys.exit(1 if report["failed_required"] else 0)

if __name__ == "__main__":
    main()
