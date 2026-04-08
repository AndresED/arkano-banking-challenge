import { NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { ExplanationsService } from './explanations.service';
import { LlmOrchestratorService } from '../../infrastructure/kafka/llm-orchestrator.service';
import { TransactionExplanationOrmEntity } from '../../infrastructure/persistence/transaction-explanation.orm-entity';

describe('ExplanationsService', () => {
  let service: ExplanationsService;
  let find: jest.Mock;
  let llm: { summarizeAccountHistory: jest.Mock; providerLabel: jest.Mock };

  beforeEach(() => {
    find = jest.fn();
    llm = {
      summarizeAccountHistory: jest.fn().mockResolvedValue('Resumen corto.'),
      providerLabel: jest.fn().mockReturnValue('mock'),
    };
    const repo = {
      find,
    } as unknown as Repository<TransactionExplanationOrmEntity>;
    service = new ExplanationsService(
      repo,
      llm as unknown as LlmOrchestratorService,
    );
  });

  it('getByTransactionId: 404 si no hay filas', async () => {
    find.mockResolvedValue([]);
    await expect(
      service.getByTransactionId('00000000-0000-4000-8000-000000000001'),
    ).rejects.toThrow(NotFoundException);
  });

  it('getByTransactionId: mapea explicaciones', async () => {
    const d = new Date('2026-02-01T12:00:00.000Z');
    find.mockResolvedValue([
      {
        eventType: 'TransactionCompleted',
        explanation: 'Un depósito.',
        sourceEventId: 'se-1',
        accountId: 'a1',
        createdAt: d,
      },
    ]);
    const r = await service.getByTransactionId(
      '00000000-0000-4000-8000-000000000002',
    );
    expect(r.transactionId).toBe('00000000-0000-4000-8000-000000000002');
    expect(r.explanations).toHaveLength(1);
    expect(r.explanations[0]).toMatchObject({
      eventType: 'TransactionCompleted',
      explanation: 'Un depósito.',
      sourceEventId: 'se-1',
      accountId: 'a1',
      createdAt: d.toISOString(),
    });
  });

  it('getAccountHistorySummary: 404 sin movimientos', async () => {
    find.mockResolvedValue([]);
    await expect(
      service.getAccountHistorySummary('00000000-0000-4000-8000-000000000003'),
    ).rejects.toThrow(NotFoundException);
    expect(llm.summarizeAccountHistory).not.toHaveBeenCalled();
  });

  it('getAccountHistorySummary: llama al LLM y devuelve provider', async () => {
    find.mockResolvedValue([
      {
        transactionId: 't1',
        eventType: 'TransactionCompleted',
        explanation: 'Mov 1',
        createdAt: new Date('2026-01-05T00:00:00.000Z'),
      },
    ]);
    const r = await service.getAccountHistorySummary(
      '00000000-0000-4000-8000-000000000004',
    );
    expect(r.accountId).toBe('00000000-0000-4000-8000-000000000004');
    expect(r.provider).toBe('mock');
    expect(r.movementLinesUsed).toBe(1);
    expect(r.summary).toBe('Resumen corto.');
    expect(llm.summarizeAccountHistory).toHaveBeenCalled();
  });
});
