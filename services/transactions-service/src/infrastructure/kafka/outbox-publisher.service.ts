import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OutboxEventOrmEntity } from '../persistence/outbox-event.orm-entity';
import { KafkaService } from './kafka.service';

@Injectable()
export class OutboxPublisherService implements OnModuleInit {
  private readonly logger = new Logger(OutboxPublisherService.name);
  private timer?: ReturnType<typeof setInterval>;

  constructor(
    @InjectRepository(OutboxEventOrmEntity)
    private readonly outbox: Repository<OutboxEventOrmEntity>,
    private readonly kafka: KafkaService,
  ) {}

  onModuleInit(): void {
    this.timer = setInterval(() => {
      void this.flushOnce().catch((e) =>
        this.logger.error(`Outbox flush failed: ${e}`),
      );
    }, 500);
  }

  async flushOnce(): Promise<void> {
    const batch = await this.outbox.find({
      where: { published: false },
      order: { createdAt: 'ASC' },
      take: 50,
    });
    for (const row of batch) {
      try {
        await this.kafka.send(row.topic, row.partitionKey, row.payload);
        row.published = true;
        row.publishedAt = new Date();
        await this.outbox.save(row);
      } catch (e) {
        this.logger.warn(`Failed to publish outbox ${row.id}: ${e}`);
      }
    }
  }
}
