import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEnvelope } from '../../common/events/event-envelope';
import { ProcessedEventOrmEntity } from '../persistence/processed-event.orm-entity';
import { TransactionExplanationOrmEntity } from '../persistence/transaction-explanation.orm-entity';
import { LlmOrchestratorService } from './llm-orchestrator.service';

function transactionIdFromPayload(env: EventEnvelope): string | null {
  const p = env.payload as { transactionId?: string };
  return typeof p?.transactionId === 'string' ? p.transactionId : null;
}

/**
 * Persiste explicación + processed (lógica extraída del consumidor para tests).
 */
@Injectable()
export class AiTransactionEventApplierService {
  constructor(
    private readonly llm: LlmOrchestratorService,
    @InjectRepository(TransactionExplanationOrmEntity)
    private readonly explanations: Repository<TransactionExplanationOrmEntity>,
  ) {}

  async apply(env: EventEnvelope): Promise<void> {
    const transactionId = transactionIdFromPayload(env);
    if (!transactionId) {
      throw new Error('Missing transactionId in payload');
    }

    const explanation = await this.llm.explainTransaction(env);

    const accountId =
      env.eventType === 'TransactionCompleted'
        ? ((env.payload as { accountId?: string }).accountId ?? null)
        : null;

    await this.explanations.manager.transaction(async (em) => {
      const procRepo = em.getRepository(ProcessedEventOrmEntity);
      const expRepo = em.getRepository(TransactionExplanationOrmEntity);

      if (await procRepo.findOne({ where: { eventId: env.eventId } })) return;

      await expRepo.save({
        transactionId,
        accountId,
        eventType: env.eventType,
        explanation,
        sourceEventId: env.eventId,
        createdAt: new Date(),
      });

      await procRepo.save({
        eventId: env.eventId,
        processedAt: new Date(),
      });
    });
  }
}
