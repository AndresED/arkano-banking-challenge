# Comportamiento por tipo de evento (qué hace cada servicio)

Este documento describe **qué servicio publica** cada `eventType`, **en qué topic** viaja y **qué hace cada microservicio** al recibirlo (procesar, ignorar o no estar suscrito).

**Referencias:** contratos en [event-contracts.md](./event-contracts.md), flujo E2E en [../07-team/fundamentos-teoricos/12.%20System%20flow.md](../07-team/fundamentos-teoricos/12.%20System%20flow.md).

---

## Leyenda

| Símbolo / término | Significado |
|-------------------|-------------|
| **Publica** | Inserta fila en `outbox_events` (misma TX que negocio); `OutboxPublisherService` envía a Kafka. |
| **Consume** | Hay `consumer.subscribe` al topic y el handler evalúa `eventType`. |
| **Ignora** | El mensaje entra al consumer del topic, pero el código hace `return` sin efecto de negocio (a veces con log). |
| **No lee el topic** | El servicio no está suscrito a ese topic; el broker no entrega esos mensajes a ese proceso. |

**Topics:** `account-events`, `transaction-events` (y `transaction-events-dlq` solo como salida de error en ai-service).

---

## Tabla resumen

| `eventType` | Topic | Publicado por | accounts-service | transactions-service | ai-service |
|-------------|-------|---------------|------------------|----------------------|------------|
| `ClientCreated` | `account-events` | accounts | Publica (handler) | Consume → **ignora** (solo procesa `AccountCreated` / `BalanceUpdated`) | No lee `account-events` |
| `AccountCreated` | `account-events` | accounts | Publica (handler) | Consume → aplica snapshot (`AccountEventApplierService`) | No lee `account-events` |
| `BalanceUpdated` | `account-events` | accounts | Publica (applier tras `TransactionCompleted`) | Consume → actualiza snapshot | No lee `account-events` |
| `TransactionRequested` | `transaction-events` | transactions | No lee el topic | Consume → ejecuta transacción (`TransactionExecuteService`) | No procesa (solo `TransactionCompleted` / `TransactionRejected`) |
| `TransactionCompleted` | `transaction-events` | transactions | Consume → saldo, legs, outbox `BalanceUpdated`, `processed_events` | Recibe en el mismo topic pero **ignora** (solo procesa `TransactionRequested`) | Consume → explicación LLM + `processed_events` |
| `TransactionRejected` | `transaction-events` | transactions | No procesa (solo `TransactionCompleted`) | Recibe en el mismo topic pero **ignora** | Consume → explicación + `processed_events` |

---

## `ClientCreated`

- **Origen:** `CreateClientHandler` persiste cliente y outbox con `eventType: 'ClientCreated'` → topic `account-events` (`services/accounts-service/.../create-client.handler.ts`).
- **accounts-service:** solo publica; no hay consumidor interno de `ClientCreated`.
- **transactions-service** (`AccountEventsConsumer`, topic `account-events`): parsea el envelope; si no es `AccountCreated` ni `BalanceUpdated`, registra skip (p. ej. `ClientCreated` se ignora) — `account-events.consumer.ts`.
- **ai-service:** no suscrito a `account-events`.

---

## `AccountCreated`

- **Origen:** `CreateAccountHandler` → outbox → `account-events` (`create-account.handler.ts`).
- **accounts-service:** publica; no reconsume su propio topic en este código.
- **transactions-service:** `AccountEventApplierService.applyAccountCreated` — inserta/actualiza `account_snapshots` e idempotencia por `eventId` en `processed_events` (`account-event-applier.service.ts`).
- **ai-service:** no aplica.

---

## `BalanceUpdated`

- **Origen:** `TransactionCompletedApplierService` en accounts, tras aplicar saldo y leg, encola outbox con `BalanceUpdated` → `account-events` (`transaction-completed-applier.service.ts`).
- **accounts-service:** publica; no consume `BalanceUpdated` de Kafka hacia sí mismo.
- **transactions-service:** `applyBalanceUpdated` — actualiza fila en `account_snapshots` y marca `processed_events` (`account-event-applier.service.ts`).
- **ai-service:** no aplica.

