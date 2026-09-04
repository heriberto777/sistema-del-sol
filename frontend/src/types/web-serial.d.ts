// Subconjunto mínimo de la Web Serial API (solo Chrome/Edge de escritorio)
// — TypeScript no la incluye en lib.dom.d.ts. Ver frontend/src/lib/apertura-caja.ts.
interface SerialPort {
  open(options: { baudRate: number }): Promise<void>;
  close(): Promise<void>;
  readonly writable: WritableStream<Uint8Array> | null;
}

interface Serial {
  requestPort(): Promise<SerialPort>;
  getPorts(): Promise<SerialPort[]>;
}

interface Navigator {
  readonly serial?: Serial;
}
