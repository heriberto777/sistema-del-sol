# Guía: cómo integrar un plugin nuevo

Checklist y explicación paso a paso para agregar un módulo activable
por tenant (un "plugin") al sistema. Para el mapa general del código y
qué hace cada módulo ya existente, ver `SISTEMA.md`. Para el porqué de
cada pieza del mecanismo de activación, ver `ARCHITECTURE.md` →
"Plugin system" / "Planes y módulos activables por tenant".

## Primero, lo más importante: qué es (y qué NO es) un "plugin" acá

No hay carga dinámica de código ni microservicios. Un plugin es:

1. **Código real**: un módulo NestJS normal, en `backend/src/<nombre>/`,
   con el mismo patrón `Controller → Service → Repository` que cualquier
   otro módulo del sistema. Se compila junto con todo el backend, en un
   solo proceso.
2. **Un manifiesto informativo**: `plugins/<nombre>/plugin.json` +
   `README.md` en la raíz del monorepo. `PluginLoaderService`
   (`backend/src/plugins/plugin-loader.service.ts`) los lee al boot
   **solo para loguear qué hay disponible** — no activa nada, no
   importa código desde ahí. Si te olvidás de crear este manifiesto, el
   plugin funciona igual; es documentación, no un paso técnico
   obligatorio, pero es la convención ya establecida y se espera que
   todo plugin nuevo la siga.
3. **Una clave de activación por tenant**: una entrada en
   `MODULOS_BASE` (`backend/src/tenants/modulos-base.ts`) +
   `@RequiereModulo('clave')` en cada controller del módulo. Esto es lo
   que de verdad prende/apaga el plugin por tenant — ver paso 3 abajo.

Si confundís estas tres cosas, el error más común es pensar que crear
`plugins/<nombre>/plugin.json` "activa" algo — no activa nada, solo
documenta.

## Paso a paso

### 1. Diseñar el modelo de datos (si hace falta)

Si el plugin necesita tablas nuevas, agregalas a
`backend/prisma/schema.prisma` con `tenantId` en cada tabla de negocio
(salvo que sea una tabla "hija" sin filtro propio — ver
`ARCHITECTURE.md` → "Multi-tenancy" para el patrón de tablas hijas y el
riesgo de IDOR si no se valida el padre primero). Generá la migración:

```bash
pnpm --filter ./backend prisma:migrate
```

**Avisar siempre y explícitamente** cuando un cambio toca
`schema.prisma` o genera una migración — no es opcional, es una
convención fuerte de este proyecto.

### 2. Crear el módulo NestJS

Estructura mínima en `backend/src/<nombre>/`:

```
<nombre>/
├── <nombre>.module.ts
├── <nombre>.controller.ts
├── <nombre>.service.ts        # lógica de negocio
├── <nombre>.repository.ts     # el ÚNICO que importa TenantPrismaService
└── dto/
    └── crear-<algo>.dto.ts
```

