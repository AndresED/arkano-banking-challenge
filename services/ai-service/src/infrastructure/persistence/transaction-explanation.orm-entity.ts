import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('transaction_explanations')
export class TransactionExplanationOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'transaction_id', type: 'uuid' })
  transactionId!: string;

  /** Cuenta afectada (solo en TransactionCompleted; null en rechazos sin cuenta en el payload). */
  @Index()
  @Column({ name: 'account_id', type: 'uuid', nullable: true })
  accountId!: string | null;

  @Column({ name: 'event_type', type: 'varchar', length: 64 })
  eventType!: string;

  @Column({ type: 'text' })
  explanation!: string;

  @Column({ name: 'source_event_id', type: 'uuid', unique: true })
  sourceEventId!: string;

  @Column({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
