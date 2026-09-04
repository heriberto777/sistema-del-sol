const { SerialPort } = require('serialport');
const { cargarConfig } = require('./config');

// Comando ESC/POS de kick estándar (pin 2, el más común en gavetas con
// cable RJ11/RJ12) — igual que en frontend/src/lib/apertura-caja.ts
// (camino Web Serial). Cubre tanto una impresora térmica USB con cable
// de gaveta (expone un puerto COM virtual) como un puerto serial/COM
// directo — desde acá, ambos son el mismo puerto COM.
const COMANDO_KICK_ESC_POS = Buffer.from([0x1b, 0x70, 0x00, 0x19, 0xfa]);

function abrirGaveta() {
  return new Promise((resolve, reject) => {
    const { puerto, baudRate } = cargarConfig();
    const sp = new SerialPort({ path: puerto, baudRate }, (err) => {
      if (err) {
        reject(new Error(`No se pudo abrir el puerto ${puerto}: ${err.message}`));
        return;
      }
      sp.write(COMANDO_KICK_ESC_POS, (errEscritura) => {
        sp.close(() => {
          if (errEscritura) reject(errEscritura);
          else resolve();
        });
      });
    });
  });
}

module.exports = { abrirGaveta };
