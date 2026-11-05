import { execFileSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
export function buildResourceGuard() {
  const dir = path.resolve(import.meta.dirname, '../packages/extension-host');
  const source=path.join(dir,'resource-guard.cs'), output=path.join(dir,'resource-guard.exe');
  if(fs.existsSync(output) && fs.statSync(output).mtimeMs >= fs.statSync(source).mtimeMs) return;
  execFileSync('C:/Windows/Microsoft.NET/Framework64/v4.0.30319/csc.exe',
    ['/nologo','/optimize+','/target:exe','/platform:x64','/out:' + path.join(dir,'resource-guard.exe'), path.join(dir,'resource-guard.cs')], { windowsHide: true });
}
if (process.argv[1] && path.resolve(process.argv[1]) === import.meta.filename) buildResourceGuard();
