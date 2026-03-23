import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const bitmapDir = path.join(rootDir, 'assets', 'common', 'fonts', 'bitmap');
const charsetPath = path.join(bitmapDir, 'charset.txt');
const binaryPath = path.join(
  rootDir,
  'node_modules',
  'msdf-bmfont-xml',
  'cli.js'
);

const sharedArgs = [
  '-i', charsetPath,
  '-s', '72',
  '-m', '2048,1024',
  '-r', '6',
  '-p', '2',
  '-b', '2',
  '-t', 'msdf'
];

const fonts = [
  {
    input: path.join(rootDir, 'assets', 'common', 'fonts', 'Roboto-Bold.ttf'),
    output: path.join(bitmapDir, 'roboto-bold.png')
  },
  {
    input: path.join(rootDir, 'assets', 'common', 'fonts', 'Roboto-Black.ttf'),
    output: path.join(bitmapDir, 'roboto-black.png')
  },
  {
    input: path.join(rootDir, 'assets', 'common', 'fonts', 'Roboto_Condensed-Medium.ttf'),
    output: path.join(bitmapDir, 'roboto-condensed-medium.png')
  }
];

for (const font of fonts) {
  const result = spawnSync(process.execPath, [binaryPath, font.input, '-o', font.output, ...sharedArgs], {
    cwd: rootDir,
    stdio: 'inherit'
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
