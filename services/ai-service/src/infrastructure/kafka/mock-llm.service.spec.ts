import { MockLlmService } from './mock-llm.service';
import { EventEnvelope } from '../../common/events/event-envelope';

describe('MockLlmService', () => {
  const svc = new MockLlmService();

  it('explains TransactionRejected en español', () => {
    const env: EventEnvelope = {
      eventId: 'e1',
      eventType: 'TransactionRejected',
      source: 'transactions-service',
      occurredAt: new Date().toISOString(),
      version: 1,
      payload: { transactionId: 't1', reason: 'Insufficient balance' },
    };
    expect(svc.explain(env)).toContain('Insufficient balance');
    expect(svc.explain(env)).toContain('t1');
    expect(svc.explain(env)).toContain('La operación');
  });

  it('explains TransactionCompleted abono', () => {
    const env: EventEnvelope = {
      eventId: 'e2',
      eventType: 'TransactionCompleted',
      source: 'transactions-service',
      occurredAt: new Date().toISOString(),
      version: 1,
      payload: { transactionId: 't2', amount: 100, accountId: 'a1' },
    };
    expect(svc.explain(env)).toContain('abonó');
    expect(svc.explain(env)).toContain('100');
  });

  it('explains TransactionCompleted cargo', () => {
    const env: EventEnvelope = {
      eventId: 'e3',
      eventType: 'TransactionCompleted',
      source: 'transactions-service',
      occurredAt: new Date().toISOString(),
      version: 1,
      payload: { transactionId: 't3', amount: -50, accountId: 'a1' },
    };
    expect(svc.explain(env)).toContain('descontó');
    expect(svc.explain(env)).toContain('50');
  });

  it('summarizeAccountHistory mock lista líneas', () => {
    const text = svc.summarizeAccountHistory(['línea 1', 'línea 2']);
    expect(text).toContain('mock');
    expect(text).toContain('línea 1');
  });
});
