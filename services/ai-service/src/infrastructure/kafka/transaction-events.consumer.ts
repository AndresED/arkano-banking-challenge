import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  EventEnvelope,
  parseEnvelope,
} from '../../common/events/event-envelope';
import { TOPIC_TRANSACTION_EVENTS } from '../../common/topics';
import { ProcessedEventOrmEntity } from '../persistence/processed-event.orm-entity';
import { KafkaService } from './kafka.service';
import { AiTransactionEventApplierService } from './ai-transaction-event-applier.service';

const MAX_RETRIES = 3;
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

@Injectable()
export class TransactionEventsConsumer implements OnModuleInit {
  private readonly logger = new Logger(TransactionEventsConsumer.name);

  constructor(
    private readonly kafkaService: KafkaService,
    private readonly applier: AiTransactionEventApplierService,
    @InjectRepository(ProcessedEventOrmEntity)
    private readonly processed: Repository<ProcessedEventOrmEntity>,
  ) {}

  async onModuleInit(): Promise<void> {
    const consumer = this.kafkaService.getKafka().consumer({
      groupId: 'ai-service-transaction-events',
    });
    await consumer.connect();
    await consumer.subscribe({
      topic: TOPIC_TRANSACTION_EVENTS,
      fromBeginning: false,
    });
    await consumer.run({
      eachMessage: async ({ message }) => {
        if (!message.value) return;
        const raw = message.value.toString();
        let env: EventEnvelope;
        try {
          env = parseEnvelope(raw);
        } catch (e) {
          this.logger.warn(`Skipping invalid message: ${e}`);
          return;
        }

        if (
          env.eventType !== 'TransactionCompleted' &&
          env.eventType !== 'TransactionRejected'
        ) {
          return;
        }

        const existing = await this.processed.findOne({
          where: { eventId: env.eventId },
        });
        if (existing) return;

        let lastError: unknown;
        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
          try {
            await this.applier.apply(env);
            return;
          } catch (e) {
            lastError = e;
            this.logger.warn(
              `Process attempt ${attempt}/${MAX_RETRIES} failed for ${env.eventId}: ${e}`,
            );
            if (attempt < MAX_RETRIES) {
              await delay(300 * attempt);
            }
          }
        }

        this.logger.error(
          `Moving event ${env.eventId} to DLQ after ${MAX_RETRIES} failures: ${lastError}`,
        );
        await this.kafkaService.sendDlq(env.eventId, raw);
        await this.processed.save({
          eventId: env.eventId,
          processedAt: new Date(),
        });
      },
    });
    this.logger.log(`Subscribed to ${TOPIC_TRANSACTION_EVENTS}`);
  }
}
