# Sistema del Sol — Plugin Travel Management
## Especificación maestra para Codex / Claude Code / agentes de desarrollo

---

## 1. Objetivo

Crear un nuevo plugin/módulo llamado:

`Travel Management`

para integrarlo dentro de:

`Sistema del Sol`

Sistema del Sol es actualmente un sistema de facturación.

El nuevo módulo debe permitir administrar una plataforma de viajes integrada con APIs externas de proveedores como:

- Duffel
- Amadeus
- Travelport
- futuros proveedores

El primer proveedor que se implementará será:

`Duffel`

La arquitectura debe permitir agregar otros proveedores sin modificar la lógica principal de la aplicación.

---

# 2. Arquitectura objetivo

Conceptualmente:

```text
┌─────────────────────────────────────────────────────┐
│                  SISTEMA DEL SOL                    │
│              Sistema de Facturación                 │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Facturación │ Clientes │ Productos │ Usuarios      │
│                                                     │
│                    🔌 PLUGINS                       │
│                         │                           │
│              ┌──────────▼──────────┐                │
│              │   TRAVEL MANAGEMENT │                │
│              │       PLUGIN        │                │
│              └──────────┬──────────┘                │
│                         │                           │
└─────────────────────────┼───────────────────────────┘
                          │
                 Travel Provider Layer
                          │
             ┌────────────┼────────────┐
             ▼            ▼            ▼
          Duffel       Amadeus     Travelport
             │            │            │
             └────────────┼────────────┘
                          │
                 ✈️ Vuelos / 🏨 Hoteles
```

El plugin debe sentirse como una parte nativa de Sistema del Sol, no como una aplicación independiente pegada al sistema.

---

# 3. Rol del agente

Actúa como:

**Principal Software Architect + Senior Full-Stack Developer**

Antes de modificar código:

1. Analiza completamente la arquitectura existente de Sistema del Sol.
2. Identifica:
   - Backend
   - Frontend
   - Base de datos
   - Sistema actual de plugins
   - Autenticación/autorización
   - Clientes
   - Facturación
   - Configuración
   - Auditoría
   - Sistema de navegación/menús
   - Sistema de permisos
   - Sistema de eventos/hooks
   - API interna
3. No reemplaces ni reescribas funcionalidades existentes.
4. No crees una segunda arquitectura innecesaria.
5. Reutiliza patrones y componentes existentes.
6. Mantén compatibilidad hacia atrás.
7. Antes de modificar archivos, presenta un análisis de la arquitectura encontrada y un plan de implementación.
8. No ejecutes migraciones destructivas.
9. No elimines datos existentes.
10. No modifiques funcionalidades existentes sin justificarlo.

---

# 4. Principio fundamental: Multi-Provider

## NO acoplar el sistema directamente a Duffel

Debe existir una abstracción:

`TravelProvider`

Ejemplo conceptual:

```typescript
interface TravelProvider {
    searchFlights(request: FlightSearchRequest): Promise<FlightSearchResult>;

    priceFlight(request: FlightPriceRequest): Promise<FlightPriceResult>;

    createFlightOrder(
        request: FlightBookingRequest
    ): Promise<FlightBookingResult>;

    getFlightOrder(orderId: string): Promise<FlightOrder>;

    cancelFlightOrder(orderId: string): Promise<CancelResult>;

    searchHotels(
        request: HotelSearchRequest
    ): Promise<HotelSearchResult>;

    getHotelOffer(
        request: HotelOfferRequest
    ): Promise<HotelOfferResult>;

    createHotelBooking(
        request: HotelBookingRequest
    ): Promise<HotelBookingResult>;

    cancelHotelBooking(
        request: HotelCancellationRequest
    ): Promise<CancelResult>;
}
```

La implementación inicial será:

```text
DuffelTravelProvider
```

Posteriormente:

```text
AmadeusTravelProvider
TravelportTravelProvider
```

---

# 5. Arquitectura recomendada

Adaptar esta estructura a la arquitectura real de Sistema del Sol.

No imponerla si el proyecto existente utiliza otro patrón mejor.

```text
Travel Management
│
├── Domain
│   ├── flights
│   ├── hotels
│   ├── bookings
│   ├── passengers
│   ├── travelers
│   ├── providers
│   ├── payments
│   └── commissions
│
├── Application
│   ├── search
│   ├── pricing
│   ├── booking
│   ├── cancellation
│   └── management
│
├── Infrastructure
│   ├── duffel
│   ├── amadeus
│   ├── travelport
│   ├── cache
│   └── persistence
│
└── Presentation
    ├── API
    ├── Admin
    └── Customer
```

