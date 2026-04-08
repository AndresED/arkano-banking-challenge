import { BadRequestException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { DataSource } from 'typeorm';
import { randomUUID } from 'crypto';
import {
  EVENT_VERSION,
  EventEnvelope,
} from '../../../../common/events/event-envelope';
import { TOPIC_TRANSACTION_EVENTS } from '../../../../common/topics';
import { OutboxEventOrmEntity } from '../../../../infrastructure/persistence/outbox-event.orm-entity';
import {
  TransactionOrmEntity,
  TransactionStatus,
} from '../../../../infrastructure/persistence/transaction.orm-entity';
import { RequestTransactionCommand } from './request-transaction.command';

@CommandHandler(RequestTransactionCommand)
export class RequestTransactionHandler implements ICommandHandler<RequestTransactionCommand> {
  constructor(private readonly dataSource: DataSource) {}

  async execute(
    command: RequestTransactionCommand,
  ): Promise<{ transactionId: string; status: TransactionStatus }> {
    const { type, amount, sourceAccountId, targetAccountId } = command.dto;

    if (type === 'deposit' && !targetAccountId) {
      throw new BadRequestException('targetAccountId required for deposit');
    }
    if (type === 'withdrawal' && !sourceAccountId) {
      throw new BadRequestException('sourceAccountId required for withdrawal');
    }
    if (type === 'transfer' && (!sourceAccountId || !targetAccountId)) {
      throw new BadRequestException(
        'sourceAccountId and targetAccountId required for transfer',
      );
    }

    const transactionId = randomUUID();
    const partitionKey =
      type === 'deposit'
        ? targetAccountId!
        : type === 'withdrawal'
          ? sourceAccountId!
          : sourceAccountId!;

    await this.dataSource.transaction(async (em) => {
      const txnRepo = em.getRepository(TransactionOrmEntity);
      const outboxRepo = em.getRepository(OutboxEventOrmEntity);

      await txnRepo.save({
        id: transactionId,
        type,
        amount: Number(amount).toFixed(2),
        sourceAccountId: sourceAccountId ?? null,
        targetAccountId: targetAccountId ?? null,
        status: 'pending',
        reason: null,
      });

      const envelope: EventEnvelope = {
        eventId: randomUUID(),
        eventType: 'TransactionRequested',
        source: 'transactions-service',
        occurredAt: new Date().toISOString(),
        version: EVENT_VERSION,
        payload: {
          transactionId,
          type,
          amount: Number(amount),
          sourceAccountId,
          targetAccountId,
        },
      };

      await outboxRepo.save({
        topic: TOPIC_TRANSACTION_EVENTS,
        partitionKey,
        eventType: 'TransactionRequested',
        payload: JSON.stringify(envelope),
        published: false,
      });
    });

    return { transactionId, status: 'pending' };
  }
}
