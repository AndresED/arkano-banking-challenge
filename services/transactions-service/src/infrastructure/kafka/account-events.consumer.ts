import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  EventEnvelope,
  parseEnvelope,
} from '../../common/events/event-envelope';
import { TOPIC_ACCOUNT_EVENTS } from '../../common/topics';
import { KafkaService } from './kafka.service';
import {
  AccountCreatedPayload,
  AccountEventApplierService,
  BalanceUpdatedPayload,
} from './account-event-applier.service';

@Injectable()
export class AccountEventsConsumer implements OnModuleInit {
  private readonly logger = new Logger(AccountEventsConsumer.name);

  constructor(
    private readonly kafkaService: KafkaService,
    private readonly applier: AccountEventApplierService,
  ) {}

  async onModuleInit(): Promise<void> {
    const consumer = this.kafkaService.getKafka().consumer({
      groupId: 'transactions-service-account-events',
    });
    await consumer.connect();
    await consumer.subscribe({
      topic: TOPIC_ACCOUNT_EVENTS,
      fromBeginning: true,
    });
    await consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        if (!message.value) return;
        try {
          const env = parseEnvelope(message.value.toString());
          this.logger.log(
            `[EVENT-BUS] CONSUME [transactions-service] <- topic=${topic} ` +
              `partition=${partition} offset=${message.offset} ` +
              `eventType=${env.eventType} eventId=${env.eventId}`,
          );
          if (env.eventType === 'AccountCreated') {
            await this.applier.applyAccountCreated(
              env as EventEnvelope<AccountCreatedPayload>,
            );
            this.logger.log(
              `[EVENT-BUS] DONE [transactions-service] AccountCreated eventId=${env.eventId}`,
            );
          } else if (env.eventType === 'BalanceUpdated') {
            await this.applier.applyBalanceUpdated(
              env as EventEnvelope<BalanceUpdatedPayload>,
            );
            this.logger.log(
              `[EVENT-BUS] DONE [transactions-service] BalanceUpdated eventId=${env.eventId}`,
            );
          } else {
            this.logger.log(
              `[EVENT-BUS] SKIP [transactions-service] eventType=${env.eventType} ` +
                `(solo AccountCreated / BalanceUpdated; p. ej. ClientCreated se ignora)`,
            );
          }
        } catch (e) {
          this.logger.error(`account-events consumer: ${e}`);
        }
      },
    });
    this.logger.log(`Subscribed to ${TOPIC_ACCOUNT_EVENTS}`);
  }
}
