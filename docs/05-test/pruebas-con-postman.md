# Pruebas con Postman según los requerimientos

Esta guía explica cómo validar, con **Postman**, el comportamiento descrito en [`01-requerimientos/requerimientos.md`](../01-requerimientos/requerimientos.md) sobre la implementación actual (tres servicios HTTP: **3001**, **3002**, **3003**).

---

## 1. Antes de abrir Postman

1. **Docker** en marcha, en la raíz del repo:

   ```bash
   docker compose up -d
   ```

2. **Los tres microservicios** en ejecución (`npm run start:dev` en cada carpeta bajo `services/`), con `.env` correcto (`DATABASE_URL`, `KAFKA_BROKERS=localhost:19092`).

3. Orden recomendado de arranque: **accounts** → **transactions** → **ai** (para que los consumidores estén listos antes de probar flujos largos).

Si algo falla, revisa [`infraestructura-implementada-y-cumplimiento-requerimientos.md`](../07-team/infraestructura-implementada-y-cumplimiento-requerimientos.md) (sección troubleshooting).

---

## 2. Formato de las respuestas HTTP

Todos los servicios envuelven el cuerpo así:

- **Éxito:** `success: true`, `statusCode`, `data` (payload útil), `timestamp`.
- **Error:** `success: false`, `statusCode`, `message`, `error`, `timestamp`.

En Postman, el valor que te interesa copiar (por ejemplo `clientId` o `transactionId`) suele estar en **`response.body.data`**.

---

## 3. Variables en Postman (colección vs entorno)

La colección importable [`postman/arkano-banking.postman_collection.json`](../../postman/arkano-banking.postman_collection.json) trae **variables de colección** y scripts que hacen `pm.collectionVariables.set('clientId', …)` tras crear recursos. No es obligatorio crear un entorno: basta importar la colección y ejecutar en orden.

Si quieres un **Environment** adicional (por ejemplo `Arkano local`) para otra máquina o puertos, define al menos:

| Variable | Valor inicial | Uso |
|----------|---------------|-----|
| `accountsUrl` | `http://localhost:3001` | Base URL del servicio de cuentas |
| `transactionsUrl` | `http://localhost:3002` | Base URL del servicio de transacciones |
| `aiUrl` | `http://localhost:3003` | Base URL del servicio AI |
| `clientId` | *(vacío)* | Lo rellenas tras crear cliente |
| `accountId` | *(vacío)* | Cuenta principal de pruebas |
| `accountId2` | *(vacío)* | Segunda cuenta (transferencias) |
| `transactionId` | *(vacío)* | Lo rellenas tras solicitar una transacción |

En cada request usa `{{accountsUrl}}`, `{{transactionsUrl}}`, `{{aiUrl}}` y en URL o body `{{clientId}}`, etc.

**Tip:** tras una respuesta exitosa, puedes usar la pestaña **Tests** de Postman para guardar IDs automáticamente, por ejemplo:

```javascript
const json = pm.response.json();
if (json.success && json.data && json.data.clientId) {
  pm.collectionVariables.set('clientId', json.data.clientId);
}
```

Si usas solo **environment**, sustituye por `pm.environment.set(...)`. La colección del repo está pensada para **collection variables**.

---

## 4. Colección sugerida (carpetas y orden)

Organiza la colección en tres carpetas alineadas con los requerimientos:

1. **01 - Clientes y cuentas (Accounts)** → cumple requisitos de registro, creación de cuenta y consulta de saldo.
2. **02 - Transacciones (Transactions)** → depósito, retiro, transferencia; estados pending / completed / rejected.
3. **03 - IA (explicaciones)** → explicación en lenguaje natural (mock LLM).

Ejecuta los requests **en orden** la primera vez, porque los IDs dependen de los pasos anteriores.

La colección JSON del repo incluye además **GET Cuenta por id (segunda)** (validar destino tras transferencia), **prerequests** que fallan con mensaje claro si faltan variables, y **tests** en GET transacción, explicaciones y resumen por cuenta cuando la respuesta es 200.

