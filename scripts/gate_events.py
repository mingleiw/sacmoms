#!/usr/bin/env python3
"""Jev quality gate for candidate SacMoms events (prototype).

Reads a JSON array of event dicts (same shape as data/events.json entries),
asks Jev (via the typesafe skill) four questions per event, and splits them
into accepted / rejected files with reasons.

Non-destructive: it never edits data/events.json. Wiring it into
scripts/daily_refresh.sh is a separate, approved step.

Usage:
  scripts/gate_events.py --events candidates.json --out accepted.json --rejected rejected.json
  scripts/gate_events.py --events data/events.json --limit 5   # dry-run preview
"""

import argparse
import json
import subprocess
import sys
from datetime import datetime
from zoneinfo import ZoneInfo

SKILL_CLI = "/home/hatch/workspace/skills/typesafe/bin/system_one.py"

# Conservative thresholds: only hard-reject when Jev is confident.
STALE_REJECT = 0.85   # stale probability at/above this -> REJECT
KID_REJECT = 0.20     # kid-appropriateness at/below this -> REJECT
QUALITY_FLAG = 0.75   # quality score below this -> keep, but flag for review

QUESTIONS = {
    "kid_event": {
        "type": "noul",
        "instructions": (
            "Is this event appropriate for children under 10? "
            "Consider the ages field, the title, and the description."
        ),
    },
    "stale": {
        "type": "noul",
        "instructions": (
            "Should this event NOT appear on a family events calendar because it is "
            "stale, expired, or a one-time past event? A one-time event whose date has "
            "already passed is stale. A weekly recurring event (day of week given, no "
            "specific date) is NOT stale. An upcoming one-time event is NOT stale."
        ),
    },
    "category": {
        "type": "choice",
        "instructions": "Pick the best category for this event.",
        "criteria": {
            "storytime": None,
            "seasonal": None,
            "museum": None,
            "outdoor": None,
            "other": None,
        },
    },
    "quality": {
        "type": "score",
        "instructions": (
            "Rate the quality of this event listing for a family events calendar: "
            "0 = poor (missing, confusing, or useless information), "
            "1 = okay (usable), 2 = great (clear and enticing)."
        ),
        "criteria": ["poor", "okay", "great"],
    },
}

WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]


def parse_args():
    p = argparse.ArgumentParser(description="Jev quality gate for event candidates")
    p.add_argument("--events", required=True, help="JSON file with an array of event dicts")
    p.add_argument("--out", help="Write accepted events here (JSON)")
    p.add_argument("--rejected", help="Write rejected events here (JSON)")
    p.add_argument("--limit", type=int, default=0, help="Only process the first N events")
    return p.parse_args()


def ask_jev(state):
    today = datetime.now(ZoneInfo("America/Los_Angeles")).strftime("%B %d, %Y")
    payload = {
        "model": "jev-latest",
        "state": {"today": today, "event": state},
        "questions": QUESTIONS,
    }
    proc = subprocess.run(
        [sys.executable, SKILL_CLI, "--payload", json.dumps(payload)],
        capture_output=True,
        text=True,
        timeout=120,
    )
    if proc.returncode != 0:
        raise RuntimeError(proc.stderr.strip()[-500:])
    return json.loads(proc.stdout)


def event_summary(event):
    when = event.get("date") or (
        f"weekly on {WEEKDAYS[event['day']]}" if "day" in event else "date unknown"
    )
    return {
        "title": event.get("title"),
        "venue": event.get("venue"),
        "city": event.get("city"),
        "ages": event.get("ages"),
        "when": when,
        "blurb": event.get("blurb"),
        "source": event.get("source"),
    }


def gate_event(event):
    """Return (verdict, reasons, details). verdict in LIST/REJECT/ERROR."""
    answers = ask_jev(event_summary(event))["answers"]

    def val(name):
        ans = answers.get(name, {})
        return ans.get(ans.get("type"))

    kid = val("kid_event")
    stale = val("stale")
    category = val("category")
    quality = val("quality")

    details = {"kid_p": kid, "stale_p": stale, "category": category, "quality": quality}
    reasons = []

    if isinstance(stale, (int, float)) and stale >= STALE_REJECT:
        reasons.append(f"stale (p={stale:.2f})")
    if isinstance(kid, (int, float)) and kid <= KID_REJECT:
        reasons.append(f"not kid-appropriate (p={kid:.2f})")
    if reasons:
        return "REJECT", reasons, details
    if isinstance(quality, (int, float)) and quality < QUALITY_FLAG:
        reasons.append(f"low quality score ({quality:.2f}) - needs review")
    return "LIST", reasons, details


def main():
    args = parse_args()
    with open(args.events, encoding="utf-8") as f:
        events = json.load(f)
    if args.limit:
        events = events[: args.limit]

    accepted, rejected = [], []
    for event in events:
        title = event.get("title", "?")
        try:
            verdict, reasons, details = gate_event(event)
        except Exception as exc:  # noqa: BLE001 - fail open: never nuke the calendar on a Jev outage
            print(f"  [ERROR] {title}: {exc} -> kept (fail-open)")
            accepted.append({**event, "_jev": {"verdict": "ERROR", "error": str(exc)[:200]}})
            continue
        enriched = {**event, "_jev": {"verdict": verdict, **details}}
        tag = "LIST " if verdict == "LIST" else "REJECT"
        note = f" ({'; '.join(reasons)})" if reasons else ""
        print(f"  [{tag}] {title}{note}")
        (accepted if verdict == "LIST" else rejected).append(enriched)

    print(f"\n{len(accepted)} accepted, {len(rejected)} rejected out of {len(events)}")
    if args.out:
        with open(args.out, "w", encoding="utf-8") as f:
            json.dump(accepted, f, indent=2, ensure_ascii=False)
    if args.rejected:
        with open(args.rejected, "w", encoding="utf-8") as f:
            json.dump(rejected, f, indent=2, ensure_ascii=False)


if __name__ == "__main__":
    main()
