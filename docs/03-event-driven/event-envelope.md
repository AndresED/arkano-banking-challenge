# Event Envelope

All events published to Kafka must follow a **standard envelope format**.

This ensures consistency across microservices and simplifies event processing.

---

# Event Structure

{
  "eventId": "uuid",
  "eventType": "TransactionCompleted",
  "source": "transactions-service",
  "occurredAt": "2026-01-01T10:00:00Z",
  "version": 1,
  "payload": {}
}

---

# Field Description

eventId

Unique identifier of the event.  
Used to guarantee **idempotent processing**.

eventType

Name of the event.

Examples:

ClientCreated  
AccountCreated  
TransactionCompleted  

source

The microservice that generated the event.

occurredAt

Timestamp indicating when the event occurred.

version

Event schema version.

payload

Contains the business data related to the event.

---

# Example Event

{
  "eventId": "5c9e3e64-b9c2-4b4d-9b6e-8e0a33c49b2f",
  "eventType": "TransactionCompleted",
  "source": "transactions-service",
  "occurredAt": "2026-01-01T10:00:00Z",
  "version": 1,
  "payload": {
    "transactionId": "t-123",
    "accountId": "a-456",
    "amount": 100
  }
}