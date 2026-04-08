import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('processed_events')
export class ProcessedEventOrmEntity {
  @PrimaryColumn({ name: 'event_id', type: 'uuid' })
  eventId!: string;

  @Column({ name: 'processed_at', type: 'timestamptz' })
  processedAt!: Date;
}
