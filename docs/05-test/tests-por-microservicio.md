# Tests unitarios y e2e por microservicio

Este documento **revisa por servicio** qué capas conviene cubrir con **tests unitarios** (mocks, rápidos, CI sin Docker) y cuáles con **e2e** (Nest + TypeORM + Kafka/Postgres reales o contenedores). Complementa la matriz por riesgo en [prioridad-tests-unitarios.md](./prioridad-tests-unitarios.md).

---

## Criterio rápido

| Tipo | Objetivo | Dependencias |
|------|----------|----------------|
| **Unitario** | Reglas de negocio, idempotencia, construcción de eventos/outbox, ramas `if` | Repositorios, `DataSource`, Kafka y HTTP **mockeados** |
| **E2E** | Contrato HTTP, migraciones/sincronización, consumidor publicando/leyendo topics | Postgres + broker; suele usar `RUN_E2E=1` en este repo |

Los **e2e multi-servicio** (Accounts + Transactions + AI en un solo flujo) no están en el repo; el flujo completo hoy se valida con [Postman](../../postman/README.md) o tests e2e **por servicio**.

---

## 1. `accounts-service` (puerto 3001)

### Capas y responsabilidad

| Capa / componente | Rol |
|-------------------|-----|
| **HTTP** (`AccountsController`) | `POST /clients`, `POST /accounts`, `GET /accounts/:id` |
| **CQRS** (`CreateClientHandler`, `CreateAccountHandler`, `GetAccountByIdHandler`) | Orquestación + transacciones + outbox |
| **Kafka** (`KafkaService`, `OutboxPublisherService`, `TransactionEventsConsumer`) | Topics, publicación periódica, consumo `TransactionCompleted` |
| **Persistencia** | Entidades TypeORM, tablas `clients`, `accounts`, `outbox_events`, `processed_events`, `applied_transaction_legs` |

### Tests unitarios (recomendado)

| Pieza | Prioridad | Qué validar | Estado en repo |
|-------|-----------|-------------|----------------|
| `parseEnvelope` | P0 | JSON válido / inválido | Cubierto (`event-envelope.spec.ts`) |
| `CreateClientHandler` | P1 | Cliente + fila outbox `ClientCreated` | Cubierto (`create-client.handler.spec.ts`) |
| `CreateAccountHandler` | P1 | Cuenta + outbox; cliente inexistente → 404 | Cubierto (`create-account.handler.spec.ts`) |
| `GetAccountByIdHandler` | P1 | Encontrada / no encontrada | Cubierto (`get-account-by-id.handler.spec.ts`) |
| `TransactionCompletedApplierService` (consumidor delega aquí) | P0 | Idempotencia `processed_events`, `applied_transaction_legs`, saldo no negativo, outbox `BalanceUpdated` | Cubierto (`transaction-completed-applier.service.spec.ts`) |
| `OutboxPublisherService` | P2 | Llama a `kafka.send` con payload publicado | **Pendiente** (mock `KafkaService`) |

### Tests e2e (recomendado)

| Escenario | Qué validar | Estado en repo |
|-----------|-------------|----------------|
| `POST /clients` | 201 + envelope HTTP + `clientId` | Cubierto con `RUN_E2E=1` (smoke) |
| `POST /accounts` + `GET /accounts/:id` | 201/200 y saldo | Cubierto con `RUN_E2E=1` |
| Consumo Kafka | Tras `TransactionCompleted` en topic, saldo en BD actualizado | **Pendiente** (requiere broker + otro productor o script) |

**Nota:** Los e2e actuales arrancan `AppModule` completo; sin Docker fallan al conectar BD/Kafka.

---

## 2. `transactions-service` (puerto 3002)

### Capas y responsabilidad

| Capa / componente | Rol |
|-------------------|-----|
| **HTTP** | `POST /transactions` (202), `GET /transactions/:id` |
| **CQRS** | `RequestTransactionHandler`, `GetTransactionByIdHandler` |
| **Kafka** | `AccountEventsConsumer`, `TransactionRequestedConsumer`, `OutboxPublisherService`, `KafkaService` |
| **Dominio async** | `TransactionExecuteService` (reglas depósito/retiro/transferencia + idempotencia) |

### Tests unitarios (recomendado)

