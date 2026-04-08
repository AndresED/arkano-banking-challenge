import { parseEnvelope } from './event-envelope';

describe('parseEnvelope', () => {
  it('parsea un envelope válido', () => {
    const raw = JSON.stringify({
      eventId: '550e8400-e29b-41d4-a716-446655440000',
      eventType: 'TransactionCompleted',
      source: 'transactions-service',
      occurredAt: '2026-01-01T10:00:00.000Z',
      version: 1,
      payload: { transactionId: 't1', amount: 10, accountId: 'a1' },
    });
    const e = parseEnvelope(raw);
    expect(e.eventId).toBe('550e8400-e29b-41d4-a716-446655440000');
    expect(e.eventType).toBe('TransactionCompleted');
    expect(e.source).toBe('transactions-service');
    expect(e.payload).toEqual({
      transactionId: 't1',
      amount: 10,
      accountId: 'a1',
    });
  });

  it('lanza si falta eventId', () => {
    const raw = JSON.stringify({
      eventType: 'X',
      source: 's',
      occurredAt: '2026-01-01T10:00:00.000Z',
      version: 1,
      payload: {},
    });
    expect(() => parseEnvelope(raw)).toThrow('Invalid event envelope');
  });

  it('lanza si el JSON es inválido', () => {
    expect(() => parseEnvelope('not json')).toThrow();
  });
});
