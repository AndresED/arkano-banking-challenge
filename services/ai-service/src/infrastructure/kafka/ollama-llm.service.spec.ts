import { ConfigService } from '@nestjs/config';
import { OllamaLlmService } from './ollama-llm.service';
import { EVENT_VERSION } from '../../common/events/event-envelope';

describe('OllamaLlmService', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('explainTransaction parsea message.content de la API chat', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      text: async () =>
        JSON.stringify({ message: { content: '  Explicación Ollama  ' } }),
    }) as unknown as typeof fetch;

    const config = {
      get: jest.fn((key: string, def?: string) => {
        if (key === 'OLLAMA_BASE_URL') return 'http://127.0.0.1:11434';
        if (key === 'OLLAMA_MODEL') return 'test-model';
        if (key === 'OLLAMA_TIMEOUT_MS') return '5000';
        return def;
      }),
    } as unknown as ConfigService;

    const svc = new OllamaLlmService(config);
    const text = await svc.explainTransaction({
      eventId: 'e1',
      eventType: 'TransactionCompleted',
      source: 'transactions-service',
      occurredAt: '2026-01-01T00:00:00.000Z',
      version: EVENT_VERSION,
      payload: { transactionId: 't1', amount: 5, accountId: 'a1' },
    });

    expect(text).toBe('Explicación Ollama');
    expect(global.fetch).toHaveBeenCalledWith(
      'http://127.0.0.1:11434/api/chat',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    const body = JSON.parse(
      (global.fetch as jest.Mock).mock.calls[0][1].body as string,
    );
    expect(body.model).toBe('test-model');
    expect(body.stream).toBe(false);
  });

  it('lanza si HTTP no ok', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => 'error',
    }) as unknown as typeof fetch;

    const config = {
      get: jest.fn((key: string, def?: string) => def),
    } as unknown as ConfigService;

    const svc = new OllamaLlmService(config);
    await expect(svc.summarizeAccountHistory(['línea 1'])).rejects.toThrow(
      'Ollama respondió 500',
    );
  });
});
