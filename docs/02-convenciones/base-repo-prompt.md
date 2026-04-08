# Especificación: repositorio plantilla NestJS multi-tenant

## Cómo debe usarse este archivo

**Si eres un asistente de IA o un desarrollador:** este documento es la **única fuente de verdad** que te proporcionan. Debes:

1. **Leer el archivo completo** antes de proponer código o estructura.
2. **Cumplir todos los requisitos numerados** de la sección «Requisitos obligatorios». No omitas puntos salvo que el usuario indique explícitamente una excepción en el mismo hilo.
3. **Crear e instalar el proyecto desde cero:** scaffolding NestJS (`nest new` o equivalente), todas las dependencias necesarias (`npm install` / `npm i` de `@nestjs/*`, TypeORM, `pg`, cliente Redis, Passport/JWT, CQRS, class-validator, Swagger, etc.), scripts en `package.json`, configuración TypeScript/ESLint si aplica. **No se asume** un repositorio Nest previo salvo que el usuario indique lo contrario; puedes partir de una carpeta vacía o generar el árbol completo.
4. **Generar el código** del repositorio plantilla para que refleje estas reglas (no solo resumirlas).
5. Si algo es ambiguo, **elige la opción más segura y alineada con producción** (migraciones explícitas, sin `synchronize` en tenant, validación de tenant, etc.).
6. **Documentación actualizada:** si el entorno ofrece el MCP **Context7** (herramientas del estilo *resolve library id* + *query docs*), **úsalo** para alinear el código con la documentación reciente de **NestJS**, **TypeORM**, **Passport JWT**, **@nestjs/cqrs**, etc. Flujo típico: resolver el ID de biblioteca en Context7 y luego consultar con una pregunta concreta (p. ej. «Dynamic TypeORM DataSource in NestJS 10»). **Respeta los límites** del servidor (p. ej. no abusar de llamadas; si tras unas pocas consultas no hay respuesta útil, continúa con la documentación oficial y criterio estable). Si **no** hay Context7 disponible, usa documentación oficial en la web y versiones LTS compatibles.

**Si eres quien encarga el trabajo:** solo necesitas adjuntar **este archivo** (`base-repo-prompt.md`) al chat o al agente. **No** hace falta entregar un proyecto ya creado ni el resto de la carpeta `base/`; la especificación ya está autocontenida. Indica la ruta de trabajo (carpeta vacía o donde debe generarse el repo) si aplica.

---

## Meta del proyecto

Generar un **repositorio plantilla NestJS** mínimo pero **production-minded**: SaaS **database-per-tenant** (una base PostgreSQL por cliente), con **Redis**, **TypeORM**, **hexagonal + CQRS**, **auth JWT con sesión en Redis**, **envelope HTTP unificado**, **listados paginados opcionales**, y convenciones de **migraciones**, **FKs anidadas en respuestas**, **CASCADE** donde corresponda, y **consultas preferentemente en BD**.

Stack: **NestJS** (LTS razonable), **TypeORM**, **PostgreSQL**, **Redis**.

**Versiones y APIs:** priorizar documentación **vigente** (Context7 si está conectado; si no, sitios oficiales) para evitar APIs obsoletas en ejemplos de código.

---

## Requisitos obligatorios

### Multitenant y datos

1. **Base maestra (una):** entidad/tabla `Tenant` con al menos `id` (UUID), `subdomain` (único), `databaseName`, `dbHost` opcional, `subscriptionStatus`, `trialEndsAt` opcional, timestamps. Conexión TypeORM dedicada (`default` o nombre explícito) con entidades maestras listadas explícitamente si se desactiva `autoLoadEntities` para esa conexión.

2. **Base por tenant:** por cada `tenantId`, instanciar/reutilizar un `DataSource` TypeORM con `database` = `databaseName` del tenant (y host desde `dbHost` o fallback env). **`synchronize: false`** en conexiones tenant. **`migrationsRun`:** según política del template (típicamente `false` en runtime y migraciones ejecutadas por CLI/orquestador).

3. **Migraciones:** cualquier cambio de esquema **solo** mediante archivos de migración versionados. Carpetas separadas si aplica, p. ej. `src/migrations/master/` y `src/migrations/tenants/`. Formato de nombre: `YYYYMMDDHHMMSS-Descripcion.ts`. No usar `synchronize: true` como estrategia de despliegue en tenant ni en maestra en producción.

