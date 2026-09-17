# SacMoms

Where to take the kids in Sacramento County.

One page per city. Pick a city, get the places near it sorted by distance, with
the parking and weather notes that decide whether it's worth the drive.

```
/                    city picker — dropdown plus a crawlable list of every city
/sacramento/         places near Sacramento, closest first
/elk-grove/          places near Elk Grove, closest first
/folsom/  /rancho-cordova/  /citrus-heights/
```

`FOCUS_REGION` at the top of `build.py` is what limits this to five pages. It is
set to `'sac'`, so only Sacramento-region towns are generated, even though `data/`
still carries Bay Area towns and places from the site's earlier scope. Widening it
is a one-line change — but read *Which cities get a page* below first, because the
guards that are supposed to make extra pages safe do not currently bite.

## Files

```
build.py             generates every page — run this after editing data
data/places.json     30 destinations (9 in the Sacramento region)
data/events.json     51 recurring weekly events (7 in the Sacramento region)
data/towns.json      46 towns with coordinates (5 in the Sacramento region)
templates/           shared fragments (icon sprite, "Before you go")
assets/style.css     styles, shared by every page
assets/app.js        client script, shared by every city page
index.html           GENERATED — do not edit
<city-slug>/         GENERATED — do not edit
sitemap.xml          GENERATED
```

**Anything marked GENERATED is overwritten by `build.py`.** Edit the JSON, then
rebuild. Generated city directories carry a `.generated` marker file so the build
can clean up ones that no longer qualify.

## Building

```sh
python3 build.py
```

No dependencies — standard library only. The output is committed, so GitHub Pages
still serves plain static files and nothing runs on deploy.

Why a build step, when "no build step" used to be the point: a city page needs its
places sorted by distance *from that city*. Doing that here rather than in the
browser means each page ships genuinely different, crawlable content, and the
whole list still renders with JavaScript off.

## Deploying

**Settings → Pages → Deploy from a branch → `main` → `/ (root)`**

Once enabled, live at <https://mingleiw.github.io/sacmoms/>

Push to `main` and Pages redeploys. Run `build.py` and commit its output first, or
the live site won't reflect your data edits.

If the repo is ever renamed, or a custom domain is pointed at it, change
`BASE_URL` at the top of `build.py` and rebuild. It drives every canonical URL and
the sitemap, and a wrong value quietly tells search engines the pages live
somewhere they don't.

## Which cities get a page

Two thresholds in `build.py`:

| Constant | Value | What it controls |
| --- | --- | --- |
| `MIN_PLACES` | 4 | A city needs this many places within `MAX_MILES` to get a page at all |
| `MAX_MILES` | 25 | The radius that qualification is measured over |
| `LIST_MILES` | 40 | A city page only lists places within this far |

All 5 Sacramento-region towns qualify; none are skipped.

### The guards are currently inert — read this before adding cities

These thresholds exist because publishing many pages that carry the same content
in a different order is the doorway-page pattern search engines demote, and the
stated long-term plan is ads, so indexability is load-bearing.

Under the old Bay Area scope they did real work. Under `FOCUS_REGION = 'sac'` they
do not. All 9 Sacramento places are within 40 miles of all 5 Sacramento towns, so
`LIST_MILES` excludes nothing, and every city page carries:

- the **same 9 places**, differing only in sort order and the printed distances
- the **same 35 events** — a byte-identical `EVENTS` payload, because `build.py`
  matches dated and weekly events on `region`, not on proximity to the town

Folsom, Rancho Cordova and Citrus Heights currently share an identical top-four.
That is the pattern the thresholds were added to prevent, now happening.

It is defensible at five pages: the distance ordering is genuinely the answer a
parent wants, and five near-identical pages is not a doorway farm. It stops being
defensible as city count grows. **Before adding cities, make the pages differ in
substance, not order** — the honest fixes are per-town events (match events by
distance from the town, not by region) and places dense enough that `LIST_MILES`
starts excluding some. Lowering the thresholds is not a fix; it is the symptom.

