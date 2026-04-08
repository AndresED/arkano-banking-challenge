import { Injectable } from '@nestjs/common';
import { EventEnvelope } from '../../common/events/event-envelope';

@Injectable()
export class MockLlmService {
  /** Explicación determinista (simula LLM). Texto en español alineado al ejemplo del reto. */
  explain(env: EventEnvelope): string {
    if (env.eventType === 'TransactionRejected') {
      const p = env.payload as { transactionId: string; reason: string };
      return (
        `La operación no pudo completarse (transacción ${p.transactionId}). ` +
        `Motivo: ${p.reason}.`
      );
    }
    if (env.eventType === 'TransactionCompleted') {
      const p = env.payload as {
        transactionId: string;
        amount: number;
        accountId: string;
      };
      const amt = Number(p.amount);
      if (amt >= 0) {
        return `La transacción ${p.transactionId} abonó ${amt} a la cuenta ${p.accountId}.`;
      }
      return `La transacción ${p.transactionId} descontó ${Math.abs(amt)} de la cuenta ${p.accountId}.`;
    }
    return `Se recibió el evento ${env.eventType} (${env.eventId}).`;
  }

  /** Resumen sin modelo generativo: lista y conteo. */
  summarizeAccountHistory(lines: string[]): string {
    if (lines.length === 0) {
      return 'No hay movimientos registrados para esta cuenta en el servicio de IA.';
    }
    const head = `Resumen automático (mock, sin LLM): hay ${lines.length} registro(s) reciente(s) asociados a esta cuenta.\n`;
    const body = lines.slice(0, 10).join('\n');
    const tail = lines.length > 10 ? `\n… y ${lines.length - 10} más.` : '';
    return head + body + tail;
  }
}
