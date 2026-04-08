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
      eachMessage: async ({ message }) => {
        if (!message.value) return;
        try {
          const env = parseEnvelope(message.value.toString());
          if (env.eventType === 'AccountCreated') {
            await this.applier.applyAccountCreated(
              env as EventEnvelope<AccountCreatedPayload>,
            );
          } else if (env.eventType === 'BalanceUpdated') {
            await this.applier.applyBalanceUpdated(
              env as EventEnvelope<BalanceUpdatedPayload>,
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