| Pieza | Prioridad | Qué validar | Estado en repo |
|-------|-----------|-------------|----------------|
| `parseEnvelope` | P0 | Igual que accounts | Cubierto |
| `TransactionExecuteService` | P0 | Depósito, rechazos, idempotencia, no pending, monto inválido, **transfer** (dos `TransactionCompleted`) | Cubierto (`transaction-execute.service.spec.ts`) |
| `RequestTransactionHandler` | P1 | `pending` + outbox `TransactionRequested`; validación DTO (cuentas requeridas por tipo) | Cubierto (`request-transaction.handler.spec.ts`) |
| `GetTransactionByIdHandler` | P1 | 404 / vista correcta | Cubierto (`get-transaction-by-id.handler.spec.ts`) |
| `AccountEventApplierService` (consumidor delega aquí) | P1 | `AccountCreated` / `BalanceUpdated` → snapshot | Cubierto (`account-event-applier.service.spec.ts`) |
| `TransactionRequestedConsumer` | P2 | Solo wiring; la lógica pesada está en `TransactionExecuteService` | Opcional |

### Tests e2e (recomendado)

| Escenario | Qué validar | Estado en repo |
|-----------|-------------|----------------|
| `POST /transactions` body inválido | 400 | Cubierto con `RUN_E2E=1` |
| Flujo deposit → GET hasta `completed` | Requiere accounts + Kafka + consumer activo | **Pendiente** (ideal integración o mono-e2e orquestado) |

---

## 3. `ai-service` (puerto 3003)

### Capas y responsabilidad

| Capa / componente | Rol |
|-------------------|-----|
| **HTTP** | `GET /explanations/:transactionId`, `GET /explanations/account/:accountId/summary` |
| **Kafka** | `TransactionEventsConsumer` (idempotencia, reintentos, DLQ) |
| **LLM** | `LlmOrchestratorService`, `MockLlmService`, `OllamaLlmService` |
| **Persistencia** | `transaction_explanations`, `processed_events` |

### Tests unitarios (recomendado)

| Pieza | Prioridad | Qué validar | Estado en repo |
|-------|-----------|-------------|----------------|
| `MockLlmService` | P1 | Textos por tipo de evento + `summarizeAccountHistory` | Cubierto |
| `LlmOrchestratorService` | P1 | `USE_OLLAMA` true/false | Cubierto |
| `OllamaLlmService` | P2 | Mockear `fetch` / error HTTP | Cubierto (`ollama-llm.service.spec.ts`) |
| `parseEnvelope` | P0 | Mismo contrato | Cubierto (`src/common/events/event-envelope.spec.ts`) |
| `AiTransactionEventApplierService` (consumidor delega aquí) | P1 | Persiste explicación + `accountId` en `TransactionCompleted`; idempotencia interna | Cubierto (`ai-transaction-event-applier.service.spec.ts`) |
| `ExplanationsService` | P1 | 404 sin datos; resumen con filas mockeadas | Cubierto (`explanations.service.spec.ts`) |

### Tests e2e (recomendado)

| Escenario | Qué validar | Estado en repo |
|-----------|-------------|----------------|
| `GET /explanations/:uuid` sin datos | 404 | Cubierto con `RUN_E2E=1` |
| `GET .../account/:uuid/summary` | 404 sin movimientos | Cubierto con `RUN_E2E=1` (404); 200 con datos sigue siendo manual o e2e con semilla en BD |
| E2E con Ollama | Opcional; suele ser manual o CI con servicio Ollama | No automatizado |

---

## 4. Resumen visual (prioridad de trabajo)

```
                    unitarios P0 / P1              e2e mínimo
accounts-service    TransactionCompleted applier   POST clients + cuenta + GET saldo
transactions-service TransactionExecute (+transfer)  POST inválido
ai-service          applier + ExplanationsService  GET explanations 404 + summary 404
```

DLQ tras reintentos del consumidor AI sigue sin spec dedicado (opcional; lógica en `transaction-events.consumer.ts`).

---

## 5. Cómo ejecutar lo que ya existe

```bash
# Unitarios por servicio
cd services/accounts-service && npm test
cd services/transactions-service && npm test
cd services/ai-service && npm test

# Cobertura
npm run test:cov

# E2E (Postgres + Kafka + .env)
set RUN_E2E=1   # Windows cmd
# PowerShell: $env:RUN_E2E=1
npm run test:e2e
```

---

## Documentos relacionados

- [Prioridad por riesgo (banca + bus)](./prioridad-tests-unitarios.md)
- [Pruebas Postman](./pruebas-con-postman.md)
- [Infra y requerimientos](../07-team/infraestructura-implementada-y-cumplimiento-requerimientos.md)

---

*Actualiza las columnas “Estado en repo” cuando añadas `*.spec.ts` o casos e2e.*
