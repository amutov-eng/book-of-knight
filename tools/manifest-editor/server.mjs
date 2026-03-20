import fs from 'fs';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3005;
const PROJECT_ROOT = path.resolve(__dirname, '../../');
const MANIFEST_PATH = path.join(PROJECT_ROOT, 'assets/desktop/assets-manifest.desktop.json');

const server = http.createServer((req, res) => {
    // Handle API requests
    if (req.url === '/api/manifest') {
        if (req.method === 'GET') {
            fs.readFile(MANIFEST_PATH, 'utf8', (err, data) => {
                if (err) {
                    res.writeHead(500);
                    res.end(JSON.stringify({ error: 'Failed to read manifest' }));
                    return;
                }
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(data);
            });
            return;
        } else if (req.method === 'POST') {
            let body = '';
            req.on('data', chunk => body += chunk.toString());
            req.on('end', () => {
                try {
                    const json = JSON.parse(body);
                    fs.writeFile(MANIFEST_PATH, JSON.stringify(json, null, 4), 'utf8', (err) => {
                        if (err) {
                            res.writeHead(500);
                            res.end(JSON.stringify({ error: 'Failed to write manifest' }));
                            return;
                        }
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: true }));
                    });
                } catch (e) {
                    res.writeHead(400);
                    res.end(JSON.stringify({ error: 'Invalid JSON' }));
                }
            });
            return;
        }
    }

    // Serve static files
    let filePath = path.join(__dirname, 'app', req.url === '/' ? 'index.html' : req.url);
    const extname = path.extname(filePath);
    let contentType = 'text/html';
    switch (extname) {
        case '.js':
            contentType = 'text/javascript';
            break;
        case '.css':
            contentType = 'text/css';
            break;
        case '.json':
            contentType = 'application/json';
            break;
        case '.png':
            contentType = 'image/png';
            break;
        case '.jpg':
            contentType = 'image/jpg';
            break;
    }

    fs.readFile(filePath, (err, content) => {
        if (err) {
            if (err.code == 'ENOENT') {
                res.writeHead(404);
                res.end('File not found');
            } else {
                res.writeHead(500);
                res.end('Server error: ' + err.code);
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`Manifest Editor running at:`);
    console.log(`- http://localhost:${PORT}/`);
    console.log(`- http://127.0.0.1:${PORT}/`);
    console.log(`Editing: ${MANIFEST_PATH}`);
});