4. **`TenantContext`:** implementar con **`AsyncLocalStorage`** (`enterWith` / `getStore`) para almacenar el `tenantId` del request actual.

5. **`TenantResolver`:** resolver `tenantId` en este orden: (1) **subdominio** desde header `Host` (si hay ≥3 segmentos y el primero no es `api` ni `api-*`), con cache Redis `tenant:subdomain:{sub}` y fallback consulta maestra por subdominio; (2) header **`X-Tenant-ID`** validado que exista en maestra; (3) opcional: `req.user.tenantId` **sabiendo** que el middleware suele ejecutarse **antes** que Passport, así que en la práctica el cliente enviará subdominio o `X-Tenant-ID`.

6. **`TenantMiddleware`:** invocar el resolver; si no hay tenant → **400**; si hay → `TenantContext.setTenantId(id)` y `next()`.

7. **`TenantConnectionManager`:** mapa `tenantId → DataSource`; cache Redis `tenant:config:{tenantId}` con `databaseName`, `dbHost`, etc.; cierre de conexiones idle según `TENANT_CONNECTION_TIMEOUT_MS`; job periódico `TENANT_CLEANUP_INTERVAL_MS`.

8. **`AppModule`:** `configure(consumer)` con `TenantMiddleware` en `forRoutes('*')` y **`exclude`** explícito para al menos: `GET /health`, rutas maestras (`/tenants`, `/plans`, `/master-users`, `/maintenance`, etc. según template), y estáticos si existen.

### Autenticación y guards

9. **Auth:** `POST` login validando usuario en **DB del tenant** (requiere tenant resuelto antes). JWT con `sub`, `tenantId`, `jti`, `role` (u campos mínimos acordados). **Whitelist Redis:** `auth:session:{sub}:{jti}` con TTL alineado al refresh. Estrategia JWT que compruebe Redis y llame `TenantContext.setTenantId(payload.tenantId)`. Refresh y logout revocan/invalidan sesión.

10. **Guard de suscripción (recomendado):** `APP_GUARD` que bloquee tenant `CANCELLED`, `PAST_DUE`, trial vencido; **excluir** explícitamente `POST /auth/login` y `POST /auth/refresh`.

11. **JWT en rutas de negocio:** aplicar **`JwtAuthGuard`** de forma **coherente** (global con `@Public()` en rutas abiertas, o por módulo). El template no debe quedar con Swagger «Bearer» pero sin guard en los endpoints del ejemplo CRUD.

### Arquitectura de código (hexagonal + CQRS)

12. **Módulo de ejemplo** (`items`, `notes`, etc.) con:
    - `domain/`: entidad de dominio + puerto `IItemRepository` (interfaz).
    - `application/commands`: **un archivo por command** y **un archivo por handler** (p. ej. `create-item.command.ts`, `create-item.handler.ts`).
    - `application/queries`: **un archivo por query** y **uno por handler** (p. ej. `list-items.query.ts`, `list-items.handler.ts`).
    - `application/utils/`: funciones puras compartidas del caso de uso si aplica.
    - `infrastructure/adapters/in/rest`: controlador **delgado** (solo DTO, `CommandBus`/`QueryBus.execute`, retorno) — **sin lógica de negocio**.
    - `infrastructure/adapters/out/persistence`: implementación TypeORM del puerto usando `TenantConnectionManager` + `TenantContext`.
    - Registro: `CqrsModule`, `provide`/`useClass` con **token string** para el repositorio.

### Respuesta HTTP global

13. **Interfaz `ApiResponse<T>`** con al menos: `success`, `statusCode`, `data`, `timestamp`, y para errores `message`, `error` opcionales según el diseño unificado.

14. **`TransformInterceptor` (global):** envolver respuestas exitosas en `{ success: true, statusCode, data, timestamp }`. Si `data` es objeto con **`items`** array (lista), normalizar `{ items, pagination }` dentro de `data` (mantener `pagination` o `null`).

