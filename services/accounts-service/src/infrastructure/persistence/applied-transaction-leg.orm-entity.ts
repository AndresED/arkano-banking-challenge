import { Column, Entity, PrimaryColumn } from 'typeorm';

/** Idempotency for TransactionCompleted per (transactionId, accountId). */
@Entity('applied_transaction_legs')
export class AppliedTransactionLegOrmEntity {
  @PrimaryColumn({ name: 'transaction_id', type: 'uuid' })
  transactionId!: string;

  @PrimaryColumn({ name: 'account_id', type: 'uuid' })
  accountId!: string;

  @Column({ name: 'applied_at', type: 'timestamptz' })
  appliedAt!: Date;
}
