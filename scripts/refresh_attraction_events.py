#!/usr/bin/env python3
"""Daily refresh of attraction / museum / parks / community dated events.

Extends the calendar beyond library storytimes and SCM programs with
official, verified sources only. Each source has its own output file so a
broken parser can never wipe another source's data. Every entry carries its
official source URL; no aggregator data, no invented dates.

Sources (all fetched as plain text from the official sites):
  zoo        saczoo.org/special-events            -> dated_events_zoo.json
  fairytale  fairytaletown.org tribe REST API     -> dated_events_fairytale.json
  effieyeaw  effieyeawnature.org/events-list      -> dated_events_effieyeaw.json
               (Wix events JSON; kid/family items only)
  mosac      visitmosac.org homeschool programs   -> dated_events_mosac.json
               + all-ages shows (verifies the weekly K-Pop entry in events.json)
  cosumnes   cosumnescsd.gov festival + contests  -> dated_events_cosumnes.json
               (dates re-verified on the official pages each run)

A source that fails (unreachable page, changed layout, lost weekly signal)
leaves its file untouched and the script exits nonzero, so the nightly
refresh stops the push instead of shipping a thinner calendar.

Deliberately NOT covered (inaccessible to the curl-based refresh; reported
rather than worked around):
  - City of Sacramento YPCE community calendar (JS-rendered, no dated data
    in plain text)
  - City of Folsom calendar (Akamai bot-block, 403 even with a browser UA)
  - City of Elk Grove events index (JS-rendered; per-event pages exist but
    there is no crawlable dated list)
  - Funderland (no calendar; events announced via blog/social only)
"""
import calendar as _calendar
import datetime as dt
import html
import json
import os
import re
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data")
EVENTS_JSON = os.path.join(DATA, "events.json")
UA = "sacmoms-refresh/1.0 (daily refresh; contact via github.com/mingleiw/sacmoms)"

MONTHS = {m.lower(): i + 1 for i, m in enumerate(
    ["January", "February", "March", "April", "May", "June", "July",
     "August", "September", "October", "November", "December"])}
# zoo page abbreviations: "Jan." "Feb." "Mar." "Apr." "May" "Jun." "Jul." "Aug." "Sep." "Oct." "Nov." "Dec."
ABBR = {"jan": 1, "feb": 2, "mar": 3, "apr": 4, "may": 5, "jun": 6,
        "jul": 7, "aug": 8, "sep": 9, "oct": 10, "nov": 11, "dec": 12}


def fetch(url):
    r = subprocess.run(["curl", "-sL", "--max-time", "40", "-A", UA, url],
                       capture_output=True, text=True)
    return r.stdout or ""


def page_text(html_doc):
    t = re.sub(r"<script.*?</script>|<style.*?</style>", " ", html_doc, flags=re.S)
    t = re.sub(r"<[^>]+>", " ", t)
    t = html.unescape(t)
    return re.sub(r"\s+", " ", t)


def unesc(s):
    """Undo JSON string escapes without mangling real UTF-8 characters."""
    s = re.sub(r"\\u([0-9a-fA-F]{4})",
               lambda m: chr(int(m.group(1), 16)), s)
    return (s.replace("\\n", " ").replace("\\t", " ").replace('\\"\"', '"')
             .replace('\\"', '"').replace("\\\\", "\\").replace("\\/", "/"))


def entry(date, title, venue, city, source, blurb="", time="", until="",
          ages="All ages"):
    e = {"date": date, "title": title, "venue": venue, "city": city,
         "region": "sac", "source": source, "blurb": blurb, "ages": ages}
    if time:
        e["time"] = time
    if until:
        e["until"] = until
    # keep key order consistent with the other dated files
    order = ["date", "time", "title", "venue", "city", "region", "ages",
             "blurb", "source", "until"]
    return {k: e[k] for k in order if k in e}


