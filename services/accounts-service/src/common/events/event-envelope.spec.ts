import { parseEnvelope } from './event-envelope';

describe('parseEnvelope', () => {
  it('parsea un envelope válido', () => {
    const raw = JSON.stringify({
      eventId: '550e8400-e29b-41d4-a716-446655440000',
      eventType: 'BalanceUpdated',
      source: 'accounts-service',
      occurredAt: '2026-01-01T10:00:00.000Z',
      version: 1,
      payload: { accountId: 'a1', newBalance: 100 },
    });
    const e = parseEnvelope(raw);
    expect(e.eventId).toBe('550e8400-e29b-41d4-a716-446655440000');
    expect(e.eventType).toBe('BalanceUpdated');
    expect(e.payload).toEqual({ accountId: 'a1', newBalance: 100 });
  });

  it('lanza si falta eventType', () => {
    const raw = JSON.stringify({
      eventId: 'e1',
      source: 's',
      occurredAt: '2026-01-01T10:00:00.000Z',
      version: 1,
      payload: {},
    });
    expect(() => parseEnvelope(raw)).toThrow('Invalid event envelope');
  });

  it('lanza si el JSON es inválido', () => {
    expect(() => parseEnvelope('{')).toThrow();
  });
});
