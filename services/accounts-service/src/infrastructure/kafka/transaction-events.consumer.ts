import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  EventEnvelope,
  parseEnvelope,
} from '../../common/events/event-envelope';
import { TOPIC_TRANSACTION_EVENTS } from '../../common/topics';
import { KafkaService } from './kafka.service';
import {
  TransactionCompletedApplierService,
  TransactionCompletedPayload,
} from './transaction-completed-applier.service';

@Injectable()
export class TransactionEventsConsumer implements OnModuleInit {
  private readonly logger = new Logger(TransactionEventsConsumer.name);

  constructor(
    private readonly config: ConfigService,
    private readonly kafkaService: KafkaService,
    private readonly applier: TransactionCompletedApplierService,
  ) {}

  async onModuleInit(): Promise<void> {
    const brokers = this.config
      .getOrThrow<string>('KAFKA_BROKERS')
      .split(',')
      .map((b) => b.trim());
    const consumer = this.kafkaService.getKafka().consumer({
      groupId: 'accounts-service-transaction-events',
    });
    await consumer.connect();
    await consumer.subscribe({
      topic: TOPIC_TRANSACTION_EVENTS,
      fromBeginning: false,
    });
    await consumer.run({
      eachMessage: async ({ message }) => {
        if (!message.value) return;
        try {
          const env = parseEnvelope(message.value.toString());
          if (env.eventType !== 'TransactionCompleted') return;
          await this.applier.apply(
            env as EventEnvelope<TransactionCompletedPayload>,
          );
        } catch (e) {
          this.logger.error(`Consumer error: ${e}`);
        }
      },
    });
    this.logger.log(
      `Subscribed to ${TOPIC_TRANSACTION_EVENTS} (${brokers.join(',')})`,
    );
  }
}
