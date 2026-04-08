import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

export type TransactionType = 'deposit' | 'withdrawal' | 'transfer';
export type TransactionStatus = 'pending' | 'completed' | 'rejected';

@Entity('transactions')
export class TransactionOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 32 })
  type!: TransactionType;

  @Column({ type: 'decimal', precision: 18, scale: 2 })
  amount!: string;

  @Column({ name: 'source_account_id', type: 'uuid', nullable: true })
  sourceAccountId!: string | null;

  @Column({ name: 'target_account_id', type: 'uuid', nullable: true })
  targetAccountId!: string | null;

  @Column({ type: 'varchar', length: 32 })
  status!: TransactionStatus;

  @Column({ type: 'text', nullable: true })
  reason!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