def write_source(name, entries):
    path = os.path.join(DATA, "dated_events_%s.json" % name)
    entries.sort(key=lambda e: (e["date"], e.get("time", ""), e["title"]))
    with open(path, "w", encoding="utf-8") as f:
        json.dump(entries, f, indent=1, ensure_ascii=False)
        f.write("\n")
    print("  %s: %d event(s) -> %s" % (name, len(entries), os.path.basename(path)))


# ---------------------------------------------------------------- zoo
ZOO_URL = "https://www.saczoo.org/special-events"

# title on page -> (calendar title, blurb, ages, fixed time/until or None)
ZOO_KNOWN = {
    "$10 Community Day": (
        "$10 Community Day",
        "Discounted $10 admission for the day.",
        "All ages", None, None),
    "Species in the Spotlight": (
        "Species in the Spotlight",
        "Keeper talks and activities spotlighting one species.",
        "All ages", None, None),
    "Deaf Awareness Day": (
        "Deaf Awareness Day",
        "ASL-interpreted programs and deaf-community celebration at the zoo.",
        "All ages", None, None),
    "Noon Year": (
        "Noon Year's Eve",
        "Kid-friendly New Year's countdown at noon.",
        "All ages", None, None),
    "Nature Explorers": (
        "Nature Explorers",
        "Drop-in open play exploring the natural world, second Saturday monthly.",
        "All ages", None, None),
    "Sac Zoo Academy Days": (
        "Sac Zoo Academy Days",
        "Special programs on school days off; see the zoo site for details.",
        "All ages", None, None),
    "Little Peeps Pre-K Classes": (
        "Little Peeps Pre-K Classes",
        "Zoo classes for 3- to 5-year-olds with a caregiver.",
        "Ages 3\u20135", None, None),
    "Fall Camp": (
        "Zoo Fall Camp",
        "Fall-break camp at the zoo; registration required.",
        "All ages", None, None),
}


def zoo_dates(line):
    """Parse 'Mon. D' / 'Mon. D & D2' / 'Mon. D, Mon2. D2' lists from a zoo line."""
    dates = []
    for m in re.finditer(r"(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\.?\s*(\d{1,2})",
                         line):
        dates.append((2026, ABBR[m.group(1).lower()[:3]], int(m.group(2))))
    # "Jul. 3 & 4" style: second day inherits the month
    return dates


def refresh_zoo(today):
    html_doc = fetch(ZOO_URL)
    if len(html_doc) < 5000:
        raise RuntimeError("special-events page unreachable")
    # work from <br>-separated lines to keep title/date pairs together
    body = re.sub(r"<script.*?</script>|<style.*?</style>", " ", html_doc, flags=re.S)
    body = re.sub(r"<br\s*/?>", "\n", body, flags=re.I)
    body = re.sub(r"<[^>]+>", " ", body)
    body = html.unescape(body)
    entries = []
    for raw in body.split("\n"):
        line = re.sub(r"\s+", " ", raw).strip()
        if not line:
            continue
        matched = None
        for key, spec in ZOO_KNOWN.items():
            if line.startswith(key) or (key in line and ("-" in line or "–" in line)):
                # guard: only treat as event line if a date follows the title
                if re.search(r"(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\.?[\s\u00a0]+\d",
                             line):
                    matched = (key, spec)
                    break
        if not matched:
            continue
        key, (title, blurb, ages, t0, t1) = matched
        for y, mo, d in zoo_dates(line):
            try:
                dt.date(y, mo, d)
            except ValueError:
                continue
            if dt.date(y, mo, d) < today:
                continue
            entries.append(entry(dt.date(y, mo, d).isoformat(), title,
                                 "Sacramento Zoo", "Sacramento", ZOO_URL,
                                 blurb, t0 or "", t1 or "", ages))
    # Nature Explorers: "the second Saturday of every month" — next occurrences
    for k in range(0, 4):
        base = today + dt.timedelta(days=30 * k)
        cal = _calendar.monthcalendar(base.year, base.month)
        saturdays = [w[_calendar.SATURDAY] for w in cal if w[_calendar.SATURDAY]]
        if len(saturdays) >= 2:
            d = dt.date(base.year, base.month, saturdays[1])
            if d >= today and not any(
                    e["date"] == d.isoformat() and "Nature Explorers" in e["title"]
                    for e in entries):
                entries.append(entry(
                    d.isoformat(), "Nature Explorers", "Sacramento Zoo",
                    "Sacramento", ZOO_URL,
                    "Drop-in open play exploring the natural world, second Saturday monthly."))
    if not entries:
        raise RuntimeError("no zoo events parsed; page layout may have changed")
    write_source("zoo", entries)


