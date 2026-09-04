const fs = require('fs');
const path = require('path');

// Empaquetado con pkg, `process.pkg` existe y `__dirname` apunta al
// snapshot read-only del ejecutable — el config.json editable por el
// usuario vive JUNTO al .exe real, no adentro del snapshot.
const RUTA_CONFIG = process.pkg
  ? path.join(path.dirname(process.execPath), 'config.json')
  : path.join(__dirname, '..', 'config.json');

const DEFAULT = { puerto: 'COM3', baudRate: 9600 };

function cargarConfig() {
  try {
    const contenido = fs.readFileSync(RUTA_CONFIG, 'utf-8');
    return { ...DEFAULT, ...JSON.parse(contenido) };
  } catch {
    return DEFAULT;
  }
}

module.exports = { cargarConfig, RUTA_CONFIG };
