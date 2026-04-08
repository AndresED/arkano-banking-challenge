# Outbox Pattern

## Problem

When a service updates its database and publishes an event to Kafka, a failure can occur.

Example:

1 Database transaction succeeds
2 Kafka publish fails

This creates inconsistent state.

## Solution

Use the **Outbox Pattern**.

## Outbox Table

outbox_events

id
event_type
payload
created_at
published

## Flow

1 Service performs a database transaction
2 The business data is saved
3 An event is inserted into outbox_events
4 Transaction commits

A background worker reads outbox_events and publishes the event to Kafka.

After publishing, the record is marked as published.

## Benefit

Ensures consistency between the database and Kafka.