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
  TOPIC_TRANSACTION_EVENTS_DLQ,
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
    this.kafka = new Kafka({
      clientId: 'transactions-service',
      brokers,
    });
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
          {
            topic: TOPIC_TRANSACTION_EVENTS_DLQ,
            numPartitions: 1,
            replicationFactor: 1,
          },
        ],
        waitForLeaders: true,
      });
    } catch (e) {
      this.logger.warn(`Topic create: ${e}`);
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
    await this.producer.send({
      topic,
      messages: [{ key: key ?? undefined, value }],
    });
  }
}
