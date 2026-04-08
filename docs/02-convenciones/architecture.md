# Microservices Architecture Specification

## Overview

This system implements a **banking platform using microservices and event‑driven communication**.
Each service is autonomous, owns its own database, and communicates through an **event bus**.

Key architectural principles:

- Microservices autonomy
- Event‑driven communication
- Hexagonal architecture
- CQRS pattern
- Independent databases
- Idempotent event processing

## Services

The platform contains **three main microservices**.

### 1. Accounts Service
Responsible for:

- Client management
- Bank accounts
- Balance updates

Publishes events:

- ClientCreated
- AccountCreated
- BalanceUpdated

---

### 2. Transactions Service
Responsible for:

- Deposits
- Withdrawals
- Transfers

Publishes events:

- TransactionRequested
- TransactionCompleted
- TransactionRejected

---

### 3. AI Service (LLM)

Responsible for:

- Explaining banking events in natural language
- Summarizing transaction history
- Translating technical events to user‑friendly messages

Consumes events:

- TransactionCompleted
- TransactionRejected

---

## Event Bus

Microservices communicate through a **message broker**.

Supported technologies:

- RabbitMQ
- Kafka
- NATS
- AWS SNS/SQS

Recommended default:

RabbitMQ

---

## System Architecture Diagram

Accounts Service
        |
        v
   Event Bus
        |
        v
Transactions Service
        |
        v
      Events
        |
        v
     AI Service

---

## Architectural Patterns

### Hexagonal Architecture

Each service follows:

domain
application
infrastructure

Domain contains business rules.

Application contains commands, queries and handlers.

Infrastructure contains adapters (REST, messaging, database).

---

### CQRS

Commands modify state.

Queries read state.

Each use case has:

- command/query class
- handler class