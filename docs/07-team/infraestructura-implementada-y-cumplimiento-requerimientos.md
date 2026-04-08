# Infraestructura implementada y cumplimiento de requerimientos

Este documento está pensado para **alguien que entra al proyecto sin contexto** y necesita en **unas pocas horas** entender la infraestructura, cómo se cumple lo pedido en [`01-requerimientos/requerimientos.md`](../01-requerimientos/requerimientos.md) y por dónde empezar si debe **mantener o extender** el sistema.

---

## 1. Qué es este proyecto en una frase

Tres **microservicios NestJS (TypeScript)** con **PostgreSQL cada uno** y un **bus de eventos compatible con Kafka** (en local: **Redpanda**), que modelan una plataforma bancaria mínima: clientes, cuentas, transacciones asíncronas y explicaciones en lenguaje natural (**mock** o **Ollama** local; ver [guia-ollama-local.md](./guia-ollama-local.md)).

---

## 2. Mapa del repositorio (dónde está cada cosa)

| Ruta | Qué contiene |
|------|----------------|
| `docker-compose.yml` | Orquestación local: Postgres + broker Kafka-compatible (Redpanda). |
| `docker/init-db.sql` | Script que crea las **tres bases de datos** al iniciar Postgres por primera vez. |
| `services/accounts-service/` | Microservicio de clientes y cuentas (HTTP + Kafka productor/consumidor). |
| `services/transactions-service/` | Microservicio de transacciones (HTTP + Kafka productor/consumidor). |
| `services/ai-service/` | Microservicio de “LLM” (solo consumo de eventos + HTTP para leer explicaciones). |
| `docs/` | Documentación: ver [`README.md`](../README.md) (índice). Carpetas `01-requerimientos` … `07-team` (esta guía y onboarding). |

Cada servicio es un **proyecto Node independiente** (tiene su propio `package.json`). No hay monorepo con workspaces obligatorio: trabajas **carpeta por carpeta**.

---

## 3. Infraestructura Docker (qué levanta y para qué sirve)

### 3.1 PostgreSQL

- **Imagen:** `postgres:16-alpine`
- **Puerto en el host:** `5432`
- **Usuario / contraseña:** `bank` / `bank` (definidos en `docker-compose.yml`)
- **Bases creadas** (ver `docker/init-db.sql`):
  - `accounts` → la usa **solo** `accounts-service`
  - `transactions` → la usa **solo** `transactions-service`
  - `ai` → la usa **solo** `ai-service`

Cumple el requisito de **“cada microservicio con su propia base de datos”**: son tres bases físicas en el mismo servidor Postgres (patrón habitual en desarrollo; en producción podrían ser instancias separadas).

**Persistencia:** el volumen `postgres_data` conserva datos entre reinicios de contenedor.

### 3.2 Bus de eventos (Kafka-compatible: Redpanda)

- **Imagen:** `docker.redpanda.com/redpandadata/redpanda:v24.2.4`
- **Motivo:** API **compatible con clientes Kafka** (por ejemplo **KafkaJS** en Node), más simple de levantar en un solo contenedor para desarrollo.
- **Puerto en el host para tus apps (Nest corriendo en la máquina, no dentro de Docker):** `19092`
  - Variable típica: `KAFKA_BROKERS=localhost:19092`
- **Dentro de la red Docker**, el broker se anuncia como `kafka:9092` (por si más adelante contenedorizas los servicios).

Los servicios Nest **crean topics al arrancar** si no existen (vía cliente admin de KafkaJS): `account-events`, `transaction-events`, `transaction-events-dlq` (y duplicados idempotentes si ya existen).

### 3.3 Cómo levantar la infraestructura

En la **raíz del repo**:

```bash
docker compose up -d
```

Comprueba que los contenedores estén saludables (`docker compose ps`). Sin esto, los tres Nest fallarán al conectar a BD o a Kafka.

---

## 4. Los tres microservicios (puertos, responsabilidad, tecnología)

| Servicio | Puerto por defecto | Base de datos | Librerías clave |
|----------|-------------------|---------------|-----------------|
| `accounts-service` | `3001` | `accounts` | NestJS, TypeORM, PostgreSQL, `@nestjs/cqrs`, KafkaJS |
| `transactions-service` | `3002` | `transactions` | Igual |
| `ai-service` | `3003` | `ai` | NestJS, TypeORM, PostgreSQL, KafkaJS (sin CQRS obligatorio en el módulo de explicaciones) |

### 4.1 Variables de entorno (obligatorias en cada servicio)

En cada carpeta `services/*/` existe `.env.example`. Copia a `.env`:

