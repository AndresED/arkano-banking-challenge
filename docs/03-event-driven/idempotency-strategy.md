# Idempotency Strategy

## Goal

Ensure that processing the same event multiple times does not produce inconsistent results.

Kafka can sometimes deliver duplicate messages, so consumers must handle duplicates safely.

## Strategy

Each service that consumes events should maintain a table:

processed_events

Example structure:

processed_events

event_id
processed_at

## Processing Flow

1 Receive event from Kafka

2 Check if eventId exists in processed_events

3 If event exists
   Ignore the event

4 If event does not exist
   Process event
   Insert eventId into processed_events

## Benefits

This guarantees that the same event will not be processed twice.