# transactions-service (Arkano)

Microservicio **NestJS**: solicitud y ciclo de vida de transacciones (**CQRS**), **snapshots** de cuentas leyendo `account-events`, ejecución asíncrona vía `TransactionRequested` / `TransactionExecuteService`, **outbox** hacia `transaction-events` (`TransactionCompleted`, `TransactionRejected`).

## Arranque local

1. Infraestructura y variables: [README raíz](../../README.md) y [`.env.example`](./.env.example).
2. Puerto por defecto: **3002** (`PORT` en `.env`).

```bash
npm install
npm run start:dev
```

## Documentación

| Recurso | Enlace |
|---------|--------|
| Detalle técnico del servicio | [docs/04-services/transactions/transactions-service.md](../../docs/04-services/transactions/transactions-service.md) |
| Índice fundamentos (Kafka, idempotencia, outbox, flujo…) | [docs/07-team/README.md](../../docs/07-team/README.md) |
| Guía endpoints paso a paso | [docs/05-test/guia-endpoints-paso-a-paso.md](../../docs/05-test/guia-endpoints-paso-a-paso.md) |

## Tests

```bash
npm test
npm run test:e2e   # opcional; ver docs/05-test
```

---

Base generada con el CLI de NestJS; el contenido anterior del starter está sustituido por esta guía del monorepo **Arkano**.
