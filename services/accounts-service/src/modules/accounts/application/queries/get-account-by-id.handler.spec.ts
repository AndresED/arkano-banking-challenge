import { NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { GetAccountByIdHandler } from './get-account-by-id.handler';
import { GetAccountByIdQuery } from './get-account-by-id.query';
import { AccountOrmEntity } from '../../../../infrastructure/persistence/account.orm-entity';

describe('GetAccountByIdHandler', () => {
  let handler: GetAccountByIdHandler;
  let findOne: jest.Mock;

  beforeEach(() => {
    findOne = jest.fn();
    const accounts = { findOne } as unknown as Repository<AccountOrmEntity>;
    handler = new GetAccountByIdHandler(accounts);
  });

  it('404 si no existe la cuenta', async () => {
    findOne.mockResolvedValue(null);
    await expect(
      handler.execute(
        new GetAccountByIdQuery('00000000-0000-4000-8000-000000000001'),
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('devuelve vista con saldo numérico', async () => {
    findOne.mockResolvedValue({
      id: '00000000-0000-4000-8000-000000000002',
      clientId: '00000000-0000-4000-8000-000000000003',
      balance: '123.45',
    });
    const v = await handler.execute(
      new GetAccountByIdQuery('00000000-0000-4000-8000-000000000002'),
    );
    expect(v).toEqual({
      accountId: '00000000-0000-4000-8000-000000000002',
      clientId: '00000000-0000-4000-8000-000000000003',
      balance: 123.45,
    });
  });
});