## Adding a place

Add an object to `data/places.json` and rebuild. It appears automatically on
every city page within `LIST_MILES` of it.

```jsonc
{
  "name": "Fairytale Town",
  "where": "William Land Park, Sacramento",   // shown under the name
  "desc": "Storybook sets built at child scale…",
  "note": "Shares the park with the zoo…",     // the "Before you go" line
  "cta": "Map, hours &amp; tickets",
  "mapq": "Fairytale+Town+Sacramento+CA",      // Google Maps search query
  "icon": "i-play",                            // see templates/sprite.svg
  "cat": "play",                               // colour coding
  "age": "0-2 3-5 6-9",                        // space separated
  "region": "sac",
  "env": "outdoor",                            // "indoor", "outdoor", or both
  "lat": 38.535, "lon": -121.503,              // required: drives everything
  "ages": "Under 10", "envlabel": "Outdoors"   // human labels for the tags
}
```

`age` and `env` must match the filter buttons' `data-v` values exactly
(`0-2` `3-5` `6-9` `10+`, and `indoor` `outdoor`) or the card can never be
filtered to. `cat` is one of `science` `animals` `outdoors` `play` `making`
`water` and only sets the icon colour.

**Coordinates are the important field.** They decide which city pages the place
appears on, in what order, and what distance is printed. The current ones are
hand-entered approximations — good enough to rank 5 miles against 40, not
surveyed.

## Adding a weekly event

Add to `data/events.json`. Events show on city pages whose region matches.

```jsonc
{
  "day": 6,                     // 0=Sun … 6=Sat
  "time": "08:00",              // OPTIONAL. 24h. Omit if the hour is genuinely
                                // unknown — never guess it; see below
  "timeLabel": "Mornings",      // OPTIONAL. Shown instead of a clock when `time`
                                // is absent but the period IS sourced
  "until": "12:00",             // optional
  "title": "Elk Grove Certified Farmers' Market",
  "venue": "Laguna Gateway Center", "city": "Elk Grove",
  "region": "sac", "ages": "All ages",
  "blurb": "Year-round Saturday market…",
  "source": "https://…"         // REQUIRED
}
```

**`source` is not optional.** Every listing renders a "Where this came from"
link, so a parent can verify it in one tap. No source, no listing.

**`time` is optional, and that is deliberate.** A confirmed day at a confirmed
venue is worth listing even when the hour isn't known; a guessed clock time is
not, because a family drives to it. Omit `time` and the row renders "Time not
confirmed", sorts after the timed events, and shows its source link so the hour
can be checked. Do not fill it in with a plausible-looking value.

If the source says something real but vague — "each Saturday morning" — put that
in `timeLabel` and leave `time` out. It carries what is known and no more.

### What does not fit this model

**Sacramento Public Library storytimes** are the dated exception to the rule
above — they are covered in the next section, not here. Do not encode them as
weekly recurrences: they are scheduled per date and rotate between branches,
so a "Saturdays at Franklin" rule would be wrong most weeks.

**Registered classes** (Cosumnes CSD Toddler Time, Buddy Bunch). You enrol in
those; they are not drop-in, so they do not belong on a "what's on today" page.

**The Elk Grove library** has a grand opening on **10 October 2026** at its new
address, 9260 Elk Grove Blvd. Nothing is listed there until it is open and a
schedule is published.

### Why recurring events, not a dated calendar

A static site has no editor to retire stale entries. A one-off date is wrong
forever once it passes. A weekday rule — *"Saturdays at 8"* — stays true for
months, and the browser works out which dates it lands on. It's the version of an
events calendar that a static site can keep honest.

### The dated exception: library storytimes, refreshed daily

**Sacramento Public Library storytimes** rotate between branches on a per-date
schedule, so they cannot be encoded as weekday rules. Instead they are scraped
as dated instances:

- `scripts/refresh_storytimes.py` fetches the library's public event listing
  and writes real instances — each with its own per-event source URL — to
  `data/dated_events_sac.json`. Cancelled and rescheduled instances are dropped.
  Stdlib only; reads the public listing, nothing else.