- Si el plugin reacciona a eventos de otro módulo (ej. "cuando se crea
  una factura, hacer X"), suscribite con `@OnEvent(...)` en vez de
  importar el servicio ajeno — mismo criterio que usan Comisiones,
  Lealtad y Contabilidad.
- Si el plugin necesita reusar lógica de un módulo existente (ej.
  Inmobiliaria reusa `ProyectosService` para la preventa, en vez de
  construir su propio sistema de hitos), importá el módulo de ese
  servicio en tu `@Module({ imports: [...] })` e inyectalo normal —
  confirmá primero que no se arme un ciclo de imports.

### 3. Gatear los controllers con `@RequiereModulo`

```ts
import { RequiereModulo } from '../common/decorators/requiere-modulo.decorator';

@RequiereModulo('mi-plugin')
@Controller('mi-plugin')
export class MiPluginController { ... }
```

`ModuloActivoGuard` (global, ya registrado en `app.module.ts`) lee este
decorator y responde 403 si el tenant actual no tiene `'mi-plugin'`
activo. **Poné este decorator en TODOS los controllers del plugin, sin
excepción** — un controller sin él queda accesible aunque el tenant no
tenga el módulo activo. Esto no es hipotético: a `ecommerce` le faltaba
en sus 2 controllers de panel admin (solo tenían `admin.configuracion`)
y un tenant sin el módulo podía gestionar pedidos/secciones igual por
API directa — corregido, ver `SISTEMA.md` → nota sobre `ecommerce`.

Excepción deliberada: una pantalla de **configuración** (credenciales,
parámetros) normalmente NO lleva `@RequiereModulo` — configurar es un
paso de Administración, no debería depender de tener el módulo ya
activo (ver `whatsapp-config`/`travel-config` como referencia).

### 4. Registrar la clave en `MODULOS_BASE`

`backend/src/tenants/modulos-base.ts`:

```ts
export const MODULOS_BASE: { clave: string; nombre: string }[] = [
  // ...
  { clave: 'mi-plugin', nombre: 'Mi Plugin (plugin)' },
];
```

Esto crea la fila `Modulo` que la plataforma puede asignar vía `Plan` o
`TenantModuloOverride`. Si el plugin es un "plus" que no debería venir
bundleado en ningún plan existente (como `travel` y `crm`), **no lo
agregues a ningún `PLANES_BASE`** — la plataforma lo activa por
`TenantModuloOverride` puntual, tenant por tenant.

**Deploy**: correr `pnpm --filter ./backend planes:seed` en producción
para que la fila `Modulo` exista — avisarlo explícitamente, es un
backfill que no corre solo.

### 5. Importar el módulo en `AppModule`

`backend/src/app.module.ts` — agregá el import y sumalo al array
`imports` (orden alfabético no es estricto, pero seguí la convención
del archivo):

```ts
import { MiPluginModule } from './mi-plugin/mi-plugin.module';

@Module({
  imports: [
    // ...
    MiPluginModule,
  ],
})
```

Sin este paso, Nest nunca registra las rutas del plugin — es el único
lugar real donde "se instala" el código.

### 6. Permisos

Si el plugin necesita permisos propios (`mi-plugin.ver`,
`mi-plugin.crear`, etc.), agregalos a `PERMISOS_BASE`
(`backend/src/tenants/roles-base.ts`). Esto los suma automáticamente a
**Admin Total** (hereda el array completo) y a **Gerente** (hereda todo
menos `admin.*`) — para que un rol más acotado (Vendedor, Cajero, etc.)
los tenga, hay que agregarlos a mano a la lista específica de ese rol
en el mismo archivo, **a propósito opt-in**, nunca automático.

**Esto NO llega a tenants ya existentes** — un tenant provisionado
antes de este cambio no tiene la fila `Permission` nueva ni se la
asignó a ningún rol suyo. Hace falta correr en producción:

```bash
pnpm --filter ./backend permisos:backfill
```

Avisarlo siempre, igual que con `planes:seed`.

### 7. Frontend

a) **Páginas**: creá en `frontend/src/pages/` una página por pantalla
   del plugin, siguiendo Atomic Design para los componentes que arme
   cada una (ver `SISTEMA.md` → "Mapa del frontend").

b) **Rutas**: agregalas en `frontend/src/router.tsx`, dentro del árbol
   `RUTAS_ADMIN` (bajo `RutaProtegida` + `AppLayout`, salvo que el
   plugin necesite una pantalla pública tipo storefront — en ese caso
   mirá cómo lo resuelve `ecommerce`/`inmobiliaria`, que agregan además
   una rama pública bajo `/tienda/:subdominio` o
   `/inmobiliaria/:subdominio`).

c) **Menú del Sidebar**: agregá un `DominioMenu` nuevo (o ítems dentro
   de uno existente) en `frontend/src/config/menu-erp.ts`:

