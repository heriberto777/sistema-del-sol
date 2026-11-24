---
type: article
title: Agente de Caja
description: App standalone fuera del workspace pnpm que abre la gaveta de dinero física del POS vía puerto COM.
resource: agente-caja/
tags: [pos, hardware, standalone]
timestamp: 2026-11-24T12:29:00Z
aliases: [agente-de-caja]
topic: subprojects
status: stable
sources: [harness bootstrap, 2026-11-24]
score: 4.0
---

# Agente de Caja

> Sources: harness bootstrap, 2026-11-24
> Raw: [agente-caja-readme](../../raw/subprojects/agente-caja-readme.md)

## Overview

`agente-caja/` es una app Node standalone — **fuera** del workspace pnpm,
empaquetada a `.exe` con `pkg` — que corre en la PC del cajero y abre la
gaveta de dinero física al cobrar en el POS. No forma parte del proceso
compilado del backend/frontend.

## Por qué existe

Hay dos métodos de apertura de caja configurables por `Bodega.metodoAperturaCaja`
(`backend/src/common/pos/resolver-metodo-apertura-caja.ts`):

- `AGENTE_LOCAL` — este agente. Cubre impresora térmica USB con cable de
  gaveta, o puerto serial/COM directo: ambos, desde Windows, terminan
  siendo un puerto COM (real o virtual).
- `WEB_SERIAL` — no necesita el agente, habla directo desde el navegador
  (solo Chrome/Edge de escritorio) vía `abrirCajaAgenteLocal()` en
  `frontend/src/lib/apertura-caja.ts`.

## Configuración y operación

- `config.json` junto al `.exe` (o en la carpeta en desarrollo):
  `{"puerto": "COM3", "baudRate": 9600}`. v1 no autodetecta el puerto —
  se configura a mano (Administrador de dispositivos → Puertos COM y
  LPT).
- Dev: `cd agente-caja && pnpm install && pnpm start`; healthcheck
  `curl http://127.0.0.1:9145/salud`.
- Build: `pnpm run build` genera `dist/agente-caja.exe` — se distribuye
  junto a `config.json`, sin necesidad de Node en la PC del cajero.

## Limitaciones conocidas (v1, a propósito)

- Sin instalador gráfico.
- Sin autodetección de puerto COM.
- Impresoras USB puras sin puerto COM virtual no soportadas (requeriría
  `node-usb`, fuera de alcance).

## Related

- [01-TOOLS — resumen de herramientas operativas](../operations/01-tools-overview.md) — mismo principio de "operación, no runtime", aunque `agente-caja` no vive en `01-TOOLS/` (es una app distribuible, no un script de operador).
