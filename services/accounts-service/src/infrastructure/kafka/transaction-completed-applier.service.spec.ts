import { DataSource, EntityManager, Repository } from 'typeorm';
import { TransactionCompletedApplierService } from './transaction-completed-applier.service';
import { ProcessedEventOrmEntity } from '../persistence/processed-event.orm-entity';
import { AccountOrmEntity } from '../persistence/account.orm-entity';
import { AppliedTransactionLegOrmEntity } from '../persistence/applied-transaction-leg.orm-entity';
import { OutboxEventOrmEntity } from '../persistence/outbox-event.orm-entity';
import { EVENT_VERSION } from '../../common/events/event-envelope';
import { TOPIC_ACCOUNT_EVENTS } from '../../common/topics';
import type { TransactionCompletedPayload } from './transaction-completed-applier.service';
import type { EventEnvelope } from '../../common/events/event-envelope';

function makeCompletedEnvelope(
  payload: TransactionCompletedPayload,
  eventId = 'evt-outer-1',
): EventEnvelope<TransactionCompletedPayload> {
  return {
    eventId,
    eventType: 'TransactionCompleted',
    source: 'transactions-service',
    occurredAt: '2026-01-01T10:00:00.000Z',
    version: EVENT_VERSION,
    payload,
  };
}

describe('TransactionCompletedApplierService', () => {
  let service: TransactionCompletedApplierService;
  let outerProcessed: { findOne: jest.Mock };
  let procRepo: { findOne: jest.Mock; save: jest.Mock };
  let legRepo: { findOne: jest.Mock; save: jest.Mock };
  let accountRepo: { findOne: jest.Mock; save: jest.Mock };
  let outboxRepo: { save: jest.Mock };
  let dataSource: { transaction: jest.Mock };

  beforeEach(() => {
    outerProcessed = { findOne: jest.fn() };
    procRepo = {
      findOne: jest.fn(),
      save: jest.fn().mockResolvedValue({}),
    };
    legRepo = {
      findOne: jest.fn(),
      save: jest.fn().mockResolvedValue({}),
    };
    accountRepo = {
      findOne: jest.fn(),
      save: jest.fn().mockResolvedValue({}),
    };
    outboxRepo = { save: jest.fn().mockResolvedValue({}) };

    const em = {
      getRepository: (entity: unknown) => {
        if (entity === ProcessedEventOrmEntity) return procRepo;
        if (entity === AppliedTransactionLegOrmEntity) return legRepo;
        if (entity === AccountOrmEntity) return accountRepo;
        if (entity === OutboxEventOrmEntity) return outboxRepo;
        throw new Error(`Unexpected entity ${String(entity)}`);
      },
    } as unknown as EntityManager;

    dataSource = {
      transaction: jest.fn(async (cb: (m: EntityManager) => Promise<void>) => {
        await cb(em);
      }),
    };

    service = new TransactionCompletedApplierService(
      dataSource as unknown as DataSource,
      outerProcessed as unknown as Repository<ProcessedEventOrmEntity>,
    );
  });

  it('no entra a transacción si el eventId ya está procesado (fuera de tx)', async () => {
    outerProcessed.findOne.mockResolvedValue({ eventId: 'evt-outer-1' });
    await service.apply(
      makeCompletedEnvelope(
        { transactionId: 't1', amount: 10, accountId: 'a1' },
        'evt-outer-1',
      ),
    );
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('si la pata ya estaba aplicada, solo marca processed', async () => {
    outerProcessed.findOne.mockResolvedValue(null);
    procRepo.findOne.mockResolvedValue(null);
    legRepo.findOne.mockResolvedValue({
      transactionId: 't1',
      accountId: 'a1',
    });

    await service.apply(
      makeCompletedEnvelope({
        transactionId: 't1',
        amount: 10,
        accountId: 'a1',
      }),
    );

    expect(accountRepo.save).not.toHaveBeenCalled();
    expect(outboxRepo.save).not.toHaveBeenCalled();
    expect(procRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ eventId: 'evt-outer-1' }),
    );
  });

  it('cuenta inexistente: marca procesado sin tocar saldo', async () => {
    outerProcessed.findOne.mockResolvedValue(null);
    procRepo.findOne.mockResolvedValue(null);
    legRepo.findOne.mockResolvedValue(null);
    accountRepo.findOne.mockResolvedValue(null);

    await service.apply(
      makeCompletedEnvelope({
        transactionId: 't1',
        amount: 10,
        accountId: 'missing',
      }),
    );

    expect(accountRepo.save).not.toHaveBeenCalled();
    expect(outboxRepo.save).not.toHaveBeenCalled();
    expect(procRepo.save).toHaveBeenCalled();
  });

  it('rechaza saldo negativo y marca procesado', async () => {
    outerProcessed.findOne.mockResolvedValue(null);
    procRepo.findOne.mockResolvedValue(null);
    legRepo.findOne.mockResolvedValue(null);
    accountRepo.findOne.mockResolvedValue({
      id: 'a1',
      clientId: 'c1',
      balance: '10.00',
    });

    await service.apply(
      makeCompletedEnvelope({
        transactionId: 't1',
        amount: -50,
        accountId: 'a1',
      }),
    );

    expect(accountRepo.save).not.toHaveBeenCalled();
    expect(outboxRepo.save).not.toHaveBeenCalled();
    expect(procRepo.save).toHaveBeenCalled();
  });

  it('aplica monto, crea pata, outbox BalanceUpdated y processed', async () => {
    outerProcessed.findOne.mockResolvedValue(null);
    procRepo.findOne.mockResolvedValue(null);
    legRepo.findOne.mockResolvedValue(null);
    const account = {
      id: 'a1',
      clientId: 'c1',
      balance: '100.00',
    };
    accountRepo.findOne.mockResolvedValue(account);

    await service.apply(
      makeCompletedEnvelope({
        transactionId: 't1',
        amount: -25.5,
        accountId: 'a1',
      }),
    );

    expect(account.balance).toBe('74.50');
    expect(accountRepo.save).toHaveBeenCalledWith(account);
    expect(legRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        transactionId: 't1',
        accountId: 'a1',
      }),
    );
    expect(outboxRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        topic: TOPIC_ACCOUNT_EVENTS,
        partitionKey: 'a1',
        eventType: 'BalanceUpdated',
        published: false,
      }),
    );
    const ob = outboxRepo.save.mock.calls[0][0] as { payload: string };
    const inner = JSON.parse(ob.payload);
    expect(inner.eventType).toBe('BalanceUpdated');
    expect(inner.payload).toEqual({ accountId: 'a1', newBalance: 74.5 });
    expect(procRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ eventId: 'evt-outer-1' }),
    );
  });
});
