import { EntityManager, Repository } from 'typeorm';
import { AiTransactionEventApplierService } from './ai-transaction-event-applier.service';
import { LlmOrchestratorService } from './llm-orchestrator.service';
import { ProcessedEventOrmEntity } from '../persistence/processed-event.orm-entity';
import { TransactionExplanationOrmEntity } from '../persistence/transaction-explanation.orm-entity';
import { EVENT_VERSION } from '../../common/events/event-envelope';
import type { EventEnvelope } from '../../common/events/event-envelope';

describe('AiTransactionEventApplierService', () => {
  let service: AiTransactionEventApplierService;
  let llm: { explainTransaction: jest.Mock };
  let procRepo: { findOne: jest.Mock; save: jest.Mock };
  let expRepo: { save: jest.Mock };
  let transaction: jest.Mock;

  beforeEach(() => {
    llm = {
      explainTransaction: jest.fn().mockResolvedValue('Explicación mock'),
    };
    procRepo = {
      findOne: jest.fn(),
      save: jest.fn().mockResolvedValue({}),
    };
    expRepo = { save: jest.fn().mockResolvedValue({}) };
    transaction = jest.fn(async (cb: (m: EntityManager) => Promise<void>) => {
      const em = {
        getRepository: (entity: unknown) => {
          if (entity === ProcessedEventOrmEntity) return procRepo;
          if (entity === TransactionExplanationOrmEntity) return expRepo;
          throw new Error(`Unexpected ${String(entity)}`);
        },
      } as unknown as EntityManager;
      await cb(em);
    });

    const explanations = {
      manager: { transaction },
    } as unknown as Repository<TransactionExplanationOrmEntity>;

    service = new AiTransactionEventApplierService(
      llm as unknown as LlmOrchestratorService,
      explanations,
    );
  });

  it('lanza si falta transactionId', async () => {
    const env: EventEnvelope = {
      eventId: 'e1',
      eventType: 'TransactionCompleted',
      source: 'x',
      occurredAt: '2026-01-01T00:00:00.000Z',
      version: EVENT_VERSION,
      payload: {},
    };
    await expect(service.apply(env)).rejects.toThrow('Missing transactionId');
    expect(llm.explainTransaction).not.toHaveBeenCalled();
  });

  it('si ya procesado dentro de la tx, no inserta explicación', async () => {
    procRepo.findOne.mockResolvedValue({ eventId: 'e-dup' });
    await service.apply({
      eventId: 'e-dup',
      eventType: 'TransactionRejected',
      source: 'transactions-service',
      occurredAt: '2026-01-01T00:00:00.000Z',
      version: EVENT_VERSION,
      payload: { transactionId: 't1', reason: 'x' },
    });
    expect(llm.explainTransaction).toHaveBeenCalled();
    expect(expRepo.save).not.toHaveBeenCalled();
    expect(procRepo.save).not.toHaveBeenCalled();
  });

  it('TransactionCompleted: guarda accountId y explicación', async () => {
    procRepo.findOne.mockResolvedValue(null);
    await service.apply({
      eventId: 'e-ok',
      eventType: 'TransactionCompleted',
      source: 'transactions-service',
      occurredAt: '2026-01-01T00:00:00.000Z',
      version: EVENT_VERSION,
      payload: {
        transactionId: 't1',
        amount: -10,
        accountId: 'acc-1',
      },
    });
    expect(expRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        transactionId: 't1',
        accountId: 'acc-1',
        eventType: 'TransactionCompleted',
        explanation: 'Explicación mock',
        sourceEventId: 'e-ok',
      }),
    );
    expect(procRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ eventId: 'e-ok' }),
    );
  });
});