15. **`AllExceptionsFilter` (global, `@Catch()`):** cuerpo `{ success: false, statusCode, data: null, message, error, timestamp }`. Manejar `HttpException` (incl. validación con `message` array). Manejar **`QueryFailedError`** de TypeORM: mapear códigos PostgreSQL típicos (`23505` → 409 Conflict, `23503`/`23502` → 400, etc.); en **`NODE_ENV=production`** mensajes genéricos para 5xx hacia el cliente; loguear siempre detalle real en servidor.

16. **`LoggingInterceptor` (global, opcional pero recomendado):** log de duración; en error, re-lanzar para que el filtro formatee.

17. **`main.ts`:** registrar `useGlobalInterceptors` / `useGlobalFilters` en orden coherente; **Helmet**, **CORS**; **Swagger** con esquema **Bearer JWT** y **API Key** `X-Tenant-ID`.

### Listados y paginación

18. **GET listados:** respuesta interna (antes del envelope) `{ items: T[], pagination: object | null }`. Si query `pagination !== 'true'` → devolver **todos** los ítems relevantes (con límite razonable documentado si aplica) y **`pagination: null`**. Si `pagination=true` → `page` (default 1), `itemsPerPage` (default 10 u otro documentado), y objeto `pagination` con `totalItems`, `totalPages`, `currentPage`, `itemsPerPage`, `hasNextPage`, `hasPrevPage`. **Paginación en BD** (`skip`/`take`, `findAndCount`), no en memoria sobre el conjunto completo.

### Rendimiento y acceso a datos

19. **Filtrar, ordenar, paginar y agregar en PostgreSQL** (TypeORM `where`, `QueryBuilder`, joins). Evitar `find` masivo + `.filter` en Node; evitar N+1 (preferir joins, `In([...])`, batch). Agregaciones en SQL cuando sea posible.

### Migraciones, FK en API y CASCADE

20. **Listados y detalles:** para FKs relevantes a la UI, devolver **nodo anidado** además del id (p. ej. `userId` + `user: { id, email, ... }`), cargado con `relations` o QueryBuilder. Excepciones documentadas solo si el id es interno y no se muestra.

21. **Relaciones hijo-padre (composición):** alinear **`onDelete: 'CASCADE'`** en TypeORM con **`ON DELETE CASCADE`** en la migración SQL. Para referencias a catálogos o entidades independientes, usar **RESTRICT** / **NO ACTION** / **SET NULL** según dominio — no cascadear todo ciegamente.

### Configuración y documentación del repo

22. **`.env.example`:** `DB_*`, Redis, `JWT_SECRET`, timeouts de tenant, `NODE_ENV`, puerto.

23. **`README`:** crear tenant en maestra, crear DB física del tenant, ejecutar migraciones maestra y tenant, arrancar app, probar login y CRUD ejemplo.

### Entregables mínimos

24. Código del esqueleto **ejecutable** (no pseudocódigo), incluyendo **proyecto generado e instalado** (`package.json` con dependencias resueltas, `npm run build` coherente con el template). CRUD ejemplo + auth. Tests básicos opcionales (resolver, middleware con mocks).

### Fuera de alcance (salvo que el usuario pida lo contrario)

25. Dominios de negocio pesados (facturación, logística, etc.). Integraciones de terceros distintas de PostgreSQL y Redis.

---

## Orden sugerido de implementación

1. Proyecto Nest + Config + TypeORM maestro + entidad `Tenant` + migración maestra inicial.  
2. Redis + `TenantContext` + `TenantResolver` + `TenantMiddleware` + exclusiones en `AppModule`.  
3. `TenantConnectionManager` + migración tenant inicial + entidad ejemplo en tenant DB.  
4. `ApiResponse` + `TransformInterceptor` + `AllExceptionsFilter` (+ `LoggingInterceptor`).  
5. Auth (login, JWT, Redis session, refresh, logout) + guard suscripción + `JwtAuthGuard` coherente.  
6. Módulo ejemplo CQRS con listado paginado y detalle con FK anidada + migraciones asociadas.

---

## Nota final para el implementador

Los nombres de rutas excluidas del middleware, campos extra de `Tenant` y el nombre del módulo de ejemplo pueden ajustarse si el usuario lo indica en el mismo hilo; el **espíritu** de cada requisito se mantiene.
