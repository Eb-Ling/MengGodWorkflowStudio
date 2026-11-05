import {build} from 'vite';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {pluginDevkitBytes} from './package-plugin-devkit.mjs';
import {checkCommandDeclarations} from './generate-command-types.mjs';
const root = path.resolve(import.meta.dirname, '..');

export async function uiSourceHashes() {
  const hashes = {};
  async function collect(relative) {
    const target = path.join(root, relative);
    const stat = await fs.stat(target);
    if (stat.isDirectory()) {
      for (const name of (await fs.readdir(target)).sort()) if(name!=='node_modules')await collect(path.join(relative, name));
    } else if (!relative.endsWith('.md')) {
      hashes[relative.replaceAll('\\', '/')] = createHash('sha256').update(await fs.readFile(target)).digest('hex');
    }
  }
  for (const relative of ['frontend', 'packages', 'plugins', 'vite.config.ts', 'tsconfig.json', 'package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml', 'build/build-ui.mjs', 'build/package-plugin-devkit.mjs', 'build/build-resource-guard.mjs', 'build/examples']) await collect(relative);
  return hashes;
}

export async function buildUi() {
  await checkCommandDeclarations();
  const result = await build({configFile: path.join(root, 'vite.config.ts')});
  const output = path.join(root, 'build/ui');
  const packages = new Set();
  for (const bundle of Array.isArray(result) ? result : [result]) {
    for (const chunk of bundle.output || []) {
      for (const id of Object.keys(chunk.modules || {})) {
        const normalized = id.replaceAll('\\', '/'), marker = '/node_modules/';
        const offset = normalized.lastIndexOf(marker);
        if (offset < 0) continue;
        const tail = normalized.slice(offset + marker.length).split('/');
        packages.add(normalized.slice(0, offset + marker.length) + tail.slice(0, tail[0].startsWith('@') ? 2 : 1).join('/'));
      }
    }
  }
  const notices = ['Third-party packages included in the compiled UI.\n'];
  for (const directory of [...packages].sort()) {
    const pkg = JSON.parse(await fs.readFile(path.join(directory, 'package.json'), 'utf8'));
    notices.push(`\n--- ${pkg.name} ${pkg.version} (${pkg.license || 'see license text'}) ---\n`);
    for (const filename of await fs.readdir(directory)) {
      if (/^(licen[cs]e|copying|notice)(\.|$)/i.test(filename) && (await fs.stat(path.join(directory, filename))).isFile()) {
        notices.push(await fs.readFile(path.join(directory, filename), 'utf8'));
      }
    }
  }
  await fs.writeFile(path.join(output, 'THIRD_PARTY_UI_NOTICES.txt'), notices.join('\n'));
  await fs.cp(path.join(root, 'plugins/starsector/runtime'), path.join(output, 'assets/starsector'), {recursive: true});
  await fs.mkdir(path.join(output, 'assets/developer'), {recursive: true});
  await fs.writeFile(path.join(output, 'assets/developer/workflow-plugin-devkit-1.0.0.zip'), await pluginDevkitBytes());
  await fs.writeFile(path.join(output, 'build-info.json'), JSON.stringify({sources: await uiSourceHashes()}, null, 2));
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.join(root, 'build/build-ui.mjs')) await buildUi();