---

# 6. Plugin

El módulo debe comportarse como un plugin real de Sistema del Sol.

Debe poder:

- instalarse
- activarse
- desactivarse
- configurar proveedores
- administrar permisos
- registrar menús
- registrar rutas
- registrar APIs
- registrar migraciones
- registrar eventos/hooks
- registrar tareas programadas
- mantener sus propias tablas

No duplicar funcionalidades existentes de Sistema del Sol.

---

# 7. Administración del plugin

Crear una sección:

`Configuración → Viajes`

## Proveedores

Mostrar:

```text
Proveedor       Estado       Ambiente       Acciones

Duffel          ● Activo     Production     Configurar
Amadeus         ○ Inactivo   Production     Configurar
Travelport      ○ Inactivo   Production     Configurar
```

---

# 8. Configuración de Duffel

Crear formulario:

```text
Proveedor
Duffel

Ambiente

( ) Sandbox
( ) Production

API Token
[************************]

Organization ID
[************************]

Webhook URL
[************************]

Estado
[Activo]

[Guardar]

[Test Connection]
```

## Seguridad de credenciales

Nunca almacenar secretos en texto plano si la arquitectura existente permite cifrado.

Utilizar, según las capacidades existentes:

- secret manager
- variables de entorno
- cifrado de credenciales
- vault

Nunca exponer API tokens en:

- frontend
- logs
- respuestas API
- errores
- consola del navegador

---

# 9. TravelProviderFactory

Crear:

```text
TravelProviderFactory
```

Ejemplo:

```typescript
getProvider("duffel")
getProvider("amadeus")
getProvider("travelport")
```

La aplicación no debe conocer detalles internos de cada proveedor.

Flujo:

```text
FlightSearchService
       │
       ▼
TravelProviderFactory
       │
       ▼
DuffelTravelProvider
       │
       ▼
Duffel API
```

---

# 10. Búsqueda de vuelos

Crear página:

`/travel/flights`

Formulario tipo buscador de viajes:

```text
Tipo de viaje

(●) Ida y vuelta
( ) Solo ida
( ) Multi-destino

Origen
[ Santo Domingo (SDQ) ]

Destino
[ Madrid (MAD) ]

Salida
[ 10/11/2026 ]

Regreso
[ 20/11/2026 ]

Pasajeros
Adultos [2]
Niños   [0]
Bebés   [0]

Cabina
[Economy ▼]

[ BUSCAR VUELOS ]
```

Debe soportar:

- aeropuerto
- ciudad
- código IATA
- autocomplete
- fechas
- pasajeros
- cabina
- equipaje cuando el proveedor lo permita
- ida/vuelta
- solo ida
- multi-city

---

# 11. Resultados de vuelos

Mostrar:

```text
Filtros
──────────────
Escalas
Precio
Aeropuerto
Aerolínea
Horario
Duración
Equipaje
Cabina

Resultados

Iberia
SDQ → MAD

09:15 ───────── 08:30
1 escala

USD 742

[VER VUELO]
```

Cada resultado debe mostrar:

- aerolínea
- logo
- número de vuelo
- origen
- destino
- horario
- duración
- escalas
- equipaje
- cabina
- precio
- moneda
- condiciones
- identificador interno de oferta

---

# 12. Gestión del Offer ID

No confiar únicamente en información almacenada del frontend.

El backend debe conservar y/o revalidar la oferta antes de reservar.

Flujo:

```text
Search
   ↓
Flight Offer
   ↓
Cache / DB
   ↓
User selects
   ↓
Re-price
   ↓
Price confirmed
   ↓
Booking
```

Nunca reservar directamente una oferta vieja sin volver a validarla cuando el proveedor lo requiera.

---

# 13. Hoteles

Crear:

`/travel/hotels`

Formulario:

```text
Destino
[ Punta Cana ]

Check-in
[ 15/10/2026 ]

Check-out
[ 20/10/2026 ]

Habitaciones
[1]

Adultos
[2]

Niños
[0]

[ BUSCAR HOTELES ]
```

Resultados:

```text
Hotel

Nombre
★★★★★

Punta Cana

Habitación Deluxe

USD 840

5 noches

[VER HABITACIONES]
```

Debe soportar:

