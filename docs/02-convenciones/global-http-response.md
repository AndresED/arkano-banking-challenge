# Respuesta HTTP unificada: interceptores y filtro global de errores

El API expone un **contrato de envelope** común para éxito y error. Esto conviene **replicar en cualquier plantilla** derivada de este proyecto para que frontends y clientes tengan siempre la misma forma de parsear respuestas.

## Registro global

En `src/main.ts` (orden relevante para el comportamiento observable):

```typescript
app.useGlobalInterceptors(new TransformInterceptor());
app.useGlobalInterceptors(new LoggingInterceptor());
app.useGlobalFilters(new AllExceptionsFilter());
```

- **`TransformInterceptor`**: envuelve respuestas **exitosas** (2xx) en un objeto estándar.
- **`LoggingInterceptor`**: mide duración y registra request/errores (no altera el cuerpo de éxito).
- **`AllExceptionsFilter`**: captura **cualquier** excepción no manejada y devuelve el envelope de **error**.

## Contrato: interfaz `ApiResponse`

**Ubicación:** `src/shared/domain/api-response.interface.ts`

```typescript
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  meta?: any;
  message?: string | string[];
  error?: string;
  statusCode: number;
  timestamp: string;
}
```

Las respuestas reales del interceptor y del filtro usan subconjuntos coherentes de estos campos.

---

## Respuestas exitosas — `TransformInterceptor`

**Ubicación:** `src/shared/infrastructure/interceptors/transform.interceptor.ts`

### Comportamiento

1. Toma el valor devuelto por el controlador/handler (tras pasar por el pipeline Nest).
2. Si `data` es un objeto con forma **lista paginada** (`items` es array), reenvuelve solo para normalizar:
   - `data.items` → se mantiene.
   - `data.pagination` → se expone explícitamente; si no venía, se usa `null`.
3. En cualquier otro caso, `data` es el payload tal cual (string, UUID, objeto simple, etc.).

### Cuerpo enviado al cliente

```json
{
  "success": true,
  "statusCode": 200,
  "data": { ... },
  "timestamp": "2025-03-23T12:00:00.000Z"
}
```

- `statusCode` se lee del objeto **Response** de Express en ese momento (respeta `@HttpCode`, redirects, etc.).

### Implicaciones para controladores/handlers

- No hace falta que cada endpoint construya manualmente `{ success, data, ... }`; basta devolver el **valor de negocio** y el interceptor lo envuelve.
- Los listados paginados deben devolver un objeto con **`items`** (array) y opcionalmente **`pagination`** para que el envoltorio sea consistente con listas.

Profundización del patrón de listados (query params, modo full vs paginado, repositorios): [listings-pagination.md](./listings-pagination.md).

---

## Errores — `AllExceptionsFilter`

**Ubicación:** `src/shared/infrastructure/filters/all-exceptions.filter.ts`

Decorador **`@Catch()`** sin argumentos: atrapa **todas** las excepciones.

### Cuerpo enviado al cliente

```json
{
  "success": false,
  "statusCode": 400,
  "data": null,
  "message": "Texto o [\"validación\", \"campos\"]",
  "error": "Bad Request",
  "timestamp": "2025-03-23T12:00:00.000Z"
}
```

### Fuentes de error tratadas

| Origen | Comportamiento |
|--------|----------------|
| **`HttpException`** (incl. `BadRequestException`, `NotFoundException`, `UnauthorizedException`, `ForbiddenException`, `ConflictException`, etc.) | `status` del exception; `message` desde `getResponse()` (string u objeto con `message`); `error` desde `responseObj.error` o nombre derivado del tipo. Los mensajes de **validación** pueden llegar como **array** y se conservan. |
| **`QueryFailedError`** (TypeORM / PostgreSQL) | Mapeo de **código PG** (`23505` → 409 Conflict, `23503`/`23502` → 400, etc.) y mensajes amigables en español vía `getUserFriendlyMessage`. En **producción** (`NODE_ENV === 'production'`), errores 500 de DB se **sanitizan** a mensaje genérico hacia el cliente. |
| **`Error` genérico** | En producción, mensajes genéricos para 500; nombres especiales `ValidationError` / `UnauthorizedError` ajustan status. |

### Logging

- Errores **5xx**: `logger.error` con método, URL, status y **stack** completo (mensaje real siempre en log).
- Errores **4xx**: `logger.warn` con detalle razonable.

Así el cliente no ve siempre el stack ni detalles internos en prod, pero operaciones sí.

---

## Logging de peticiones — `LoggingInterceptor`

**Ubicación:** `src/shared/infrastructure/interceptors/loggin.interceptor.ts`

- Tras respuesta exitosa: log **debug** con método, URL, ruta y duración en ms.
- Si el observable falla: log **error** con stack y **re-lanza** la excepción para que **`AllExceptionsFilter`** la formatee.

No modifica el JSON de respuesta.

---

## Checklist para replicar en otro proyecto / plantilla

1. Copiar o reimplementar `ApiResponse<T>` y mantener los mismos nombres de campo (`success`, `statusCode`, `data`, `message`, `error`, `timestamp`).
2. Registrar **`TransformInterceptor`** y **`AllExceptionsFilter`** de forma global en `main.ts`.
3. Opcional pero recomendado: **`LoggingInterceptor`** con el mismo patrón (tap + catchError rethrow).
4. Asegurar que **ningún** middleware personalizado devuelva JSON sin pasar por el filtro en errores no capturados (Nest delega en el filter).
5. En Swagger, documentar los esquemas `ApiResponseDto` / `ApiErrorResponseDto` como en este repo (`main.ts` + plugin) para que el contrato sea visible.

---

## Documentos relacionados

- Formato resumido en `AGENTS.md` (sección API Response Format).
- [architecture.md](./architecture.md) — infraestructura transversal.
- [base-repo-prompt.md](./base-repo-prompt.md) — prompt actualizado para exigir esta capa en plantillas nuevas.
