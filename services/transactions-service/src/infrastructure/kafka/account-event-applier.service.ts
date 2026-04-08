import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEnvelope } from '../../common/events/event-envelope';
import { AccountSnapshotOrmEntity } from '../persistence/account-snapshot.orm-entity';
import { ProcessedEventOrmEntity } from '../persistence/processed-event.orm-entity';

export type AccountCreatedPayload = {
  accountId: string;
  clientId: string;
  balance: number;
};

export type BalanceUpdatedPayload = {
  accountId: string;
  newBalance: number;
};

/**
 * Aplica eventos de cuentas al snapshot local (testeable fuera del consumidor Kafka).
 */
@Injectable()
export class AccountEventApplierService {
  constructor(
    @InjectRepository(ProcessedEventOrmEntity)
    private readonly processed: Repository<ProcessedEventOrmEntity>,
    @InjectRepository(AccountSnapshotOrmEntity)
    private readonly snapshots: Repository<AccountSnapshotOrmEntity>,
  ) {}

  async applyAccountCreated(
    env: EventEnvelope<AccountCreatedPayload>,
  ): Promise<void> {
    const seen = await this.processed.findOne({
      where: { eventId: env.eventId },
    });
    if (seen) return;

    const { accountId, clientId, balance } = env.payload;
    await this.snapshots.manager.transaction(async (em) => {
      const procRepo = em.getRepository(ProcessedEventOrmEntity);
      const snapRepo = em.getRepository(AccountSnapshotOrmEntity);
      if (await procRepo.findOne({ where: { eventId: env.eventId } })) return;

      await snapRepo.save({
        accountId,
        clientId,
        balance: Number(balance).toFixed(2),
      });
      await procRepo.save({ eventId: env.eventId, processedAt: new Date() });
    });
  }

  async applyBalanceUpdated(
    env: EventEnvelope<BalanceUpdatedPayload>,
  ): Promise<void> {
    const seen = await this.processed.findOne({
      where: { eventId: env.eventId },
    });
    if (seen) return;

    const { accountId, newBalance } = env.payload;
    await this.snapshots.manager.transaction(async (em) => {
      const procRepo = em.getRepository(ProcessedEventOrmEntity);
      const snapRepo = em.getRepository(AccountSnapshotOrmEntity);
      if (await procRepo.findOne({ where: { eventId: env.eventId } })) return;

      const row = await snapRepo.findOne({ where: { accountId } });
      if (row) {
        row.balance = Number(newBalance).toFixed(2);
        await snapRepo.save(row);
      }
      await procRepo.save({ eventId: env.eventId, processedAt: new Date() });
    });
  }
}