- hoteles
- habitaciones
- ocupación
- precio
- moneda
- políticas
- cancelación
- amenities
- imágenes cuando estén disponibles
- ubicación
- rating
- disponibilidad

---

# 14. Booking

Crear flujo:

```text
Search
 ↓
Select Offer
 ↓
Re-price
 ↓
Passenger Information
 ↓
Customer Information
 ↓
Payment
 ↓
Create Order
 ↓
Confirmation
```

Crear número interno:

```text
TRV-2026-000001
```

El identificador interno nunca debe depender del ID del proveedor.

Guardar ambos:

```text
internal_booking_id
provider_booking_id
```

---

# 15. Pasajeros

Crear gestión de pasajeros:

```text
Nombre
Apellido
Fecha nacimiento
Nacionalidad
Sexo
Documento
Número documento
Fecha expiración
País emisión
Email
Teléfono
```

Para vuelos internacionales contemplar:

- passport
- APIS
- SSR
- servicios adicionales

según soporte del proveedor.

No almacenar información sensible que no sea necesaria.

---

# 16. Integración con clientes de Sistema del Sol

Integrar con los clientes existentes de Sistema del Sol.

**NO crear un segundo sistema de clientes.**

Un cliente de Sistema del Sol debe poder tener:

```text
Cliente
   │
   ├── Facturas
   ├── Pagos
   ├── Viajes
   ├── Reservas
   └── Pasajeros
```

Permitir seleccionar:

`Cliente existente`

o crear cliente si el sistema actual lo permite.

---

# 17. Integración con facturación

Este punto es CRÍTICO.

Una reserva confirmada debe poder integrarse con el sistema de facturación existente.

Flujo:

```text
Reserva
   ↓
Booking confirmado
   ↓
Generar documento de venta
   ↓
Sistema del Sol
   ↓
Factura
```

**NO implementar un sistema de facturación paralelo.**

Reutilizar, si ya existen:

- clientes
- impuestos
- moneda
- productos
- comprobantes
- numeración
- cuentas
- pagos

del Sistema del Sol.

---

# 18. Productos de viajes

Crear posibilidad de mapear productos:

```text
Configuración
→ Viajes
→ Productos
```

Ejemplos:

```text
Flight Ticket
Hotel
Baggage
Seat
Travel Insurance
Service Fee
Agency Fee
```

Ejemplo:

```text
Duffel Flight
      ↓
Producto Sistema del Sol:
"BOLETO AÉREO"
```

---

# 19. Markup

La plataforma debe permitir definir margen.

Ejemplo:

```text
Costo proveedor
USD 450

Markup
USD 30

Service fee
USD 10

Precio cliente
USD 490
```

Soportar:

- monto fijo
- porcentaje
- reglas por proveedor
- reglas por tipo de servicio
- reglas por cliente
- reglas por ruta
- reglas por cabina

Para el MVP comenzar con:

```text
Markup fijo
Markup %
```

y dejar reglas avanzadas para una fase posterior.

---

# 20. Monedas

Preparar el sistema para:

```text
USD
DOP
EUR
CAD
GBP
```

No convertir precios en frontend.

El backend debe manejar:

- moneda proveedor
- moneda costo
- moneda venta
- tasa de cambio
- precio final

Guardar la tasa utilizada en el momento de la operación.

---

# 21. Pagos

No crear un procesador de pagos propio.

Crear una abstracción:

```typescript
PaymentProvider
```

que permita posteriormente:

```text
Stripe
Azul
CardNET
PayPal
```

El módulo de viajes debe poder trabajar con el sistema de pagos existente de Sistema del Sol si ya existe.

---

# 22. Webhooks

Implementar endpoint conceptual:

```text
POST /api/travel/webhooks/duffel
```

Debe:

- validar firma
- registrar evento
- evitar duplicados
- procesar de forma idempotente
- actualizar booking
- registrar errores
- mantener auditoría

Crear tabla/log:

```text
travel_webhook_events
```

con:

```text
id
provider
event_type
event_id
payload
processed
processed_at
error
created_at
```

`event_id` debe utilizarse para idempotencia.

---

# 23. Auditoría

Registrar:

- búsqueda
- selección
- repricing
- reserva
- cancelación
- cambio
- pago
- refund
- webhook
- modificación administrativa
- cambio de configuración
- cambio de proveedor

Nunca almacenar información sensible innecesaria.

---

# 24. Cache

Las búsquedas de vuelos pueden generar un volumen muy alto.

Implementar una estrategia de cache apropiada.

Considerar:

