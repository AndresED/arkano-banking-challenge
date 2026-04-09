# Postman

## Importar en Postman

1. **Colección:** `Import` → archivo `arkano-banking.postman_collection.json`
2. **(Opcional) Entorno:** `Import` → `arkano-local.postman_environment.json`  
   Luego selecciona el entorno **Arkano local** arriba a la derecha.

La colección define **variables de colección**: URLs base, `clientId`, `accountId`, `accountId2`, `transactionId`, etc. Los scripts de **Tests** guardan IDs en esas variables al crear cliente/cuenta/transacción. El **entorno** `arkano-local` solo sobrescribe las tres URLs si lo seleccionas; el resto de IDs sigue en la colección salvo que copies los scripts a `pm.environment.set`.

## Uso

1. Levanta Docker y los tres servicios Nest (ver README raíz).
2. Ejecuta en orden la carpeta **01 - Accounts** (cliente → cuenta; para transferencias, también cliente 2 y cuenta 2).
3. Espera **1–3 s** tras crear cuentas antes de transacciones (sincronía Kafka).
4. Carpeta **02 - Transactions:** tras cada `POST`, usa **GET Transaction por id** hasta ver `completed` o `rejected`.
5. Carpeta **03 - AI:** **GET Explicaciones** y, si ya hubo movimientos en la cuenta, **GET Resumen historial por cuenta** (`Ollama` opcional; ver [guía Ollama](../docs/07-team/guia-ollama-local.md)).

Guía detallada: [`docs/05-test/pruebas-con-postman.md`](../docs/05-test/pruebas-con-postman.md).

Flujo extremo a extremo (Kafka, servicios): [`docs/07-team/fundamentos-teoricos/12. System flow.md`](../docs/07-team/fundamentos-teoricos/12.%20System%20flow.md).
