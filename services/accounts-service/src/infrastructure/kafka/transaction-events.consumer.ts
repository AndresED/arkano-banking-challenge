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
      eachMessage: async ({ topic, partition, message }) => {
        if (!message.value) return;
        try {
          const env = parseEnvelope(message.value.toString());
          this.logger.log(
            `[EVENT-BUS] CONSUME [accounts-service] <- topic=${topic} ` +
              `partition=${partition} offset=${message.offset} ` +
              `eventType=${env.eventType} eventId=${env.eventId}`,
          );
          if (env.eventType !== 'TransactionCompleted') {
            this.logger.log(
              `[EVENT-BUS] SKIP [accounts-service] eventId=${env.eventId} ` +
                `(solo TransactionCompleted; recibido ${env.eventType})`,
            );
            return;
          }
          const pl = env.payload as TransactionCompletedPayload;
          this.logger.log(
            `[EVENT-BUS] EXEC [accounts-service] TransactionCompleted ` +
              `transactionId=${pl.transactionId} accountId=${pl.accountId} amount=${pl.amount}`,
          );
          await this.applier.apply(
            env as EventEnvelope<TransactionCompletedPayload>,
          );
          this.logger.log(
            `[EVENT-BUS] DONE [accounts-service] TransactionCompleted eventId=${env.eventId}`,
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
