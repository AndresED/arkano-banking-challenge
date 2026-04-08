import { BadRequestException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { RequestTransactionHandler } from './request-transaction.handler';
import { RequestTransactionCommand } from './request-transaction.command';
import type { RequestTransactionDto } from '../dtos/request-transaction.dto';
import { TransactionOrmEntity } from '../../../../infrastructure/persistence/transaction.orm-entity';
import { OutboxEventOrmEntity } from '../../../../infrastructure/persistence/outbox-event.orm-entity';
import { TOPIC_TRANSACTION_EVENTS } from '../../../../common/topics';

describe('RequestTransactionHandler', () => {
  let handler: RequestTransactionHandler;
  let txnRepoSave: jest.Mock;
  let outboxRepoSave: jest.Mock;

  beforeEach(() => {
    txnRepoSave = jest.fn().mockResolvedValue({});
    outboxRepoSave = jest.fn().mockResolvedValue({});

    const em = {
      getRepository: (entity: unknown) => {
        if (entity === TransactionOrmEntity) return { save: txnRepoSave };
        if (entity === OutboxEventOrmEntity) return { save: outboxRepoSave };
        throw new Error(`Unexpected entity ${String(entity)}`);
      },
    } as unknown as EntityManager;

    const dataSource = {
      transaction: jest.fn(async (cb: (m: EntityManager) => Promise<void>) => {
        await cb(em);
      }),
    } as unknown as DataSource;

    handler = new RequestTransactionHandler(dataSource);
  });

  it('deposit sin targetAccountId → 400', async () => {
    await expect(
      handler.execute(
        new RequestTransactionCommand({
          type: 'deposit',
          amount: 10,
        } as RequestTransactionDto),
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('transfer sin cuentas → 400', async () => {
    await expect(
      handler.execute(
        new RequestTransactionCommand({
          type: 'transfer',
          amount: 1,
        } as RequestTransactionDto),
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('persiste pending y outbox TransactionRequested', async () => {
    const res = await handler.execute(
      new RequestTransactionCommand({
        type: 'transfer',
        amount: 15.25,
        sourceAccountId: '00000000-0000-4000-8000-000000000001',
        targetAccountId: '00000000-0000-4000-8000-000000000002',
      }),
    );

    expect(res.status).toBe('pending');
    expect(res.transactionId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );

    expect(txnRepoSave).toHaveBeenCalledWith(
      expect.objectContaining({
        id: res.transactionId,
        type: 'transfer',
        amount: '15.25',
        status: 'pending',
      }),
    );
    expect(outboxRepoSave).toHaveBeenCalledWith(
      expect.objectContaining({
        topic: TOPIC_TRANSACTION_EVENTS,
        partitionKey: '00000000-0000-4000-8000-000000000001',
        eventType: 'TransactionRequested',
        published: false,
      }),
    );
    const env = JSON.parse(
      (outboxRepoSave.mock.calls[0][0] as { payload: string }).payload,
    );
    expect(env.eventType).toBe('TransactionRequested');
    expect(env.payload).toMatchObject({
      transactionId: res.transactionId,
      type: 'transfer',
      amount: 15.25,
    });
  });
});
