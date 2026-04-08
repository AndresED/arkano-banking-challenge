# Kafka Partitioning Strategy

## Purpose

Kafka topics can be divided into **partitions**.

Partitioning allows:

- parallel processing
- scalability
- event ordering within a key

---

# Partition Key

To preserve ordering for financial operations, messages should use:

partition key = accountId

This guarantees that all events related to the same account are processed in order.

---

# Example

Transaction events:

key: accountId
value: TransactionCompleted event

Kafka ensures that events with the same key go to the same partition.

---

# Benefit

Using accountId as the partition key ensures:

- correct transaction ordering
- consistent balance updates
- simpler event processing logic