---

## 5. Carpeta 1: Clientes y cuentas (`{{accountsUrl}}`)

### 5.1 Registrar cliente

- **Método:** `POST`
- **URL:** `{{accountsUrl}}/clients`
- **Headers:** `Content-Type: application/json`
- **Body (raw JSON):**

```json
{
  "name": "Ana Prueba",
  "email": "ana.prueba.postman@example.com"
}
```

**Qué validar (requerimiento):** cliente registrado.  
**Qué guardar:** en `data.clientId` → variable `clientId`.

### 5.2 Crear cuenta bancaria

- **Método:** `POST`
- **URL:** `{{accountsUrl}}/accounts`
- **Body:**

```json
{
  "clientId": "{{clientId}}"
}
```

**Qué validar:** cuenta asociada al cliente; saldo inicial coherente (0).  
**Qué guardar:** `data.accountId` → `accountId`.

Para **transferencias**, crea un **segundo cliente** (otro email) y otra **cuenta**; guarda el segundo `accountId` en `accountId2`.

### 5.3 Consultar cuenta y saldo

- **Método:** `GET`
- **URL:** `{{accountsUrl}}/accounts/{{accountId}}`

**Qué validar (requerimiento):** consulta de cuenta y saldo (`data.balance`, `data.clientId`, etc.).

Repite el GET después de operaciones en transacciones para comprobar que el saldo en **accounts** se actualiza cuando se completa un movimiento (vía eventos).

---

## 6. Carpeta 2: Transacciones (`{{transactionsUrl}}`)

### Importante: flujo asíncrono

- `POST /transactions` responde **202** y deja la transacción en **`pending`**.
- El procesamiento ocurre al consumir el evento `TransactionRequested` (outbox + Kafka).
- Debes hacer **GET** `/transactions/:id` varias veces hasta ver `completed` o `rejected` (o usar **Send and Delay** en Postman Collection Runner con una pausa de 1–2 s entre intentos).

Antes de depósitos/retiros/transferencias, asegúrate de que **transactions-service** haya recibido al menos **`AccountCreated`** (y si aplica **`BalanceUpdated`**) para esa cuenta; si no, verás rechazos con motivo tipo cuenta desconocida. Tras crear la cuenta en Accounts, espera 1–3 segundos o reintenta el POST de transacción.

### 6.1 Depósito

- **Método:** `POST`
- **URL:** `{{transactionsUrl}}/transactions`
- **Body:**

```json
{
  "type": "deposit",
  "amount": 100,
  "targetAccountId": "{{accountId}}"
}
```

**Qué validar:** respuesta **202**; `data.status` = `pending`; `data.transactionId` → guardar en `transactionId`.

Luego:

- **GET** `{{transactionsUrl}}/transactions/{{transactionId}}` hasta `status: "completed"`.
- **GET** `{{accountsUrl}}/accounts/{{accountId}}` y comprobar que el saldo subió.

### 6.2 Retiro (fondos suficientes)

Primero asegúrate de tener saldo (depósito previo). Luego:

- **POST** `{{transactionsUrl}}/transactions`

```json
{
  "type": "withdrawal",
  "amount": 30,
  "sourceAccountId": "{{accountId}}"
}
```

**Qué validar:** `completed` y saldo en accounts reducido.

### 6.3 Retiro sin fondos (rechazo)

- **POST** con `amount` mayor que el saldo disponible (misma `sourceAccountId`).

**Qué validar (requerimiento):** estado **`rejected`**, y en `data.reason` un texto tipo fondos insuficientes.

### 6.4 Transferencia entre cuentas

Con `accountId` (origen con saldo) y `accountId2` (destino):

- **POST**

```json
{
  "type": "transfer",
  "amount": 25,
  "sourceAccountId": "{{accountId}}",
  "targetAccountId": "{{accountId2}}"
}
```

