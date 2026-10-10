#!/usr/bin/env python3
"""Build shared LVGL pages; discover web-simulator.json in the selected project."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
from application import load_application, write_adapter, local_path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
OUTPUT = ROOT / 'build' / 'web-simulator'
LVGL = ROOT / 'managed_components' / 'lvgl__lvgl'
ASSET = HERE / 'assets' / 'ai-passport-shell-reference.png'

def configure_project(project=None):
    global ROOT, OUTPUT, LVGL
    ROOT = Path(project).resolve() if project else HERE.parent.parent
    if not (ROOT / 'main').is_dir() or not (ROOT / 'components' / 'bsp').is_dir():
        raise ValueError('Project requires main/ and components/bsp/: ' + str(ROOT))
    OUTPUT = ROOT / 'build' / 'web-simulator'
    LVGL = ROOT / 'managed_components' / 'lvgl__lvgl'

def shared_files(cfg):
    if cfg:
        files = [cfg['manifest'], *cfg['sources'], *cfg['watch']]
        # Monitor shared headers and configuration without compiling device files.
        for folder in [ROOT / 'main', *cfg['include_dirs']]:
            files += [p for p in folder.rglob('*.h') if p.is_file()]
        for src, _ in cfg['assets']:
            files += [p for p in src.rglob('*') if p.is_file()] if src.is_dir() else [src]
    else:
        files = [ROOT / 'main' / name for name in
                 ('ui_pixel.c', 'ui_pixel.h', 'demo.h', 'demo_display.c', 'demo_button.c')]
    files += [ROOT / 'components' / 'bsp' / area / name for area, name in (
        ('include', 'bsp_button.h'), ('include', 'bsp_display.h'),
        ('src', 'bsp_display_rounding.c'), ('src', 'bsp_display_rounding.h'))]
    return files

def sources():
    cfg = load_application(ROOT)
    files = shared_files(cfg)
    files += [ASSET, *[p for p in HERE.rglob('*') if p.is_file()
        and '__pycache__' not in p.parts and '.git' not in p.parts
        and (p.suffix in ('.c', '.h', '.py', '.mjs', '.html', '.css', '.md', '.sh', '.json')
             or p.name == 'CMakeLists.txt')]]
    files += [p for p in (LVGL / 'src').rglob('*') if p.suffix in ('.c', '.h')]
    files.append(LVGL / 'lv_version.h')
    return sorted(set(files), key=str)

def fingerprint():
    digest = hashlib.sha256()
    digest.update(str(ROOT).encode())
    for path in sources():
        digest.update(str(path).encode())
        digest.update(path.read_bytes())
    return digest.hexdigest()

def restore_output_inheritance(directory):
    # Emscripten moves JS from a private tempfile directory on Windows.
    # Restore project ACL inheritance for these generated files only.
    if os.name != 'nt':
        return
    for name in ('runtime.js', 'runtime.wasm'):
        path = directory / name
        if path.is_file():
            result = subprocess.run(['icacls', str(path), '/inheritance:e'],
                                    capture_output=True)
            if result.returncode:
                print('Could not restore inherited permissions: ' + str(path), flush=True)

def build():
    if not (LVGL / 'lv_version.h').exists():
        raise RuntimeError('Missing pinned LVGL dependency. Build the selected firmware project first.')
    cfg = load_application(ROOT)
    identity = fingerprint()
    manifest = OUTPUT / 'build-info.json'
    if manifest.exists() and (OUTPUT / 'runtime.wasm').exists() and (OUTPUT / 'runtime.js').exists():
        if json.loads(manifest.read_text(encoding='utf-8'))['id'] == identity:
            print('Web simulator is up to date.', flush=True)
            return identity
    emcmake = shutil.which('emcmake')
    if not emcmake:
        raise RuntimeError('Emscripten is not activated. Load emsdk_env.bat on Windows or emsdk_env.sh on Unix.')
    cache = ROOT / 'build' / 'web-simulator-cache'
    if ROOT != HERE.parent.parent:
        cache = cache / hashlib.sha256(str(HERE).encode()).hexdigest()[:8]
    args = [emcmake, 'cmake', '-S', str(HERE), '-B', str(cache), '-G', 'Ninja',
            '-DCMAKE_BUILD_TYPE=Release', '-DREPO_ROOT=' + ROOT.as_posix(),
            '-DAPP_CONFIG_FILE=' + (write_adapter(cfg, cache).as_posix() if cfg else '')]
    subprocess.run(args, check=True)
    subprocess.run(['cmake', '--build', str(cache), '--parallel', str(min(os.cpu_count() or 4, 8))], check=True)
    restore_output_inheritance(cache)
    if fingerprint() != identity:
        raise RuntimeError('Sources changed during compilation. Save files and rebuild before previewing.')
    OUTPUT.mkdir(parents=True, exist_ok=True)
    for file in (HERE / 'web').iterdir():
        if file.is_file(): shutil.copy2(file, OUTPUT / file.name)
    if cfg:
        for src, target in cfg['assets']:
            dest = local_path(OUTPUT, target)
            if src.is_dir():
                shutil.copytree(src, dest, dirs_exist_ok=True)
            else:
                dest.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(src, dest)
    for name in ('runtime.js', 'runtime.wasm'):
        shutil.copy2(cache / name, OUTPUT / name)
    restore_output_inheritance(OUTPUT)
    (OUTPUT / 'assets').mkdir(exist_ok=True)
    shutil.copy2(ASSET, OUTPUT / 'assets' / ASSET.name)
    for name in ('README.md', 'README.zh_CN.md', 'INTEGRATION.md', 'INTEGRATION.zh_CN.md'):
        shutil.copy2(HERE / name, OUTPUT / name)
    pages = cfg['pages'] if cfg else [
        {'title': 'Display test', 'help': 'OK: cycle colors; UP/DOWN: brightness.'},
        {'title': 'Button test', 'help': 'PRESS / CLICK / DOUBLE / LONG events.'}]
    info = {'id': identity, 'lvgl': '9.5.0', 'project': ROOT.name,
            'pages': [{'title': p['title'], 'help': p.get('help', '')} for p in pages],
            'shared_sources': [str(p.relative_to(ROOT)) for p in shared_files(cfg)]}
    manifest.write_text(json.dumps(info, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
    print('Web simulator built: ' + str(OUTPUT), flush=True)
    return identity

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--project', help='Application project root; defaults to this simulator parent project')
    args = parser.parse_args()
    try:
        configure_project(args.project)
        build()
    except (RuntimeError, ValueError, OSError, subprocess.CalledProcessError) as error:
        raise SystemExit(str(error))
