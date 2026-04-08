export const EVENT_VERSION = 1;

export type EventEnvelope<T = Record<string, unknown>> = {
  eventId: string;
  eventType: string;
  source: string;
  occurredAt: string;
  version: number;
  payload: T;
};

export function parseEnvelope(raw: string): EventEnvelope {
  const v = JSON.parse(raw) as EventEnvelope;
  if (!v?.eventId || !v?.eventType || !v?.source) {
    throw new Error('Invalid event envelope');
  }
  return v;
}
