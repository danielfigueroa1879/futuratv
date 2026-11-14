#!/usr/bin/env python3
"""Genera app/version.json: versión (de app/appinfo.json), lista de archivos y dirección de actualización.

La caja Android compara este archivo con el publicado en "updateUrl" (config.json) y,
si hay una versión más nueva, se descarga la interfaz sola, sin reinstalar el APK.
"""
import json, os

ROOT = os.path.dirname(os.path.abspath(__file__))
APP = os.path.join(ROOT, 'app')
SKIP_FILES = {'appinfo.json', 'icon.png', 'largeIcon.png', 'version.json', '.DS_Store'}

info = json.load(open(os.path.join(APP, 'appinfo.json'), encoding='utf-8'))
cfg = json.load(open(os.path.join(ROOT, 'config.json'), encoding='utf-8'))
files = []
for d, dirs, names in os.walk(APP):
    dirs[:] = sorted(x for x in dirs if not x.startswith('.'))
    for n in sorted(names):
        if n in SKIP_FILES or n.startswith('.'):
            continue
        files.append(os.path.relpath(os.path.join(d, n), APP).replace(os.sep, '/'))
# El código lleva su propia versión (se ve en Ajustes y delata archivos viejos de la caché)
import re
js = os.path.join(APP, 'app.js')
src = open(js, encoding='utf-8').read()
src2 = re.sub(r"var APP_BUILD = '[^']*';", "var APP_BUILD = '%s';" % info['version'], src, count=1)
if src2 != src:
    open(js, 'w', encoding='utf-8').write(src2)
data = {'version': info['version'], 'updateUrl': cfg.get('updateUrl', ''), 'files': files}
with open(os.path.join(APP, 'version.json'), 'w', encoding='utf-8') as f:
    json.dump(data, f, indent=2, ensure_ascii=False)
    f.write('\n')
print('version.json: v%s, %d archivos, updateUrl=%s' % (data['version'], len(files), data['updateUrl'] or '(sin configurar)'))
