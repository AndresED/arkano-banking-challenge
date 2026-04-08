import { NotFoundException } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TransactionOrmEntity } from '../../../../infrastructure/persistence/transaction.orm-entity';
import { GetTransactionByIdQuery } from './get-transaction-by-id.query';

export type TransactionView = {
  transactionId: string;
  type: string;
  amount: number;
  sourceAccountId: string | null;
  targetAccountId: string | null;
  status: string;
  reason: string | null;
};

@QueryHandler(GetTransactionByIdQuery)
export class GetTransactionByIdHandler implements IQueryHandler<
  GetTransactionByIdQuery,
  TransactionView
> {
  constructor(
    @InjectRepository(TransactionOrmEntity)
    private readonly txns: Repository<TransactionOrmEntity>,
  ) {}

  async execute(query: GetTransactionByIdQuery): Promise<TransactionView> {
    const row = await this.txns.findOne({ where: { id: query.transactionId } });
    if (!row) throw new NotFoundException('Transaction not found');
    return {
      transactionId: row.id,
      type: row.type,
      amount: Number(row.amount),
      sourceAccountId: row.sourceAccountId,
      targetAccountId: row.targetAccountId,
      status: row.status,
      reason: row.reason,
    };
  }
}
