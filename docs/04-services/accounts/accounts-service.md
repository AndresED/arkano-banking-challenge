# accounts-service — Documentación técnica

Microservicio NestJS que gestiona **clientes**, **cuentas** y el **saldo autoritativo** en PostgreSQL. Publica eventos de dominio vía patrón **transactional outbox** y consume **`TransactionCompleted`** desde Kafka para actualizar saldos de forma idempotente.

**Puerto por defecto:** `3001` (`PORT` en `.env`).

---

## 1. Módulos registrados (fuente de verdad)

### `AppModule` (`src/app.module.ts`)

| Import | Función |
|--------|---------|
| `ConfigModule.forRoot({ isGlobal: true })` | Variables de entorno globales |
| `TypeOrmModule.forRootAsync(...)` | PostgreSQL vía `DATABASE_URL`, `autoLoadEntities`, `synchronize: true` |
| `AccountsModule` | Único módulo de dominio |

### `AccountsModule` (`src/modules/accounts/accounts.module.ts`)

| Tipo | Registro |
|------|----------|
| **Imports** | `CqrsModule`, `TypeOrmModule.forFeature([ClientOrmEntity, AccountOrmEntity, OutboxEventOrmEntity, ProcessedEventOrmEntity, AppliedTransactionLegOrmEntity])` |
| **Controllers** | `AccountsController` |
| **Handlers CQRS** | `CreateClientHandler`, `CreateAccountHandler`, `GetAccountByIdHandler` |
| **Providers** | `KafkaService`, `OutboxPublisherService`, `TransactionCompletedApplierService`, `TransactionEventsConsumer` |

No existe módulo `AuthModule` ni otros módulos raíz: la superficie queda acotada a cuentas + Kafka.

---

## 2. Organización real del código

```
src/
├── app.module.ts
├── main.ts                          # ValidationPipe, TransformInterceptor, AllExceptionsFilter
├── common/
│   ├── events/event-envelope.ts     # parseEnvelope, EVENT_VERSION
│   └── topics.ts                    # TOPIC_ACCOUNT_EVENTS, TOPIC_TRANSACTION_EVENTS
├── infrastructure/
│   ├── kafka/                       # KafkaService, OutboxPublisher, TransactionEventsConsumer, Applier
│   └── persistence/                 # Entidades TypeORM
├── modules/accounts/
│   ├── accounts.module.ts
│   ├── application/
│   │   ├── commands/                # create-client, create-account + DTOs
│   │   └── queries/                 # get-account-by-id
│   └── infrastructure/adapters/in/rest/
│       └── accounts.controller.ts
└── shared/infrastructure/           # filtros e interceptor HTTP compartidos
```

Patrón: **CQRS** (commands/queries) + **hexagonal light** (REST como adaptador de entrada, Kafka y TypeORM como salida).

---

## 3. API HTTP

| Método | Ruta | Handler / bus | Código HTTP |
|--------|------|---------------|-------------|
| POST | `/clients` | `CreateClientCommand` | 201 |
| POST | `/accounts` | `CreateAccountCommand` | 201 |
| GET | `/accounts/:id` | `GetAccountByIdQuery` | 200 / 404 |

**Validación:** `class-validator` en DTOs (`CreateClientDto`, `CreateAccountDto` con `clientId` UUID).

**Respuesta envuelta:** el `TransformInterceptor` devuelve `{ success, statusCode, data, timestamp }`.

---

## 4. Diagrama C4 — contexto del servicio (C1)

```mermaid
flowchart LR
  subgraph usuarios["Usuarios / integraciones"]
    CLI["Cliente HTTP"]
  end

  ACC["accounts-service"]

  subgraph externos["Sistemas externos"]
    PG[("PostgreSQL")]
    KF[("Kafka")]
    TRX["transactions-service<br/>productor de TransactionCompleted"]
  end

  CLI --> ACC
  ACC --> PG
  ACC <--> KF
  TRX --> KF
```

---

## 5. Diagrama C4 — contenedor interno (C2)

