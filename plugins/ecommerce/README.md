# Plugin: Tienda Online (e-commerce v1)

Este directorio solo contiene el manifiesto (`plugin.json`), para que
`PluginLoaderService` lo descubra y aparezca en el catálogo de
plugins instalados — **no hay código acá**.

A diferencia de `plugins/inmobiliaria/` (un stub nunca importado en
`AppModule`, con imports relativos hacia `backend/src` que nunca se
probó que compilaran, porque `backend/tsconfig.json` no incluye
`plugins/` en su `include` por defecto), la implementación real de
este plugin vive como un módulo normal del backend:
`backend/src/ecommerce/` (`EcommerceModule`, registrado en
`AppModule` como cualquier otro feature).

La activación por tenant es la misma para ambos casos: clave
`ecommerce` en `Modulo`/`MODULOS_BASE`, gateada por Plan o
`TenantModuloOverride` — ver `docs/ARCHITECTURE.md`, sección
"Plugin system".