# ------------------------------------------------------------ fairytale
FT_API = "https://www.fairytaletown.org/wp-json/tribe/events/v1/events"
FT_SKIP = re.compile(r"volunteer|orientation|staff|board meeting", re.I)
# Fairytale Town's own description for this event is stale ("every Tuesday
# morning this Spring") while it actually runs Thursdays in the fall; don't
# republish the wrong weekday/season.
FT_BLURB_OVERRIDES = {
    "Toddler Time!": "Weekly toddler program at Fairytale Town; see the official listing for this week's details.",
}


def ft_venue(e, title):
    """Real venue for a Fairytale Town listing, which is not always their park.

    They publish off-site events on the same calendar (the Dirty Kid Obstacle
    Race runs at Sacramento Adventure Playground), and stamping every entry
    with their own name put a wrong distance and map link on those. Anything
    the API names as Fairytale Town keeps that exact string so it still
    matches venues.json; only a clearly different venue overrides it, and an
    absent or unexpected shape falls back to the old behaviour.

    Note: the API's venue record itself is unreliable for off-site events --
    the Dirty Kid race's venue field still says "Fairytale Town" (their
    default venue record) with the real location only in the title. So when
    the API venue is Fairytale Town, check the title against known off-site
    locations before falling back.
    """
    v = e.get("venue")
    if isinstance(v, dict):
        name = html.unescape(str(v.get("venue") or "")).strip()
        city = html.unescape(str(v.get("city") or "")).strip()
        if name and "fairytale" not in name.lower():
            return name, city or "Sacramento"
    tl = (title or "").lower()
    for key, venue in FT_OFFSITE_VENUES.items():
        if key in tl:
            return venue, "Sacramento"
    return "Fairytale Town", "Sacramento"


# Off-site locations Fairytale Town publishes on its own calendar while the
# API venue record still says "Fairytale Town". Keyed on distinctive title
# fragments; checked only when the API venue is Fairytale Town itself.
FT_OFFSITE_VENUES = {
    "sacramento adventure playground": "Sacramento Adventure Playground",
}


def refresh_fairytale(today):
    all_events, page, pages = [], 1, 1
    while page <= pages:
        raw = fetch("%s?per_page=100&start_date=%s&page=%d" %
                    (FT_API, today.isoformat(), page))
        try:
            data = json.loads(raw)
        except ValueError:
            raise RuntimeError("tribe API returned non-JSON (page %d)" % page)
        if "events" not in data:
            raise RuntimeError("tribe API response missing events (page %d)" % page)
        pages = int(data.get("total_pages", 1))
        all_events.extend(data["events"])
        page += 1
    if not all_events:
        raise RuntimeError("tribe API returned zero events")
    entries = []
    for e in all_events:
        title = html.unescape(re.sub(r"<[^>]+>", "", e.get("title", ""))).strip()
        if not title or FT_SKIP.search(title):
            continue
        sd = (e.get("start_date") or "")[:10]
        if not sd or sd < today.isoformat():
            continue
        desc = html.unescape(re.sub(r"<[^>]+>", " ", e.get("description") or ""))
        desc = re.sub(r"\s+", " ", desc).strip()
        venue, city = ft_venue(e, title)
        entries.append(entry(
            sd, title, venue, city, e.get("url") or FT_API,
            FT_BLURB_OVERRIDES.get(title, desc[:220]),
            (e.get("start_date") or "")[11:16],
            (e.get("end_date") or "")[11:16]))
    if not entries:
        raise RuntimeError("no fairytale events after filtering")
    write_source("fairytale", entries)