- **`DATABASE_URL`**: URL de conexión a la BD **correspondiente** a ese servicio (ver ejemplo).
- **`KAFKA_BROKERS`**: `localhost:19092` cuando Nest corre en el host y Docker expone Redpanda ahí.
- **`PORT`**: opcional; si no se define, el código usa 3001 / 3002 / 3003 según el servicio.

### 4.2 Orden recomendado al arrancar en local

1. `docker compose up -d`
2. Terminal 1: `cd services/accounts-service && npm run start:dev`
3. Terminal 2: `cd services/transactions-service && npm run start:dev`
4. Terminal 3: `cd services/ai-service && npm run start:dev`

El orden ayuda a que existan topics y a que los consumidores estén listos antes de probar flujos largos; no es un requisito estricto del broker.

---

## 5. Contrato HTTP mínimo (qué endpoint tocar para qué)

### 5.1 Accounts (`http://localhost:3001`)

| Método y ruta | Requerimiento que satisface |
|----------------|----------------------------|
| `POST /clients` `{ name, email }` | Registrar clientes |
| `POST /accounts` `{ clientId }` | Crear cuenta bancaria asociada a un cliente |
| `GET /accounts/:id` | Consultar cuenta y **saldo** |

Respuestas envueltas en el formato común (`success`, `data`, `statusCode`, `timestamp`) por interceptor global.

### 5.2 Transactions (`http://localhost:3002`)

| Método y ruta | Comportamiento |
|----------------|----------------|
| `POST /transactions` | **202 Accepted**: registra la transacción en estado **pending** y encola publicación de `TransactionRequested` (vía outbox). Cuerpo: `type` (`deposit` \| `withdrawal` \| `transfer`), `amount`, y cuentas según el tipo. |
| `GET /transactions/:id` | Devuelve estado: `pending`, `completed`, `rejected` y motivo si aplica. |

**Importante:** el POST **no** devuelve el resultado final de la operación financiera: eso ocurre **después**, vía eventos y un consumidor interno.

### 5.3 AI (`http://localhost:3003`)

| Método y ruta | Comportamiento |
|----------------|----------------|
| `GET /explanations/:transactionId` | Explicaciones guardadas tras `TransactionCompleted` / `TransactionRejected` (texto mock u Ollama según `USE_OLLAMA`). |
| `GET /explanations/account/:accountId/summary` | Resumen del historial reciente para esa cuenta (datos de `TransactionCompleted` con `accountId`). |

---

## 6. Eventos Kafka: topics, flujo y quién publica/qué consume

### 6.1 Topics

| Topic | Contenido típico |
|-------|-------------------|
| `account-events` | `ClientCreated`, `AccountCreated`, `BalanceUpdated` |
| `transaction-events` | `TransactionRequested`, `TransactionCompleted`, `TransactionRejected` |
| `transaction-events-dlq` | Mensajes que el **ai-service** no pudo procesar tras reintentos |

### 6.2 Formato del mensaje (sobre / envelope)

Todos los mensajes JSON publicados siguen la idea de `event-envelope.md`:

- `eventId`, `eventType`, `source`, `occurredAt`, `version`, `payload`

El `eventId` es la base de la **idempotencia** en consumidores.

### 6.3 Flujo principal (lectura rápida)

1. **Accounts** guarda negocio + fila en **outbox** → un job periódico publica a `account-events`.
2. **Transactions** consume `account-events` y mantiene **snapshots** de cuentas (`account_snapshots`) para validar sin llamar HTTP a Accounts.
3. Cliente llama `POST /transactions` → **Transactions** guarda `pending` + outbox `TransactionRequested` → se publica a `transaction-events`.
4. Un **consumidor dentro del mismo transactions-service** (grupo `transactions-service-requested-processor`) lee `TransactionRequested`, ejecuta reglas, actualiza snapshots y encola `TransactionCompleted` o `TransactionRejected`.
5. **Accounts** consume `TransactionCompleted` y actualiza el saldo autoritativo en su tabla `accounts`, y genera outbox `BalanceUpdated` → otra vez `account-events`.
6. **Transactions** puede recibir `BalanceUpdated` y alinear el snapshot (consistencia eventual).
7. **AI** consume `TransactionCompleted` y `TransactionRejected` de `transaction-events`, genera texto con **`LlmOrchestratorService`** (mock u **Ollama**), guarda en `transaction_explanations` (con `account_id` cuando aplica).

### 6.4 Partition keys

Donde aplica, las claves de partición usan **`accountId`** (alineado con la guía de particionado) para orden por cuenta.

---

## 7. Cumplimiento explícito frente a `requerimientos.md`

La siguiente tabla relaciona **cada exigencia del documento de requerimientos** con **cómo está hecho en código** y **dónde mirar**.

### 7.1 Arquitectura general

