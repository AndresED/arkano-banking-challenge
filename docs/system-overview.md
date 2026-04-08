# System Overview

## Purpose

This project implements a simplified banking platform using **microservices and event‑driven architecture**.

The platform supports:

- Client and account management
- Financial transactions
- AI explanations of financial events

The system is designed to be **simple, decoupled, and scalable**, following modern backend architecture practices.

---

# High Level Architecture

The system is composed of three microservices communicating through **Apache Kafka**.

Services:

- accounts-service
- transactions-service
- ai-service

Communication happens through **Kafka topics**.

---

# Architecture Diagram

            +-------------------+
            |       Kafka       |
            |   Event Broker    |
            +-------------------+
                 ↑          ↑
                 |          |
      account-events    transaction-events
                 |          |
                 |          |
        +----------------+  |
        | Accounts       |  |
        | Service        |  |
        +----------------+  |
                            |
                            v
                  +---------------------+
                  | Transactions        |
                  | Service             |
                  +---------------------+
                            |
                            v
                  +---------------------+
                  | AI Service (LLM)    |
                  +---------------------+

---

# Event Driven Flow

1. **Accounts Service**
   - Creates clients and accounts
   - Publishes account events

2. **Transactions Service**
   - Executes financial transactions
   - Consumes account events
   - Publishes transaction events

3. **AI Service**
   - Consumes transaction events
   - Generates natural language explanations

---

# Event Communication

All services communicate asynchronously through Kafka.

Topics:

- account-events
- transaction-events

This approach ensures:

- loose coupling
- independent scaling
- fault tolerance

---

# Reliability Strategies

The system includes basic reliability patterns:

### Idempotent Consumers

Each consumer tracks processed events using:

processed_events table

This prevents duplicate processing.

### Retry Strategy

Consumers retry failed processing up to **3 times**.

### Dead Letter Topics

If retries fail, the message is sent to a **DLQ topic** for inspection.

### Outbox Pattern

Services publish events using the **Outbox Pattern** to avoid inconsistencies between the database and Kafka.

---

# Simplicity Goal

The solution intentionally focuses on:

- clear architecture
- reliable event processing
- minimal complexity

This keeps the system understandable while meeting the requirements of the technical challenge.