"""Declarative application integration; paths are relative to the application."""
import json
import re
from pathlib import Path

IDENTIFIER = re.compile(r'^[A-Za-z_][A-Za-z0-9_]*$')

def local_path(root, value):
    if not isinstance(value, str) or not value or Path(value).is_absolute():
        raise ValueError('Expected a nonempty project-relative path')
    path = (root / value).resolve()
    if not path.is_relative_to(root.resolve()):
        raise ValueError('Path escapes project: ' + value)
    return path

def validate_pattern(value):
    if not isinstance(value, str) or not value or Path(value).is_absolute() or '..' in Path(value).parts:
        raise ValueError('Expected a project-relative glob pattern')

def load_application(root):
    manifest = root / 'web-simulator.json'
    if not manifest.exists():
        return None
    cfg = json.loads(manifest.read_text(encoding='utf-8-sig'))
    if cfg.get('version') != 1:
        raise ValueError('web-simulator.json requires version 1')
    sources = cfg.get('sources', [])
    if not isinstance(sources, list) or not sources:
        raise ValueError('sources must be a nonempty list')
    compiled = []
    for pattern in sources:
        validate_pattern(pattern)
        matches = sorted(root.glob(pattern))
        if not matches:
            raise ValueError('Source pattern matched nothing: ' + pattern)
        for path in matches:
            local_path(root, str(path.relative_to(root)))
            if not path.is_file() or path.suffix not in ('.c', '.cpp', '.cc'):
                raise ValueError('Not a C/C++ source: ' + str(path))
            compiled.append(path.resolve())
    includes = []
    for name in cfg.get('include_dirs', []):
        path = local_path(root, name)
        if not path.is_dir():
            raise ValueError('Missing include directory: ' + name)
        includes.append(path)
    defines = cfg.get('defines', [])
    if not isinstance(defines, list) or any(not isinstance(d, str) or not re.fullmatch(r'[A-Za-z_][A-Za-z0-9_]*(?:=[A-Za-z0-9_]+)?', d) for d in defines):
        raise ValueError('defines must contain simple C macro names or values')
    pages = cfg.get('pages', [])
    if not isinstance(pages, list) or not pages:
        raise ValueError('pages must be a nonempty list')
    for page in pages:
        if not isinstance(page, dict) or not isinstance(page.get('title'), str):
            raise ValueError('Each page needs a title')
        if not isinstance(page.get('help', ''), str):
            raise ValueError('Page help must be text')
        for hook in ('enter', 'exit', 'key'):
            if not isinstance(page.get(hook), str) or not IDENTIFIER.fullmatch(page[hook]):
                raise ValueError('Invalid page hook: ' + hook)
        if page.get('step') is not None and (not isinstance(page['step'], str) or not IDENTIFIER.fullmatch(page['step'])):
            raise ValueError('Invalid step hook')
    assets = []
    for item in cfg.get('assets', []):
        src = local_path(root, item['source'])
        if not src.exists():
            raise ValueError('Missing asset: ' + item['source'])
        target = item['target']
        local_path(root, target)
        if (Path(target).parts and Path(target).parts[0] == '.git') or target in ('runtime.js', 'runtime.wasm', 'build-info.json'):
            raise ValueError('Reserved output asset: ' + target)
        assets.append((src, target))
    watched = []
    for pattern in cfg.get('watch', []):
        validate_pattern(pattern)
        for path in root.glob(pattern):
            local_path(root, str(path.relative_to(root)))
            if path.is_file(): watched.append(path)
    return {'watch': watched, 'sources': list(dict.fromkeys(compiled)), 'include_dirs': includes,
            'defines': defines, 'pages': pages, 'assets': assets, 'manifest': manifest}

def cmake_quote(value):
    value = str(value).replace('\\', '/')
    if any(c in value for c in (';', '$', '\n', '\r', '"')):
        raise ValueError('Unsupported CMake path or value: ' + value)
    return '"' + value + '"'

def write_adapter(cfg, cache):
    cache.mkdir(parents=True, exist_ok=True)
    cmake = []
    for name, values in [('APP_SOURCES', cfg['sources']),
                         ('APP_INCLUDE_DIRS', cfg['include_dirs']),
                         ('APP_DEFINES', cfg['defines'])]:
        cmake.append('set(' + name + ' ' + ' '.join(cmake_quote(v) for v in values) + ')')
    config_file = cache / 'application.cmake'
    content = '\n'.join(cmake) + '\n'
    if not config_file.exists() or config_file.read_text(encoding='utf-8') != content:
        config_file.write_text(content, encoding='utf-8')
    header = ['#pragma once', '#include "bsp_button.h"',
              '#define SIM_APP_PAGE_COUNT ' + str(len(cfg['pages']))]
    for page in cfg['pages']:
        for hook in ('enter', 'exit', 'step', 'key'):
            name = page.get(hook)
            if name:
                params = 'bsp_btn_t, bsp_btn_ev_t' if hook == 'key' else 'void'
                header.append('void ' + name + '(' + params + ');')
    for hook in ('enter', 'exit', 'step', 'key'):
        params = 'int page, bsp_btn_t key, bsp_btn_ev_t event' if hook == 'key' else 'int page'
        header += ['static void sim_app_' + hook + '(' + params + ') {', 'switch(page) {']
        for i, page in enumerate(cfg['pages']):
            call = page.get(hook)
            arguments = 'key,event' if hook == 'key' else ''
            header.append('case ' + str(i) + ': ' + (call + '(' + arguments + '); ' if call else '') + 'break;')
        header += ['default: break;', '}', '}']
    adapter = cache / 'app_router.h'
    content = '\n'.join(header) + '\n'
    if not adapter.exists() or adapter.read_text(encoding='utf-8') != content:
        adapter.write_text(content, encoding='utf-8')
    return config_file