| Requerimiento | Implementación |
|---------------|----------------|
| Tres microservicios independientes | Carpetas `services/accounts-service`, `services/transactions-service`, `services/ai-service`, cada una con app Nest propia. |
| Bus de servicios event-driven | Redpanda (Kafka-compatible) + KafkaJS; topics `account-events` y `transaction-events`. |
| Cada uno con su propia BD | Tres bases Postgres: `accounts`, `transactions`, `ai`. |
| Autonomía / publicar y consumir | Cada servicio tiene su módulo de persistencia y clases Kafka (productor/consumidor) según su rol (ver sección 6). |
| Node.js + TypeScript | Todo el código de servicios es TypeScript compilado con Nest. |
| Hexagonal + CQRS | En **accounts** y **transactions**: comandos/consultas con `@nestjs/cqrs`, controladores delgados; persistencia y Kafka en infraestructura. **AI** es más simple (servicio + consumidor). |
| Variables de entorno | `ConfigModule` + `.env` / `.env.example` por servicio. |
| Manejo de errores | `ValidationPipe` global, filtro de excepciones global, respuestas de error unificadas. |
| Tests unitarios y e2e | Hay tests unitarios de ejemplo (p. ej. mock LLM en `ai-service`). E2E opcionales con `RUN_E2E=1` cuando hay Docker y `.env` (ver README raíz). |
| README técnico | `README.md` en la raíz del repo (entrada principal) + esta guía en `docs/`. |

### 7.2 Microservicio clientes y cuentas

| Requerimiento | Implementación |
|---------------|----------------|
| Registrar clientes | `POST /clients` → handler CQRS crea fila `clients` + outbox `ClientCreated`. |
| Crear cuentas | `POST /accounts` → valida cliente, crea `accounts` con saldo 0 + outbox `AccountCreated`. |
| Consultar cuentas y saldo | `GET /accounts/:id` → query handler lee `accounts`. |
| Una cuenta pertenece a un cliente | Columna `client_id` en entidad `accounts` y validación en creación. |
| Saldo no negativo | Al aplicar `TransactionCompleted`, si el saldo resultante fuera negativo, no se aplica el débito y se registra el evento como procesado (caso anómalo; la validación fuerte está en transacciones). |
| Eventos `ClientCreated`, `AccountCreated`, `BalanceUpdated` | Publicados vía **outbox** + `OutboxPublisherService` hacia `account-events`. `BalanceUpdated` se emite cuando Accounts aplica un `TransactionCompleted`. |

### 7.3 Microservicio transacciones

| Requerimiento | Implementación |
|---------------|----------------|
| Depósito, retiro, transferencia | `POST /transactions` con `type` y cuentas según tipo; procesamiento en `TransactionExecuteService` al consumir `TransactionRequested`. |
| Validar existencia de cuentas | Se valida contra `account_snapshots` poblados por eventos `AccountCreated` / `BalanceUpdated`. |
| Validar fondos | Comparación de saldo en snapshot antes de retiro/transferencia. |
| Evitar ejecución duplicada | **Idempotencia por `eventId`** en `processed_events` al consumir `TransactionRequested`. Además, si la transacción ya no está `pending`, el procesador no vuelve a ejecutar el flujo. |
| Estados pending / completed / rejected | Columna `status` en tabla `transactions`; el POST deja `pending`; el consumidor actualiza a `completed` o `rejected`. |
| No resolver de forma síncrona | HTTP **202** + resultado final vía eventos y `GET /transactions/:id`. |
| Eventos `TransactionRequested`, `TransactionCompleted`, `TransactionRejected` | Los tres se publican (vía outbox) en `transaction-events`. |

### 7.4 Microservicio IA (LLM)

| Requerimiento | Implementación |
|---------------|----------------|
| No ejecuta lógica bancaria | Solo persiste explicaciones y escucha eventos; no modifica cuentas ni montos de negocio. |
| Explicar transacción (obligatorio) | `LlmOrchestratorService`: texto vía **mock** (español) u **Ollama** (`USE_OLLAMA=true`); se guarda en `transaction_explanations` con `account_id` si el evento lo trae. |
| Consumir `TransactionCompleted` y `TransactionRejected` | Consumidor en `ai-service` filtra esos `eventType`. |
| Mock o LLM local | Mock por defecto; **Ollama** en [guia-ollama-local.md](./guia-ollama-local.md). |
| Resumir historial por cuenta | `GET /explanations/account/:accountId/summary` usa movimientos indexados por `account_id` y el mismo orquestador LLM. |
| Traducir eventos a lenguaje claro | Prompts orientados al usuario (Ollama) o plantillas (mock). |

### 7.5 Bus de servicios: publicación, consumo, idempotencia, fallos

