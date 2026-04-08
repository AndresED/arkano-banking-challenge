# Acceso a datos: preferir la base frente a operaciones en memoria

Problema recurrente en aplicaciones con ORM: **resolver en Node** (arrays grandes, bucles, filtros) lo que **PostgreSQL puede hacer mejor** con menos datos transferidos y un solo plan de ejecución. Esta guía fija el criterio para refactors y código nuevo.

## Principio

> **Filtrar, ordenar, agrupar, paginar y unir** en la **base de datos**; en el proceso Node solo **mapear** resultados ya acotados a DTOs o reglas que realmente no son expresables en SQL.

El adaptador de persistencia (repositorio TypeORM) es el lugar natural para **QueryBuilder**, `find` con `where` rico, `relations`/`leftJoinAndSelect` medidos, o `query()` parametrizada cuando el ORM se vuelve incómodo.

---

## Anti-patrones frecuentes

| Patrón | Por qué duele | Dirección |
|--------|----------------|-----------|
| `find()` o equivalente **sin límite** y luego `.filter()` / `.sort()` en JS | Trae filas innecesarias; memoria y red | `WHERE`, `ORDER BY` en la query |
| **N+1 queries**: por cada fila, otra llamada al repo (`Promise.all` sobre ids) | Latencia multiplicada; carga en DB | `JOIN`, `In(ids)` con una query, eager loading acotado, subconsulta |
| Paginación calculada **después** de cargar todo el conjunto | Peor caso O(n) en memoria | `skip`/`take` o `LIMIT`/`OFFSET` (o keyset) en SQL — ver [listings-pagination.md](./listings-pagination.md) |
| Agregaciones (`sum`, `count`, `max`) en JS sobre listas | Descarga datos brutos que la BD podría resumir | `SUM()`, `COUNT()`, `GROUP BY`, `getRawMany()` / `getRawOne()` |
| Duplicados o “último por grupo” resueltos en memoria | Misma lectura masiva | `DISTINCT ON`, ventanas (`ROW_NUMBER`), subquery en QueryBuilder |
| Búsquedas de texto sobre **todos** los registros cargados | No escala | `ILIKE` con índice adecuado, `tsvector` / full-text si aplica, o servicio de búsquica dedicado |

---

## Qué usar en TypeORM (orientación)

1. **`find` / `findAndCount`** cuando el `where` y las `relations` son razonables y el árbol de entidades no explota.
2. **`createQueryBuilder`** cuando necesitas:
   - joins explícitos y alias
   - condiciones dinámicas complejas
   - `select` parcial de columnas
   - agregaciones y `groupBy`
   - orden que mezcla columnas de varias tablas
3. **`query(sql, params)`** en el `DataSource` o repositorio para SQL muy específico (siempre **parametrizado**, nunca concatenar valores del usuario).
4. **Índices** en PostgreSQL alineados con `WHERE`, `JOIN` y `ORDER BY` habituales; sin índices, “mover la query a BD” sigue siendo lento.

---

## Handlers y capa de aplicación

Los **query/command handlers** no deberían ser el lugar donde se **reimplementa SQL en JavaScript** sobre colecciones grandes. Si el handler hace:

- cargar muchas entidades y luego enriquecer una a una con más queries,

vale la pena evaluar **una o dos queries** con joins o una carga por lotes (`In([...])`) desde el repositorio.

La lógica que **debe** quedar en memoria suele ser:

- reglas que dependen de estado no persistido
- validaciones ya sobre un conjunto **acotado** (p. ej. una página de 20 filas)
- formato de salida / DTOs

---

## Multitenant

Todas las queries deben seguir yendo contra el `DataSource` del tenant correcto (`TenantConnectionManager` + `TenantContext`). Optimizar **no** significa saltarse el aislamiento: significa que **dentro** de esa base la selección sea selectiva.

---

## Checklist antes de dar por buena una implementación

- [ ] ¿Se limita el trabajo con `WHERE` / paginación en BD antes de traer filas?
- [ ] ¿Hay bucles que disparan queries? ¿Se pueden sustituir por join o batch?
- [ ] ¿Las agregaciones de dashboard podrían ser una sola query o materialized view?
- [ ] ¿Los `relations` cargan más de lo necesario? ¿Hace falta `select` parcial o query dedicada de “listado”?

---

## Relación con otros documentos

- [listings-pagination.md](./listings-pagination.md) — paginar en repositorio, no en controlador ni sobre listas completas.
- [hexagonal-cqrs.md](./hexagonal-cqrs.md) — la optimización vive en los **adaptadores de persistencia** (y en el diseño de queries), no en el controlador.

---

## Plantillas / nuevos repos

Al generar un repositorio base a partir de [base-repo-prompt.md](./base-repo-prompt.md), exigir que los listados y filtros usen **ORM/QueryBuilder en BD** por defecto y documentar este criterio en el README del template.
