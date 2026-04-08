# Plataforma bancaria (microservicios + eventos)

Proyecto de **tres microservicios** en **NestJS + TypeScript**, con **PostgreSQL** (una base por servicio) y un bus **compatible con Kafka** (**Redpanda** en local, cliente **KafkaJS**). Cubre el reto descrito en [`docs/01-requerimientos/requerimientos.md`](docs/01-requerimientos/requerimientos.md).

---

## Documentación

- **Índice de toda la carpeta `docs/`:** [`docs/README.md`](docs/README.md)
- **Onboarding e infra implementada (español):** [`docs/07-team/infraestructura-implementada-y-cumplimiento-requerimientos.md`](docs/07-team/infraestructura-implementada-y-cumplimiento-requerimientos.md) — Docker, variables, topics, flujos, tabla requerimiento → código, troubleshooting.
- **C4 baseline (requerimientos):** [`docs/01-requerimientos/c4-contexto-y-contenedores-v1.md`](docs/01-requerimientos/c4-contexto-y-contenedores-v1.md)
- **Servicios (detalle técnico + diagramas):** [`docs/04-services/index.md`](docs/04-services/index.md)
- **Endpoints y flujo event-driven (paso a paso):** [`docs/05-test/guia-endpoints-paso-a-paso.md`](docs/05-test/guia-endpoints-paso-a-paso.md)
- **Pruebas con Postman:** [`docs/05-test/pruebas-con-postman.md`](docs/05-test/pruebas-con-postman.md)
- **Colección Postman (importar):** [`postman/arkano-banking.postman_collection.json`](postman/arkano-banking.postman_collection.json) — ver [`postman/README.md`](postman/README.md)
- **Prompt para agentes / extender el repo:** [`docs/06-agents/microservices-repo-prompt.md`](docs/06-agents/microservices-repo-prompt.md)
- **Ollama (LLM local en ai-service):** [`docs/07-team/guia-ollama-local.md`](docs/07-team/guia-ollama-local.md)

---

## Requisitos previos

- **Node.js** (LTS recomendado) y **npm**
- **Docker Desktop** (o Docker Engine) para Postgres + Redpanda

---

## Arranque rápido

### 1. Infraestructura

En la raíz del repositorio:

```bash
docker compose up -d
```

- **PostgreSQL:** `localhost:5432`, usuario `bank`, contraseña `bank`, bases `accounts`, `transactions`, `ai` (creadas por `docker/init-db.sql`).
- **Kafka compatible (Redpanda):** `localhost:19092` para aplicaciones que corren **en tu máquina** (fuera de Docker).

### 2. Variables de entorno por servicio

En cada carpeta:

```bash
cp services/accounts-service/.env.example services/accounts-service/.env
cp services/transactions-service/.env.example services/transactions-service/.env
cp services/ai-service/.env.example services/ai-service/.env
```

Ajusta solo si tus puertos o credenciales difieren.

### 3. Instalar dependencias (primera vez)

```bash
cd services/accounts-service && npm install
cd ../transactions-service && npm install
cd ../ai-service && npm install
```

### 4. Levantar los tres servicios (tres terminales)

```bash
cd services/accounts-service && npm run start:dev
```

```bash
cd services/transactions-service && npm run start:dev
```

```bash
cd services/ai-service && npm run start:dev
```

Puertos por defecto: **3001** (accounts), **3002** (transactions), **3003** (ai).

---

## APIs resumidas

| Servicio | Base URL | Endpoints principales |
|----------|----------|------------------------|
| Accounts | `http://localhost:3001` | `POST /clients`, `POST /accounts`, `GET /accounts/:id` |
| Transactions | `http://localhost:3002` | `POST /transactions` (202), `GET /transactions/:id` |
| AI | `http://localhost:3003` | `GET /explanations/:transactionId`, `GET /explanations/account/:accountId/summary` |

Las respuestas HTTP siguen un envelope común (`success`, `data`, `statusCode`, `timestamp`).

---

## Eventos y topics

| Topic | Uso |
|-------|-----|
| `account-events` | Cliente/cuenta/saldo (vía outbox desde accounts) |
| `transaction-events` | Solicitud y resultado de transacciones |
| `transaction-events-dlq` | Fallos definitivos del consumidor de AI (tras reintentos) |

Detalle en la [guía de infraestructura](docs/07-team/infraestructura-implementada-y-cumplimiento-requerimientos.md).

---

## Tests

Estrategia **por microservicio** (unitarios vs e2e): [`docs/05-test/tests-por-microservicio.md`](docs/05-test/tests-por-microservicio.md).

```bash
# Unitarios en cada servicio
cd services/accounts-service && npm test
cd services/transactions-service && npm test
cd services/ai-service && npm test
```

E2E con infraestructura real (Postgres + Kafka) y variables cargadas:

```bash
cd services/accounts-service
set RUN_E2E=1
npm run test:e2e
```

En Windows PowerShell: `$env:RUN_E2E=1; npm run test:e2e`

---

## Estructura del repositorio

```
docker-compose.yml          # Postgres + Redpanda
docker/init-db.sql          # CREATE DATABASE por servicio
services/
  accounts-service/         # Nest, puerto 3001
  transactions-service/     # Nest, puerto 3002
  ai-service/               # Nest, puerto 3003
docs/
  README.md                 # Índice de documentación
  01-requerimientos/
  02-convenciones/
  03-event-driven/
  04-services/
  05-test/
  06-agents/
  07-team/
  system-overview.md
postman/                    # Colección Postman importable
```

---

## Stack

NestJS, TypeORM, PostgreSQL, KafkaJS, CQRS en accounts/transactions, patrón **outbox**, consumidores **idempotentes**, reintentos + **DLQ** en AI, **LLM** opcional **Ollama** local o **mock** — ver [`docs/07-team/guia-ollama-local.md`](docs/07-team/guia-ollama-local.md).

---

## Licencia

Revisa el campo `license` de cada `package.json` si aplica a tu uso del código.