```mermaid
flowchart TB
  subgraph nest["accounts-service"]
    CTRL["AccountsController"]
    BUS["CommandBus / QueryBus"]
    H1["CreateClientHandler"]
    H2["CreateAccountHandler"]
    H3["GetAccountByIdHandler"]
    OUT["OutboxPublisherService"]
    CON["TransactionEventsConsumer"]
    APP["TransactionCompletedApplierService"]
    KS["KafkaService"]
    ORM["TypeORM DataSource"]
  end

  CTRL --> BUS
  BUS --> H1
  BUS --> H2
  BUS --> H3
  H1 --> ORM
  H2 --> ORM
  H3 --> ORM
  OUT --> KS
  OUT --> ORM
  CON --> KS
  CON --> APP
  APP --> ORM
```

---

## 6. Flujo funcional — crear cliente y publicar evento

```mermaid
flowchart TD
  A[POST /clients] --> B[ValidationPipe]
  B --> C[CreateClientHandler]
  C --> D[Transacción DB]
  D --> E[INSERT clients]
  D --> F[INSERT outbox_events<br/>ClientCreated JSON]
  F --> G[Commit]
  G --> H[Respuesta clientId]
  O[OutboxPublisherService ciclo] --> I[Leer outbox no publicado]
  I --> J[Kafka produce account-events]
  J --> K[Marcar published]
```

---

## 7. Diagrama de secuencia — aplicar TransactionCompleted

```mermaid
sequenceDiagram
  participant K as Kafka topic transaction-events
  participant C as TransactionEventsConsumer
  participant A as TransactionCompletedApplierService
  participant DB as PostgreSQL

  K->>C: mensaje TransactionCompleted
  C->>C: parseEnvelope
  C->>A: apply envelope
  A->>DB: find processed_events por eventId
  alt ya procesado
    A-->>C: return
  else aplicar
    A->>DB: TX: leg, account, outbox BalanceUpdated, processed
  end
```

---

## 8. Base de datos — modelo entidad-relación

**Diagrama ER lógico + modelo físico (tablas, tipos, PK/FK/UK):** [diagramas-er-fisico.md](./diagramas-er-fisico.md).

```mermaid
erDiagram
  clients ||--o{ accounts : owns
  clients {
    uuid id PK
    varchar name
    varchar email UK
    timestamptz created_at
  }
  accounts {
    uuid id PK
    uuid client_id FK
    decimal balance
    timestamptz created_at
  }
  applied_transaction_legs {
    uuid transaction_id PK
    uuid account_id PK
    timestamptz applied_at
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
| `clients` | Titulares; email único |
| `accounts` | Cuenta vinculada a `client_id`; **saldo autoritativo** |
| `outbox_events` | Eventos a publicar en Kafka en la misma transacción de negocio |
| `processed_events` | Idempotencia por `event_id` (Kafka puede reenviar) |
| `applied_transaction_legs` | Idempotencia por par **(transaction_id, account_id)** al aplicar una pata de `TransactionCompleted` |

---

## 9. Eventos Kafka

| Dirección | Topic | Eventos relevantes |
|-----------|-------|-------------------|
| **Publica** | `account-events` | `ClientCreated`, `AccountCreated`, `BalanceUpdated` |
| **Consume** | `transaction-events` | `TransactionCompleted` (actualiza saldo, encola `BalanceUpdated` si aplica) |

Constantes en `src/common/topics.ts`.

**Reglas destacadas en `TransactionCompletedApplierService`:** no permitir saldo negativo; ignorar cuenta desconocida; no duplicar aplicación por leg ya existente.

---

## 10. Servicios externos e integraciones

| Sistema | Uso | Configuración |
|---------|-----|---------------|
| **PostgreSQL** | Persistencia | `DATABASE_URL` |
| **Kafka / Redpanda** | Mensajería | `KAFKA_BROKERS` (lista separada por comas) |
| **kafkajs** | Cliente producer/consumer | Dependencia npm |

No hay llamadas a APIs REST de terceros en este servicio.

---

## 11. Variables de entorno (referencia)

Ver `services/accounts-service/.env.example`: `PORT`, `DATABASE_URL`, `KAFKA_BROKERS`.

---

## 12. Documentos relacionados

- [Índice 04-services](../index.md)
- [Guía Ollama](../../07-team/guia-ollama-local.md) (no aplica a accounts; enlazada desde ai)
- [Tests por microservicio](../../05-test/tests-por-microservicio.md)

[← Índice 04-services](../index.md)