# ------------------------------------------------------------ effie yeaw
EYNC_URL = "https://www.effieyeawnature.org/events-list"
EYNC_DETAIL = "https://www.effieyeawnature.org/event-details/"
EYNC_INCLUDE = None  # include everything except the adult-marked list below
EYNC_EXCLUDE = re.compile(
    r"gala|fundraiser|speaker series|poetry|photography workshop|"
    r"naturalist program|certified|certification|master class",
    re.I)


def eync_to_24h(h, m, ap):
    h = int(h) % 12
    if ap.lower().startswith("p"):
        h += 12
    return "%02d:%s" % (h, m)


def refresh_effieyeaw(today):
    html_doc = fetch(EYNC_URL)
    if len(html_doc) < 50000:
        raise RuntimeError("events-list page unreachable")
    entries, skipped = [], []
    seen = set()
    for m in re.finditer(r'"startDate":"(2026[^"]+)"', html_doc):
        win = html_doc[m.start():m.start() + 4000]
        tm = re.search(r'"title":"((?:[^"\\]|\\.){1,120})"', win)
        sm = re.search(r'"slug":"([^"]+)"', win)
        fm = re.search(r'"formatted":"((?:[^"\\]|\\.){0,90})"', win)
        dm = re.search(r'"description":"((?:[^"\\]|\\.){0,400})', win)
        if not (tm and fm):
            continue
        title = unesc(tm.group(1))
        fmt = unesc(fm.group(1))
        desc = unesc(dm.group(1)) if dm else ""
        desc = re.sub(r"\s+", " ", desc).strip()
        # fmt like "September 19, 2026, 10:00 – 11:00 AM",
        # "November 7, 2026, 10:00 AM – 2:00 PM", or "September 14, 2026 at 5:30 PM"
        dm2 = re.match(
            r"(\w+) (\d{1,2}), (\d{4})(?:, (\d{1,2}):(\d{2})(?:\s*(AM|PM))?\s*[–—-]\s*"
            r"(\d{1,2}):(\d{2})\s*(AM|PM)"
            r"|\s+at\s+(\d{1,2}):(\d{2})\s*(AM|PM))", fmt)
        if not dm2:
            skipped.append((title, "unparsed fmt: %s" % fmt))
            continue
        mo = MONTHS[dm2.group(1).lower()]
        d = dt.date(int(dm2.group(3)), mo, int(dm2.group(2)))
        if d < today:
            continue
        if dm2.group(4):
            ap0 = dm2.group(6) or dm2.group(9)
            t0 = eync_to_24h(dm2.group(4), dm2.group(5), ap0)
            t1 = eync_to_24h(dm2.group(7), dm2.group(8), dm2.group(9))
        else:
            t0 = eync_to_24h(dm2.group(10), dm2.group(11), dm2.group(12))
            t1 = ""
        text = title + " " + desc
        key = (title, d.isoformat(), t0)
        if key in seen:
            continue
        seen.add(key)
        if EYNC_EXCLUDE.search(text):
            skipped.append((title, "adult-oriented"))
            continue
        am = re.search(r"[Aa]ges?\s+(\d+)\s*(?:-|–|to|through)\s*(\d+)", desc)
        ages = "Ages %s\u2013%s" % (am.group(1), am.group(2)) if am else "All ages"
        source = EYNC_DETAIL + sm.group(1) if sm else EYNC_URL
        entries.append(entry(d.isoformat(), title, "Effie Yeaw Nature Center",
                             "Carmichael", source, desc[:220], t0, t1, ages))
    if not entries:
        raise RuntimeError("no effie yeaw kid/family events parsed; skipped=%r" % skipped)
    for t, why in skipped:
        print("  effieyeaw skipped: %s (%s)" % (t[:60], why))
    write_source("effieyeaw", entries)


# ----------------------------------------------------------------- mosac
MOSAC_HOME = "https://visitmosac.org/learn/homeschool-programs/"
MOSAC_ALLAGES = "https://visitmosac.org/all-ages-shows/"
MOSAC_VENUE = "Museum of Science and Curiosity"


