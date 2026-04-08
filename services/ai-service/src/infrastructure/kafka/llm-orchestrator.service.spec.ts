import { ConfigService } from '@nestjs/config';
import { LlmOrchestratorService } from './llm-orchestrator.service';
import { MockLlmService } from './mock-llm.service';
import { OllamaLlmService } from './ollama-llm.service';
import { EventEnvelope } from '../../common/events/event-envelope';

describe('LlmOrchestratorService', () => {
  const env: EventEnvelope = {
    eventId: 'e1',
    eventType: 'TransactionCompleted',
    source: 'x',
    occurredAt: new Date().toISOString(),
    version: 1,
    payload: { transactionId: 't', amount: 1, accountId: 'a' },
  };

  it('usa mock cuando USE_OLLAMA no es true', async () => {
    const config = {
      get: (key: string, def?: string) =>
        key === 'USE_OLLAMA' ? 'false' : def,
    } as unknown as ConfigService;
    const mock = new MockLlmService();
    const ollama = {
      explainTransaction: jest.fn(),
      summarizeAccountHistory: jest.fn(),
    } as unknown as OllamaLlmService;
    const svc = new LlmOrchestratorService(config, mock, ollama);
    expect(svc.providerLabel()).toBe('mock');
    const out = await svc.explainTransaction(env);
    expect(out).toContain('abonó');
    expect(ollama.explainTransaction).not.toHaveBeenCalled();
  });

  it('delega en Ollama cuando USE_OLLAMA=true', async () => {
    const config = {
      get: (key: string, def?: string) => (key === 'USE_OLLAMA' ? 'true' : def),
    } as unknown as ConfigService;
    const mock = new MockLlmService();
    const ollama = {
      explainTransaction: jest.fn().mockResolvedValue('desde-ollama'),
      summarizeAccountHistory: jest.fn().mockResolvedValue('resumen'),
    } as unknown as OllamaLlmService;
    const svc = new LlmOrchestratorService(config, mock, ollama);
    expect(svc.providerLabel()).toBe('ollama');
    await expect(svc.explainTransaction(env)).resolves.toBe('desde-ollama');
    await expect(svc.summarizeAccountHistory(['x'])).resolves.toBe('resumen');
  });
});
