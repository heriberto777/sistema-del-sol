const http = require('http');
const { abrirGaveta } = require('./gaveta');
const { RUTA_CONFIG } = require('./config');

const PUERTO_HTTP = 9145;

// Solo *.ciguadev.com (el dominio de producción) y localhost (dev) —
// 127.0.0.1/localhost son "potentially trustworthy" para los
// navegadores, así que app.ciguadev.com (HTTPS) puede pegarle a este
// agente (HTTP local) sin bloqueo de contenido mixto.
const ORIGEN_PERMITIDO = /^https?:\/\/([a-z0-9-]+\.)*ciguadev\.com$|^https?:\/\/localhost(:\d+)?$/i;

function conCors(req, res) {
  const origen = req.headers.origin;
  if (origen && ORIGEN_PERMITIDO.test(origen)) {
    res.setHeader('Access-Control-Allow-Origin', origen);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  }
}

const servidor = http.createServer(async (req, res) => {
  conCors(req, res);

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === 'GET' && req.url === '/salud') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, config: RUTA_CONFIG }));
    return;
  }

  if (req.method === 'POST' && req.url === '/abrir-caja') {
    try {
      await abrirGaveta();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: err.message }));
    }
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ ok: false, error: 'No encontrado' }));
});

servidor.listen(PUERTO_HTTP, '127.0.0.1', () => {
  console.log(`Agente de caja escuchando en http://127.0.0.1:${PUERTO_HTTP} (config: ${RUTA_CONFIG})`);
});