```text
Redis
```

si ya existe en el proyecto.

No cachear indiscriminadamente precios que deban considerarse en tiempo real.

Separar:

```text
Airport / City data
       ↓
cache largo

Flight search
       ↓
cache corto

Flight price
       ↓
revalidación obligatoria
```

---

# 25. Control de costos

Crear métricas por proveedor:

```text
Provider API Calls

Duffel
Search: 10,245
Price: 1,420
Orders: 95
Errors: 32
```

También:

```text
API Cost
Bookings
Conversion rate
Search → booking ratio
```

Esto permitirá controlar el costo de las APIs.

---

# 26. Dashboard administrativo

Crear:

`Travel Management Dashboard`

Ejemplo:

```text
┌────────────────┐
│ 1,245 Searches │
└────────────────┘

┌────────────────┐
│ 87 Bookings    │
└────────────────┘

┌────────────────┐
│ USD 42,580     │
│ Sales          │
└────────────────┘

┌────────────────┐
│ USD 4,280      │
│ Margin         │
└────────────────┘
```

Agregar:

- ventas
- reservas
- margen
- proveedores
- API usage
- errores
- búsquedas
- conversiones

---

# 27. Gestión de reservas

Crear:

`/travel/bookings`

Columnas:

```text
Código
Cliente
Tipo
Proveedor
Estado
Fecha
Monto
Moneda
Acciones
```

Estados sugeridos:

```text
SEARCHED
PRICE_PENDING
PRICE_CONFIRMED
PENDING_PAYMENT
PAID
CONFIRMED
TICKETED
CANCELLED
REFUNDED
FAILED
EXPIRED
```

Adaptar estos estados al modelo existente si ya existe uno equivalente.

---

# 28. Permisos

Integrarse con el RBAC existente.

Crear permisos similares a:

```text
travel.view
travel.search
travel.book
travel.cancel
travel.refund
travel.manage
travel.providers
travel.settings
travel.reports
```

No crear otro sistema de usuarios.

---

# 29. Seguridad

Aplicar:

- RBAC existente
- permisos específicos
- validación de entrada
- rate limiting
- protección webhook
- secret management
- encryption
- audit logs
- idempotency
- timeout
- retry con backoff
- circuit breaker cuando corresponda

Nunca confiar en datos enviados por el frontend.

---

# 30. Manejo de errores

Crear errores normalizados:

```text
PROVIDER_UNAVAILABLE
OFFER_EXPIRED
PRICE_CHANGED
BOOKING_FAILED
PAYMENT_FAILED
INVALID_PASSENGER
INVALID_CREDENTIALS
RATE_LIMITED
```

La interfaz no debe mostrar errores técnicos del proveedor directamente al usuario.

---

# 31. API interna

Crear endpoints siguiendo el estándar existente.

Conceptualmente:

```text
GET  /api/travel/providers

POST /api/travel/flights/search

POST /api/travel/flights/price

POST /api/travel/flights/book

GET  /api/travel/bookings

GET  /api/travel/bookings/:id

POST /api/travel/bookings/:id/cancel

POST /api/travel/hotels/search

POST /api/travel/hotels/price

POST /api/travel/hotels/book

POST /api/travel/webhooks/:provider
```

Adaptar nombres al estándar actual del proyecto.

---

# 32. Base de datos

Diseñar entidades separadas del core.

Conceptualmente:

```text
travel_providers
travel_provider_credentials
travel_searches
travel_flight_offers
travel_hotel_offers
travel_bookings
travel_booking_items
travel_passengers
travel_payments
travel_markup_rules
travel_webhook_events
travel_api_logs
travel_audit_logs
```

Relacionar con entidades existentes:

```text
customers
users
invoices
payments
products
```

si existen.

No duplicarlas.

---

# 33. Observabilidad

Registrar métricas por proveedor:

```text
search_count
price_count
booking_count
error_count
latency
conversion_rate
```

Crear logging estructurado.

Nunca registrar:

- API keys
- tokens
- passwords
- datos completos de tarjetas
- documentos sensibles innecesarios

---

# 34. Testing

## Unit tests

Para:

```text
FlightSearchService
FlightPriceService
BookingService
MarkupService
ProviderFactory
```

## Integration tests

Para:

```text
DuffelTravelProvider
```

utilizando sandbox cuando sea posible.

## E2E

Flujo:

```text
Search
→ Select
→ Price
→ Passenger
→ Booking
→ Invoice
```

---

