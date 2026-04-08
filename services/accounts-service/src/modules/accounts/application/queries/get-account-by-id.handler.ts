import { NotFoundException } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AccountOrmEntity } from '../../../../infrastructure/persistence/account.orm-entity';
import { GetAccountByIdQuery } from './get-account-by-id.query';

export type AccountView = {
  accountId: string;
  clientId: string;
  balance: number;
};

@QueryHandler(GetAccountByIdQuery)
export class GetAccountByIdHandler implements IQueryHandler<
  GetAccountByIdQuery,
  AccountView
> {
  constructor(
    @InjectRepository(AccountOrmEntity)
    private readonly accounts: Repository<AccountOrmEntity>,
  ) {}

  async execute(query: GetAccountByIdQuery): Promise<AccountView> {
    const row = await this.accounts.findOne({ where: { id: query.accountId } });
    if (!row) throw new NotFoundException('Account not found');
    return {
      accountId: row.id,
      clientId: row.clientId,
      balance: Number(row.balance),
    };
  }
}
