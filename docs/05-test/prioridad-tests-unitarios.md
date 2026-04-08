# Prioridad de tests unitarios (contexto bancario + bus de eventos)

Este documento cruza los [**requerimientos**](../01-requerimientos/requerimientos.md) con lo que **debe** cubrirse con tests unitarios primero, por **riesgo** y por **obligación explícita** del enunciado (“Test unitarios y e2e”).

## Estado actual (breve)

Hay **tests unitarios** amplios en los tres servicios: handlers de cuenta en accounts, `TransactionCompletedApplierService`, en transactions `TransactionExecuteService` (incl. transfer), handlers HTTP-path, `AccountEventApplierService`; en ai envelope, `AiTransactionEventApplierService`, `ExplanationsService`, mock/orquestador/Ollama mockeado.

Queda **opcional** P2: `OutboxPublisherService` (mock Kafka), e2e multi-servicio, y un spec explícito del **bucle DLQ** del consumidor AI (la persistencia feliz está en el applier).

Los **e2e** siguen **mínimos** y detrás de `RUN_E2E=1` (requieren Docker + `.env`): accounts incluye creación de cuenta + GET saldo; ai incluye 404 del resumen por cuenta. Detalle: [tests-por-microservicio.md](./tests-por-microservicio.md).

---

## Criterio de prioridad (app bancaria)

1. **Dinero y estados:** cualquier error puede generar saldos incorrectos, doble gasto percibido o estados de transacción incoherentes.
2. **Idempotencia en el bus:** Kafka puede reenviar mensajes; procesar dos veces un mismo evento es un riesgo operacional alto.
3. **Contrato de mensajes:** envelope inválido o payload mal tipado no debe tumbar consumidores de forma silenciosa incorrecta.
4. **Infraestructura “alambre” (Kafka real, Postgres real):** mejor **tests de integración** o **e2e**; los unitarios deben centrarse en **lógica** y **orquestación con dependencias mockeadas**.

---

## Matriz: requerimiento → prioridad de tests unitarios

Leyenda: **P0** = hacer primero, **P1** = siguiente oleada, **P2** = deseable / integración.

### Microservicio clientes y cuentas

| Requerimiento | Riesgo | Prioridad | Qué testear (unitario) |
|---------------|--------|-----------|-------------------------|
| Registrar clientes / crear cuentas / consultar saldo | Medio (integridad de datos) | **P1** | Handlers CQRS con repositorios **mockeados**: creación persiste entidades y escribe **outbox** en la misma unidad lógica (o verificar llamadas a `transaction` si extraes un servicio de aplicación). |
| Una cuenta pertenece a un cliente | Alto (modelo incorrecto) | **P1** | Crear cuenta con `clientId` inexistente → `NotFoundException`; existente → OK. |
| Saldo no puede ser negativo | **Muy alto** | **P0** | Lógica que aplica `TransactionCompleted` (o reglas puras extraídas): si `nuevoSaldo < 0` → no aplicar / marcar según diseño. |
| Eventos ClientCreated / AccountCreated / BalanceUpdated | Medio (desacople) | **P1** | Verificar **forma del envelope** (`eventId`, `eventType`, `payload`) al construir filas de outbox (snapshots de strings JSON o builders testeados). |

### Microservicio transacciones

| Requerimiento | Riesgo | Prioridad | Qué testear (unitario) |
|---------------|--------|-----------|-------------------------|
| Depósito / retiro / transferencia | **Muy alto** | **P0** | `TransactionExecuteService` (o núcleo extraído) con **DataSource mockeado**: caminos felices y `Unknown account`, `Insufficient balance`. |
| Validar existencia de cuentas (snapshot) | Alto | **P0** | Mismo bloque: snapshot `null` → rechazo. |
| Validar fondos suficientes | **Muy alto** | **P0** | Retiro/transfer con `balance < amount` → `rejected` + outbox `TransactionRejected`. |
| Evitar ejecución duplicada | **Muy alto** | **P0** | Si `processed_events` ya tiene `eventId` → no modificar transacción ni publicar de nuevo efectos duplicados. |
| Estados pending / completed / rejected | Alto | **P0** | Transacción no `pending` al llegar evento → solo marcar evento procesado, sin doble negocio. |
| Flujo basado en eventos (no síncrono) | Contrato HTTP | **P1** | Handler de `POST /transactions`: persiste `pending` + outbox (mocks), no “completa” en el mismo request. |
| Monto inválido (≤ 0, NaN) | Alto | **P0** | Rechazo con motivo claro. |

