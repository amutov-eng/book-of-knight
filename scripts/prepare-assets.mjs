import { rm, mkdir, readdir, copyFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');

const variant = (process.argv[2] || process.env.VARIANT || process.env.VITE_VARIANT || 'desktop').trim();
if (!['desktop', 'mobile'].includes(variant)) {
  console.error(`Invalid variant: ${variant}`);
  process.exit(1);
}

const srcCommon = path.join(root, 'assets', 'common');
const srcVariant = path.join(root, 'assets', variant);
const srcDesktop = path.join(root, 'assets', 'desktop');
const outAssets = path.join(root, 'public', 'assets');
const sharedIntroRelativePaths = [
  path.join('spine', 'intro', '600_felix_logo.json'),
  path.join('spine', 'intro', '600_felix_logo.atlas'),
  path.join('spine', 'intro', '600_felix_logo.png')
];

async function copyDir(from, to) {
  if (!existsSync(from)) return;
  await mkdir(to, { recursive: true });
  const entries = await readdir(from, { withFileTypes: true });
  for (const entry of entries) {
    const src = path.join(from, entry.name);
    const dst = path.join(to, entry.name);
    if (entry.isDirectory()) {
      await copyDir(src, dst);
    } else {
      await mkdir(path.dirname(dst), { recursive: true });
      await copyFile(src, dst);
    }
  }
}

await rm(outAssets, { recursive: true, force: true });
await mkdir(outAssets, { recursive: true });
await copyDir(srcCommon, outAssets);
await copyDir(srcVariant, outAssets);

for (const relativePath of sharedIntroRelativePaths) {
  const target = path.join(outAssets, relativePath);
  if (existsSync(target)) continue;

  const desktopFallback = path.join(srcDesktop, relativePath);
  if (!existsSync(desktopFallback)) continue;

  await mkdir(path.dirname(target), { recursive: true });
  await copyFile(desktopFallback, target);
}

console.log(`[prepare-assets] variant=${variant} -> ${path.relative(root, outAssets)}`);
