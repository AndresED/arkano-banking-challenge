import { NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import {
  EVENT_VERSION,
  EventEnvelope,
} from '../../../../common/events/event-envelope';
import { TOPIC_ACCOUNT_EVENTS } from '../../../../common/topics';
import { AccountOrmEntity } from '../../../../infrastructure/persistence/account.orm-entity';
import { ClientOrmEntity } from '../../../../infrastructure/persistence/client.orm-entity';
import { OutboxEventOrmEntity } from '../../../../infrastructure/persistence/outbox-event.orm-entity';
import { CreateAccountCommand } from './create-account.command';

@CommandHandler(CreateAccountCommand)
export class CreateAccountHandler implements ICommandHandler<CreateAccountCommand> {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(ClientOrmEntity)
    private readonly clients: Repository<ClientOrmEntity>,
  ) {}

  async execute(command: CreateAccountCommand): Promise<{ accountId: string }> {
    const client = await this.clients.findOne({
      where: { id: command.dto.clientId },
    });
    if (!client) {
      throw new NotFoundException('Client not found');
    }

    const accountId = randomUUID();
    await this.dataSource.transaction(async (em) => {
      const accountRepo = em.getRepository(AccountOrmEntity);
      const outboxRepo = em.getRepository(OutboxEventOrmEntity);

      await accountRepo.save({
        id: accountId,
        clientId: command.dto.clientId,
        balance: '0.00',
      });

      const envelope: EventEnvelope = {
        eventId: randomUUID(),
        eventType: 'AccountCreated',
        source: 'accounts-service',
        occurredAt: new Date().toISOString(),
        version: EVENT_VERSION,
        payload: {
          accountId,
          clientId: command.dto.clientId,
          balance: 0,
        },
      };

      await outboxRepo.save({
        topic: TOPIC_ACCOUNT_EVENTS,
        partitionKey: accountId,
        eventType: 'AccountCreated',
        payload: JSON.stringify(envelope),
        published: false,
      });
    });

    return { accountId };
  }
}