| Requerimiento | Implementación |
|---------------|----------------|
| Publicación y consumo | Productores KafkaJS en servicios que publican; consumidores con `consumer.run` en accounts, transactions y ai. |
| Procesamiento idempotente | Tabla `processed_events` en cada BD donde hay consumo; en accounts además `applied_transaction_legs` para pies de `TransactionCompleted` (misma transacción, dos cuentas en transferencia). |
| Reintentos y fallos | En **ai-service**: hasta **3 intentos** con espera incremental; si falla, envío a **`transaction-events-dlq`** y se marca el `eventId` en `processed_events` para no reprocesar en bucle (mensaje queda en DLQ para inspección). |

### 7.6 Patrón Outbox (coherencia BD + Kafka)

| Requerimiento | Implementación |
|---------------|----------------|
| Evitar inconsistencia si falla Kafka tras commit en BD | Tabla `outbox_events` en **accounts** y **transactions**; el negocio escribe en la misma transacción SQL que el outbox; un servicio `OutboxPublisherService` hace polling y publica marcas `published`. |

---

## 8. Flujo de prueba manual (copy-paste mental)

1. Crear cliente → anotar `clientId`.
2. Crear cuenta → anotar `accountId`.
3. Esperar un momento a que **transactions** sincronice el snapshot (evento `AccountCreated`).
4. `POST /transactions` depósito hacia `targetAccountId` → anotar `transactionId`.
5. Polling `GET /transactions/:id` hasta `completed` (o `rejected`).
6. `GET /accounts/:id` en accounts para ver saldo alineado tras `TransactionCompleted` + `BalanceUpdated`.
7. `GET /explanations/:transactionId` en AI para ver el texto mock.

Si el paso 3 falla (siempre `rejected` por cuenta desconocida), suele ser que **transactions-service** arrancó tarde o el consumidor no leyó aún `account-events`: revisa logs y que Kafka esté arriba.

---

## 9. Cómo añadir un feature nuevo (checklist práctico)

1. **¿Es HTTP nuevo?** Añade DTO + command/query + handler + ruta en el controlador del servicio que posee el dato.
2. **¿Afecta a otro servicio?** No llames HTTP entre servicios: define **evento** en el contrato (`event-contracts.md`) y publica vía **outbox** si hay escritura en BD.
3. **¿Nuevo consumidor?** Crea grupo de consumo nuevo (`groupId`), filtra `eventType`, implementa idempotencia con `processed_events`.
4. **¿Nuevo topic?** Añádelo en el `createTopics` del `KafkaService` del servicio que primero lo necesite y documenta el contrato.
5. **¿Migraciones?** Hoy se usa `synchronize: true` (solo desarrollo); en producción conviene migraciones TypeORM (ver convenciones en `02-convenciones/`).

---

## 10. Troubleshooting rápido

| Síntoma | Qué revisar |
|---------|-------------|
| Nest no arranca por BD | `docker compose ps`, `DATABASE_URL`, que existan las tres bases. |
| Nest no arranca por Kafka | `KAFKA_BROKERS=localhost:19092`, contenedor Redpanda arriba. |
| Transacción siempre rechazada “Unknown account” | Que `transactions-service` esté consumiendo `account-events` y que la cuenta se haya creado antes. |
| AI devuelve 404 en explicaciones | Que el evento haya sido consumido; revisa logs del `ai-service`. |
| Mensajes en DLQ | Inspeccionar topic `transaction-events-dlq` con herramientas Kafka/Redpanda; corregir causa y reprocesar manualmente si aplica. |

---

## 11. Documentación relacionada

- Requerimientos originales: [`01-requerimientos/requerimientos.md`](../01-requerimientos/requerimientos.md)
- Pruebas con Postman: [`05-test/pruebas-con-postman.md`](../05-test/pruebas-con-postman.md)
- Contratos de eventos: [`03-event-driven/event-contracts.md`](../03-event-driven/event-contracts.md)
- Envelope: [`03-event-driven/event-envelope.md`](../03-event-driven/event-envelope.md)
- Outbox: [`03-event-driven/outbox-pattern.md`](../03-event-driven/outbox-pattern.md)
- Idempotencia y DLQ: [`03-event-driven/idempotency-strategy.md`](../03-event-driven/idempotency-strategy.md), [`03-event-driven/retry-dlq-strategy.md`](../03-event-driven/retry-dlq-strategy.md)
- Convenciones CQRS/hexagonal: [`02-convenciones/hexagonal-cqrs.md`](../02-convenciones/hexagonal-cqrs.md)

---

*Última orientación: si solo tienes dos horas, lee secciones 2–6 y 7, luego haz el flujo de la sección 8 con [Postman](../05-test/pruebas-con-postman.md) o curl.*
