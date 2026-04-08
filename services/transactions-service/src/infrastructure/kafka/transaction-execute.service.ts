import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import {
  EVENT_VERSION,
  EventEnvelope,
} from '../../common/events/event-envelope';
import { TOPIC_TRANSACTION_EVENTS } from '../../common/topics';
import { AccountSnapshotOrmEntity } from '../persistence/account-snapshot.orm-entity';
import { OutboxEventOrmEntity } from '../persistence/outbox-event.orm-entity';
import { ProcessedEventOrmEntity } from '../persistence/processed-event.orm-entity';
import { TransactionOrmEntity } from '../persistence/transaction.orm-entity';

export type TransactionRequestedPayload = {
  transactionId: string;
  type: 'deposit' | 'withdrawal' | 'transfer';
  amount: number;
  sourceAccountId?: string;
  targetAccountId?: string;
};

@Injectable()
export class TransactionExecuteService {
  constructor(private readonly dataSource: DataSource) {}

  async executeRequested(
    env: EventEnvelope<TransactionRequestedPayload>,
  ): Promise<void> {
    await this.dataSource.transaction(async (em) => {
      const procRepo = em.getRepository(ProcessedEventOrmEntity);
      const txnRepo = em.getRepository(TransactionOrmEntity);
      const snapRepo = em.getRepository(AccountSnapshotOrmEntity);
      const outboxRepo = em.getRepository(OutboxEventOrmEntity);

      if (await procRepo.findOne({ where: { eventId: env.eventId } })) return;

      const { transactionId, type, amount, sourceAccountId, targetAccountId } =
        env.payload;
      const txn = await txnRepo.findOne({ where: { id: transactionId } });
      if (!txn || txn.status !== 'pending') {
        await procRepo.save({
          eventId: env.eventId,
          processedAt: new Date(),
        });
        return;
      }

      const reject = async (reason: string): Promise<void> => {
        txn.status = 'rejected';
        txn.reason = reason;
        await txnRepo.save(txn);
        const envelope: EventEnvelope = {
          eventId: randomUUID(),
          eventType: 'TransactionRejected',
          source: 'transactions-service',
          occurredAt: new Date().toISOString(),
          version: EVENT_VERSION,
          payload: { transactionId, reason },
        };
        await outboxRepo.save({
          topic: TOPIC_TRANSACTION_EVENTS,
          partitionKey: transactionId,
          eventType: 'TransactionRejected',
          payload: JSON.stringify(envelope),
          published: false,
        });
        await procRepo.save({
          eventId: env.eventId,
          processedAt: new Date(),
        });
      };

      const amt = Number(amount);
      if (!Number.isFinite(amt) || amt <= 0) {
        await reject('Invalid amount');
        return;
      }

      if (type === 'deposit') {
        if (!targetAccountId) {
          await reject('Missing target account');
          return;
        }
        const snap = await snapRepo.findOne({
          where: { accountId: targetAccountId },
        });
        if (!snap) {
          await reject('Unknown account');
          return;
        }
        snap.balance = (Number(snap.balance) + amt).toFixed(2);
        await snapRepo.save(snap);
        txn.status = 'completed';
        await txnRepo.save(txn);
        await this.enqueueCompleted(
          outboxRepo,
          transactionId,
          targetAccountId,
          amt,
        );
        await procRepo.save({
          eventId: env.eventId,
          processedAt: new Date(),
        });
        return;
      }

      if (type === 'withdrawal') {
        if (!sourceAccountId) {
          await reject('Missing source account');
          return;
        }
        const snap = await snapRepo.findOne({
          where: { accountId: sourceAccountId },
        });
        if (!snap) {
          await reject('Unknown account');
          return;
        }
        const bal = Number(snap.balance);
        if (bal < amt) {
          await reject('Insufficient balance');
          return;
        }
        snap.balance = (bal - amt).toFixed(2);
        await snapRepo.save(snap);
        txn.status = 'completed';
        await txnRepo.save(txn);
        await this.enqueueCompleted(
          outboxRepo,
          transactionId,
          sourceAccountId,
          -amt,
        );
        await procRepo.save({
          eventId: env.eventId,
          processedAt: new Date(),
        });
        return;
      }

      if (type === 'transfer') {
        if (!sourceAccountId || !targetAccountId) {
          await reject('Missing source or target account');
          return;
        }
        const src = await snapRepo.findOne({
          where: { accountId: sourceAccountId },
        });
        const dst = await snapRepo.findOne({
          where: { accountId: targetAccountId },
        });
        if (!src || !dst) {
          await reject('Unknown account');
          return;
        }
        const srcBal = Number(src.balance);
        if (srcBal < amt) {
          await reject('Insufficient balance');
          return;
        }
        src.balance = (srcBal - amt).toFixed(2);
        dst.balance = (Number(dst.balance) + amt).toFixed(2);
        await snapRepo.save(src);
        await snapRepo.save(dst);
        txn.status = 'completed';
        await txnRepo.save(txn);
        await this.enqueueCompleted(
          outboxRepo,
          transactionId,
          sourceAccountId,
          -amt,
        );
        await this.enqueueCompleted(
          outboxRepo,
          transactionId,
          targetAccountId,
          amt,
        );
        await procRepo.save({
          eventId: env.eventId,
          processedAt: new Date(),
        });
        return;
      }

      await reject('Unknown transaction type');
    });
  }

  private async enqueueCompleted(
    outboxRepo: Repository<OutboxEventOrmEntity>,
    transactionId: string,
    accountId: string,
    amount: number,
  ): Promise<void> {
    const envelope: EventEnvelope = {
      eventId: randomUUID(),
      eventType: 'TransactionCompleted',
      source: 'transactions-service',
      occurredAt: new Date().toISOString(),
      version: EVENT_VERSION,
      payload: { transactionId, amount, accountId },
    };
    await outboxRepo.save({
      topic: TOPIC_TRANSACTION_EVENTS,
      partitionKey: accountId,
      eventType: 'TransactionCompleted',
      payload: JSON.stringify(envelope),
      published: false,
    });
  }
}
