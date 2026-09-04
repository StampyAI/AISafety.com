"""Regenerate the nav-tooltip page thumbnails in public/images/page-previews.

Captures each resource page at 1200x750 with the nav bar and any floating
elements hidden, at full resolution so the text stays legible when the
tooltip shows it scaled down, saved as WebP. Run against a
production server (`npm run build && npm run start`) so pages load fast:

    python3 scripts/capture-page-previews.py http://localhost:3000

Needs `pip install playwright pillow` and `python3 -m playwright install chromium`.
"""
import os, sys
from PIL import Image
from playwright.sync_api import sync_playwright

BASE = (sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:3000').rstrip('/')
OUT = os.path.join(os.path.dirname(__file__), '..', 'public', 'images', 'page-previews')
SLUGS = ['training', 'events', 'map', 'communities', 'self-study', 'jobs', 'funding',
         'media-channels', 'advisors', 'projects', 'founders', 'donation-guide']
HIDE = """() => {
  const nav = document.querySelector('nav');
  if (nav) nav.parentElement.parentElement.style.setProperty('display', 'none', 'important');
  for (const el of document.querySelectorAll('body *')) {
    if (getComputedStyle(el).position === 'fixed') el.style.setProperty('display', 'none', 'important');
  }
  window.scrollTo(0, 0);
}"""

os.makedirs(OUT, exist_ok=True)
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    for slug in SLUGS:
        page = browser.new_page(viewport={'width': 1200, 'height': 750}, device_scale_factor=1)
        page.goto(f'{BASE}/{slug}', wait_until='networkidle', timeout=240000)
        page.wait_for_timeout(1200)
        page.evaluate(HIDE)
        page.wait_for_timeout(300)
        tmp = os.path.join(OUT, f'{slug}.jpg')
        page.screenshot(path=tmp, type='jpeg', quality=88)
        page.close()
        Image.open(tmp).save(os.path.join(OUT, f'{slug}.webp'), 'WEBP', quality=85)
        os.remove(tmp)
        print('captured', slug)
    browser.close()
