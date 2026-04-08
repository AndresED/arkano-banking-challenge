import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TransactionExplanationOrmEntity } from '../../infrastructure/persistence/transaction-explanation.orm-entity';
import { LlmOrchestratorService } from '../../infrastructure/kafka/llm-orchestrator.service';

const ACCOUNT_HISTORY_LIMIT = 40;

@Injectable()
export class ExplanationsService {
  constructor(
    @InjectRepository(TransactionExplanationOrmEntity)
    private readonly repo: Repository<TransactionExplanationOrmEntity>,
    private readonly llm: LlmOrchestratorService,
  ) {}

  async getByTransactionId(transactionId: string): Promise<{
    transactionId: string;
    explanations: Array<{
      eventType: string;
      explanation: string;
      sourceEventId: string;
      accountId: string | null;
      createdAt: string;
    }>;
  }> {
    const rows = await this.repo.find({
      where: { transactionId },
      order: { createdAt: 'ASC' },
    });
    if (rows.length === 0) {
      throw new NotFoundException(
        'No explanation available yet for this transaction',
      );
    }
    return {
      transactionId,
      explanations: rows.map((r) => ({
        eventType: r.eventType,
        explanation: r.explanation,
        sourceEventId: r.sourceEventId,
        accountId: r.accountId,
        createdAt: r.createdAt.toISOString(),
      })),
    };
  }

  /**
   * Cumple el requisito de “resumir historial por cuenta”: usa movimientos
   * ya explicados donde conocemos accountId (p. ej. TransactionCompleted).
   */
  async getAccountHistorySummary(accountId: string): Promise<{
    accountId: string;
    provider: 'ollama' | 'mock';
    movementLinesUsed: number;
    summary: string;
  }> {
    const rows = await this.repo.find({
      where: { accountId },
      order: { createdAt: 'DESC' },
      take: ACCOUNT_HISTORY_LIMIT,
    });
    if (rows.length === 0) {
      throw new NotFoundException(
        'No hay movimientos indexados para esta cuenta en el servicio de IA (necesitas TransactionCompleted previos).',
      );
    }
    const lines = rows.map(
      (r) =>
        `[${r.createdAt.toISOString()}] ${r.eventType} tx=${r.transactionId}: ${r.explanation}`,
    );
    const summary = await this.llm.summarizeAccountHistory(lines);
    return {
      accountId,
      provider: this.llm.providerLabel(),
      movementLinesUsed: rows.length,
      summary,
    };
  }
}
