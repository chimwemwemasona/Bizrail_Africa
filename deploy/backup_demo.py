#!/usr/bin/env python3
"""Private, host-local backups for the sample-business demo."""
from pathlib import Path
from datetime import datetime, timezone, timedelta
import subprocess, os
ROOT = Path('/home/chimwemwe/apps/bizrail-runtime/backups')
def main():
    ROOT.mkdir(parents=True,exist_ok=True); ROOT.chmod(0o700)
    result=subprocess.run(['docker','exec','bizrail-africa-postgres-1','pg_dump','-U','bizrail_owner','-d','bizrail','--format=custom'],capture_output=True)
    if result.returncode: raise RuntimeError('Database backup failed: '+result.stderr.decode(errors='replace'))
    destination=ROOT/('bizrail-'+datetime.now(timezone.utc).strftime('%Y%m%d-%H%M%S')+'.dump')
    temp=destination.with_suffix('.tmp')
    with temp.open('wb') as f:os.chmod(temp,0o600);f.write(result.stdout)
    os.replace(temp,destination)
    cutoff=(datetime.now(timezone.utc)-timedelta(days=7)).timestamp()
    for old in ROOT.glob('bizrail-*.dump'):
        if old.stat().st_mtime<cutoff:old.unlink()
    print('Demo backup saved:',destination.name,'bytes:',destination.stat().st_size)
if __name__=='__main__':main()
