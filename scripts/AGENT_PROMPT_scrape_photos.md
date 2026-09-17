# Task: Scrape and process place/event photos for sacmoms.com

You have computer use. Your job is to visit each URL below, find the best representative photo for each place or event, download it, process it to **400px wide, 16:9 aspect ratio, WebP format**, and save it to the output directory.

## Output specification

- **Directory:** `assets/photos/` (create if needed)
- **Filename:** `<slug>.webp` where slug is the lowercase-hyphenated place name (examples below)
- **Format:** WebP, quality 82
- **Dimensions:** 400 x 225 px (16:9 crop)
- **Crop strategy:** Center-crop to 16:9 before resizing. Prefer keeping the main subject visible.

Use Python + Pillow for processing:
```python
from PIL import Image
img = img.convert('RGB')
# Center-crop to 16:9
w, h = img.size
target_h = w / (16/9)
if target_h <= h:
    top = (h - int(target_h)) // 2
    img = img.crop((0, top, w, top + int(target_h)))
else:
    target_w = h * (16/9)
    left = (w - int(target_w)) // 2
    img = img.crop((left, 0, left + int(target_w), h))
img = img.resize((400, 225), Image.LANCZOS)
img.save(output_path, 'WEBP', quality=82)
```

## What image to pick

1. **First choice:** The `og:image` meta tag from the page's HTML
2. **Second choice:** The main hero/banner image on the page (usually the largest prominent photo near the top)
3. **Third choice:** Search Google Images for `"<place name> <city> CA"` and pick the first relevant result showing the actual venue
4. **Skip criteria:** Don't save logos, icons, stock photos of generic families, or images smaller than 300px wide

## Places (37 entries)

For each: visit the URL, find the best photo, save as `assets/photos/<slug>.webp`

| # | Place Name | URL | Output Slug |
|---|-----------|-----|-------------|
| 1 | Elk Grove Regional Park | https://www.elkgrovecity.org/recreation/parks-trails/elk-grove-regional-park | `elk-grove-regional-park` |
| 2 | Oasis Park | https://www.elkgrovecity.org/recreation/parks-trails/oasis-park | `oasis-park` |
| 3 | Wackford Aquatic Complex | https://www.elkgrovecity.org/recreation/aquatics/wackford-aquatic-complex | `wackford-aquatic-complex` |
| 4 | The Alley | https://www.bowlthealley.com/ | `the-alley` |
| 5 | Fairytale Town | https://www.fairytaletown.org/ | `fairytale-town` |
| 6 | Funderland | https://www.funderlandpark.com/ | `funderland` |
| 7 | Sacramento Zoo | https://www.saczoo.org/ | `sacramento-zoo` |
| 8 | California State Railroad Museum | https://www.californiarailroad.museum/ | `california-state-railroad-museum` |
| 9 | Sacramento Children's Museum | https://sackids.org/ | `sacramento-children-s-museum` |
| 10 | McKinley Park | https://www.cityofsacramento.org/ParksandRec/Parks/Park-Directory/Central-City/McKinley-Park | `mckinley-park` |
| 11 | Bertha Henschel Park | https://www.cityofsacramento.org/ParksandRec/Parks/Park-Directory/North-Sacramento/Bertha-Henschel-Park | `bertha-henschel-park` |
| 12 | Sacramento Adventure Playground | https://www.cityofsacramento.org/ParksandRec/Parks/Park-Directory/South-Area/William-Land-Regional-Park | `sacramento-adventure-playground` |
| 13 | Heron Landing Community Park | https://www.cityofranchocordova.org/government/community-services/parks-recreation/parks | `heron-landing-community-park` |
| 14 | White Rock Community Splash Park | https://www.cityofranchocordova.org/government/community-services/parks-recreation/parks | `white-rock-community-splash-park` |
| 15 | Folsom Kids' Castle Park | https://www.folsom.ca.us/government/parks-recreation/parks-trails/parks | `folsom-kids-castle-park` |
| 16 | Folsom City Lions Park | https://www.folsom.ca.us/government/parks-recreation/parks-trails/parks | `folsom-city-lions-park` |
| 17 | Econome Family Park | https://www.folsom.ca.us/government/parks-recreation/parks-trails/parks | `econome-family-park` |
| 18 | Tempo Park | https://www.citrusheights.net/161/Parks | `tempo-park` |
| 19 | Rusch Park | https://www.citrusheights.net/161/Parks | `rusch-park` |
| 20 | Kammerer Park | https://www.elkgrovecity.org/recreation/parks-trails/kammerer-park | `kammerer-park` |
| 21 | George Park | https://www.elkgrovecity.org/recreation/parks-trails/george-park | `george-park` |
| 22 | Enchanted Elk Grove | https://www.enchantedplayland.com/ | `enchanted-elk-grove` |
| 23 | Enchanted Natomas | https://www.enchantedplayland.com/ | `enchanted-natomas` |
| 24 | Urban Air Trampoline and Adventure Park | https://www.urbanair.com/sacramento-ca | `urban-air-trampoline-and-adventure-park` |
| 25 | Rebounderz Sacramento | https://www.rfranchising.com/sacramento/ | `rebounderz-sacramento` |
| 26 | Kids Empire | https://www.kidsempire.com/locations/rancho-cordova/ | `kids-empire` |
| 27 | Peek-a-Boo Factory | https://www.peekaboofactory.com/ | `peek-a-boo-factory` |
| 28 | Wacky Tacky | https://wackytacky.com/ | `wacky-tacky` |
| 29 | WonderPlay Zone | https://www.wonderplayzone.com/ | `wonderplay-zone` |
| 30 | Ely's Play House | https://www.elysplayhouse.com/ | `ely-s-play-house` |
| 31 | Space To Play | https://www.spacetoplay.com/ | `space-to-play` |
| 32 | Oneto Park | https://www.elkgrovecity.org/recreation/parks-trails/oneto-park | `oneto-park` |
| 33 | Miwok Park | https://www.elkgrovecity.org/recreation/parks-trails/miwok-park | `miwok-park` |
| 34 | Machado Dairy Park | https://www.elkgrovecity.org/recreation/parks-trails/machado-dairy-park | `machado-dairy-park` |
| 35 | Kloss Park | https://www.elkgrovecity.org/recreation/parks-trails/kloss-park | `kloss-park` |
| 36 | Morse Community Park | https://www.elkgrovecity.org/recreation/parks-trails/morse-community-park | `morse-community-park` |
| 37 | Derr-Okamoto Community Park | https://www.elkgrovecity.org/recreation/parks-trails/derr-okamoto-community-park | `derr-okamoto-community-park` |

