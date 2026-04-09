# accounts-service (Arkano)

Microservicio **NestJS**: clientes, cuentas, **saldo autoritativo**, patrón **outbox** hacia el topic `account-events`, consumo de `TransactionCompleted` desde `transaction-events` y publicación de `BalanceUpdated`.

## Arranque local

1. Infraestructura y variables: [README raíz](../../README.md) y [`.env.example`](./.env.example).
2. Puerto por defecto: **3001** (`PORT` en `.env`).

```bash
npm install
npm run start:dev
```

## Documentación

| Recurso | Enlace |
|---------|--------|
| Detalle técnico del servicio | [docs/04-services/accounts/accounts-service.md](../../docs/04-services/accounts/accounts-service.md) |
| Índice fundamentos (EDA, outbox, hexagonal, flujo…) | [docs/07-team/README.md](../../docs/07-team/README.md) |
| Infra y troubleshooting | [docs/07-team/infraestructura-implementada-y-cumplimiento-requerimientos.md](../../docs/07-team/infraestructura-implementada-y-cumplimiento-requerimientos.md) |

## Tests

```bash
npm test
npm run test:e2e   # opcional; ver docs/05-test
```

---

Base generada con el CLI de NestJS; el contenido anterior del starter está sustituido por esta guía del monorepo **Arkano**.
