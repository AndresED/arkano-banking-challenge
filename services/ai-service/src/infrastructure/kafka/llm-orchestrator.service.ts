import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEnvelope } from '../../common/events/event-envelope';
import { MockLlmService } from './mock-llm.service';
import { OllamaLlmService } from './ollama-llm.service';

@Injectable()
export class LlmOrchestratorService {
  constructor(
    private readonly config: ConfigService,
    private readonly mock: MockLlmService,
    private readonly ollama: OllamaLlmService,
  ) {}

  private useOllama(): boolean {
    return (
      this.config.get<string>('USE_OLLAMA', 'false').toLowerCase() === 'true'
    );
  }

  providerLabel(): 'ollama' | 'mock' {
    return this.useOllama() ? 'ollama' : 'mock';
  }

  async explainTransaction(env: EventEnvelope): Promise<string> {
    if (this.useOllama()) {
      return this.ollama.explainTransaction(env);
    }
    return Promise.resolve(this.mock.explain(env));
  }

  async summarizeAccountHistory(lines: string[]): Promise<string> {
    if (this.useOllama()) {
      return this.ollama.summarizeAccountHistory(lines);
    }
    return Promise.resolve(this.mock.summarizeAccountHistory(lines));
  }
}
