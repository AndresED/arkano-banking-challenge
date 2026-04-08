import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

@Entity('account_snapshots')
export class AccountSnapshotOrmEntity {
  @PrimaryColumn({ name: 'account_id', type: 'uuid' })
  accountId!: string;

  @Column({ name: 'client_id', type: 'uuid', nullable: true })
  clientId!: string | null;

  @Column({ type: 'decimal', precision: 18, scale: 2 })
  balance!: string;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
