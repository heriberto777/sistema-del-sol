// Ítem F-9 (ver ARCHITECTURE.md/docs/cuadre-plan-integracion.md) — abrir
// la gaveta de dinero física al cobrar en POS, por 2 caminos posibles
// según Bodega.metodoAperturaCaja (resuelto server-side, ver
// resolver-metodo-apertura-caja.ts):
//
// - AGENTE_LOCAL: le pega a un servidor HTTP corriendo en la PC del
//   cajero (agente-caja/, carpeta standalone en la raíz del repo, se
//   distribuye como .exe aparte). 127.0.0.1/localhost son "potentially
//   trustworthy" para los navegadores modernos, así que una página en
//   HTTPS SÍ puede hacer fetch a este puerto local sin bloqueo de
//   contenido mixto.
// - WEB_SERIAL: sin instalar nada, habla directo por USB/serial desde
//   el propio navegador (solo Chrome/Edge de escritorio).
//
// En ambos casos, un fallo (agente no corriendo, puerto no autorizado)
// nunca debe impedir que la venta ya registrada se vea como exitosa —
// por eso todo acá adentro atrapa sus propios errores y no relanza.

const URL_AGENTE_LOCAL = 'http://127.0.0.1:9145';

// Comando ESC/POS de kick estándar (pin 2, el más común en gavetas con
// cable RJ11/RJ12) — igual en el agente local (ver agente-caja/) y acá.
const COMANDO_KICK_ESC_POS = new Uint8Array([0x1b, 0x70, 0x00, 0x19, 0xfa]);

export async function abrirCajaAgenteLocal(): Promise<void> {
  try {
    await fetch(`${URL_AGENTE_LOCAL}/abrir-caja`, { method: 'POST' });
  } catch {
    // Agente no instalado o no corriendo en este momento — silencioso a propósito.
  }
}

export function soportaWebSerial(): boolean {
  return typeof navigator !== 'undefined' && !!navigator.serial;
}

let puertoWebSerial: SerialPort | null = null;

/** Puerto ya autorizado en una sesión anterior (no vuelve a preguntar) — llamar al montar la pantalla de POS. */
export async function puertoWebSerialYaAutorizado(): Promise<boolean> {
  if (!navigator.serial) return false;
  const puertos = await navigator.serial.getPorts();
  if (puertos.length === 0) return false;
  puertoWebSerial = puertos[0];
  return true;
}

/** Requiere gesto del usuario (click) — el navegador rechaza requestPort() fuera de un handler de click/submit. */
export async function conectarCajaWebSerial(): Promise<boolean> {
  if (!navigator.serial) return false;
  try {
    puertoWebSerial = await navigator.serial.requestPort();
    return true;
  } catch {
    return false; // el usuario cerró el selector de dispositivo sin elegir uno
  }
}

export async function abrirCajaWebSerial(): Promise<void> {
  if (!puertoWebSerial) {
    const autorizado = await puertoWebSerialYaAutorizado();
    if (!autorizado) return;
  }
  try {
    await puertoWebSerial!.open({ baudRate: 9600 });
    const writer = puertoWebSerial!.writable!.getWriter();
    await writer.write(COMANDO_KICK_ESC_POS);
    writer.releaseLock();
    await puertoWebSerial!.close();
  } catch {
    // Puerto desconectado o en uso — silencioso a propósito.
  }
}
