# Convenciones de capa de aplicación (objetivo de refactor)

Este documento fija las reglas que el proyecto **está adoptando progresivamente** mediante refactors. Sirve como contrato para nuevos cambios y para alinear código legacy.

## 1. Controladores: solo entrada/salida HTTP

El controlador **no debe contener lógica de negocio** ni orquestación relevante.

### Permitido

- Decoradores Nest/Swagger (`@Get`, `@Post`, `@ApiOperation`, etc.).
- Recibir `Body`, `Param`, `Query` tipados con DTOs (validación vía `ValidationPipe` global o por ruta, cuando esté activa).
- Instanciar el **Command** o **Query** correspondiente y llamar a `commandBus.execute(...)` / `queryBus.execute(...)`.
- Devolver el resultado del bus tal cual, o con un mapeo **trivial** a forma HTTP (p. ej. envolver en un objeto solo si el contrato API lo exige explícitamente).

### No permitido

- Cálculos de negocio, reglas de autorización más allá de guards, ramas condicionales complejas.
- Llamadas directas a repositorios, `DataSource`, servicios de dominio o integraciones (facturación, PDF, storage) desde el controlador.
- Duplicar lógica que ya deba vivir en un handler.

**Resumen:** el controlador **recibe datos HTTP** y **devuelve datos**; el **handler** es quien interpreta, valida en profundidad y aplica reglas.

---

## 2. Un archivo por Command y un archivo por Query

Cada caso de uso de escritura o lectura tiene su **propio fichero**. Ejemplos:

| Caso de uso | Ficheros (convención kebab-case) |
|-------------|----------------------------------|
| Crear usuario | `create-user.command.ts` + `create-user.handler.ts` |
| Listar usuarios | `list-users.query.ts` + `list-users.handler.ts` |

### Command

- Un solo **export** principal por archivo: la clase `XxxCommand` (o el nombre acordado).
- El archivo se nombra según la acción: `create-user.command.ts`, `annul-invoice.command.ts`.

### Command handler

- Un handler por command, en archivo dedicado: `create-user.handler.ts` con `CreateUserHandler` y `@CommandHandler(CreateUserCommand)`.
- Evitar acumular muchos `@CommandHandler` en un único `*.handlers.ts` (patrón histórico del repo a **dismember** al tocar el módulo).

### Query

- Igual criterio: `get-user-by-id.query.ts`, `list-users.query.ts`.

### Query handler

- `get-user-by-id.handler.ts`, `list-users.handler.ts`, etc.

### Registro en el módulo

- El `*.module.ts` del feature importa y lista **cada** handler en `providers` (o un barrel `index.ts` que re-exporte solo para no olvidar registros — si se usa barrel, debe ser explícito y revisable en PR).

---

## 3. Utilidades para lógica reutilizable específica

Si varios handlers del mismo dominio comparten **funciones puras o casi puras** (mapeos, formateo, validaciones auxiliares, construcción de value objects), esas piezas van en **utilidades**, no copiadas en el controlador ni duplicadas entre handlers sin criterio.

### Dónde colocarlas

| Alcance | Ubicación sugerida |
|---------|-------------------|
| Solo un feature | `src/modules/[feature]/application/utils/` (o `application/helpers/`) |
| Transversal, sin acoplar a un módulo | `src/shared/utils/` o `src/shared/application/` según naturaleza |

### Criterios

- **Sin** dependencias de Nest en funciones puras cuando sea posible (facilita tests unitarios).
- Si la utilidad necesita inyectar servicios, valorar un **servicio de aplicación** registrado en el módulo en lugar de un fichero de funciones sueltas.

Los **handlers** orquestan; las **utilidades** ejecutan fragmentos reutilizables y testeables.

---

## 4. Relación con la estructura de carpetas

Ejemplo objetivo para un módulo `tenant-users`:

```
tenant-users/
├── application/
│   ├── commands/
│   │   ├── create-user.command.ts
│   │   ├── create-user.handler.ts
│   │   ├── update-user.command.ts
│   │   └── update-user.handler.ts
│   ├── queries/
│   │   ├── list-users.query.ts
│   │   ├── list-users.handler.ts
│   │   ├── get-user-by-id.query.ts
│   │   └── get-user-by-id.handler.ts
│   ├── utils/
│   │   └── user-payload.mapper.ts
│   └── dtos/
├── domain/
└── infrastructure/
    └── adapters/in/rest/
        └── tenant-users.controller.ts   # delgado
```

---

## 5. Estado actual del repositorio

Hoy coexisten módulos con **controladores muy extensos** y ficheros agregados (`client.commands.ts` + `client.handlers.ts` con muchos casos). Eso es **deuda técnica** reconocida; al refactorizar un flujo, se aplica esta guía **en el perímetro tocado** para no mezclar indefinidamente dos estilos en el mismo archivo nuevo.

---

## Documentos relacionados

- [hexagonal-cqrs.md](./hexagonal-cqrs.md) — rol de buses, puertos y adaptadores.
- [architecture.md](./architecture.md) — visión general del sistema.
