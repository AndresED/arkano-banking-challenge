import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import {
  EVENT_VERSION,
  EventEnvelope,
} from '../../../../common/events/event-envelope';
import { TOPIC_ACCOUNT_EVENTS } from '../../../../common/topics';
import { ClientOrmEntity } from '../../../../infrastructure/persistence/client.orm-entity';
import { OutboxEventOrmEntity } from '../../../../infrastructure/persistence/outbox-event.orm-entity';
import { CreateClientCommand } from './create-client.command';

@CommandHandler(CreateClientCommand)
export class CreateClientHandler implements ICommandHandler<CreateClientCommand> {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(ClientOrmEntity)
    private readonly clients: Repository<ClientOrmEntity>,
  ) {}

  async execute(command: CreateClientCommand): Promise<{ clientId: string }> {
    const id = randomUUID();
    await this.dataSource.transaction(async (em) => {
      const clientRepo = em.getRepository(ClientOrmEntity);
      const outboxRepo = em.getRepository(OutboxEventOrmEntity);
      await clientRepo.save({
        id,
        name: command.dto.name,
        email: command.dto.email,
      });
      const envelope: EventEnvelope = {
        eventId: randomUUID(),
        eventType: 'ClientCreated',
        source: 'accounts-service',
        occurredAt: new Date().toISOString(),
        version: EVENT_VERSION,
        payload: {
          clientId: id,
          name: command.dto.name,
          email: command.dto.email,
        },
      };
      await outboxRepo.save({
        topic: TOPIC_ACCOUNT_EVENTS,
        partitionKey: id,
        eventType: 'ClientCreated',
        payload: JSON.stringify(envelope),
        published: false,
      });
    });
    return { clientId: id };
  }
}
