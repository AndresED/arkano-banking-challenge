import { DataSource, EntityManager } from 'typeorm';
import {
  TransactionExecuteService,
  type TransactionRequestedPayload,
} from './transaction-execute.service';
import { EventEnvelope } from '../../common/events/event-envelope';
import { ProcessedEventOrmEntity } from '../persistence/processed-event.orm-entity';
import { TransactionOrmEntity } from '../persistence/transaction.orm-entity';
import { AccountSnapshotOrmEntity } from '../persistence/account-snapshot.orm-entity';
import { OutboxEventOrmEntity } from '../persistence/outbox-event.orm-entity';
import { TOPIC_TRANSACTION_EVENTS } from '../../common/topics';

function makeRequestedEnvelope(
  payload: TransactionRequestedPayload,
  eventId = 'event-uuid-1',
): EventEnvelope<TransactionRequestedPayload> {
  return {
    eventId,
    eventType: 'TransactionRequested',
    source: 'transactions-service',
    occurredAt: '2026-01-01T10:00:00.000Z',
    version: 1,
    payload,
  };
}

describe('TransactionExecuteService', () => {
  let service: TransactionExecuteService;
  let procRepo: {
    findOne: jest.Mock;
    save: jest.Mock;
  };
  let txnRepo: {
    findOne: jest.Mock;
    save: jest.Mock;
  };
  let snapRepo: {
    findOne: jest.Mock;
    save: jest.Mock;
  };
  let outboxRepo: {
    save: jest.Mock;
  };
  let dataSource: { transaction: jest.Mock };

  beforeEach(() => {
    procRepo = { findOne: jest.fn(), save: jest.fn().mockResolvedValue({}) };
    txnRepo = { findOne: jest.fn(), save: jest.fn().mockResolvedValue({}) };
    snapRepo = { findOne: jest.fn(), save: jest.fn().mockResolvedValue({}) };
    outboxRepo = { save: jest.fn().mockResolvedValue({}) };

    const em = {
      getRepository: (entity: unknown) => {
        if (entity === ProcessedEventOrmEntity) return procRepo;
        if (entity === TransactionOrmEntity) return txnRepo;
        if (entity === AccountSnapshotOrmEntity) return snapRepo;
        if (entity === OutboxEventOrmEntity) return outboxRepo;
        throw new Error(`Unexpected entity ${entity}`);
      },
    } as unknown as EntityManager;

    dataSource = {
      transaction: jest.fn(async (cb: (m: EntityManager) => Promise<void>) => {
        await cb(em);
      }),
    };

    service = new TransactionExecuteService(
      dataSource as unknown as DataSource,
    );
  });

  it('no procesa de nuevo si el eventId ya está en processed_events', async () => {
    procRepo.findOne.mockResolvedValue({ eventId: 'dup' });
    await service.executeRequested(
      makeRequestedEnvelope(
        {
          transactionId: 't1',
          type: 'deposit',
          amount: 10,
          targetAccountId: 'a1',
        },
        'dup',
      ),
    );
    expect(txnRepo.findOne).not.toHaveBeenCalled();
    expect(outboxRepo.save).not.toHaveBeenCalled();
  });

  it('deposit: completa y publica TransactionCompleted', async () => {
    procRepo.findOne.mockResolvedValue(null);
    txnRepo.findOne.mockResolvedValue({
      id: 't1',
      status: 'pending',
      type: 'deposit',
      amount: '10.00',
    });
    const snap = { accountId: 'a1', balance: '0.00' };
    snapRepo.findOne.mockResolvedValue(snap);

    await service.executeRequested(
      makeRequestedEnvelope({
        transactionId: 't1',
        type: 'deposit',
        amount: 10,
        targetAccountId: 'a1',
      }),
    );

    expect(snap.balance).toBe('10.00');
    expect(txnRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'completed' }),
    );
    const completedSaves = outboxRepo.save.mock.calls.filter(
      (c) => c[0].eventType === 'TransactionCompleted',
    );
    expect(completedSaves).toHaveLength(1);
    const payload = JSON.parse(completedSaves[0][0].payload);
    expect(payload.eventType).toBe('TransactionCompleted');
    expect(payload.payload).toMatchObject({
      transactionId: 't1',
      amount: 10,
      accountId: 'a1',
    });
    expect(completedSaves[0][0].topic).toBe(TOPIC_TRANSACTION_EVENTS);
    expect(procRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ eventId: 'event-uuid-1' }),
    );
  });

  it('withdrawal: rechaza si fondos insuficientes', async () => {
    procRepo.findOne.mockResolvedValue(null);
    txnRepo.findOne.mockResolvedValue({
      id: 't2',
      status: 'pending',
      type: 'withdrawal',
      amount: '100.00',
    });
    snapRepo.findOne.mockResolvedValue({
      accountId: 'a1',
      balance: '5.00',
    });

    await service.executeRequested(
      makeRequestedEnvelope({
        transactionId: 't2',
        type: 'withdrawal',
        amount: 100,
        sourceAccountId: 'a1',
      }),
    );

    expect(txnRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'rejected',
        reason: 'Insufficient balance',
      }),
    );
    const rejected = outboxRepo.save.mock.calls.find(
      (c) => c[0].eventType === 'TransactionRejected',
    );
    expect(rejected).toBeDefined();
    const p = JSON.parse(rejected![0].payload);
    expect(p.eventType).toBe('TransactionRejected');
    expect(p.payload.reason).toBe('Insufficient balance');
  });

  it('rechaza monto inválido', async () => {
    procRepo.findOne.mockResolvedValue(null);
    txnRepo.findOne.mockResolvedValue({
      id: 't3',
      status: 'pending',
      type: 'deposit',
      amount: '0',
    });

    await service.executeRequested(
      makeRequestedEnvelope({
        transactionId: 't3',
        type: 'deposit',
        amount: 0,
        targetAccountId: 'a1',
      }),
    );

    expect(txnRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'rejected', reason: 'Invalid amount' }),
    );
  });

  it('transfer: dos TransactionCompleted (origen y destino)', async () => {
    procRepo.findOne.mockResolvedValue(null);
    txnRepo.findOne.mockResolvedValue({
      id: 't-tr',
      status: 'pending',
      type: 'transfer',
      amount: '30.00',
    });
    const src = { accountId: 'src-a', clientId: 'c1', balance: '100.00' };
    const dst = { accountId: 'dst-a', clientId: 'c1', balance: '20.00' };
    snapRepo.findOne.mockImplementation(
      async ({ where }: { where: { accountId: string } }) => {
        if (where.accountId === 'src-a') return src;
        if (where.accountId === 'dst-a') return dst;
        return null;
      },
    );

    await service.executeRequested(
      makeRequestedEnvelope({
        transactionId: 't-tr',
        type: 'transfer',
        amount: 30,
        sourceAccountId: 'src-a',
        targetAccountId: 'dst-a',
      }),
    );

    expect(src.balance).toBe('70.00');
    expect(dst.balance).toBe('50.00');
    const completed = outboxRepo.save.mock.calls.filter(
      (c) => c[0].eventType === 'TransactionCompleted',
    );
    expect(completed).toHaveLength(2);
    const amounts = completed.map((c) => JSON.parse(c[0].payload).payload);
    expect(amounts).toEqual(
      expect.arrayContaining([
        { transactionId: 't-tr', amount: -30, accountId: 'src-a' },
        { transactionId: 't-tr', amount: 30, accountId: 'dst-a' },
      ]),
    );
  });

  it('si la transacción no está pending solo marca el evento procesado', async () => {
    procRepo.findOne.mockResolvedValue(null);
    txnRepo.findOne.mockResolvedValue({
      id: 't4',
      status: 'completed',
      type: 'deposit',
      amount: '10.00',
    });

    await service.executeRequested(
      makeRequestedEnvelope({
        transactionId: 't4',
        type: 'deposit',
        amount: 10,
        targetAccountId: 'a1',
      }),
    );

    expect(snapRepo.findOne).not.toHaveBeenCalled();
    expect(outboxRepo.save).not.toHaveBeenCalled();
    expect(procRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ eventId: 'event-uuid-1' }),
    );
  });
});
