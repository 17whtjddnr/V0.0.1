"""Create web delivery copies without replacing original art or music.

Requires Pillow and either ffmpeg on PATH or imageio-ffmpeg.
Run again after changing PNG backgrounds or source MP3 tracks.
"""
from pathlib import Path
import shutil
import subprocess
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
art = ROOT / 'public/assets'
images = list((art / 'backgrounds').glob('*.png'))
for source in images:
    target = source.with_suffix('.webp')
    # Reuse generated delivery copies until the original illustration changes.
    if target.exists() and target.stat().st_mtime >= source.stat().st_mtime:
        continue
    with Image.open(source) as image:
        image.save(target, 'WEBP', quality=88, method=6)
    print(f'{source.name}: {source.stat().st_size:,} -> {target.stat().st_size:,} bytes')

ffmpeg = shutil.which('ffmpeg')
if not ffmpeg:
    from imageio_ffmpeg import get_ffmpeg_exe
    ffmpeg = get_ffmpeg_exe()
for source in (art / 'sound/Bgm').glob('*.mp3'):
    if source.name.endswith('.web.mp3'):
        continue
    target = source.with_name(source.stem + '.web.mp3')
    subprocess.run([ffmpeg, '-hide_banner', '-loglevel', 'error', '-y', '-i', str(source),
                    '-vn', '-codec:a', 'libmp3lame', '-b:a', '96k', '-ar', '44100',
                    '-map_metadata', '-1', '-write_xing', '1', str(target)], check=True)
    print(f'{source.name}: {source.stat().st_size:,} -> {target.stat().st_size:,} bytes')