---

## `TransactionRequested`

- **Origen:** `RequestTransactionHandler` → outbox → `transaction-events` (`request-transaction.handler.ts`).
- **accounts-service:** `TransactionEventsConsumer` solo acepta `TransactionCompleted` → **ignora** otros tipos (`transaction-events.consumer.ts`).
- **transactions-service:** `TransactionRequestedConsumer` → `TransactionExecuteService.executeRequested` — valida snapshots, completa/rechaza, encola `TransactionCompleted` / `TransactionRejected`, idempotencia con `processed_events` (`transaction-requested.consumer.ts`, `transaction-execute.service.ts`).
- **ai-service:** `TransactionEventsConsumer` filtra solo `TransactionCompleted` y `TransactionRejected` → **no ejecuta** pipeline de explicación para `TransactionRequested`.

---

## `TransactionCompleted`

- **Origen:** `TransactionExecuteService.enqueueCompleted` (una o más filas outbox por transferencia) → `transaction-events` (`transaction-execute.service.ts`).
- **accounts-service:** `TransactionCompletedApplierService.apply` — idempotencia `processed_events` + legs, actualiza `accounts.balance`, outbox `BalanceUpdated`, marca procesado (`transaction-completed-applier.service.ts`).
- **transactions-service:** el mismo consumer de `transaction-events` que procesa `TransactionRequested` **no** trata `TransactionCompleted` (comprueba tipo y hace return) — `transaction-requested.consumer.ts`.
- **ai-service:** `AiTransactionEventApplierService` — LLM + insert `transaction_explanations` + `processed_events` (reintentos y DLQ en el consumer) (`ai-transaction-event-applier.service.ts`, `transaction-events.consumer.ts`).

---

## `TransactionRejected`

- **Origen:** `TransactionExecuteService` en ramas `reject(...)` → outbox `TransactionRejected` → `transaction-events` (`transaction-execute.service.ts`).
- **accounts-service:** consumer de `transaction-events` solo `TransactionCompleted` → **ignora**.
- **transactions-service:** mismo consumer que `TransactionRequested` → **ignora** `TransactionRejected`.
- **ai-service:** mismo flujo que `TransactionCompleted` — explicación del rechazo (payload con `reason`; `accountId` puede ser null según payload) y persistencia idempotente.

---

## Notas de diseño

1. **Mismo topic, distintos consumidores:** `transaction-events` lo leen **tres** procesos con **tres `groupId` distintos** (accounts, transactions-requested, ai). Cada grupo recibe **copia** del flujo de mensajes según partición asignada; el **filtrado por `eventType`** evita que accounts ejecute solicitudes o que transactions ejecute completados.
2. **`ClientCreated` en accounts-events:** hoy no tiene consumidor que materialice nada en transactions; es coherente con el alcance del reto (transacciones dependen de cuentas vía snapshots alimentados por `AccountCreated` / `BalanceUpdated`).
3. **DLQ:** no es un `eventType` de negocio del envelope estándar; es el topic `transaction-events-dlq` donde ai-service deposita el payload crudo tras fallos repetidos.

---

## Referencias de código rápidas

| Servicio | Archivo | Rol |
|----------|---------|-----|
| accounts | `create-client.handler.ts`, `create-account.handler.ts` | Outbox `ClientCreated` / `AccountCreated` |
| accounts | `transaction-completed-applier.service.ts` | Outbox `BalanceUpdated`; aplica `TransactionCompleted` |
| accounts | `transaction-events.consumer.ts` | Consume `transaction-events`; filtra `TransactionCompleted` |
| transactions | `account-events.consumer.ts` | `AccountCreated` / `BalanceUpdated` |
| transactions | `transaction-requested.consumer.ts`, `transaction-execute.service.ts` | `TransactionRequested`; publica `Completed` / `Rejected` |
| ai | `transaction-events.consumer.ts`, `ai-transaction-event-applier.service.ts` | `TransactionCompleted` / `TransactionRejected` |

[← Índice event-driven](./README.md)
