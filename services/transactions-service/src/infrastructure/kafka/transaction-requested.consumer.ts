import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  EventEnvelope,
  parseEnvelope,
} from '../../common/events/event-envelope';
import { TOPIC_TRANSACTION_EVENTS } from '../../common/topics';
import { KafkaService } from './kafka.service';
import {
  TransactionExecuteService,
  TransactionRequestedPayload,
} from './transaction-execute.service';

@Injectable()
export class TransactionRequestedConsumer implements OnModuleInit {
  private readonly logger = new Logger(TransactionRequestedConsumer.name);

  constructor(
    private readonly kafkaService: KafkaService,
    private readonly executor: TransactionExecuteService,
  ) {}

  async onModuleInit(): Promise<void> {
    const consumer = this.kafkaService.getKafka().consumer({
      groupId: 'transactions-service-requested-processor',
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
          const p = partition;
          const o = message.offset;
          this.logger.log(
            `[EVENT-BUS] CONSUME [transactions-service] <- topic=${topic} ` +
              `partition=${p} offset=${o} eventType=${env.eventType} eventId=${env.eventId}`,
          );
          if (env.eventType !== 'TransactionRequested') {
            this.logger.log(
              `[EVENT-BUS] SKIP [transactions-service] eventId=${env.eventId} ` +
                `(solo procesa TransactionRequested; recibido ${env.eventType})`,
            );
            return;
          }
          const payload = env.payload as TransactionRequestedPayload;
          this.logger.log(
            `[EVENT-BUS] EXEC [transactions-service] TransactionRequested ` +
              `transactionId=${payload.transactionId} type=${payload.type}`,
          );
          await this.executor.executeRequested(
            env as EventEnvelope<TransactionRequestedPayload>,
          );
          this.logger.log(
            `[EVENT-BUS] DONE [transactions-service] TransactionRequested ` +
              `transactionId=${payload.transactionId}`,
          );
        } catch (e) {
          this.logger.error(`transaction-requested consumer: ${e}`);
        }
      },
    });
    this.logger.log(
      `Processing TransactionRequested from ${TOPIC_TRANSACTION_EVENTS}`,
    );
  }
}
