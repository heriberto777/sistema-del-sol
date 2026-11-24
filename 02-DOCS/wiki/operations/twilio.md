---
type: article
title: TWILIO (operaciones)
description: Mensajería de WhatsApp — notificaciones, bandeja y bot conversacional del tenant.
resource: 01-TOOLS/TWILIO/
tags: [operations, whatsapp, twilio]
timestamp: 2026-11-24T12:29:00Z
aliases: [twilio]
topic: operations
status: stable
sources: [harness bootstrap, 2026-11-24]
score: 8.0
---

# TWILIO (operaciones)

> Sources: harness bootstrap, 2026-11-24
> Raw: [twilio-readme-credentials](../../raw/operations/twilio-readme-credentials.md)

## Overview

Mensajería de WhatsApp: notificaciones (factura/cotización/estado de
cuenta por WhatsApp), la bandeja de WhatsApp, y el bot conversacional
(`backend/src/whatsapp-bot/`).

## Credenciales

- `TWILIO_ACCOUNT_SID` (público).
- `TWILIO_AUTH_TOKEN` (secreto) — rotar ante sospecha de fuga.
- `TWILIO_WHATSAPP_FROM` (público) — lleva el prefijo literal `whatsapp:`.

## Notas

El webhook de WhatsApp entrante usa `WHATSAPP_WEBHOOK_URL` (variable del
backend, no una credencial de Twilio). El plugin Publicaciones Sociales
reusa esta misma infraestructura para la entrega por WhatsApp.

## Related

- [01-TOOLS — resumen](./01-tools-overview.md)
- [Plugin Publicaciones Sociales](../subprojects/plugin-publicaciones-sociales.md)
