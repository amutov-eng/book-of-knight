import { copyFile, mkdir, readdir, readFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';

const variant = process.env.VITE_VARIANT || process.env.VARIANT || 'desktop';
const outDir = `dist/prod/${variant}`;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function isVariant(value: string): value is 'desktop' | 'mobile' {
  return value === 'desktop' || value === 'mobile';
}

async function copyDir(from: string, to: string): Promise<void> {
  if (!existsSync(from)) return;
  await mkdir(to, { recursive: true });
  const entries = await readdir(from, { withFileTypes: true });
  for (const entry of entries) {
    const src = path.join(from, entry.name);
    const dst = path.join(to, entry.name);
    if (entry.isDirectory()) {
      await copyDir(src, dst);
      continue;
    }
    await mkdir(path.dirname(dst), { recursive: true });
    await copyFile(src, dst);
  }
}

function assetsSyncPlugin(activeVariant: string): Plugin {
  const runtimeVariant = isVariant(activeVariant) ? activeVariant : 'desktop';
  const root = __dirname;
  const commonDir = path.resolve(root, 'assets', 'common');
  const variantDir = path.resolve(root, 'assets', runtimeVariant);
  const outputDir = path.resolve(root, 'public', 'assets');
  const sourceDirs = [commonDir, variantDir].map((p) => p.toLowerCase());

  const isSourceAssetPath = (filePath: string): boolean => {
    const normalized = path.resolve(filePath).toLowerCase();
    return sourceDirs.some((sourceDir) => normalized.startsWith(sourceDir));
  };

  const syncAll = async (): Promise<void> => {
    await rm(outputDir, { recursive: true, force: true });
    await mkdir(outputDir, { recursive: true });
    await copyDir(commonDir, outputDir);
    await copyDir(variantDir, outputDir);
  };

  return {
    name: 'dev-assets-sync',
    apply: 'serve',
    configureServer(server) {
      let running = false;
      let pending = false;
      let debounce: NodeJS.Timeout | null = null;

      const runSync = () => {
        if (running) {
          pending = true;
          return;
        }
        running = true;
        void syncAll()
          .then(() => {
            server.ws.send({ type: 'full-reload' });
          })
          .finally(() => {
            running = false;
            if (pending) {
              pending = false;
              runSync();
            }
          });
      };

      const scheduleSync = (filePath: string) => {
        if (!isSourceAssetPath(filePath)) return;
        if (debounce) clearTimeout(debounce);
        debounce = setTimeout(() => runSync(), 120);
      };

      server.watcher.add([commonDir, variantDir]);
      server.watcher.on('change', scheduleSync);
      server.watcher.on('add', scheduleSync);
      server.watcher.on('unlink', scheduleSync);
      server.watcher.on('addDir', scheduleSync);
      server.watcher.on('unlinkDir', scheduleSync);

      server.middlewares.use(async (req, res, next) => {
        const rawUrl = req.url || '';
        const pathname = rawUrl.split('?')[0];
        if (!pathname.startsWith('/assets/')) {
          next();
          return;
        }

        const relativePath = pathname.replace(/^\/assets\//, '');
        const targetPath = path.join(outputDir, relativePath);
        if (!existsSync(targetPath)) {
          next();
          return;
        }

        const ext = path.extname(targetPath).toLowerCase();
        const typeMap: Record<string, string> = {
          '.json': 'application/json; charset=utf-8',
          '.png': 'image/png',
          '.jpg': 'image/jpeg',
          '.jpeg': 'image/jpeg',
          '.webp': 'image/webp',
          '.svg': 'image/svg+xml; charset=utf-8',
          '.txt': 'text/plain; charset=utf-8'
        };

        try {
          const file = await readFile(targetPath);
          res.statusCode = 200;
          res.setHeader('Content-Type', typeMap[ext] || 'application/octet-stream');
          res.end(file);
        } catch {
          next();
        }
      });

      runSync();
    }
  };
}

export default defineConfig({
  plugins: [assetsSyncPlugin(variant)],
  define: {
    __VARIANT__: JSON.stringify(variant)
  },
  server: {
    host: true,
    strictPort: false
  },
  build: {
    outDir,
    sourcemap: false,
    emptyOutDir: true,
    target: 'es2022'
  }
});
