# transactions-service — Documentación técnica

Microservicio NestJS que recibe **solicitudes de transacciones** (depósito, retiro, transferencia), las deja en estado **pending** con evento **TransactionRequested** en outbox, y **ejecuta** la lógica al consumir ese evento: actualiza **snapshots locales** de cuentas, cambia estado de la transacción y publica **TransactionCompleted** o **TransactionRejected**.

**Puerto por defecto:** `3002` (`PORT` en `.env`).

---

## 1. Módulos registrados (fuente de verdad)

### `AppModule` (`src/app.module.ts`)

| Import | Función |
|--------|---------|
| `ConfigModule.forRoot({ isGlobal: true })` | Configuración global |
| `TypeOrmModule.forRootAsync(...)` | PostgreSQL (`DATABASE_URL`) |
| `TransactionsModule` | Único módulo de feature |

### `TransactionsModule` (`src/modules/transactions/transactions.module.ts`)

| Tipo | Registro |
|------|----------|
| **Imports** | `CqrsModule`, `TypeOrmModule.forFeature([TransactionOrmEntity, AccountSnapshotOrmEntity, OutboxEventOrmEntity, ProcessedEventOrmEntity])` |
| **Controllers** | `TransactionsController` |
| **Handlers** | `RequestTransactionHandler`, `GetTransactionByIdHandler` |
| **Providers** | `KafkaService`, `OutboxPublisherService`, `AccountEventApplierService`, `AccountEventsConsumer`, `TransactionExecuteService`, `TransactionRequestedConsumer` |

---

## 2. Organización real del código

```
src/
├── app.module.ts
├── main.ts
├── common/events, common/topics
├── infrastructure/
│   ├── kafka/
│   │   ├── kafka.service.ts
│   │   ├── outbox-publisher.service.ts
│   │   ├── account-events.consumer.ts      # suscripción account-events
│   │   ├── account-event-applier.service.ts
│   │   ├── transaction-requested.consumer.ts
│   │   └── transaction-execute.service.ts    # núcleo de reglas
│   └── persistence/
│       ├── transaction.orm-entity.ts
│       ├── account-snapshot.orm-entity.ts
│       ├── outbox-event.orm-entity.ts
│       └── processed-event.orm-entity.ts
└── modules/transactions/
    ├── transactions.module.ts
    ├── application/commands, queries, dtos
    └── infrastructure/adapters/in/rest/transactions.controller.ts
```

El **núcleo de negocio** de ejecución está en `TransactionExecuteService` (no en un handler CQRS directo del POST), porque el flujo es **asíncrono** vía Kafka.

---

## 3. API HTTP

| Método | Ruta | Comportamiento |
|--------|------|----------------|
| POST | `/transactions` | **202** — Crea fila `transactions` en `pending` + outbox `TransactionRequested` |
| GET | `/transactions/:id` | **200** vista / **404** si no existe |

**DTO** `RequestTransactionDto`: `type` ∈ deposit | withdrawal | transfer, `amount` > 0, `sourceAccountId` / `targetAccountId` opcionales según tipo. Validaciones adicionales en `RequestTransactionHandler` (p. ej. transfer requiere ambas cuentas).

---

## 4. Diagrama C4 — contexto (C1)

```mermaid
flowchart LR
  subgraph usuarios["Usuarios"]
    U["Cliente HTTP"]
  end

  T["transactions-service"]

  subgraph externos["Externos"]
    PG[("PostgreSQL")]
    K[("Kafka")]
    A["accounts-service<br/>account-events"]
  end

  U --> T
  T --> PG
  T <--> K
  A --> K
```

---

## 5. Diagrama C4 — contenedor interno (C2)

```mermaid
flowchart TB
  subgraph nest["transactions-service"]
    TC["TransactionsController"]
    CB["CommandBus / QueryBus"]
    RH["RequestTransactionHandler"]
    GH["GetTransactionByIdHandler"]
    TRC["TransactionRequestedConsumer"]
    EX["TransactionExecuteService"]
    AEC["AccountEventsConsumer"]
    APL["AccountEventApplierService"]
    OP["OutboxPublisherService"]
    KS["KafkaService"]
    ORM["TypeORM"]
  end

  TC --> CB
  CB --> RH
  CB --> GH
  RH --> ORM
  GH --> ORM
  TRC --> EX
  EX --> ORM
  AEC --> APL
  APL --> ORM
  OP --> KS
  OP --> ORM
```

