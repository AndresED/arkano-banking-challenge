import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEnvelope } from '../../common/events/event-envelope';

@Injectable()
export class OllamaLlmService {
  private readonly logger = new Logger(OllamaLlmService.name);

  constructor(private readonly config: ConfigService) {}

  private baseUrl(): string {
    return this.config
      .get<string>('OLLAMA_BASE_URL', 'http://127.0.0.1:11434')
      .replace(/\/$/, '');
  }

  private model(): string {
    return this.config.get<string>('OLLAMA_MODEL', 'llama3.2');
  }

  private timeoutMs(): number {
    return (
      Number(this.config.get<string>('OLLAMA_TIMEOUT_MS', '120000')) || 120000
    );
  }

  /** Si es false, solo se loguean URL, modelo y tamaños (sin cuerpos). */
  private logIo(): boolean {
    return (
      this.config.get<string>('OLLAMA_LOG_IO', 'true').toLowerCase() !== 'false'
    );
  }

  private async chat(system: string, user: string): Promise<string> {
    const url = `${this.baseUrl()}/api/chat`;
    const model = this.model();
    const requestBody = {
      model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      stream: false,
    };
    const bodyJson = JSON.stringify(requestBody);

    if (this.logIo()) {
      this.logger.log(
        `[OLLAMA] REQUEST POST ${url}\n${JSON.stringify(requestBody, null, 2)}`,
      );
    } else {
      this.logger.log(
        `[OLLAMA] REQUEST POST ${url} model=${model} ` +
          `(system ${system.length} chars, user ${user.length} chars; OLLAMA_LOG_IO=false)`,
      );
    }

    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), this.timeoutMs());
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: bodyJson,
      });
      const text = await res.text();
      if (this.logIo()) {
        this.logger.log(
          `[OLLAMA] RESPONSE HTTP ${res.status} body (${text.length} chars):\n${text}`,
        );
      } else {
        this.logger.log(
          `[OLLAMA] RESPONSE HTTP ${res.status} body length=${text.length} chars`,
        );
      }
      if (!res.ok) {
        this.logger.warn(`Ollama HTTP ${res.status}: ${text.slice(0, 500)}`);
        throw new Error(`Ollama respondió ${res.status}`);
      }
      const data = JSON.parse(text) as {
        message?: { content?: string };
      };
      const content = data.message?.content?.trim();
      if (!content) {
        throw new Error('Respuesta Ollama sin contenido');
      }
      if (this.logIo()) {
        this.logger.log(
          `[OLLAMA] EXTRACTED message.content (${content.length} chars): ${content}`,
        );
      }
      return content;
    } finally {
      clearTimeout(t);
    }
  }

  async explainTransaction(env: EventEnvelope): Promise<string> {
    const system =
      'Eres un asistente de banca para clientes finales. Responde en español, claro y breve (máximo 3 frases). No inventes datos que no estén en el evento.';
    const user = `Explica este evento bancario (JSON):\n${JSON.stringify(
      {
        tipo: env.eventType,
        datos: env.payload,
        momento: env.occurredAt,
      },
      null,
      2,
    )}`;
    return this.chat(system, user);
  }

  async summarizeAccountHistory(lines: string[]): Promise<string> {
    const system =
      'Eres un asistente de banca. Resume en español el historial de movimientos para el titular de la cuenta: tono profesional, 2–5 frases, sin jerga técnica innecesaria.';
    const user = `Movimientos recientes (más nuevos primero):\n${lines.join('\n')}\n\nGenera el resumen.`;
    return this.chat(system, user);
  }
}
