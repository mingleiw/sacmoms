#!/usr/bin/env python3
"""Daily refresh of kids classes (data/classes_sac.json).

Re-verifies every class against its official source page and prunes
listings whose sessions have verifiably ended. Each class is handled
independently: one provider's site being down never wipes another
provider's listing.

Per class:
  1. Parse the session end date from the `session` field
     ("Oct 4 - Dec 6, 2026" -> 2026-12-06; "Ongoing enrollment" -> none).
  2. Fetch the official `source` URL (curl, retries, like the other
     refresh scripts).
  3. If the page is unreachable or has no usable text (JS-rendered,
     bot-blocked), the class is kept as-is and flagged NEEDS REVIEW.
     We never drop a listing over a fetch failure.
  4. If the session end date is in the past:
       - page usable and the class name is gone with no sign of an
         upcoming session -> drop the class (reported).
       - otherwise -> keep, flagged NEEDS REVIEW (session ended).

The script exits nonzero only on structural problems (unreadable JSON,
nothing left to write). Individual verification failures are warnings,
so a flaky provider site never blocks the nightly push.

Deliberately NOT auto-updated (reported for a human instead):
  - price / schedule changes (too easy to mis-scrape; the output flags
    classes whose session ended so prices get re-checked then anyway)
  - new sessions for a dropped class (added via browser research, like
    the original listings)
"""
import datetime as dt
import html
import json
import os
import re
import subprocess
import sys
import time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data")
CLASSES_JSON = os.path.join(DATA, "classes_sac.json")
UA = "sacmoms-refresh/1.0 (daily refresh; contact via github.com/mingleiw/sacmoms)"

MONTHS = {m.lower(): i + 1 for i, m in enumerate(
    ["January", "February", "March", "April", "May", "June", "July",
     "August", "September", "October", "November", "December"])}
# 3-letter lookups for session strings like "Oct 4 - Dec 6, 2026"
MONTH_ABBR = {k[:3]: v for k, v in MONTHS.items()}

SESSION_RE = re.compile(
    r"([A-Za-z]{3,9})\s+(\d{1,2})\s*[-\u2013\u2014]\s*"
    r"(?:([A-Za-z]{3,9})\s+)?(\d{1,2}),?\s*(\d{4})")

# Language suggesting enrollment is still open / upcoming on a provider page.
OPEN_RE = re.compile(
    r"regist(er|ration)|enroll|upcoming|now enrolling|open for registration|"
    r"fall 2026|winter 2026|2026[-\s]?2027", re.I)
# A date-like mention in 2026+ (e.g. "October 4, 2026", "10/4/2026").
FUTURE_DATE_RE = re.compile(
    r"(January|February|March|April|May|June|July|August|September|October|"
    r"November|December)\s+\d{1,2}(?:\s*[-,]\s*|\s*,\s*)202[67]"
    r"|\b\d{1,2}/\d{1,2}/202[67]\b", re.I)


def fetch(url, retries=4):
    body = ""
    for _ in range(retries):
        r = subprocess.run(["curl", "-sL", "--max-time", "40", "-A", UA, url],
                           capture_output=True, text=True)
        body = r.stdout or ""
        if body and "sgcaptcha" not in body:
            return body
        time.sleep(10)
    return body


def page_text(html_doc):
    t = re.sub(r"<script.*?</script>|<style.*?</style>", " ", html_doc, flags=re.S)
    t = re.sub(r"<[^>]+>", " ", t)
    t = html.unescape(t)
    return re.sub(r"\s+", " ", t)


def session_end(session):
    """End date of a session string, or None for ongoing/unknown."""
    if not session:
        return None
    m = SESSION_RE.search(session)
    if not m:
        return None
    end_month = m.group(3) or m.group(1)
    try:
        return dt.date(int(m.group(5)), MONTH_ABBR[end_month.lower()[:3]], int(m.group(4)))
    except (KeyError, ValueError):
        return None


def significant_words(name):
    stop = {"kids", "kid", "youth", "junior", "jr", "little", "tiny", "class",
            "classes", "club", "team", "league", "level", "lessons", "lesson"}
    return [w for w in re.findall(r"[A-Za-z0-9]+", name.lower())
            if w not in stop and len(w) > 2]


def name_on_page(name, text):
    tl = text.lower()
    if name.lower() in tl:
        return True
    words = significant_words(name)
    return len(words) >= 2 and all(w in tl for w in words)


def refresh_class(cls, today):
    """Returns (keep: bool, note: str)."""
    name = cls.get("name", "?")
    url = cls.get("source") or cls.get("registration_url") or ""
    end = session_end(cls.get("session", ""))
    ended = end is not None and end < today

    if not url:
        return True, "no source URL; kept (NEEDS REVIEW)"

    text = page_text(fetch(url))
    if len(text) < 1500:
        # JS-rendered, bot-blocked, or down: unverifiable, never drop.
        why = "session ended %s" % end.isoformat() if ended else "page unverifiable"
        return True, "%s; kept (NEEDS REVIEW)" % why

    on_page = name_on_page(name, text)
    if not ended:
        return True, "session current through %s" % end.isoformat() if end else "ongoing; listed on source page" if on_page else "ongoing; name not found on page (layout may have changed), kept"

    # Session ended: look for a renewed/upcoming session before dropping.
    window = text
    if on_page:
        idx = text.lower().find(name.lower().split()[0])
        window = text[max(0, idx - 1500):idx + 1500]
    if OPEN_RE.search(window) and FUTURE_DATE_RE.search(window):
        return True, ("session ended %s but page shows upcoming enrollment; "
                      "kept (NEEDS REVIEW: update session dates)" % end.isoformat())
    if on_page:
        return True, ("session ended %s; class still named on page but no upcoming "
                      "session found; kept (NEEDS REVIEW)" % end.isoformat())
    return False, "session ended %s and class no longer appears on source page; DROPPED" % end.isoformat()


def main():
    today = dt.date.today()
    try:
        with open(CLASSES_JSON, encoding="utf-8") as f:
            classes = json.load(f)
    except (OSError, ValueError) as ex:
        print("ERROR: cannot read %s: %s" % (CLASSES_JSON, ex), file=sys.stderr)
        return 1
    if not isinstance(classes, list) or not classes:
        print("ERROR: %s is empty or not a list; refusing to wipe" % CLASSES_JSON,
              file=sys.stderr)
        return 1

    kept, dropped, review = [], [], []
    for cls in classes:
        try:
            keep, note = refresh_class(cls, today)
        except Exception as ex:  # noqa: BLE001 - per-class fail-soft
            keep, note = True, "verification crashed (%s); kept" % ex
        print("  [%s] %s -- %s" % ("keep" if keep else "DROP", cls.get("name"), note))
        (kept if keep else dropped).append(cls)
        if "NEEDS REVIEW" in note:
            review.append(cls.get("name"))

    if not kept:
        print("ERROR: every class would be dropped; refusing to wipe %s" % CLASSES_JSON,
              file=sys.stderr)
        return 1

    with open(CLASSES_JSON, "w", encoding="utf-8") as f:
        json.dump(kept, f, indent=2, ensure_ascii=False)
        f.write("\n")
    print("classes refresh: %d kept, %d dropped, %d need review" %
          (len(kept), len(dropped), len(review)))
    for n in review:
        print("  NEEDS REVIEW: %s" % n)
    return 0


if __name__ == "__main__":
    sys.exit(main())