---

## 6. Flujo funcional — de solicitud a completado

```mermaid
flowchart TD
  S[POST /transactions 202] --> P[INSERT transaction pending]
  P --> O[INSERT outbox TransactionRequested]
  Q[OutboxPublisher] --> K1[Kafka transaction-events]
  W[TransactionRequestedConsumer] --> E[TransactionExecuteService.executeRequested]
  E --> R{Reglas y snapshots}
  R -->|OK| C[completed + TransactionCompleted en outbox]
  R -->|fallo| J[rejected + TransactionRejected en outbox]
  C --> K2[Publicación Kafka]
  J --> K2
```

---

## 7. Diagrama de secuencia — transferencia exitosa (dos patas)

```mermaid
sequenceDiagram
  participant API as TransactionsController
  participant H as RequestTransactionHandler
  participant DB as PostgreSQL outbox
  participant K as Kafka
  participant C as TransactionRequestedConsumer
  participant X as TransactionExecuteService

  API->>H: RequestTransactionCommand transfer
  H->>DB: TX: save transaction pending + outbox requested
  Note over K: TransactionRequested publicado
  K->>C: mensaje
  C->>X: executeRequested
  X->>DB: actualiza snapshots origen y destino
  X->>DB: transaction completed
  X->>DB: dos filas outbox TransactionCompleted
```

Cada **TransactionCompleted** lleva `transactionId`, `amount` (+/-) y `accountId` para que **accounts-service** aplique el movimiento en el saldo global.

---

## 8. Estados y reglas (resumen)

| Estado | Significado |
|--------|-------------|
| `pending` | Registrada; esperando procesamiento del consumidor |
| `completed` | Ejecutada; eventos de resultado en outbox |
| `rejected` | Rechazada con `reason`; `TransactionRejected` en outbox |

**Snapshots (`account_snapshots`):** réplica local alimentada por `AccountCreated` y `BalanceUpdated` desde `account-events`. La ejecución valida existencia y fondos contra estos datos (no contra la BD de accounts en tiempo real).

---

## 9. Base de datos — modelo ER

```mermaid
erDiagram
  transactions {
    uuid id PK
    varchar type
    decimal amount
    uuid source_account_id
    uuid target_account_id
    varchar status
    text reason
    timestamptz created_at
  }
  account_snapshots {
    uuid account_id PK
    uuid client_id
    decimal balance
    timestamptz updated_at
  }
  outbox_events {
    uuid id PK
    varchar topic
    varchar partition_key
    varchar event_type
    text payload
    boolean published
    timestamptz published_at
    timestamptz created_at
  }
  processed_events {
    uuid event_id PK
    timestamptz processed_at
  }
```

### Diccionario de datos (resumen)

| Tabla | Propósito |
|-------|-----------|
| `transactions` | Solicitud y estado del movimiento |
| `account_snapshots` | Vista local para validar cuentas y saldos en ejecución |
| `outbox_events` | Outbox hacia `transaction-events` |
| `processed_events` | Idempotencia de consumo de eventos entrantes |

---

## 10. Eventos Kafka

| Topic | Rol |
|-------|-----|
| `account-events` | **Consume:** `AccountCreated`, `BalanceUpdated` → actualiza `account_snapshots` |
| `transaction-events` | **Consume:** `TransactionRequested`; **publica:** `TransactionRequested`, `TransactionCompleted`, `TransactionRejected` |

El topic `transaction-events-dlq` está definido en constantes compartidas con ai-service; **el productor DLQ** para mensajes fallidos está implementado en **ai-service**, no en transactions.

---

## 11. Servicios externos

| Sistema | Uso |
|---------|-----|
| PostgreSQL | Persistencia |
| Kafka / Redpanda | Orquestación asíncrona |
| **accounts-service** (indirecto) | Eventos en `account-events` que alimentan snapshots |

---

## 12. Variables de entorno

`DATABASE_URL`, `KAFKA_BROKERS`, `PORT` — ver `.env.example` del servicio.

---

## 13. Documentos relacionados

- [Índice 04-services](../index.md)
- [accounts-service](../accounts/accounts-service.md)
- [ai-service](../ai/ai-service.md)

[← Índice 04-services](../index.md)
