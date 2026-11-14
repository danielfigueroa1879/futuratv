#!/usr/bin/env python3
"""Arma el instalador .ipk de la app para LG webOS (mismo formato que ares-package).

Uso:  python3 build-ipk.py
Resultado: dist/<id>_<version>_all.ipk
"""
import io, json, os, sys, tarfile, time

ROOT = os.path.dirname(os.path.abspath(__file__))
APP_DIR = os.path.join(ROOT, 'app')
DIST = os.path.join(ROOT, 'dist')
SKIP = {'.DS_Store', '.claude'}


def tar_gz(entries):
    """entries: list of (arcname, bytes|None for dir)."""
    buf = io.BytesIO()
    now = int(time.time())
    with tarfile.open(fileobj=buf, mode='w:gz', format=tarfile.GNU_FORMAT) as tar:
        for name, data in entries:
            ti = tarfile.TarInfo(name)
            ti.mtime = now
            ti.uid = ti.gid = 0
            ti.uname = ti.gname = 'root'
            if data is None:
                ti.type = tarfile.DIRTYPE
                ti.mode = 0o755
                tar.addfile(ti)
            else:
                ti.size = len(data)
                ti.mode = 0o644
                tar.addfile(ti, io.BytesIO(data))
    return buf.getvalue()


def ar_archive(members):
    out = io.BytesIO()
    out.write(b'!<arch>\n')
    now = int(time.time())
    for name, data in members:
        header = '%-16s%-12d%-6d%-6d%-8s%-10d`\n' % (name, now, 0, 0, '100644', len(data))
        out.write(header.encode('ascii'))
        out.write(data)
        if len(data) % 2:
            out.write(b'\n')
    return out.getvalue()


def main():
    import subprocess
    subprocess.check_call([sys.executable, os.path.join(ROOT, 'make-version.py')])
    with open(os.path.join(APP_DIR, 'appinfo.json'), encoding='utf-8') as f:
        info = json.load(f)
    app_id, version = info['id'], info['version']

    app_prefix = './usr/palm/applications/%s/' % app_id
    pkg_prefix = './usr/palm/packages/%s/' % app_id
    entries = [(d, None) for d in ('./', './usr/', './usr/palm/', './usr/palm/applications/',
                                   app_prefix, './usr/palm/packages/', pkg_prefix)]
    total = 0
    for dirpath, dirnames, filenames in os.walk(APP_DIR):
        dirnames[:] = sorted(d for d in dirnames if d not in SKIP)
        rel = os.path.relpath(dirpath, APP_DIR)
        if rel != '.':
            entries.append((app_prefix + rel.replace(os.sep, '/') + '/', None))
        for fn in sorted(filenames):
            if fn in SKIP:
                continue
            with open(os.path.join(dirpath, fn), 'rb') as f:
                data = f.read()
            total += len(data)
            arc = fn if rel == '.' else rel.replace(os.sep, '/') + '/' + fn
            entries.append((app_prefix + arc, data))

    packageinfo = json.dumps({
        'app': app_id, 'id': app_id, 'loc_name': info.get('title', app_id),
        'package_format_version': 2, 'vendor': info.get('vendor', ''), 'version': version,
    }, indent=4).encode('utf-8')
    entries.append((pkg_prefix + 'packageinfo.json', packageinfo))
    total += len(packageinfo)

    control = (
        'Package: %s\nVersion: %s\nSection: misc\nPriority: optional\nArchitecture: all\n'
        'Installed-Size: %d\nMaintainer: N/A <nobody@example.com>\n'
        'Description: %s\nwebOS-Package-Format-Version: 2\nwebOS-Packager-Version: 1.0.0\n'
    ) % (app_id, version, (total + 1023) // 1024, info.get('title', app_id))

    ipk = ar_archive([
        ('debian-binary', b'2.0\n'),
        ('control.tar.gz', tar_gz([('./', None), ('./control', control.encode('utf-8'))])),
        ('data.tar.gz', tar_gz(entries)),
    ])
    os.makedirs(DIST, exist_ok=True)
    out = os.path.join(DIST, '%s_%s_all.ipk' % (app_id, version))
    with open(out, 'wb') as f:
        f.write(ipk)
    print('Creado: %s (%d KB)' % (out, len(ipk) // 1024))


if __name__ == '__main__':
    sys.exit(main())