# 35. Fases de implementación

No intentar construir todo de una vez.

## FASE 1 — Arquitectura

Analizar Sistema del Sol.

Entregar:

- arquitectura encontrada
- puntos de integración
- archivos relevantes
- riesgos
- propuesta
- cambios necesarios

**NO modificar todavía.**

---

## FASE 2 — Plugin base

Implementar:

- plugin
- menú
- permisos
- configuración
- navegación
- base de datos
- auditoría

---

## FASE 3 — Duffel

Implementar:

```text
DuffelTravelProvider
```

con:

- authentication
- flight search
- flight pricing
- flight order
- booking retrieval
- cancellation
- webhooks

---

## FASE 4 — Flight UI

Crear:

```text
Flight Search
Flight Results
Flight Details
Passenger Information
Booking Confirmation
```

---

## FASE 5 — Hotels

Implementar:

```text
Hotel Search
Hotel Results
Hotel Details
Hotel Booking
```

---

## FASE 6 — Sistema del Sol

Integrar:

```text
Customer
Product
Invoice
Payment
Currency
Taxes
Accounting
```

reutilizando los servicios existentes.

---

## FASE 7 — Dashboard

Implementar:

- ventas
- reservas
- margen
- proveedores
- API usage
- errores

---

## FASE 8 — Segundo proveedor

Después de estabilizar Duffel:

```text
AmadeusTravelProvider
```

sin modificar:

```text
FlightSearchService
BookingService
HotelSearchService
```

La implementación debe demostrar que la arquitectura realmente es multi-provider.

---

# 36. Reglas estrictas para el agente

## NO hacer

- No reescribir Sistema del Sol.
- No reemplazar el sistema de facturación.
- No crear usuarios duplicados.
- No crear clientes duplicados.
- No crear pagos paralelos si ya existe uno.
- No crear una segunda autenticación.
- No almacenar API keys en frontend.
- No acoplar dominio a Duffel.
- No usar Duffel directamente desde React.
- No hacer llamadas de proveedor desde componentes UI.
- No realizar migraciones destructivas.
- No eliminar tablas existentes.
- No cambiar contratos existentes sin justificación.
- No instalar dependencias innecesarias.

## SÍ hacer

- Reutilizar servicios existentes.
- Reutilizar componentes existentes.
- Reutilizar autenticación.
- Reutilizar RBAC.
- Reutilizar clientes.
- Reutilizar facturación.
- Reutilizar pagos.
- Mantener separación de responsabilidades.
- Usar interfaces/adapters.
- Mantener idempotencia.
- Mantener auditoría.
- Mantener compatibilidad futura con múltiples proveedores.

---

# 37. Regla de trabajo del agente

Antes de escribir código:

1. Explora el repositorio.
2. Identifica la arquitectura.
3. Identifica el sistema de plugins existente.
4. Identifica el sistema de facturación.
5. Identifica el modelo Customer.
6. Identifica Product.
7. Identifica Invoice.
8. Identifica Payment.
9. Identifica RBAC.
10. Identifica routing.
11. Identifica API.
12. Identifica database migrations.
13. Identifica testing.

Después genera:

```text
ARCHITECTURE.md
TRAVEL_MODULE_PLAN.md
TRAVEL_DATABASE_DESIGN.md
TRAVEL_API_DESIGN.md
```

No implementar todavía hasta mostrar el plan y detectar conflictos con la arquitectura existente.

Una vez aprobado el plan, implementar por fases pequeñas.

Después de cada fase:

- ejecutar tests
- ejecutar lint
- ejecutar typecheck
- revisar migraciones
- revisar seguridad
- revisar regresiones

Y reportar:

```text
Completed
Changed files
Database changes
Tests
Potential risks
Next step
```

---

# 38. Arquitectura de referencia recomendada

La aplicación debe terminar conceptualmente así:

```text
                    SISTEMA DEL SOL
                          │
                 ┌────────▼────────┐
                 │ Travel Management│
                 │      Plugin      │
                 └────────┬────────┘
                          │
                 ┌────────▼────────┐
                 │ TravelProvider  │
                 │    Interface    │
                 └────────┬────────┘
                          │
             ┌────────────┼────────────┐
             │            │            │
             ▼            ▼            ▼
          Duffel       Amadeus     Travelport
             │            │            │
             └────────────┼────────────┘
                          │
                     PROVEEDORES
```

El patrón recomendado es:

