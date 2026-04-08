# Microservices Banking Platform – Agent Implementation Specification

## Purpose of this Document

This document is intended to be provided to an **AI coding agent or developer**.
It describes how to implement the system and how to understand the documentation.

This file is the **entry point for generating or extending the project**.

---

# IMPORTANT: Documentation Reading Order

Before generating any code, the agent MUST read the project documentation in the following order.

1. **docs/system-overview.md**  
   Overall architecture and service interaction.

2. **docs/01-requerimientos/**  
   Functional requirements: `requerimientos.md` and baseline architecture **C4 v1**: `c4-contexto-y-contenedores-v1.md` (actors, three services, event bus — requirement-level view).

3. **docs/03-event-driven/kafka-architecture.md**  
   How Kafka is used.

4. **docs/03-event-driven/event-driven-communication.md**  
   Asynchronous communication between services.

5. **docs/03-event-driven/event-envelope.md**  
   Standard event structure (`eventId`, `eventType`, `source`, `occurredAt`, **`version`**, `payload`).

6. **docs/03-event-driven/event-contracts.md**  
   Business events and payloads.

7. **docs/03-event-driven/kafka-partitioning.md**  
   Event ordering guarantees.

8. **docs/03-event-driven/idempotency-strategy.md**  
   How duplicate events are prevented.

9. **docs/03-event-driven/retry-dlq-strategy.md**  
   Retry and DLQ handling (e.g. AI consumer → `transaction-events-dlq`).

10. **docs/03-event-driven/outbox-pattern.md**  
    Consistency between database and Kafka.

11. **docs/04-services/index.md** and **per-service docs** under `docs/04-services/accounts/`, `transactions/`, `ai/`  
    Implemented responsibilities, HTTP APIs, modules (`AppModule`, feature modules), Kafka consumers/publishers, and ER summaries aligned with the **actual NestJS codebase**.

12. **docs/02-convenciones/**  
    Hexagonal architecture, CQRS, HTTP responses, etc.

The agent must use these documents as the **source of truth**. If the repo already contains an implementation, prefer **04-services** and source code over this prompt when they differ.

---

# System Overview

The system implements a simplified **banking platform** using:

- Microservices architecture
- Event-driven communication
- Apache Kafka (or Kafka-compatible broker, e.g. Redpanda locally)

Three services must be implemented:

1. **Accounts Service** — authoritative balances, clients, accounts; consumes `TransactionCompleted` from `transaction-events`.
2. **Transactions Service** — async transaction execution; consumes `account-events` (snapshots) and `transaction-events` (`TransactionRequested`); publishes results to `transaction-events`.
3. **AI Service** — explains `TransactionCompleted` / `TransactionRejected`; HTTP APIs for explanations and **account history summary**; optional Ollama or mock LLM.

---

# Technology Stack

Required stack:

- Node.js  
- NestJS  
- TypeScript  
- PostgreSQL (one database **per** microservice)  
- Apache Kafka (or compatible)

Suggested libraries:

- `@nestjs/cqrs` (accounts + transactions command/query side)  
- `kafkajs`  
- `typeorm`  
- `pg`

Note: `@nestjs/microservices` is **not** required if HTTP + KafkaJS consumers are used directly (as in this repo).

---

# Microservices

## Accounts Service

Responsibilities:

- Register clients  
- Create bank accounts  
- Retrieve account balance (authoritative)  
- Publish account domain events via **transactional outbox**  
- Consume **`TransactionCompleted`** and apply balance updates **idempotently** (processed events + applied legs)

Events **published** (examples):

- `ClientCreated`  
- `AccountCreated`  
- `BalanceUpdated`

**HTTP (typical):** `POST /clients`, `POST /accounts`, `GET /accounts/:id`  
**Port (this repo):** `3001`

Database (minimum conceptual model — implementation also uses outbox/idempotency tables):

- `clients`, `accounts`  
- `outbox_events`, `processed_events`, `applied_transaction_legs` (pattern support)

---

## Transactions Service

Responsibilities:

- Accept deposit, withdrawal, transfer requests (**202** + `pending`)  
- Execute operations **asynchronously** when processing `TransactionRequested`  
- Validate using **local account snapshots** fed from `account-events`  
- Enforce sufficient funds, unknown account rejection, **idempotent** event handling  
- Publish `TransactionCompleted` / `TransactionRejected`

Events:

- `TransactionRequested`  
- `TransactionCompleted`  
- `TransactionRejected`

**HTTP:** `POST /transactions` (202), `GET /transactions/:id`  
**Port (this repo):** `3002`

**Kafka:** consumes `account-events` and `transaction-events`; publishes to `transaction-events`.

---

## AI Service

Responsibilities:

- Consume `TransactionCompleted` and `TransactionRejected` from `transaction-events`  
- Generate natural-language explanations (mock or **Ollama** HTTP)  
- Expose **GET** explanations by transaction and **GET** account history summary  
- **No** financial business rules

**HTTP (this repo):**

- `GET /explanations/:transactionId`  
- `GET /explanations/account/:accountId/summary` (route order: **summary path before** `:transactionId`)

**Port (this repo):** `3003`

A mock LLM implementation is acceptable. Integration matters more than model quality.

---

# Event Communication

Kafka topics (as implemented):

| Topic | Typical flow |
|-------|----------------|
| `account-events` | Accounts → Transactions (and any subscriber) |
| `transaction-events` | Transactions ↔ Accounts (`TransactionCompleted`), Transactions → AI |
| `transaction-events-dlq` | AI service dead-letter after retries |

Example flow:

- Accounts → `account-events` → Transactions (snapshots)  
- Transactions → `transaction-events` (`TransactionRequested` → consumer executes → `TransactionCompleted` / `TransactionRejected`)  
- Transactions → `transaction-events` → Accounts (balance apply)  
- Transactions → `transaction-events` → AI (explanations)

---

# Event Format

All events published to Kafka must follow this structure (see **event-envelope.md**):

```json
{
  "eventId": "uuid",
  "eventType": "TransactionCompleted",
  "source": "transactions-service",
  "occurredAt": "2026-01-01T10:00:00.000Z",
  "version": 1,
  "payload": {}
}
```

---

# Idempotency

Kafka may deliver duplicate messages.

Each consumer must ensure idempotent processing.

Strategy:

- Table: **`processed_events`** (`event_id`, `processed_at`)  
- Additional keys where needed (e.g. **applied transaction legs** per account + transaction)

Processing flow:

1. Receive event  
2. Check `processed_events` (and domain-specific deduplication if applicable)  
3. If exists → ignore  
4. If not → process and store `event_id`

---

# Retry Strategy

Consumers should retry failed processing up to **3** times (exponential or linear backoff as documented).

If still failing, publish to a **Dead Letter** topic, e.g.:

- `transaction-events-dlq` (AI service in this repo)

---

# Minimum Deliverables

The generated project must include:

- Three NestJS microservices  
- Kafka configuration  
- PostgreSQL persistence (isolated per service)  
- Event publishing and consumption  
- Idempotency implementation  
- Basic documentation  
- **Unit tests and e2e** (as per requirements)  
- **README** with run instructions and env vars  
- Optional: **Postman collection** under `postman/` (see `docs/05-test/pruebas-con-postman.md`)

---

# Manual verification

- Import **`postman/arkano-banking.postman_collection.json`** (+ optional `arkano-local.postman_environment.json`).  
- Follow **`docs/05-test/pruebas-con-postman.md`**.
