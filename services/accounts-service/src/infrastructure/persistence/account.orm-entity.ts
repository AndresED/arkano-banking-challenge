import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ClientOrmEntity } from './client.orm-entity';

@Entity('accounts')
export class AccountOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'client_id', type: 'uuid' })
  clientId!: string;

  @ManyToOne(() => ClientOrmEntity, (c) => c.accounts, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'client_id' })
  client!: ClientOrmEntity;

  @Column({ type: 'decimal', precision: 18, scale: 2, default: '0' })
  balance!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
