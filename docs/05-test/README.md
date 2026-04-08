# Pruebas (`docs/05-test`)

Guías para validar el comportamiento del sistema y la **estrategia de tests** (unitarios, e2e, manuales).

## Estrategia de tests

- **[tests-por-microservicio.md](./tests-por-microservicio.md)** — revisión **por servicio** (accounts, transactions, ai): qué cubrir con **unitarios** vs **e2e**, prioridad y estado actual.
- **[prioridad-tests-unitarios.md](./prioridad-tests-unitarios.md)** — cruce con `requerimientos.md`, matriz P0/P1/P2 por riesgo bancario y bus de eventos.

---

Guías para validar el comportamiento del sistema sin depender solo de tests automatizados.

| Documento | Descripción |
|-----------|-------------|
| [Guía endpoints paso a paso](./guia-endpoints-paso-a-paso.md) | Orden progresivo de cada endpoint: body/respuesta, qué hace cada handler, outbox, topics Kafka y cadena event-driven entre los tres microservicios. |
| [Pruebas con Postman](./pruebas-con-postman.md) | Variables de entorno en Postman, requests ordenados, depósito / retiro / transferencia / rechazo, polling de transacciones asíncronas y consulta de explicaciones en el servicio AI. |
| Colección importable | [`../../postman/arkano-banking.postman_collection.json`](../../postman/arkano-banking.postman_collection.json) (+ entorno [`arkano-local.postman_environment.json`](../../postman/arkano-local.postman_environment.json)) — ver [`../../postman/README.md`](../../postman/README.md) |

**Contexto de infraestructura y troubleshooting:** [../07-team/infraestructura-implementada-y-cumplimiento-requerimientos.md](../07-team/infraestructura-implementada-y-cumplimiento-requerimientos.md).

[← Índice de documentación](../README.md)