**Notes on shared URLs:**
- Entries 13-14 share a URL (Rancho Cordova parks page) — search for each park's specific photo on the page or via Google Images
- Entries 15-17 share a URL (Folsom parks page) — same approach
- Entries 18-19 share a URL (Citrus Heights parks page) — same approach
- Entries 22-23 share a URL (Enchanted Playland) — use the same image for both, or find location-specific photos if available

## Seasonal Events (5 entries)

| # | Event Name | Group Slug | URL | Output Slug |
|---|-----------|------------|-----|-------------|
| 1 | Dave's Pumpkin Patch | daves-pumpkin-2026 | https://www.davespumpkinpatch.com/ | `daves-pumpkin-2026` |
| 2 | Cool Patch Pumpkins | cool-patch-2026 | https://www.coolpatchpumpkins.com/ | `cool-patch-2026` |
| 3 | Elk Grove Giant Pumpkin Festival | eg-pumpkin-fest-2026 | https://www.elkgrovegiantpumpkinfestival.org/ | `eg-pumpkin-fest-2026` |
| 4 | Boo at the Zoo | sac-zoo-boo-2026 | https://www.saczoo.org/ | `sac-zoo-boo-2026` |
| 5 | Keema's Pumpkin Farm | keemas-pumpkin-2026 | https://www.keemaspumpkinfarm.com/?page_id=31 | `keemas-pumpkin-2026` |

## Deliverable

When done, produce a JSON summary at `assets/photos/manifest.json`:
```json
{
  "elk-grove-regional-park": {"status": "ok", "source_url": "https://...original-image-url..."},
  "oasis-park": {"status": "ok", "source_url": "https://..."},
  "the-alley": {"status": "failed", "reason": "no suitable image found"},
  ...
}
```

This lets the build system know which places have photos and which don't (fallback to icon-only card).

## Priority order

If you're time-limited, prioritize in this order:
1. The 5 seasonal events (they're the featured section)
2. The top attractions: Fairytale Town, Sacramento Zoo, California State Railroad Museum, Funderland, Sacramento Children's Museum
3. Indoor play places (Enchanted, Urban Air, Kids Empire, etc.)
4. Parks (many city park pages may not have great photos — skip if no good image found)
