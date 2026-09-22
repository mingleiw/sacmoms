#!/bin/bash
# Daily refresh: re-scrape library storytimes, refresh other recurring events,
# rebuild the site, push if changed.
# Run from cron. The push helper authenticates through the Secure Vault, so this
# needs the VM's authd socket (present in the normal agent runtime).
set -euo pipefail
cd "$(dirname "$0")/.."

# Sacramento sources gate the run. These feed the pages we actually publish, so
# a failure here must stop the push rather than quietly ship a thinner calendar.
python3 scripts/refresh_storytimes.py          # Sacramento-area library storytimes
python3 scripts/refresh_scm_events.py          # Sacramento Children's Museum weekly programs
python3 scripts/refresh_attraction_events.py  # Zoo, Fairytale Town, Effie Yeaw,
                                               # MOSAC, Cosumnes CSD official calendars
python3 scripts/refresh_classes.py            # Kids classes: re-verify listings
                                               # against official provider pages,
                                               # prune verifiably ended sessions

# Marin sources are kept warm but must NOT gate the run. build.py filters towns
# to FOCUS_REGION ('sac'), so nothing these write is rendered today — and both
# exit non-zero when their source yields nothing, which under `set -e` used to
# abort the whole refresh and leave Sacramento un-rebuilt and un-pushed over an
# outage at a Mill Valley library. If FOCUS_REGION ever widens to 'marin', move
# these back above the line so their failures gate the push again.
python3 scripts/refresh_marin_storytimes.py || echo "warning: marin storytimes refresh failed; keeping last known-good" >&2
python3 scripts/refresh_marin_events.py       || echo "warning: marin events refresh failed; keeping last known-good" >&2

# Jev quality gate: every event file (weekly + dated one-offs) is re-checked
# nightly. Confident rejects (stale/expired, not kid-appropriate) are moved to
# data/events_quarantine.json for review instead of being silently deleted, and
# a Jev/API failure keeps everything (fail-open) so the calendar never thins
# out over an outage. Non-fatal on purpose, like geocoding below.
shopt -s nullglob
python3 scripts/gate_events.py \
  --events data/events.json data/dated_events_*.json \
  --quarantine data/events_quarantine.json \
  || echo "warning: Jev quality gate failed; keeping last known-good" >&2
shopt -u nullglob

# New venues appear whenever the library rotates storytimes to a branch we have
# not seen. This only looks up the ones missing coordinates, so it is usually a
# no-op. Non-fatal on purpose: a geocoder outage must not block the push, and
# events without coordinates simply show no distance.
python3 scripts/geocode_venues.py || echo "warning: venue geocoding failed; events may show no distance" >&2

python3 build.py

if [ -z "$(git status --porcelain)" ]; then
  echo "no changes"
  exit 0
fi

# gh-push-tree lives outside the repo (it holds no secrets; auth comes from the
# Secure Vault at call time).
~/workspace/skills/github/bin/gh-push-tree "$(pwd)" "Daily storytime refresh ($(date +%F))" main

# Keep the local clone in sync with what was just pushed so tomorrow's
# `git status` only shows genuinely new changes.
git fetch -q origin main
git reset -q --hard origin/main
echo "pushed and synced"
