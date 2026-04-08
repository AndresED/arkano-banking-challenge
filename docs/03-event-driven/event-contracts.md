# Event Contracts

This document defines the events exchanged between microservices.

---

## ClientCreated

Published by:

Accounts Service

Payload:

{
  clientId: string
  name: string
  email: string
}

---

## AccountCreated

Published by:

Accounts Service

Payload:

{
  accountId: string
  clientId: string
  balance: number
}

---

## BalanceUpdated

Published by:

Accounts Service

Payload:

{
  accountId: string
  newBalance: number
}

---

## TransactionRequested

Published by:

Transactions Service

Payload:

{
  transactionId: string
  type: "deposit | withdrawal | transfer"
  amount: number
  sourceAccountId?: string
  targetAccountId?: string
}

---

## TransactionCompleted

Published by:

Transactions Service

Payload:

{
  transactionId: string
  amount: number
  accountId: string
}

---

## TransactionRejected

Published by:

Transactions Service

Payload:

{
  transactionId: string
  reason: string
}