### Bus de servicios (Kafka / Redpanda)

| Requerimiento | Riesgo | Prioridad | Qué testear (unitario) |
|---------------|--------|-----------|-------------------------|
| Publicación / consumo | Integración con broker | **P2** | Unitario: **no** Kafka real; mockear `producer.send` / `consumer.run`. Integración: contenedor Testcontainers (otra tarea). |
| Procesamiento idempotente | **Muy alto** | **P0** | Tabla `processed_events`: “ya visto” → early return. Mismo criterio en **accounts** al consumir `TransactionCompleted` y en **ai** antes de explicar. |
| Reintentos / DLQ | Medio-alto | **P1** | **AI:** lógica “3 intentos luego DLQ” con dependencias mockeadas (sin esperar tiempos reales). |

### Contrato de mensajes (todas las apps)

| Tema | Prioridad | Qué testear |
|------|-----------|-------------|
| `parseEnvelope` / JSON inválido / campos obligatorios | **P0** | Unitarios sobre función pura: válido, falta `eventId`, JSON corrupto. |
| Versión / `eventType` | **P1** | Evolución de esquema (cuando exista). |

### Microservicio IA (LLM)

| Requerimiento | Prioridad | Qué testear |
|---------------|-----------|-------------|
| Explicar transacción (mock) | **P1** (ya hay tests) | Ampliar casos: `TransactionRejected` con distintos `reason`, transferencias con múltiples eventos si el modelo de datos lo permite. |
| No lógica bancaria | Medio | Test de humo: el servicio no llama a repositorios de saldo (arquitectura). |

---

## Orden recomendado de implementación (unitarios)

1. **P0 – Transacciones:** `TransactionExecuteService` (deposit / withdraw / transfer / reject / idempotencia / amount inválido / txn no pending).
2. **P0 – Envelope:** `parseEnvelope` (en cada servicio o módulo compartido futuro).
3. **P0 – Accounts:** aplicación de `TransactionCompleted` sin romper saldo (mocks) + idempotencia + leg duplicado.
4. **P1 – AI:** política reintentos + DLQ (mocks de Kafka + persistencia).
5. **P1 – Handlers HTTP + outbox:** comandos que solo orquestan persistencia y outbox.
6. **P2 – Outbox publisher:** polling con `KafkaService` mockeado (integración fina).

Los **e2e** siguen siendo necesarios para cablear Nest + TypeORM + Kafka real; no sustituyen los P0 anteriores.

---

## Qué queda fuera de “unitario” (pero sí de test)

- Conexión real a **Redpanda** / **Postgres**: integración o e2e.
- **Orden global** entre particiones: difícil de unitarizar; contratos y e2e.
- **UI / Postman**: manuales o Newman.

---

## Referencias en el repo

- Guía Postman: [pruebas-con-postman.md](./pruebas-con-postman.md)
- Colección: [`../../postman/`](../../postman/README.md)
- Cumplimiento funcional vs código: [../07-team/infraestructura-implementada-y-cumplimiento-requerimientos.md](../07-team/infraestructura-implementada-y-cumplimiento-requerimientos.md)

---

## Tests unitarios ya añadidos en el repo (referencia)

| Servicio | Archivo | Cobertura orientativa |
|----------|---------|------------------------|
| `accounts-service` | `src/common/events/event-envelope.spec.ts` | Contrato `parseEnvelope` (P0 bus). |
| `accounts-service` | `src/modules/accounts/application/commands/create-client.handler.spec.ts` | Registro de cliente + outbox `ClientCreated` (P1 cuentas). |
| `transactions-service` | `src/common/events/event-envelope.spec.ts` | Contrato `parseEnvelope` (P0 bus). |
| `transactions-service` | `src/infrastructure/kafka/transaction-execute.service.spec.ts` | Idempotencia, depósito feliz, rechazo por fondos, monto inválido, transacción no pending (P0 dinero / estados). |
| `ai-service` | `src/infrastructure/kafka/mock-llm.service.spec.ts` | Textos del mock LLM. |
| `ai-service` | `src/infrastructure/kafka/llm-orchestrator.service.spec.ts` | Selección mock vs Ollama según `USE_OLLAMA`. |

Pendientes de alta prioridad según esta guía: **accounts** (saldo / `TransactionCompleted`), **ai** (reintentos + DLQ con mocks), más casos de **transfer** en `TransactionExecuteService`.

---

*Documento vivo: al añadir tests, actualiza la tabla anterior.*
