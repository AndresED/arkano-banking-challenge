Technical Challenge - Nodejs Developer | Arkano

Plataforma Bancaria con Node.js, Bus de Servicios y LLM

Contexto:
Una entidad financiera necesita desarrollar una plataforma bancaria simplificada,
basada en microservicios desacoplados y orientados a eventos, que permita
gestionar cuentas bancarias y transacciones financieras.
Adicionalmente, el banco desea incorporar capacidades de inteligencia artificial
(LLM) para explicar operaciones financieras en lenguaje natural y mejorar la
experiencia del usuario.

Objetivo
Diseñar e implementar una solución que permita:
· Gestionar clientes y cuentas bancarias
· Ejecutar transacciones financieras (depósitos, retiros y transferencias)
· Comunicar los procesos de negocio a través de un bus de servicios
· Utilizar un microservicio con LLM para explicar y resumir información bancaria

Arquitectura Requerida
La solución debe estar compuesta por:
· Tres microservicios independientes
· Un bus de servicios (event-driven)

Cada microservicio debe:
· Tener su propia base de datos
· Ser autónomo
· Publicar y/o consumir eventos desde el bus de servicios

Microservicio de Clientes y Cuentas
Responsable de la gestión de clientes y sus cuentas bancarias.
Funcionalidades mínimas
· Registrar clientes
· Crear cuentas bancarias
· Consultar cuentas y saldo
Reglas
· Una cuenta pertenece a un cliente
· El saldo no puede ser negativo
Eventos
· ClientCreated
· AccountCreated
· BalanceUpdated
Microservicio de Transacciones
Responsable de ejecutar operaciones financieras.
Tipos de transacciones
· Depósito
· Retiro
· Transferencia entre cuentas
Reglas críticas

· Validar existencia de cuentas
· Validar fondos suficientes
· Evitar ejecución duplicada
· Manejar estados de la transacción:

o Pendiente
o Completada
o Rechazada

Comunicación
· Las transacciones no deben resolverse de forma síncrona
· El flujo debe basarse en eventos publicados en el bus
Eventos
· TransactionRequested
· TransactionCompleted
· TransactionRejected

Microservicio de Inteligencia Artificial (LLM)
Responsable de interpretar información financiera y generar explicaciones en
lenguaje natural.
Este servicio no ejecuta lógica bancaria, solo analiza información y eventos.
Funciones mínimas (al menos una obligatoria)
· Explicar una transacción bancaria
Ejemplo: La transferencia fue rechazada porque el saldo de la cuenta origen era
insuficiente.
· Resumir el historial de transacciones de una cuenta
· Traducir eventos técnicos a mensajes entendibles para usuarios finales
Comunicación
· Consume eventos del bus, por ejemplo:
o TransactionCompleted
o TransactionRejected

Requisitos
· El LLM puede ser:

o Un proveedor externo
o O una simulación (mock)

· Se evalúa la integración, no la calidad del modelo

Bus de Servicios (Obligatorio)
Debe utilizarse un bus de eventos para la comunicación entre microservicios.
Tecnología a elección:
· RabbitMQ
· Kafka
· Azure Service Bus
· AWS SNS / SQS
· NATS
Se espera:
· Publicación y consumo de eventos
· Procesamiento idempotente
· Manejo básico de fallos o reintentos (explicado)

Requisitos Técnicos
· Node.js (TypeScript recomendado)
· Arquitectura desacoplada
· Comunicación event-driven
· Bases de datos independientes
· Manejo de errores
· Variables de entorno

· Test unitarios y e2e
· README técnico claro

Stack Elegido
Hexagonal
CQRS
Kafka
NestJS