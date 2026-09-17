#!/usr/bin/env python3
"""
Scrape og:image (or first large <img>) from each place / seasonal event URL,
convert to 400px-wide 16:9 WebP, and save to assets/photos/.

    python3 scripts/scrape_photos.py          # scrape missing only
    python3 scripts/scrape_photos.py --all     # re-scrape everything

Reads:  data/places.json  (field: url)
        data/dated_events_curated.json  (field: source, for seasonal entries)
Writes: assets/photos/<slug>.webp
"""

import json, os, re, sys, time, io, urllib.request, urllib.parse, ssl
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PHOTO_DIR = os.path.join(ROOT, 'assets', 'photos')
WIDTH = 400
ASPECT = 16 / 9
HEIGHT = int(WIDTH / ASPECT)

os.makedirs(PHOTO_DIR, exist_ok=True)

UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

ctx = ssl.create_default_context()
try:
    ctx.load_verify_locations(os.environ.get('SSL_CERT_FILE', '/etc/ssl/certs/ca-certificates.crt'))
except Exception:
    pass


def slugify(name):
    return re.sub(r'[^a-z0-9]+', '-', name.lower()).strip('-')


def fetch_url(url, timeout=15):
    req = urllib.request.Request(url, headers={'User-Agent': UA})
    try:
        with urllib.request.urlopen(req, timeout=timeout, context=ctx) as resp:
            return resp.read(), resp.headers.get('Content-Type', '')
    except Exception as e:
        print(f'    fetch error: {e}')
        return None, ''


def extract_og_image(html_bytes, base_url):
    text = html_bytes.decode('utf-8', errors='replace')
    m = re.search(r'<meta\s+(?:[^>]*?\s+)?property=["\']og:image["\']\s+content=["\']([^"\']+)', text, re.I)
    if not m:
        m = re.search(r'<meta\s+(?:[^>]*?\s+)?content=["\']([^"\']+)["\']\s+(?:[^>]*?\s+)?property=["\']og:image', text, re.I)
    if m:
        img_url = m.group(1).strip()
        if img_url.startswith('//'):
            img_url = 'https:' + img_url
        elif img_url.startswith('/'):
            parsed = urllib.parse.urlparse(base_url)
            img_url = f'{parsed.scheme}://{parsed.netloc}{img_url}'
        return img_url

    imgs = re.findall(r'<img\s+[^>]*?src=["\']([^"\']+)', text, re.I)
    for src in imgs:
        if any(skip in src.lower() for skip in ['logo', 'icon', 'avatar', 'badge', 'sprite', 'pixel', '.svg', '1x1']):
            continue
        if src.startswith('//'):
            src = 'https:' + src
        elif src.startswith('/'):
            parsed = urllib.parse.urlparse(base_url)
            src = f'{parsed.scheme}://{parsed.netloc}{src}'
        elif not src.startswith('http'):
            continue
        return src
    return None


def process_image(img_bytes, output_path):
    try:
        img = Image.open(io.BytesIO(img_bytes))
        img = img.convert('RGB')

        w, h = img.size
        target_h = w / ASPECT
        if target_h <= h:
            top = (h - int(target_h)) // 2
            img = img.crop((0, top, w, top + int(target_h)))
        else:
            target_w = h * ASPECT
            left = (w - int(target_w)) // 2
            img = img.crop((left, 0, left + int(target_w), h))

        img = img.resize((WIDTH, HEIGHT), Image.LANCZOS)
        img.save(output_path, 'WEBP', quality=82)
        size_kb = os.path.getsize(output_path) / 1024
        print(f'    saved {output_path} ({size_kb:.0f} KB)')
        return True
    except Exception as e:
        print(f'    image processing error: {e}')
        return False


def scrape_one(name, url, slug):
    out = os.path.join(PHOTO_DIR, f'{slug}.webp')
    if not force and os.path.exists(out):
        return 'skip'

    print(f'  {name}')
    print(f'    fetching {url}')
    html_bytes, ctype = fetch_url(url)
    if html_bytes is None:
        return 'fail'

    if 'image' in ctype:
        if process_image(html_bytes, out):
            return 'ok'
        return 'fail'

    img_url = extract_og_image(html_bytes, url)
    if not img_url:
        print(f'    no og:image or suitable <img> found')
        return 'fail'

    print(f'    downloading {img_url[:80]}...')
    img_bytes, _ = fetch_url(img_url)
    if img_bytes is None:
        return 'fail'

    if process_image(img_bytes, out):
        return 'ok'
    return 'fail'


if __name__ == '__main__':
    force = '--all' in sys.argv

    places = json.load(open(os.path.join(ROOT, 'data', 'places.json')))
    dated = json.load(open(os.path.join(ROOT, 'data', 'dated_events_curated.json')))

    stats = {'ok': 0, 'skip': 0, 'fail': 0, 'no_url': 0}

    print('=== Places ===')
    for p in places:
        url = p.get('url')
        if not url:
            stats['no_url'] += 1
            continue
        slug = slugify(p['name'])
        result = scrape_one(p['name'], url, slug)
        stats[result] += 1
        if result != 'skip':
            time.sleep(0.5)

    seen_groups = set()
    print('\n=== Seasonal events ===')
    for e in dated:
        if not e.get('seasonal'):
            continue
        group = e.get('group', e['title'])
        if group in seen_groups:
            continue
        seen_groups.add(group)
        url = e.get('source')
        if not url:
            stats['no_url'] += 1
            continue
        slug = slugify(group)
        result = scrape_one(e['title'], url, slug)
        stats[result] += 1
        if result != 'skip':
            time.sleep(0.5)

    print(f'\nDone: {stats["ok"]} scraped, {stats["skip"]} skipped (exist), '
          f'{stats["fail"]} failed, {stats["no_url"]} no URL')
