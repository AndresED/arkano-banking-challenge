# Documentación del proyecto

Índice de la carpeta `docs/`. La **entrada operativa** del repositorio (Docker, arranque, APIs) está en el [**README.md**](../README.md) de la raíz.

---

## Por dónde empezar

| Si necesitas… | Documento |
|---------------|-----------|
| Entender infraestructura, flujos Kafka y cómo el código cumple el reto | [07-team / Infraestructura y cumplimiento de requerimientos](./07-team/infraestructura-implementada-y-cumplimiento-requerimientos.md) |
| Recorrer endpoints y flujo event-driven | [05-test / Guía paso a paso](./05-test/guia-endpoints-paso-a-paso.md) |
| Probar todo con Postman | [05-test / Pruebas con Postman](./05-test/pruebas-con-postman.md); colección JSON en [`../postman/`](../postman/README.md) |
| Tests por microservicio (unitarios + e2e) | [05-test / tests-por-microservicio.md](./05-test/tests-por-microservicio.md) |
| Prioridad de tests unitarios (banca + Kafka) | [05-test / prioridad-tests-unitarios.md](./05-test/prioridad-tests-unitarios.md) |
| Ollama local (LLM en ai-service) | [07-team / guia-ollama-local.md](./07-team/guia-ollama-local.md) |
| Visión de arquitectura | [system-overview.md](./system-overview.md) |
| Prompt para generar o extender el sistema con IA | [06-agents / microservices-repo-prompt](./06-agents/microservices-repo-prompt.md) |

---

## Estructura de carpetas

| Carpeta | Contenido |
|---------|-----------|
| [**01-requerimientos**](./01-requerimientos/) | Enunciado (`requerimientos.md`), C4 baseline v1 (`c4-contexto-y-contenedores-v1.md`). |
| [**02-convenciones**](./02-convenciones/) | Arquitectura hexagonal, CQRS, respuestas HTTP, migraciones, paginación, etc. |
| [**03-event-driven**](./03-event-driven/) | Kafka, envelope de eventos, contratos, idempotencia, outbox, DLQ, particionado. |
| [**04-services**](./04-services/) | Documentación técnica por microservicio: [índice y diagrama de plataforma](./04-services/index.md). |
| [**05-test**](./05-test/) | Guías de prueba manuales (Postman). |
| [**06-agents**](./06-agents/) | Especificaciones orientadas a agentes de código / implementación. |
| [**07-team**](./07-team/) | Onboarding, infraestructura implementada y trazabilidad frente a requerimientos. |

---

## Orden de lectura sugerido (diseño)

1. [Requerimientos](./01-requerimientos/requerimientos.md) y [C4 v1 (contexto y contenedores)](./01-requerimientos/c4-contexto-y-contenedores-v1.md)
2. [Visión del sistema](./system-overview.md)
3. Carpeta [03-event-driven](./03-event-driven/) (contratos y patrones)
4. [Servicios](./04-services/)
5. [Convenciones](./02-convenciones/)

Para **poner en marcha** el código y **mantenerlo**, prioriza [07-team](./07-team/README.md) y el [README raíz](../README.md).
