import { parseEnvelope } from './event-envelope';

describe('parseEnvelope (ai-service)', () => {
  it('parsea envelope válido', () => {
    const raw = JSON.stringify({
      eventId: '550e8400-e29b-41d4-a716-446655440000',
      eventType: 'TransactionCompleted',
      source: 'transactions-service',
      occurredAt: '2026-01-01T10:00:00.000Z',
      version: 1,
      payload: { transactionId: 't1', amount: 1, accountId: 'a1' },
    });
    const e = parseEnvelope(raw);
    expect(e.eventType).toBe('TransactionCompleted');
    expect(e.payload).toEqual({
      transactionId: 't1',
      amount: 1,
      accountId: 'a1',
    });
  });

  it('lanza si falta source', () => {
    const raw = JSON.stringify({
      eventId: 'e1',
      eventType: 'X',
      occurredAt: '2026-01-01T10:00:00.000Z',
      version: 1,
      payload: {},
    });
    expect(() => parseEnvelope(raw)).toThrow('Invalid event envelope');
  });
});
