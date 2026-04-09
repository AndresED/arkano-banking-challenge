# ai-service (Arkano)

Microservicio **NestJS**: consume `transaction-events` (`TransactionCompleted` / `TransactionRejected`), genera explicaciones con **LLM mock** u **Ollama** (opcional), persiste `transaction_explanations`, **idempotencia** con `processed_events`, **reintentos** y **DLQ** (`transaction-events-dlq`).

## Arranque local

1. Infraestructura y variables: [README raíz](../../README.md) y [`.env.example`](./.env.example).
2. Puerto por defecto: **3003** (`PORT` en `.env`).
3. Ollama: [docs/07-team/guia-ollama-local.md](../../docs/07-team/guia-ollama-local.md).

```bash
npm install
npm run start:dev
```

## Documentación

| Recurso | Enlace |
|---------|--------|
| Detalle técnico del servicio | [docs/04-services/ai/ai-service.md](../../docs/04-services/ai/ai-service.md) |
| Retry + DLQ (con código) | [docs/07-team/fundamentos-teoricos/5. Manejo de errores (Retry + DLQ).md](../../docs/07-team/fundamentos-teoricos/5.%20Manejo%20de%20errores%20%28Retry%20%2B%20DLQ%29.md) |
| Índice fundamentos | [docs/07-team/README.md](../../docs/07-team/README.md) |

## Tests

```bash
npm test
```

---

Base generada con el CLI de NestJS; el contenido anterior del starter está sustituido por esta guía del monorepo **Arkano**.
