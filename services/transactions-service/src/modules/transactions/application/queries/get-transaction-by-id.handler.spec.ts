import { NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { GetTransactionByIdHandler } from './get-transaction-by-id.handler';
import { GetTransactionByIdQuery } from './get-transaction-by-id.query';
import { TransactionOrmEntity } from '../../../../infrastructure/persistence/transaction.orm-entity';

describe('GetTransactionByIdHandler', () => {
  let handler: GetTransactionByIdHandler;
  let findOne: jest.Mock;

  beforeEach(() => {
    findOne = jest.fn();
    handler = new GetTransactionByIdHandler({
      findOne,
    } as unknown as Repository<TransactionOrmEntity>);
  });

  it('404 si no existe', async () => {
    findOne.mockResolvedValue(null);
    await expect(
      handler.execute(
        new GetTransactionByIdQuery('00000000-0000-4000-8000-000000000001'),
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('mapea fila a TransactionView', async () => {
    findOne.mockResolvedValue({
      id: '00000000-0000-4000-8000-000000000002',
      type: 'withdrawal',
      amount: '50.00',
      sourceAccountId: '00000000-0000-4000-8000-000000000003',
      targetAccountId: null,
      status: 'completed',
      reason: null,
    });
    const v = await handler.execute(
      new GetTransactionByIdQuery('00000000-0000-4000-8000-000000000002'),
    );
    expect(v).toEqual({
      transactionId: '00000000-0000-4000-8000-000000000002',
      type: 'withdrawal',
      amount: 50,
      sourceAccountId: '00000000-0000-4000-8000-000000000003',
      targetAccountId: null,
      status: 'completed',
      reason: null,
    });
  });
});
