import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import {
  EVENT_VERSION,
  EventEnvelope,
} from '../../common/events/event-envelope';
import { TOPIC_ACCOUNT_EVENTS } from '../../common/topics';
import { AccountOrmEntity } from '../persistence/account.orm-entity';
import { AppliedTransactionLegOrmEntity } from '../persistence/applied-transaction-leg.orm-entity';
import { OutboxEventOrmEntity } from '../persistence/outbox-event.orm-entity';
import { ProcessedEventOrmEntity } from '../persistence/processed-event.orm-entity';

export type TransactionCompletedPayload = {
  transactionId: string;
  amount: number;
  accountId: string;
};

/**
 * Aplica TransactionCompleted al saldo autoritativo y encola BalanceUpdated (outbox).
 * Extraído del consumidor Kafka para pruebas unitarias.
 */
@Injectable()
export class TransactionCompletedApplierService {
  private readonly logger = new Logger(TransactionCompletedApplierService.name);

  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(ProcessedEventOrmEntity)
    private readonly processed: Repository<ProcessedEventOrmEntity>,
  ) {}

  async apply(env: EventEnvelope<TransactionCompletedPayload>): Promise<void> {
    const existing = await this.processed.findOne({
      where: { eventId: env.eventId },
    });
    if (existing) return;

    const { transactionId, amount, accountId } = env.payload;
    await this.dataSource.transaction(async (em) => {
      const procRepo = em.getRepository(ProcessedEventOrmEntity);
      const legRepo = em.getRepository(AppliedTransactionLegOrmEntity);
      const accountRepo = em.getRepository(AccountOrmEntity);
      const outboxRepo = em.getRepository(OutboxEventOrmEntity);

      const dupProc = await procRepo.findOne({
        where: { eventId: env.eventId },
      });
      if (dupProc) return;

      const leg = await legRepo.findOne({
        where: { transactionId, accountId },
      });
      if (leg) {
        await procRepo.save({
          eventId: env.eventId,
          processedAt: new Date(),
        });
        return;
      }

      const account = await accountRepo.findOne({ where: { id: accountId } });
      if (!account) {
        this.logger.warn(`TransactionCompleted: unknown account ${accountId}`);
        await procRepo.save({
          eventId: env.eventId,
          processedAt: new Date(),
        });
        return;
      }

      const current = Number(account.balance);
      const next = current + Number(amount);
      if (next < 0) {
        this.logger.error(
          `TransactionCompleted would make balance negative for ${accountId}`,
        );
        await procRepo.save({
          eventId: env.eventId,
          processedAt: new Date(),
        });
        return;
      }

      account.balance = next.toFixed(2);
      await accountRepo.save(account);

      await legRepo.save({
        transactionId,
        accountId,
        appliedAt: new Date(),
      });

      const balanceEventId = randomUUID();
      const balanceEnvelope: EventEnvelope = {
        eventId: balanceEventId,
        eventType: 'BalanceUpdated',
        source: 'accounts-service',
        occurredAt: new Date().toISOString(),
        version: EVENT_VERSION,
        payload: {
          accountId,
          newBalance: next,
        },
      };

      await outboxRepo.save({
        topic: TOPIC_ACCOUNT_EVENTS,
        partitionKey: accountId,
        eventType: 'BalanceUpdated',
        payload: JSON.stringify(balanceEnvelope),
        published: false,
      });

      await procRepo.save({
        eventId: env.eventId,
        processedAt: new Date(),
      });
    });
  }
}
