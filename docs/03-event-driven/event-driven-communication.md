# Event Driven Communication

## Overview

Services communicate **asynchronously through events**.

No service directly calls another service synchronously.

Instead:

1. A service publishes an event.
2. Other services consume that event.
3. Each service reacts independently.

---

## Event Bus

Recommended implementation:

RabbitMQ

Queue model:

Publisher → Exchange → Queue → Consumer

---

## Event Structure

All events follow the same contract.

{
  eventId: string
  eventType: string
  occurredAt: string
  source: string
  payload: object
}

Example:

{
  eventId: "uuid",
  eventType: "TransactionCompleted",
  occurredAt: "2026‑01‑01T10:00:00Z",
  source: "transactions-service",
  payload: {
    transactionId: "uuid",
    amount: 500,
    accountId: "uuid"
  }
}

---

## Idempotency

Consumers must guarantee **idempotent processing**.

Recommended strategy:

Table: processed_events

Fields:

event_id
processed_at

Before processing an event:

1. Check if eventId already exists
2. If exists → ignore
3. If not → process event

---

## Retry Strategy

Consumers must support retries.

Recommended approach:

- Retry up to 3 times
- If still failing → send event to **Dead Letter Queue**

---

## Dead Letter Queue

Used for:

- corrupted events
- repeated processing failures
- debugging integration issues