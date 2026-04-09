# Documentación para el equipo (`docs/07-team`)

Material de **onboarding** y **operación**: cómo está montada la infraestructura y cómo el código satisface los requerimientos del reto. Incluye la serie **fundamentos teóricos** (español), enlazada al código real del monorepo.

---

## Fundamentos teóricos (`fundamentos-teoricos/`)

Guías para entrevistas, onboarding técnico y revisión de diseño. Cada documento mezcla teoría y **referencias a archivos concretos** en `services/`.

| # | Documento | Tema |
|---|-----------|------|
| 1 | [Event-Driven Architecture (EDA)](./fundamentos-teoricos/1.%20Event-Driven%20Architecture%20(EDA).md) | EDA aplicada a la plataforma |
| 2 | [Kafka](./fundamentos-teoricos/2.kafka.md) | Conceptos y uso en el repo |
| 3 | [Idempotencia](./fundamentos-teoricos/3.Idempotencia.md) | `processed_events`, appliers, AI |
| 4 | [Outbox Pattern](./fundamentos-teoricos/4.%20Outbox%20Pattern.md) | Tabla outbox, publicador, handlers |
| 5 | [Manejo de errores (Retry + DLQ)](./fundamentos-teoricos/5.%20Manejo%20de%20errores%20%28Retry%20%2B%20DLQ%29.md) | ai-service vs otros consumidores |
| 6 | [Microservices design](./fundamentos-teoricos/6.%20Microservices%20design.md) | Límites, DB por servicio, topics |
| 7 | [Event design](./fundamentos-teoricos/7.%20Event%20design.md) | Envelope, contratos, particiones |
| 8 | [Hexagonal architecture](./fundamentos-teoricos/8.%20Hexagonal%20architecture.md) | Capas y módulos Nest |
| 9 | [CQRS](./fundamentos-teoricos/9.%20CQRS.md) | CommandBus / QueryBus en el repo |
| 10 | [NestJS microservices](./fundamentos-teoricos/10.%20NestJS%20microservices.md) | Módulos, bootstrap, Kafka en Nest |
| 11 | [Testing](./fundamentos-teoricos/11.%20Testing.md) | Jest, specs por capa |
| 12 | [System flow](./fundamentos-teoricos/12.%20System%20flow.md) | Flujos E2E y diagrama de secuencia |

Documentación complementaria en inglés y formato breve: [../03-event-driven/](../03-event-driven/README.md).

---

## Documentos en esta carpeta

| Documento | Descripción |
|-----------|-------------|
| [Infraestructura implementada y cumplimiento de requerimientos](./infraestructura-implementada-y-cumplimiento-requerimientos.md) | Docker (Postgres + Redpanda), variables de entorno, topics, flujos, tabla **requerimiento → implementación**, troubleshooting y checklist para nuevas features. |

---

## Guía Ollama (LLM local)

- [Guía Ollama local](./guia-ollama-local.md) — instalar modelo, variables `USE_OLLAMA`, API `/api/chat`, pruebas.

---

## Relacionado (otras carpetas)

- Pruebas con **Postman**: [../05-test/pruebas-con-postman.md](../05-test/pruebas-con-postman.md)
- Requerimientos originales: [../01-requerimientos/requerimientos.md](../01-requerimientos/requerimientos.md)
- Visión del sistema: [../system-overview.md](../system-overview.md)
- Prompt de implementación / agentes: [../06-agents/microservices-repo-prompt.md](../06-agents/microservices-repo-prompt.md)

---

## Índice general de `docs/`

Volver al [README principal de documentación](../README.md).

La guía para clonar, levantar Docker y arrancar los tres servicios Nest está en el [**README del repositorio**](../../README.md) (raíz).
