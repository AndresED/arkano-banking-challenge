# Event Bus Conventions

## Kafka Topics

Topics used in the system:

account-events
transaction-events

## Producers

accounts-service publishes:

- ClientCreated
- AccountCreated
- BalanceUpdated

transactions-service publishes:

- TransactionRequested
- TransactionCompleted
- TransactionRejected

## Consumers

transactions-service consumes:

- AccountCreated
- BalanceUpdated

ai-service consumes:

- TransactionCompleted
- TransactionRejected

## Partition Key

Kafka messages should use a partition key to preserve order.

Recommended key:

accountId

This ensures that events for the same account are processed in order.