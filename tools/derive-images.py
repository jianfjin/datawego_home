#!/usr/bin/env python3
"""Derive the shipped imagery from the authored originals in resources/.

Run by hand, never by build.mjs: the output is committed, so a machine without
Pillow still builds the site, and `node build.mjs --check` compares against the
same bytes a deploy would ship. Re-run this after changing a PNG.

    python3 tools/derive-images.py

Hero: the banner is 2056x491 shown full-bleed, so the candidates step down by
device pixel ratio, not by breakpoint. WebP q72 holds the flat brand colour
without the ringing q60 gives on the skyline photo.
og:image: 1200x630 as JPEG, because a social card is read by clients whose WebP
support is a decade behind their PNG support, and one is not worth a fork.
"""
import os
import subprocess
import tempfile
from PIL import Image

FAVICON_SVG = "favicon.svg"
LOGO_SVG = "logo.svg"
SVG_SIZE = {"favicon.svg": (96, 96), "logo.svg": (243, 204)}
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RES = os.path.join(ROOT, "resources")
HERO_SRC = "DataWeGo_banner3.png"
HERO_WIDTHS = (640, 1028, 1542, 2056)


def rasterise(svg, wide, tall, scale=4):
    """Ask headless Chrome to draw an SVG, and hand back its pixels.

    Chrome is not a build dependency — build.mjs never runs it. It is a dependency
    of this script, which is run by hand when the artwork changes. The viewport is
    the SVG's own box and the device-scale-factor is the magnification, which is
    how an SVG gets a sharp 180-pixel PNG without a rasteriser in the dependency
    list.
    """
    with tempfile.TemporaryDirectory() as tmp:
        subprocess.run(
            ["google-chrome", "--headless=new", "--disable-gpu", "--no-sandbox", "--hide-scrollbars",
             "--force-device-scale-factor=%d" % scale, "--default-background-color=00000000",
             "--window-size=%d,%d" % SVG_SIZE[svg], "--screenshot=%s/out.png" % tmp,
             "file://" + os.path.join(RES, svg)],
            check=True, capture_output=True)
        return Image.open(os.path.join(tmp, "out.png")).convert("RGBA").resize((wide, tall), Image.LANCZOS)


def save(im, name, fmt, quality=None):
    path = os.path.join(RES, name)
    kw = {"quality": quality, "method": 6} if quality else {}
    im.save(path, fmt, **kw)
    print(f"  {name:34s} {im.size[0]}x{im.size[1]:<5} {os.path.getsize(path):>9,} B")


def main():
    hero = Image.open(os.path.join(RES, HERO_SRC)).convert("RGB")
    print(f"hero  <- {HERO_SRC} {hero.size} {os.path.getsize(os.path.join(RES, HERO_SRC)):,} B")
    for w in HERO_WIDTHS:
        h = round(hero.size[1] * w / hero.size[0])
        save(hero.resize((w, h), Image.LANCZOS), f"hero-{w}.webp", "WEBP", 72)

        # The PNG icons are rasterised from the authored SVG rather than cut out of
    # the logo PNG, so a visitor who gets a PNG and a visitor who gets the SVG are
    # looking at the same drawing.
    print("icons <- resources/favicon.svg")
    save(rasterise(FAVICON_SVG, 180, 180), "apple-touch-icon.png", "PNG", 95)
    save(rasterise(FAVICON_SVG, 32, 32), "favicon-32.png", "PNG")

    # og:image — the brand band across the top, the mark under it. Cropped to
    # cover would lose the headline (it sits at the left edge of a 4.2:1 strip),
    # and centring the strip alone left two thirds of the card empty matte.
    card = Image.new("RGB", (1200, 630), (11, 26, 58))
    band_h = round(hero.size[1] * 1200 / hero.size[0])
    card.paste(hero.resize((1200, band_h), Image.LANCZOS), (0, 0))
    mark_w, mark_h = 327, 275
    mark = rasterise(LOGO_SVG, mark_w, mark_h)
    card.paste(mark, ((1200 - mark_w) // 2, band_h + (630 - band_h - mark_h) // 2), mark)
    save(card, "og-image.jpg", "JPEG", 82)


if __name__ == "__main__":
    main()
