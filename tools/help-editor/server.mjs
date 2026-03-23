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
            sendJson(res, 200, { manifest, translations });
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