**Qué validar:** `completed`; saldo origen baja y destino sube (consultando GET accounts de ambas cuentas).

### 6.5 Validación del body (errores 400)

Prueba casos inválidos para ver el manejo de errores:

- Depósito sin `targetAccountId`.
- Retiro sin `sourceAccountId`.
- Transferencia sin una de las dos cuentas.

---

## 7. Carpeta 3: IA / explicaciones (`{{aiUrl}}`)

Cuando la transacción esté **`completed`** o **`rejected`**, el **ai-service** habrá consumido los eventos correspondientes (tras un breve delay).

- **Método:** `GET`
- **URL:** `{{aiUrl}}/explanations/{{transactionId}}`

**Qué validar (requerimiento):** explicación en lenguaje natural (mock); en `data.explanations` un array de textos asociados a esa transacción.

Si recibes **404**, el consumidor aún no procesó el evento: espera y reintenta, o revisa que **ai-service** esté en marcha y conectado a Kafka.

### 7.1 Resumen de historial por cuenta (requerimiento LLM)

- **Método:** `GET`
- **URL:** `{{aiUrl}}/explanations/account/{{accountId}}/summary`

Solo hay datos si existen filas con ese `accountId` (se rellenan al procesar **`TransactionCompleted`**). Tras varios depósitos/retiros completados en esa cuenta, el endpoint devuelve `data.summary` y `data.provider` (`mock` u `ollama`).

Para usar **Ollama** en local: [../07-team/guia-ollama-local.md](../07-team/guia-ollama-local.md) (`USE_OLLAMA=true` en `ai-service`).

---

## 8. Tabla rápida: requerimiento → request en Postman

| Requerimiento | Cómo probarlo en Postman |
|---------------|---------------------------|
| Registrar clientes | `POST {{accountsUrl}}/clients` |
| Crear cuentas | `POST {{accountsUrl}}/accounts` |
| Consultar saldo | `GET {{accountsUrl}}/accounts/:id` |
| Depósito / retiro / transferencia | `POST {{transactionsUrl}}/transactions` con `type` y cuentas |
| Transacción no síncrona | 202 en POST + polling `GET .../transactions/:id` |
| Estados pending / completed / rejected | Mismo GET de transacción |
| Rechazo por fondos | Retiro con `amount` excesivo |
| Explicación tipo LLM | `GET {{aiUrl}}/explanations/:transactionId` tras completed/rejected |
| Resumen historial por cuenta | `GET {{aiUrl}}/explanations/account/:accountId/summary` (tras varios `TransactionCompleted` con esa cuenta) |
| LLM real local (Ollama) | `USE_OLLAMA=true` + guía [guia-ollama-local.md](../07-team/guia-ollama-local.md) |

---

## 9. Collection Runner (opcional)

1. Ordena los requests como en las carpetas 1 → 2 → 3.
2. Añade **delay** de 1–2 s entre requests donde haya Kafka (después de crear cuenta, después de POST transacción antes del GET).
3. Activa **Tests** que asignen `clientId`, `accountId`, `transactionId` para no copiar a mano.

---

## 10. Colección lista para importar

En el repo hay una colección exportable:

- **Colección:** [`postman/arkano-banking.postman_collection.json`](../../postman/arkano-banking.postman_collection.json)
- **Entorno local (opcional):** [`postman/arkano-local.postman_environment.json`](../../postman/arkano-local.postman_environment.json)

En Postman: **Import** → selecciona esos archivos. Instrucciones breves: [`postman/README.md`](../../postman/README.md).

También puedes **Export** desde Postman (colección + environment) si modificas requests y quieres versionar los cambios.

---

## Documentación relacionada

- [Infraestructura y cumplimiento de requerimientos](../07-team/infraestructura-implementada-y-cumplimiento-requerimientos.md)
- [Requerimientos](../01-requerimientos/requerimientos.md)
- [Contratos de eventos](../03-event-driven/event-contracts.md)
- [Índice de documentación](../README.md)
