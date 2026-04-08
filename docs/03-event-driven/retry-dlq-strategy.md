# Retry and Dead Letter Strategy

## Retries

If event processing fails, the consumer should retry.

Recommended policy:

maxRetries: 3

Each retry should wait a short delay before reprocessing.

## Dead Letter Topic

If processing still fails after retries, the event should be sent to a Dead Letter Topic.

Example:

transaction-events-dlq

## Purpose

Dead letter topics allow:

- inspection of failed events
- debugging integration problems
- reprocessing events later if needed

## Simplified Flow

Receive event
      |
      v
Process event
      |
      v
Success?
   /     Yes       No
 |        |
Done    Retry
            |
       Max retries?
        /            No        Yes
      |          |
    Retry      Send to DLQ