- Adapter
- Strategy
- Factory
- Service Layer
- Repository cuando corresponda
- Dependency Injection cuando la arquitectura existente lo soporte

---

# 39. Separación Backoffice / Cliente final

Separar claramente dos experiencias.

## Backoffice

```text
Sistema del Sol
   ↓
Administración
   ↓
Proveedores
Credenciales
Markup
Reservas
Facturación
Reportes
```

## Cliente final

```text
Página web
   ↓
Buscar vuelos
Buscar hoteles
   ↓
Resultados
   ↓
Seleccionar
   ↓
Datos pasajeros
   ↓
Pago
   ↓
Reserva
   ↓
Factura
```

El frontend público nunca debe tener acceso directo a las credenciales ni a las APIs privadas de los proveedores.

---

# 40. Integración conceptual con Duffel

El primer proveedor es Duffel.

El código debe estar preparado para usar el API oficial y sus mecanismos actuales de:

```text
Authentication
Flight Search
Flight Offers
Flight Pricing
Flight Orders
Booking retrieval
Cancellation
Webhooks
Hotels / Stays cuando corresponda
```

No asumir endpoints, campos o capacidades sin verificar primero la documentación oficial vigente del proveedor.

El agente debe consultar la documentación oficial antes de implementar una integración que dependa de detalles concretos del API.

---

# 41. Consideraciones de costos

El sistema debe permitir medir:

```text
Búsquedas
Precios/repricing
Reservas
Errores
Conversiones
Costo estimado por proveedor
```

Esto es importante porque el modelo de costos de cada proveedor puede ser diferente.

El sistema debe evitar llamadas innecesarias.

Especialmente:

```text
Frontend
   ↓
Backend
   ↓
Cache cuando corresponda
   ↓
Provider API
```

Nunca:

```text
Browser
   ↓
Duffel directamente
```

---

# 42. Recomendación de estrategia de proveedores

Primera etapa:

```text
Duffel
```

Segunda etapa:

```text
Amadeus
```

Tercera etapa, si el volumen y modelo de negocio lo justifican:

```text
Travelport
```

La arquitectura debe permitir cambiar o combinar proveedores sin reescribir la lógica de negocio.

Ejemplo futuro:

```text
Search
   │
   ├── Duffel
   ├── Amadeus
   └── Travelport
          ↓
     Normalización
          ↓
     Deduplicación
          ↓
     Ordenamiento
          ↓
     Resultados
```

---

# 43. Resultado esperado

El resultado final debe ser un módulo profesional de gestión de viajes dentro de Sistema del Sol que permita:

- administrar proveedores
- administrar credenciales
- buscar vuelos
- buscar hoteles
- consultar precios
- realizar reservas
- consultar reservas
- cancelar cuando corresponda
- administrar pasajeros
- aplicar markup
- cobrar al cliente
- facturar desde Sistema del Sol
- controlar pagos
- administrar permisos
- recibir webhooks
- auditar operaciones
- controlar costos de API
- generar reportes
- incorporar nuevos proveedores

sin convertir Sistema del Sol en una aplicación monolítica acoplada a un proveedor específico.

---

# 44. Instrucción final para el agente

**NO empieces programando inmediatamente.**

Primero analiza el repositorio real de Sistema del Sol.

Determina:

1. Cómo funciona actualmente el sistema de plugins.
2. Cómo se registran los módulos.
3. Cómo se registran rutas.
4. Cómo se registran permisos.
5. Cómo se realizan migraciones.
6. Cómo se accede a la base de datos.
7. Cómo funciona el frontend.
8. Cómo funciona el backend.
9. Cómo funciona autenticación.
10. Cómo funciona RBAC.
11. Cómo funcionan clientes.
12. Cómo funcionan productos.
13. Cómo funcionan facturas.
14. Cómo funcionan pagos.
15. Cómo funcionan impuestos.
16. Cómo funcionan monedas.
17. Qué componentes UI existentes pueden reutilizarse.
18. Qué servicios existentes pueden reutilizarse.
19. Qué puntos de extensión existen.

Después crea un informe de análisis y una propuesta de arquitectura específica para este repositorio.

**No hagas cambios de código hasta completar este análisis.**

Una vez aprobada la arquitectura, implementa el proyecto por fases, verificando tests, lint, typecheck, migraciones, seguridad y regresiones después de cada fase.

El objetivo no es solamente "conectar Duffel".

El objetivo es construir:

**Travel Management como un módulo nativo, extensible y multi-proveedor de Sistema del Sol.**