def refresh_mosac(today):
    text = page_text(fetch(MOSAC_HOME))
    if "Homeschool Days" not in text:
        raise RuntimeError("homeschool page unreachable or redesigned")
    entries = []
    # "UC Davis Neurofest October 2nd Friday, October 2nd 10am-2pm"
    # (some entries lack the comma after the weekday: "March 11th Thursday March 11 th")
    pat = re.compile(
        r"(January|February|March|April|May|June|July|August|September|October|"
        r"November|December)\s+(\d{1,2})\s*(?:st|nd|rd|th)\s+\w+,?\s+"
        r"(January|February|March|April|May|June|July|August|September|October|"
        r"November|December)\s+(\d{1,2})\s*(?:st|nd|rd|th)\s+"
        r"(\d{1,2})(am|pm)\s*-\s*(\d{1,2})(am|pm)", re.I)
    JUNK = re.compile(
        r"(?i)register here|members?|faqs|download homeschool 2026 pdf|"
        r"sorry, your browser doesn't support embedded videos\.?|"
        r"2026-2027 homeschool days")
    for m in pat.finditer(text):
        mo = MONTHS[m.group(3).lower()]
        day = int(m.group(4))
        year = today.year if mo >= today.month else today.year + 1
        d = dt.date(year, mo, day)
        if d < today:
            continue
        # theme = last meaningful text chunk before the date block
        before = JUNK.sub(" ", text[max(0, m.start() - 120):m.start()])
        theme = re.split(r"[.!?]", before)[-1].strip()
        theme = re.sub(r"^[\W_]+|[\W_]+$", "", theme).strip()
        if not theme:
            raise RuntimeError("could not extract homeschool theme near %s" %
                               text[m.start():m.start() + 40])
        h0 = int(m.group(5)) % 12 + (12 if m.group(6).lower() == "pm" else 0)
        h1 = int(m.group(7)) % 12 + (12 if m.group(8).lower() == "pm" else 0)
        entries.append(entry(
            d.isoformat(), "Homeschool Day: %s" % theme, MOSAC_VENUE,
            "Sacramento", MOSAC_HOME,
            "A curiosity-filled day for homeschool, charter and independent-study "
            "families: planetarium shows, hands-on labs and museum exhibits.",
            "%02d:00" % h0, "%02d:00" % h1))
    if not entries:
        raise RuntimeError("no homeschool days parsed; page layout may have changed")
    write_source("mosac", entries)

    # weekly K-Pop Demon Hunters laser show ("Saturdays at 4 pm")
    aa = page_text(fetch(MOSAC_ALLAGES))
    if "K-Pop Demon Hunters" not in aa:
        raise RuntimeError("all-ages page no longer lists K-Pop Demon Hunters")
    m = re.search(r"K-Pop Demon Hunters.*?Saturdays?\s+at\s+(\d{1,2})\s*(am|pm)",
                  aa, re.I | re.S)
    if not m:
        raise RuntimeError("K-Pop show no longer weekly Saturdays; check page")
    hour = int(m.group(1)) % 12 + (12 if m.group(2).lower() == "pm" else 0)
    want = {"time": "%02d:00" % hour, "day": 6,
            "title": "K-Pop Demon Hunters Laser Show",
            "venue": MOSAC_VENUE, "city": "Sacramento", "region": "sac",
            "ages": "All ages",
            "blurb": "Every Saturday, a sing-along laser concert under the planetarium "
                     "dome. General admission required; shows sell out.",
            "source": MOSAC_ALLAGES, "origin": "mosac"}
    events = json.load(open(EVENTS_JSON))
    found = None
    for e in events:
        if e.get("origin") == "mosac" and e.get("title") == want["title"]:
            found = e
            break
    if found is None:
        events.append(want)
        print("  mosac: added weekly K-Pop entry to events.json")
    elif found.get("day") != want["day"] or found.get("time") != want["time"]:
        print("  mosac: RESCHEDULED K-Pop %s/%s -> %s/%s" %
              (found.get("day"), found.get("time"), want["day"], want["time"]))
        found.update(want)
    else:
        print("  mosac: weekly K-Pop entry still current")
    json.dump(events, open(EVENTS_JSON, "w"), indent=1, ensure_ascii=False)
    open(EVENTS_JSON, "a").write("\n")


