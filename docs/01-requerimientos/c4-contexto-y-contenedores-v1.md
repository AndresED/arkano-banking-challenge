# Arquitectura C4 — primera versión (baseline de requerimientos)

Este documento fija la **primera versión** del mapa arquitectónico de la plataforma bancaria, tal como se deriva del [enunciado del reto](./requerimientos.md) **antes** de entrar en detalles de implementación (outbox, snapshots, DLQ, etc.). Sirve como **línea base evolutiva**: los diagramas posteriores en [04-services](../04-services/index.md) refinan estos contenedores con el código real.

**Alcance de la v1:** actores, tres microservicios autónomos, bus de eventos, tres bases de datos y el rol del LLM como capacidad auxiliar — sin pretender ser el modelo de despliegue final.

**Herramienta de diagramas:** [Mermaid](https://mermaid.live/) (`flowchart` como equivalente legible a C4 nivel contexto y contenedores).

---

## 1. Contexto del sistema — nivel C1 (v1)

En esta primera iteración se asume un **único tipo de actor externo** que interactúa por HTTP con los servicios que expongan API, y un **bus de eventos** como sistema compartido de mensajería. Las bases de datos aparecen como almacenes dedicados por servicio, acorde al requisito de **persistencia independiente**.

```mermaid
flowchart TB
  subgraph externos["Actores y sistemas externos"]
    ACT["Actor primario<br/>Cliente digital / operador / integración HTTP"]
    LLM_EXT["Proveedor LLM opcional<br/>API externa o simulación local"]
  end

  subgraph plataforma["Plataforma bancaria (v1)"]
    MS_ACC["Microservicio<br/>Clientes y cuentas"]
    MS_TRX["Microservicio<br/>Transacciones"]
    MS_AI["Microservicio<br/>Inteligencia artificial"]
  end

  BUS[("Bus de servicios<br/>event-driven")]

  subgraph datos_v1["Datos — una BD por servicio"]
    DB_ACC[("Base de datos<br/>cuentas")]
    DB_TRX[("Base de datos<br/>transacciones")]
    DB_AI[("Base de datos<br/>IA / explicaciones")]
  end

  ACT -->|"HTTP: altas, consultas"| MS_ACC
  ACT -->|"HTTP: solicitar movimientos<br/>consultar estado"| MS_TRX
  ACT -->|"HTTP: explicaciones y resúmenes"| MS_AI

  MS_ACC <-->|"eventos de dominio<br/>cuenta / saldo"| BUS
  MS_TRX <-->|"eventos de transacción"| BUS
  MS_AI <-->|"consume resultados<br/>de operaciones"| BUS

  MS_ACC --> DB_ACC
  MS_TRX --> DB_TRX
  MS_AI --> DB_AI

  MS_AI -.->|"si aplica"| LLM_EXT
```

### Lectura evolutiva del C1 (v1)

| Elemento | Decisión en v1 | Nota para iteraciones posteriores |
|----------|----------------|-----------------------------------|
| Actor | Un solo bloque “canal HTTP” | Se puede desglosar en app móvil, BFF, backoffice |
| Bus | Caja única “event-driven” | En implementación: Kafka/Redpanda, topics nombrados, idempotencia |
| Tres MS | Límites por bounded context del enunciado | Misma separación se mantiene en el repo |
| LLM | Relación opcional desde el MS de IA | Mock por defecto; Ollama u otro proveedor como detalle técnico |

---

## 2. Contenedores — nivel C2 (v1), por microservicio

La **v1 de contenedores** describe el interior lógico de cada microservicio en términos de **exposición HTTP**, **núcleo de negocio o análisis** y **persistencia**, más el acoplamiento al bus. No lista clases NestJS ni módulos: eso corresponde a la documentación de [04-services](../04-services/).

### 2.1 Visión conjunta (tres servicios en un lienzo)

```mermaid
flowchart TB
  subgraph acc["Microservicio Clientes y cuentas — v1"]
    A_API["Contenedor: API HTTP"]
    A_DOM["Contenedor: Dominio<br/>clientes, cuentas, saldo"]
    A_DB[("PostgreSQL<br/>dedicado")]
    A_API --> A_DOM
    A_DOM --> A_DB
  end

  subgraph trx["Microservicio Transacciones — v1"]
    T_API["Contenedor: API HTTP"]
    T_DOM["Contenedor: Dominio<br/>depósito, retiro, transferencia<br/>estados pendiente / completada / rechazada"]
    T_DB[("PostgreSQL<br/>dedicado")]
    T_API --> T_DOM
    T_DOM --> T_DB
  end

  subgraph ai["Microservicio IA — v1"]
    I_API["Contenedor: API HTTP"]
    I_ENG["Contenedor: Motor de explicación<br/>LLM o mock"]
    I_DB[("PostgreSQL<br/>dedicado")]
    I_API --> I_ENG
    I_ENG --> I_DB
  end

  K[("Bus de eventos")]

  A_DOM <-->|"publica y consume"| K
  T_DOM <-->|"publica y consume"| K
  I_ENG <-->|"consume"| K
```

### 2.2 C2 detallado — interacción v1 entre contenedores (flujo conceptual)

```mermaid
flowchart LR
  subgraph actor["Actor"]
    U["Usuario / integración"]
  end

  subgraph ms_acc["Cuentas"]
    API1["API"]
    D1["Dominio cuentas"]
  end

  subgraph ms_trx["Transacciones"]
    API2["API"]
    D2["Dominio transacciones"]
  end

  subgraph ms_ai["IA"]
    API3["API"]
    D3["Explicaciones"]
  end

  BUS[("Bus")]

  U --> API1
  U --> API2
  U --> API3

  API1 --> D1
  API2 --> D2
  API3 --> D3

  D1 <--> BUS
  D2 <--> BUS
  D3 --> BUS
```

En **v1** el diagrama enfatiza que **ningún microservicio sustituye al otro por HTTP** para completar una transacción de extremo a extremo: la coordinación temporal entre “solicitud” y “efecto en saldo” se delega al **bus**, tal como exige el enunciado (flujo **no síncrono** entre servicios para la ejecución del movimiento).

---

## 3. Cierre evolutivo: de la v1 de requerimientos al código

Esta **primera versión** C1/C2 es deliberadamente **estable y pobre en detalle técnico**: permite validar límites, actores y dependencias con el negocio antes de fijar patrones (outbox, snapshots, consumidores, DLQ).

| Versión documental | Dónde profundizar |
|--------------------|-------------------|
| **v1 (este documento)** | Actores, 3 MS, bus, 3 BD, rol del LLM |
| **Implementación NestJS + Kafka** | [04-services/index.md](../04-services/index.md) y un documento por servicio |

Si en el futuro se versiona de nuevo el C4 a nivel requerimientos (v2), lo natural sería añadir explícitamente los **nombres de eventos** del enunciado como contrato entre contenedores, manteniendo este archivo como **histórico de baseline** o renombrándolo con sufijo de fecha.

---

## Documentos relacionados

- [requerimientos.md](./requerimientos.md) — enunciado original
- [04-services / índice](../04-services/index.md) — C4 lógico alineado al código
- [03-event-driven](../03-event-driven/) — contratos de eventos e idempotencia

[← README de 01-requerimientos](./README.md)