```ts
{
  id: 'mi-plugin',
  etiqueta: 'Mi Plugin',
  icono: AlgunIconoDeLucide,
  categorias: [
    { categoria: 'catalogos', items: [] },
    {
      categoria: 'transacciones',
      items: [
        { id: 'mi-plugin-nuevo', etiqueta: 'Crear X', ruta: '/mi-plugin', permisos: ['mi-plugin.crear'], modulo: 'mi-plugin' },
      ],
    },
    { categoria: 'consultas', items: [{ id: 'mi-plugin-buscar', etiqueta: 'Buscar X', ruta: '/mi-plugin', permisos: ['mi-plugin.ver'], modulo: 'mi-plugin' }] },
    { categoria: 'reportes', items: [] },
    { categoria: 'configuracion', items: [] },
  ],
},
```

El campo `modulo: 'mi-plugin'` es lo que hace que el ítem desaparezca
del Sidebar si el tenant no tiene el módulo activo (función `esVisible`
en el mismo archivo) — sin esto, el ítem se vería aunque el backend
rechace la petición con 403. **Esto es 100% UX, no reemplaza**
`@RequiereModulo` del backend.

### 8. Documentar el plugin

`plugins/<nombre>/plugin.json`:

```json
{
  "key": "mi-plugin",
  "nombre": "Mi Plugin",
  "version": "1.0.0",
  "descripcion": "Una frase de qué hace — implementación real en backend/src/mi-plugin/, ver README.md."
}
```

`plugins/<nombre>/README.md`: documentación de negocio del plugin —
qué resuelve, qué fases/modelos tiene, qué permisos opt-in existen, y
una sección "Tests" con los archivos de spec/e2e. Usá
`plugins/inmobiliaria/README.md` como plantilla — es el plugin más
completo y el que mejor sigue el criterio esperado (fases bien
delimitadas, pendientes conocidos explícitos en vez de callados).

### 9. Tests

- **Unitarios** (`*.service.spec.ts`, mockeando el repositorio): la
  lógica de negocio real del plugin — igual criterio que cualquier otro
  módulo (ver `CLAUDE.md` → "Tests").
- **e2e de aislamiento entre tenants** (`backend/test/<nombre>.e2e-spec.ts`,
  Postgres real vía `docker-compose up -d postgres redis`): **obligatorio**
  para cualquier plugin con su propio "buscarPorId" — confirmar que el
  tenant B nunca puede leer/tocar un registro del tenant A, y que sin el
  módulo activo el endpoint responde 403. Ver
  `backend/test/inmobiliaria.e2e-spec.ts` (30 casos) como referencia de
  cobertura esperada: aislamiento en cada entidad propia, y los IDOR de
  cada FK cruzada (`agenteId`/`clienteId`/etc.).
- Antes de dar el trabajo por terminado, correr
  `pnpm --filter ./backend test:e2e` — no alcanza con los unitarios
  (`pnpm test`) para pescar un bug de aislamiento entre tenants.

### 10. Checklist final antes de mergear

- [ ] Migración de Prisma generada y avisada explícitamente (si aplica).
- [ ] Todos los controllers del plugin llevan `@RequiereModulo('clave')`
      (salvo pantallas de configuración, a propósito).
- [ ] Clave agregada a `MODULOS_BASE` — y a `PLANES_BASE` solo si
      corresponde que venga bundleada en algún plan.
- [ ] Módulo importado en `app.module.ts`.
- [ ] Permisos nuevos agregados a `PERMISOS_BASE` (y a los roles
      específicos que deban tenerlos además de Admin Total/Gerente).
- [ ] Rutas + ítems de menú en el frontend, con `modulo`/`permisos`
      correctos.
- [ ] `plugins/<nombre>/plugin.json` + `README.md` creados.
- [ ] Tests unitarios + e2e de aislamiento entre tenants, `pnpm test` y
      `pnpm --filter ./backend test:e2e` ambos en verde.
- [ ] Comandos de backfill para producción (`planes:seed`,
      `permisos:backfill`) comunicados explícitamente — no corren solos
      en un deploy normal.

## Ejemplo real de referencia

`inmobiliaria` es el plugin más completo y mejor documentado del
sistema — buen punto de partida para copiar la forma, no el contenido:
`backend/src/inmobiliaria/`, `plugins/inmobiliaria/README.md`,
`backend/test/inmobiliaria.e2e-spec.ts`.
