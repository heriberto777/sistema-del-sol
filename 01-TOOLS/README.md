# 01-TOOLS

> Generado por `harness` el 2026-11-24.

Arsenal operativo de **Sistema del Sol**. Cada subcarpeta es una
**herramienta** que combina (a) credenciales co-ubicadas en su propio
`.env` y (b) los scripts/CLIs que las consumen. Todo lo necesario para
operar un servicio externo vive bajo `01-TOOLS/<SERVICIO>/`.

> **Operación, no runtime.** Los scripts acá son los que corre un
> operador desde la terminal. El SDK que la app consume en producción
> **no vive acá** — vive en `backend/src/`.

## Convenciones

### Nombres y estructura

- **Carpeta de herramienta**: MAYÚSCULAS con `_` — `STRIPE`, `TWILIO`.
- **Una carpeta = un proveedor externo.**
- **Scripts**: snake_case, verbo en infinitivo + objeto —
  `test_connection.sh`.
- **Variables de `.env`**: MAYÚSCULAS con `_`, prefijo del proveedor —
  `STRIPE_SECRET_KEY`, `TWILIO_AUTH_TOKEN`.

### Archivos por herramienta

| Archivo | Obligatorio | Propósito |
|---------|-------------|-----------|
| `.env` | sí (si hay secretos) | Credenciales reales — `chmod 600`, gitignored. |
| `.env.example` | sí | Plantilla pública con los nombres de variable, valores vacíos. |
| `.gitignore` | sí | Al menos `.env` y `keys/`. |
| `README.md` | sí | Qué hace y cómo correr los scripts. |
| `CREDENTIALS.md` | sí | Detalle de cada variable, dashboard del proveedor, rotación. |
| `test_connection.sh` | sí | Smoke-test, sin parámetros. |

## Catálogo

| Herramienta | Categoría | Para qué | Estado |
|-------------|-----------|----------|--------|
| [`ANTHROPIC`](./ANTHROPIC/README.md) | ia | Claude API — `backend/src/ia/`, degrada a heurística sin key | Creada |
| [`STRIPE`](./STRIPE/README.md) | pagos | Pasarela de pago de la suscripción de plataforma | Creada |
| [`TWILIO`](./TWILIO/README.md) | comunicación | Mensajería de WhatsApp (bandeja, bot, notificaciones) | Creada |

**No catalogados en esta skill** (reales en el código, sin entrada en
`providers.yaml` — no se fabrica una carpeta especulativa):
`CARDNET`, `AZUL` (pasarelas locales de RD, hoy stubs), `DUFFEL` (API de
viajes, plugin Travel), `ALANUBE` (e-CF/DGII). Si hace falta una carpeta
real para alguno, se hace puntual con la skill `connect-tool`.

## Flujos comunes

```bash
# Smoke-test de cada herramienta
01-TOOLS/ANTHROPIC/test_connection.sh
01-TOOLS/STRIPE/test_connection.sh
01-TOOLS/TWILIO/test_connection.sh
```

## Agregar una herramienta nueva

1. `cp -r 01-TOOLS/_TEMPLATE 01-TOOLS/<NOMBRE>`
2. Llenar `.env.example` con los nombres reales de variable del proveedor.
3. Crear el `.env` real con valores del dashboard. `chmod 600 .env`.
4. **Implementar `test_connection.sh` primero** — un smoke-test tonto.
5. Agregar otros scripts a demanda — solo los que hagan falta ahora.
6. Actualizar el `README.md` de la herramienta.
7. Agregar una fila al catálogo de este README.

## Filosofía

- **Sin herramientas especulativas.** Una herramienta se agrega cuando la
  integración ya está en runtime o hay una operación manual recurrente
  que duele.
- **Smoke-test primero.** Antes que cualquier otro script, probar que las
  credenciales funcionan.
- **Co-ubicación.** Credenciales y scripts viven juntos. Rotar una key =
  abrir una carpeta.

## Ver también

- `02-DOCS/` — wiki LLM del proyecto. Cuando una herramienta acumula
  operaciones recurrentes que vale la pena documentar más allá del README
  local, el protocolo de `harness` ingiere el README +
  `CREDENTIALS.md` en `02-DOCS/raw/operations/` y los compila en
  `02-DOCS/wiki/operations/`.
