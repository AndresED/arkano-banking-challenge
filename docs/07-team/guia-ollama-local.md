# Guía: Ollama local con el AI service

El **ai-service** puede generar explicaciones y resúmenes con **Ollama** (LLM local) o, por defecto, con un **mock** determinista. Esta guía describe cómo levantar Ollama en tu máquina y conectarlo al servicio.

---

## 1. Qué hace el servicio con el LLM

| Modo | Variable | Comportamiento |
|------|----------|----------------|
| **Mock** (por defecto) | `USE_OLLAMA` ausente o `false` | Texto fijo en español (`MockLlmService`) y resumen por cuenta tipo lista. |
| **Ollama** | `USE_OLLAMA=true` | Llamadas HTTP a la API de Ollama (`/api/chat`) para explicar eventos y resumir historial. |

### Inspeccionar petición y respuesta de Ollama

Con `USE_OLLAMA=true`, el **`OllamaLlmService`** escribe en consola del ai-service líneas con prefijo **`[OLLAMA]`**:

- **`REQUEST POST {url}`** — cuerpo JSON enviado (`model`, `messages` con `system` y `user`, `stream: false`).
- **`RESPONSE HTTP {status}`** — cuerpo **crudo** devuelto por Ollama (tamaño en caracteres + texto completo).
- **`EXTRACTED message.content`** — texto ya recortado que se usará como explicación o resumen.

Para desactivar el volcado de cuerpos (solo URL, modelo y tamaños): **`OLLAMA_LOG_IO=false`** en `.env`.

Los endpoints HTTP del AI service:

- `GET /explanations/:transactionId` — explicaciones guardadas al consumir `TransactionCompleted` / `TransactionRejected`.
- `GET /explanations/account/:accountId/summary` — **resumen del historial** a partir de movimientos ya explicados con `accountId` (típicamente tras varios `TransactionCompleted`).

---

## 2. Instalar Ollama (Windows / macOS / Linux)

1. Descarga e instalación desde el sitio oficial: [https://ollama.com/download](https://ollama.com/download)
2. Tras instalar, el daemon suele escuchar en **`http://127.0.0.1:11434`** (comprueba la documentación de tu versión).

### Verificar que responde

En terminal:

```bash
curl http://127.0.0.1:11434/api/tags
```

Deberías ver JSON con los modelos instalados (o lista vacía).

---

## 3. Descargar un modelo

Ejemplos (elige uno y espera a que termine la descarga):

```bash
ollama pull llama3.2
```

Otros modelos razonables en español / uso general: `mistral`, `llama3.1`, `phi3`. El nombre exacto es el que usarás en `OLLAMA_MODEL`.

Comprueba generación rápida:

```bash
ollama run llama3.2 "Di hola en una frase."
```

---

## 4. Configurar el ai-service

En `services/ai-service/.env` (o variables de entorno del proceso):

```env
USE_OLLAMA=true
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=llama3.2
OLLAMA_TIMEOUT_MS=120000
```

- **`OLLAMA_BASE_URL`**: sin barra final; si Ollama corre en otro host/puerto, ajústalo.
- **`OLLAMA_MODEL`**: debe coincidir con un modelo que hayas hecho `pull`.
- **`OLLAMA_TIMEOUT_MS`**: tiempo máximo por petición (el primer prompt puede ser lento en CPU).

Reinicia el ai-service tras cambiar `.env`.

---

## 5. Flujo de prueba manual

1. Infra Docker (Postgres + Kafka) y los **tres** microservicios en marcha.
2. Con **Ollama** arrancado y modelo descargado.
3. Crea cliente, cuenta y al menos un **depósito** que llegue a `completed` (para que el AI persista una fila con `accountId`).
4. `GET http://localhost:3003/explanations/{transactionId}` — deberías ver texto generado por Ollama (o error 5xx si Ollama no responde; revisa logs del ai-service).
5. `GET http://localhost:3003/explanations/account/{accountId}/summary` — resumen agregado; requiere filas con ese `accountId` (solo se rellena en eventos **TransactionCompleted**).

Si Ollama falla tras reintentos en el consumidor Kafka, el mensaje puede ir a **DLQ** (`transaction-events-dlq`); revisa logs.

---

## 6. Volver al mock (CI o sin GPU)

```env
USE_OLLAMA=false
```

o elimina `USE_OLLAMA`. No hace falta tener Ollama instalado para ejecutar tests unitarios ni para demos solo-mock.

---

## 7. Seguridad y producción

Esta integración está pensada para **desarrollo local**. En producción: TLS, red privada, límites de rate, modelo aprobado por compliance y **no** exponer Ollama sin autenticación hacia Internet.

---

## Documentación relacionada

- [Servicio AI (diseño)](../04-services/ai/ai-service.md)
- [Pruebas Postman](../05-test/pruebas-con-postman.md)
- [Infraestructura implementada](./infraestructura-implementada-y-cumplimiento-requerimientos.md)
