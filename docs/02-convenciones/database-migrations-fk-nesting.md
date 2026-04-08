# Base de datos: migraciones, respuestas con nodos anidados y FK con cascade

Convenciones para cambios de esquema, forma de las respuestas API frente a claves foráneas y uso de **CASCADE** en relaciones.

## 1. Todo cambio de BD va por migraciones

**Regla:** cualquier modificación de esquema (tablas, columnas, índices, FKs, datos de catálogo versionables) se implementa con **archivos de migración** versionados, no depender de `synchronize: true` en entornos reales.

### En este repositorio

| Base | Carpeta de migraciones | Notas |
|------|------------------------|--------|
| **Maestra** | `src/migrations/master/` | Afecta la conexión `default` de `AppModule` |
| **Por tenant** | `src/migrations/tenants/` | Se aplican contra cada `DataSource` de tenant (`TenantConnectionManager` referencia `dist/src/migrations/tenants/*`) |

- **Formato de nombre:** `YYYYMMDDHHMMSS-Description.ts` (como en `AGENTS.md`).
- Las entidades TypeORM describen el modelo, pero la **fuente de verdad** del despliegue es la migración que altera PostgreSQL.
- Tras cambiar entidades, generar o escribir la migración equivalente y ejecutarla en el flujo acordado (local, CI, orquestador de tenants).

**Prohibido / a evitar:** “arreglar” columnas solo con `synchronize: true` en producción o en bases compartidas sin migración explícita.

---

## 2. Listados y detalles: la FK se expone como nodo anidado

**Regla:** en respuestas de **listado** y **detalle**, si el modelo tiene una relación lógica (p. ej. `user_id`, `country_id`), el cliente debe recibir el **objeto relacionado** además del id cuando ese dato es relevante para la UI.

### Ejemplo de intención

- En lugar de solo: `{ "userId": "uuid-..." }`
- Preferir: `{ "userId": "uuid-...", "user": { "id": "...", "email": "...", "name": "..." } }`  
  (o el subconjunto de campos acordado en el DTO de lectura).

### Implicaciones en código

1. **DTOs de respuesta** (`*ResponseDto`, `*Dto` de salida): incluir propiedad anidada (`user`, `country`, `defaultCurrency`, etc.) alineada con lo que expone Swagger.
2. **Repositorio / QueryBuilder:** cargar la relación con `relations`, `leftJoinAndSelect` o proyección explícita para no devolver solo el escalar.
3. **Handlers:** mapear entidad + relaciones cargadas al DTO; evitar devolver solo ids si la convención del producto es mostrar el nodo completo.

Esto encaja con patrones ya usados en el proyecto (p. ej. clientes con `country`, `defaultCurrency`). La regla **unifica** el criterio para nuevos endpoints.

### Excepciones razonables

- Identificadores **internos** que el frontend nunca muestra y que no aportan contexto pueden omitir el nodo si se documenta.
- Listados muy pesados: nodo **reducido** (solo campos necesarios), no obligatorio traer el documento completo de la entidad relacionada.

---

## 3. Claves foráneas y `CASCADE`

**Regla:** definir en entidad y en **migración** el comportamiento referencial acordado. Para relaciones **pertenencia / composición** (líneas de factura, detalles de compra, hijos que no tienen sentido sin el padre), usar **`ON DELETE CASCADE`** de forma coherente entre TypeORM y PostgreSQL.

### TypeORM (lado `@ManyToOne` / inverso)

Ejemplo de patrón ya presente en el código:

```typescript
@ManyToOne(() => ParentEntity, { onDelete: 'CASCADE' })
@JoinColumn({ name: 'parent_id' })
parent: ParentEntity;
```

La migración que crea o altera la FK debe declarar `ON DELETE CASCADE` (o el equivalente generado por la herramienta de migraciones) para que el esquema real coincida con el modelo.

### Cuándo no usar `CASCADE` en delete

- Referencias a **catálogos compartidos** o entidades que no deben borrarse al borrar el padre: valorar **`RESTRICT`**, **`NO ACTION`** o **`SET NULL`** (si la columna es nullable).
- Borrado en cascada profundo sin análisis puede eliminar datos de negocio de forma accidental; revisar agregados y reglas de dominio.

**Resumen:** usar **CASCADE** donde el hijo sea **propiedad del padre**; usar **restricciones más débiles** donde la FK sea solo una **referencia** a entidad viva independiente.

---

## Checklist rápido

- [ ] ¿Hay migración `master` y/o `tenants` para cada cambio de esquema?
- [ ] ¿Los DTO de listado/detalle incluyen el **nodo** de las FK que la UI necesita?
- [ ] ¿Las queries cargan relaciones o joins sin N+1 innecesario? (ver [query-optimization.md](./query-optimization.md))
- [ ] ¿`onDelete` en entidad y FK en migración están alineados?

---

## Documentos relacionados

- [query-optimization.md](./query-optimization.md) — joins y carga de relaciones sin castigar rendimiento.
- [listings-pagination.md](./listings-pagination.md) — listados y repositorio.
- [multitenant-implementation.md](./multitenant-implementation.md) — conexión tenant y ruta de migraciones.
- `AGENTS.md` — formato de nombres de migraciones.
