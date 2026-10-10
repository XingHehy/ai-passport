#!/usr/bin/env python3
"""Build the real LVGL C pages for the browser; reuse Ninja's incremental cache."""
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
OUTPUT = ROOT / 'build' / 'web-simulator'
LVGL = ROOT / 'managed_components' / 'lvgl__lvgl'
SHARED = [ROOT / 'main' / name for name in ('ui_pixel.c', 'ui_pixel.h', 'demo.h', 'demo_display.c', 'demo_button.c')]
SHARED += [ROOT / 'components' / 'bsp' / area / name for area, name in (
    ('include', 'bsp_button.h'), ('include', 'bsp_display.h'),
    ('src', 'bsp_display_rounding.c'), ('src', 'bsp_display_rounding.h'))]
ASSET = HERE / 'assets' / 'ai-passport-shell-reference.png'


def sources():
    return sorted([*SHARED, ASSET, *[p for p in HERE.rglob('*') if p.is_file() and '__pycache__' not in p.parts and '.git' not in p.parts and (p.suffix in ('.c', '.h', '.py', '.mjs', '.html', '.css', '.md', '.sh') or p.name == 'CMakeLists.txt')],
        *[p for p in (LVGL / 'src').rglob('*') if p.suffix in ('.c', '.h')], LVGL / 'lv_version.h'], key=str)


def fingerprint():
    digest = hashlib.sha256()
    for path in sources():
        digest.update(str(path.relative_to(ROOT)).encode())
        digest.update(path.read_bytes())
    return digest.hexdigest()


def build():
    if not (LVGL / 'lv_version.h').exists():
        raise RuntimeError('Missing pinned LVGL dependency. Activate ESP-IDF and build firmware first.')
    identity = fingerprint()
    manifest = OUTPUT / 'build-info.json'
    if manifest.exists() and (OUTPUT / 'runtime.wasm').exists() and (OUTPUT / 'runtime.js').exists():
        if json.loads(manifest.read_text())['id'] == identity:
            print('Web simulator is up to date.', flush=True)
            return identity
    emcmake = shutil.which('emcmake')
    if not emcmake:
        raise RuntimeError('Emscripten is not activated. Source <emsdk>/emsdk_env.sh first.')
    cache = ROOT / 'build' / 'web-simulator-cache'
    subprocess.run([emcmake, 'cmake', '-S', str(HERE), '-B', str(cache), '-G', 'Ninja', '-DCMAKE_BUILD_TYPE=Release'], check=True)
    subprocess.run(['cmake', '--build', str(cache), '--parallel', str(min(os.cpu_count() or 4, 8))], check=True)
    if fingerprint() != identity:
        raise RuntimeError('Sources changed during compilation. Save files and rebuild before previewing.')
    OUTPUT.mkdir(parents=True, exist_ok=True)
    for file in (HERE / 'web').iterdir():
        if file.is_file(): shutil.copy2(file, OUTPUT / file.name)
    for name in ('runtime.js', 'runtime.wasm'):
        shutil.copy2(cache / name, OUTPUT / name)
    (OUTPUT / 'assets').mkdir(exist_ok=True)
    shutil.copy2(ASSET, OUTPUT / 'assets' / ASSET.name)
    for name in ('README.md', 'README.zh_CN.md'):
        shutil.copy2(HERE / name, OUTPUT / name)
    manifest.write_text(json.dumps({'id': identity, 'lvgl': '9.5.0', 'shared_sources': [str(p.relative_to(ROOT)) for p in SHARED]}, indent=2) + '\n')
    print('Web simulator built: ' + str(OUTPUT), flush=True)
    return identity


if __name__ == '__main__':
    try:
        build()
    except (RuntimeError, subprocess.CalledProcessError) as error:
        raise SystemExit(str(error))
