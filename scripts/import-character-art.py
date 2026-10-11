"""Import updated original PNGs as 900px-high WebP portraits and 120px face thumbnails.

Usage: python scripts/import-character-art.py [source_stem ...]
Requires Pillow. Source PNGs are never modified.
"""
import sys
from pathlib import Path
from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'OriginalData/Character/Character_Original'
PORTRAITS = ROOT / 'public/assets/art/2D/Character'
THUMBNAILS = ROOT / 'public/assets/art/2D/Character_thumnail'
# Square crop centers and sizes are fractions of the original width/height.
CROPS = {
    'DesertKing': (0.54, 0.145, 0.37),
    'king': (0.53, 0.12, 0.37),
    '0087_F_H': (0.48, 0.105, 0.65),
    '0069_F_M': (0.36, 0.11, 0.43),
    '0005_F_W': (0.47, 0.105, 0.43),
    '139_M_W': (0.47, 0.105, 0.43),
    'NorthKing': (0.56, 0.13, 0.36),
}

for stem in sys.argv[1:] or CROPS:
    with Image.open(SOURCE / f'{stem}.png') as original:
        image = ImageOps.exif_transpose(original).convert('RGBA')
        width, height = image.size
        target = PORTRAITS / f'{stem}.webp'
        image.resize((round(width * 900 / height), 900), Image.Resampling.LANCZOS).save(
            target, 'WEBP', quality=88, method=6, exact=True)
        center_x, center_y, size = CROPS[stem]
        side = round(width * size)
        left = max(0, min(width - side, round(width * center_x - side / 2)))
        top = max(0, min(height - side, round(height * center_y - side / 2)))
        thumbnail = image.crop((left, top, left + side, top + side)).resize((120, 120), Image.Resampling.LANCZOS)
        thumbnail.save(THUMBNAILS / f'{stem}.webp', 'WEBP', quality=88, method=6, exact=True)
        print(f'{stem}: {width}x{height} -> {round(width * 900 / height)}x900, {target.stat().st_size:,} bytes')