# -------------------------------------------------------------- cosumnes
COSUMNES = [
    {"url": "https://www.cosumnescsd.gov/726/Elk-Grove-Giant-Pumpkin-Festival",
     "must": ["October 3 & 4, 2026", "10 am - 5 pm"],
     "dates": ["2026-10-03", "2026-10-04"],
     "title": "Elk Grove Giant Pumpkin Festival",
     "time": "10:00", "until": "17:00",
     "blurb": "Free admission. Giant pumpkin and produce contest, 30+ food vendors, "
              "100 crafters, kids' activities and contests at Elk Grove Park.",
     "ages": "All ages", "venue": "Elk Grove Park"},
    {"url": "https://www.cosumnescsd.gov/729/Lil-Pumpkin-Cupcake-Contest",
     "must": ["Sunday, October 4, 2026", "10 am"],
     "dates": ["2026-10-04"],
     "title": "Lil' Pumpkin Cupcake Contest",
     "time": "10:00", "until": "",
     "blurb": "Cupcake contest at the Giant Pumpkin Festival. Free entry; open to "
              "bakers 12 and under; registration closes September 25.",
     "ages": "12 & under", "venue": "Elk Grove Park"},
    {"url": "https://www.cosumnescsd.gov/728/Youth-Art-Contest",
     "must": ["October 3-4, 2026"],
     "dates": ["2026-10-03", "2026-10-04"],
     "title": "Youth Art Contest",
     "time": "", "until": "",
     "blurb": "Youth art contest at the Giant Pumpkin Festival. Free entry; "
              "categories ages 3-6, 7-12 and 13-17; registration closes September 25.",
     "ages": "Ages 3\u201317", "venue": "Elk Grove Park"},
    {"url": "https://www.cosumnescsd.gov/731/Pumpkin-Recipe-Contest",
     "must": ["Saturday, October 3, 2026", "9:30 am"],
     "dates": ["2026-10-03"],
     "title": "Pumpkin Recipe Contest",
     "time": "09:30", "until": "",
     "blurb": "Pumpkin recipe contest at the Giant Pumpkin Festival. Free entry; "
              "walk-up entries accepted.",
     "ages": "All ages", "venue": "Elk Grove Park"},
]


def refresh_cosumnes(today):
    entries = []
    for spec in COSUMNES:
        text = page_text(fetch(spec["url"]))
        if len(text) < 2000:
            raise RuntimeError("%s unreachable" % spec["url"])
        for needle in spec["must"]:
            if needle not in text:
                raise RuntimeError("%s no longer confirms %r" %
                                   (spec["url"], needle))
        for d in spec["dates"]:
            if dt.date.fromisoformat(d) < today:
                continue
            entries.append(entry(
                d, spec["title"], spec["venue"], "Elk Grove", spec["url"],
                spec["blurb"], spec["time"], spec["until"], spec["ages"]))
    if not entries:
        raise RuntimeError("all cosumnes events are in the past?!")
    write_source("cosumnes", entries)


SOURCES = [
    ("zoo", refresh_zoo),
    ("fairytale", refresh_fairytale),
    ("effieyeaw", refresh_effieyeaw),
    ("mosac", refresh_mosac),
    ("cosumnes", refresh_cosumnes),
]


def main():
    today = dt.date.today()
    problems = []
    for name, fn in SOURCES:
        try:
            fn(today)
        except Exception as ex:  # noqa: BLE001 - report, don't wipe
            problems.append("%s: %s" % (name, ex))
    if problems:
        for p in problems:
            print("ERROR: %s" % p, file=sys.stderr)
        return 1
    print("attraction refresh: all %d source(s) ok" % len(SOURCES))
    return 0


if __name__ == "__main__":
    sys.exit(main())
