import fs from 'fs';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3006;
const PROJECT_ROOT = path.resolve(__dirname, '../../');
const MANIFEST_PATH = path.join(PROJECT_ROOT, 'assets/desktop/assets-manifest.desktop.json');
const TRANSLATIONS_PATH = path.join(PROJECT_ROOT, 'assets/common/localization/translations.json');
const ATLAS_FILES = [
    'assets/desktop/symbols/symbols-0.json',
    'assets/desktop/symbols/freegames.json',
    'assets/desktop/ui/interface-0.json',
    'assets/desktop/ui/menu_buttons-0.json'
];

function sendJson(res, statusCode, payload) {
    res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(payload, null, 2));
}

function readJson(filePath) {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value) {
    fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function buildAtlasIndex() {
    const atlasIndex = {};
    for (const relativePath of ATLAS_FILES) {
        const atlasPath = path.join(PROJECT_ROOT, relativePath);
        if (!fs.existsSync(atlasPath)) continue;
        const atlas = readJson(atlasPath);
        const frames = atlas?.frames || {};
        const imageName = atlas?.meta?.image;
        const sheetW = Number(atlas?.meta?.size?.w) || 0;
        const sheetH = Number(atlas?.meta?.size?.h) || 0;
        if (!imageName) continue;
        const imagePath = `/${path.posix.join(path.posix.dirname(relativePath), imageName)}`;

        for (const [frameName, frameData] of Object.entries(frames)) {
            if (!frameData || !frameData.frame) continue;
            atlasIndex[frameName] = {
                imagePath,
                sheetW,
                sheetH,
                x: Number(frameData.frame.x) || 0,
                y: Number(frameData.frame.y) || 0,
                w: Number(frameData.frame.w) || 0,
                h: Number(frameData.frame.h) || 0,
                sourceW: Number(frameData.sourceSize?.w) || Number(frameData.frame.w) || 0,
                sourceH: Number(frameData.sourceSize?.h) || Number(frameData.frame.h) || 0
            };
        }
    }

    atlasIndex['bg_menu.png'] = {
        imagePath: '/assets/desktop/ui/bg_menu.png',
        sheetW: 1920,
        sheetH: 1080,
        x: 0,
        y: 0,
        w: 1920,
        h: 1080,
        sourceW: 1920,
        sourceH: 1080,
        direct: true
    };

    return atlasIndex;
}

function readRequestBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', (chunk) => {
            body += chunk.toString();
        });
        req.on('end', () => resolve(body));
        req.on('error', reject);
    });
}

function serveStatic(req, res) {
    if (req.url.startsWith('/assets/')) {
        const assetPath = path.join(PROJECT_ROOT, req.url.replace(/^\//, ''));
        fs.readFile(assetPath, (err, content) => {
            if (err) {
                res.writeHead(err.code === 'ENOENT' ? 404 : 500);
                res.end(err.code === 'ENOENT' ? 'File not found' : `Server error: ${err.code}`);
                return;
            }

            const extname = path.extname(assetPath).toLowerCase();
            const contentTypes = {
                '.json': 'application/json; charset=utf-8',
                '.png': 'image/png',
                '.jpg': 'image/jpeg',
                '.jpeg': 'image/jpeg',
                '.svg': 'image/svg+xml'
            };
            res.writeHead(200, { 'Content-Type': contentTypes[extname] || 'application/octet-stream' });
            res.end(content);
        });
        return;
    }

    const filePath = path.join(__dirname, 'app', req.url === '/' ? 'index.html' : req.url);
    const extname = path.extname(filePath).toLowerCase();
    const contentTypes = {
        '.html': 'text/html; charset=utf-8',
        '.js': 'text/javascript; charset=utf-8',
        '.css': 'text/css; charset=utf-8',
        '.json': 'application/json; charset=utf-8',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.svg': 'image/svg+xml'
    };

    fs.readFile(filePath, (err, content) => {
        if (err) {
            if (err.code === 'ENOENT') {
                res.writeHead(404);
                res.end('File not found');
                return;
            }
            res.writeHead(500);
            res.end(`Server error: ${err.code}`);
            return;
        }

        res.writeHead(200, { 'Content-Type': contentTypes[extname] || 'application/octet-stream' });
        res.end(content);
    });
}

const server = http.createServer(async (req, res) => {
    if (req.url === '/api/help-data' && req.method === 'GET') {
        try {
            const manifest = readJson(MANIFEST_PATH);
            const translations = readJson(TRANSLATIONS_PATH);
            const atlasIndex = buildAtlasIndex();
            sendJson(res, 200, { manifest, translations, atlasIndex });
        } catch (error) {
            sendJson(res, 500, { error: `Failed to load help data: ${error instanceof Error ? error.message : String(error)}` });
        }
        return;
    }

    if (req.url === '/api/help-data' && req.method === 'POST') {
        try {
            const rawBody = await readRequestBody(req);
            const body = JSON.parse(rawBody || '{}');
            if (!body || typeof body !== 'object') {
                sendJson(res, 400, { error: 'Invalid payload.' });
                return;
            }

            if (!body.manifest || !body.translations) {
                sendJson(res, 400, { error: 'Both manifest and translations are required.' });
                return;
            }

            writeJson(MANIFEST_PATH, body.manifest);
            writeJson(TRANSLATIONS_PATH, body.translations);
            sendJson(res, 200, { success: true });
        } catch (error) {
            sendJson(res, 500, { error: `Failed to save help data: ${error instanceof Error ? error.message : String(error)}` });
        }
        return;
    }

    serveStatic(req, res);
});

server.listen(PORT, '0.0.0.0', () => {
    console.log('Help Menu Editor running at:');
    console.log(`- http://localhost:${PORT}/`);
    console.log(`- http://127.0.0.1:${PORT}/`);
    console.log(`Manifest: ${MANIFEST_PATH}`);
    console.log(`Translations: ${TRANSLATIONS_PATH}`);
});
