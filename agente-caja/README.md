# Agente de caja

Aplicación standalone (fuera del workspace pnpm) que corre en la PC del
cajero y abre la gaveta de dinero física al cobrar en el POS. Cubre los
dos escenarios de hardware posibles — impresora térmica USB con cable
de gaveta, o puerto serial/COM directo — porque ambos, desde Windows,
terminan siendo un puerto COM (real o virtual).

Es la contraparte del método `AGENTE_LOCAL` en
`Bodega.metodoAperturaCaja` (ver `backend/src/common/pos/resolver-metodo-apertura-caja.ts`)
y de `abrirCajaAgenteLocal()` en `frontend/src/lib/apertura-caja.ts`.
El otro método disponible, `WEB_SERIAL`, no necesita este agente — habla
directo desde el navegador (solo Chrome/Edge de escritorio).

## Configuración

Editar `config.json` (junto al `.exe` en la máquina del cajero, o en
esta carpeta en desarrollo):

```json
{
  "puerto": "COM3",
  "baudRate": 9600
}
```

`puerto` es el puerto COM de Windows donde está conectada la impresora
térmica (usualmente un COM virtual creado por su driver USB) o el cable
serial directo. v1 no autodetecta el puerto — se configura a mano
(Administrador de dispositivos → Puertos COM y LPT).

## Desarrollo

```bash
cd agente-caja
pnpm install
pnpm start
```

Confirma que está corriendo con `curl http://127.0.0.1:9145/salud`.

## Build (.exe de Windows)

```bash
pnpm run build
```

Genera `dist/agente-caja.exe` con `pkg`. Se distribuye junto a
`config.json` (el usuario lo edita para su puerto COM real) — no hace
falta tener Node instalado en la PC del cajero.

## Limitaciones conocidas (v1, a propósito)

- Sin instalador gráfico — solo el `.exe` + `config.json` a mano.
- Sin autodetección de puerto COM.
- Impresoras USB puras sin puerto COM virtual no están soportadas
  (requeriría `node-usb`, fuera de alcance de esta primera vuelta).
