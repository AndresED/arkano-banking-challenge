import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Kafka, Producer } from 'kafkajs';
import {
  TOPIC_ACCOUNT_EVENTS,
  TOPIC_TRANSACTION_EVENTS,
} from '../../common/topics';

@Injectable()
export class KafkaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(KafkaService.name);
  private kafka!: Kafka;
  private producer!: Producer;

  constructor(private readonly config: ConfigService) {}

  async onModuleInit(): Promise<void> {
    const brokers = this.config
      .getOrThrow<string>('KAFKA_BROKERS')
      .split(',')
      .map((b) => b.trim());
    this.kafka = new Kafka({ clientId: 'accounts-service', brokers });
    const admin = this.kafka.admin();
    await admin.connect();
    try {
      await admin.createTopics({
        topics: [
          {
            topic: TOPIC_ACCOUNT_EVENTS,
            numPartitions: 3,
            replicationFactor: 1,
          },
          {
            topic: TOPIC_TRANSACTION_EVENTS,
            numPartitions: 3,
            replicationFactor: 1,
          },
        ],
        waitForLeaders: true,
      });
    } catch (e) {
      this.logger.warn(`Topic create (may already exist): ${e}`);
    }
    await admin.disconnect();

    this.producer = this.kafka.producer();
    await this.producer.connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.producer?.disconnect();
  }

  getKafka(): Kafka {
    return this.kafka;
  }

  async send(topic: string, key: string | null, value: string): Promise<void> {
    this.logBusPublish(topic, key, value);
    await this.producer.send({
      topic,
      messages: [{ key: key ?? undefined, value }],
    });
  }

  private logBusPublish(topic: string, key: string | null, value: string): void {
    try {
      const j = JSON.parse(value) as {
        eventType?: string;
        eventId?: string;
        payload?: { transactionId?: string; accountId?: string };
      };
      const tx = j.payload?.transactionId;
      const acc = j.payload?.accountId;
      this.logger.log(
        `[EVENT-BUS] PUBLISH [accounts-service] -> topic=${topic} key=${key ?? 'null'} ` +
          `eventType=${j.eventType ?? '?'} eventId=${j.eventId ?? '?'}` +
          (tx ? ` transactionId=${tx}` : '') +
          (acc ? ` accountId=${acc}` : ''),
      );
    } catch {
      this.logger.log(
        `[EVENT-BUS] PUBLISH [accounts-service] -> topic=${topic} key=${key ?? 'null'} (raw)`,
      );
    }
  }
}