**Mill Valley Public Library storytimes** are published as dated instances
through the library's public LibCal calendar:

- `scripts/refresh_marin_storytimes.py` queries that JSON feed day-by-day and
  writes the storytime instances to `data/dated_events_marin.json`. Each source
  owns its own file so a broken scraper can never wipe another source's data.
- **Nothing it writes is rendered today.** `FOCUS_REGION = 'sac'` filters towns
  to the Sacramento region, and events match on `region`, so the Marin files are
  kept warm for a future scope widening and nothing more.

- `build.py` folds the next 7 days of dated events into each town page of the
  matching region alongside the weekly events. `assets/app.js` matches them by
  date (`e.date`) while weekly events keep matching by day-of-week (`e.day`).
- A daily cron (`scripts/daily_refresh.sh`) runs the scrapers, rebuilds, commits
  and pushes. Each script exits non-zero without touching its file when its
  source yields zero storytimes, so a bad scrape reports instead of publishing an
  empty calendar.
- **The Sacramento scrapers gate that run; the Marin ones deliberately do not.**
  The script is `set -e`, so before this was split, a Mill Valley outage aborted
  the refresh and left Sacramento un-rebuilt and un-pushed over data that is not
  even rendered. The Marin calls now carry `|| echo warning`. If `FOCUS_REGION`
  ever widens to include Marin, move them back above the line in that script so
  their failures gate the push again.

If the scrape ever fails or the listing markup changes, the site falls back to
the weekly events — it never invents storytimes to fill the gap. Do not add
library storytimes to `data/events.json` as weekly recurrences.

## Editorial rule

**No opening hours, admission prices or one-off dates anywhere on the page.**

They change constantly and a stale value sends a family on a wasted trip. Cards
carry only things that rarely change, plus a map link that's always current.

Map links are Google Maps *search* links, not specific URLs, so they can't 404 and
survive a venue redesigning its website.

## Ads

Two comment markers sit where an ad unit would go — one on the root page between
the picker and the city index, one on each city page above the shortlist. Search
for `ad slot` in `build.py`.

If ads happen, the SEO notes above stop being theoretical: revenue tracks traffic,
traffic tracks whether these pages are worth indexing, and that is exactly what
`MIN_PLACES` and `LIST_MILES` protect.

## Implementation notes — don't remove these

- `[hidden] { display: none !important; }` is **load-bearing**. Cards are
  `display:flex`, which would otherwise override the `hidden` attribute and break
  filtering entirely.
- Distances are baked into `data-dist` at build time. `app.js` never computes
  geography — it re-ranks using those numbers.
- Weather is an enhancement, never a dependency. A blocked request, bad status,
  unexpected shape or 4s timeout all leave it unknown, and the shortlist ranks on
  distance alone while claiming nothing about the sky.
- `localStorage` access is wrapped in `try/catch` — private browsing throws, and
  the site must still work.
- Event text is escaped before insertion, so an apostrophe or `&` in a venue name
  can't break the markup.
- The nav link has a short form (`Cities`) below 420px, because "Change city"
  plus the brand overflows a 320px screen.

## Possible next steps

- [ ] **Make city pages differ in substance, not just order** — the five pages
      currently carry the same 9 places and a byte-identical event payload. Match
      events by distance from the town rather than by `region`, and add places
      outside the Sacramento core so `LIST_MILES` starts excluding some. This
      gates any increase in city count; see *Which cities get a page*.
- [ ] More Sacramento-region places, especially outside the central cluster —
      9 places across 5 cities is what makes the pages duplicate each other
- [ ] Storytimes for the Elk Grove library after its **10 October 2026** grand
      opening at 9260 Elk Grove Blvd; nothing is listed there until a schedule
      is published
- [ ] The hour for the A Seat at the Table Books storytime, which is listed
      without one
- [ ] An age filter on the weekly events (`ages` is display-only today)
- [ ] Per-city `<title>` tuning if search traffic ever becomes the goal
