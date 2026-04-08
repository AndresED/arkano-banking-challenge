import { DataSource, EntityManager, Repository } from 'typeorm';
import { CreateClientHandler } from './create-client.handler';
import { CreateClientCommand } from './create-client.command';
import { ClientOrmEntity } from '../../../../infrastructure/persistence/client.orm-entity';
import { OutboxEventOrmEntity } from '../../../../infrastructure/persistence/outbox-event.orm-entity';
import { TOPIC_ACCOUNT_EVENTS } from '../../../../common/topics';

describe('CreateClientHandler', () => {
  let handler: CreateClientHandler;
  let clientRepoSave: jest.Mock;
  let outboxRepoSave: jest.Mock;

  beforeEach(() => {
    clientRepoSave = jest.fn().mockResolvedValue({});
    outboxRepoSave = jest.fn().mockResolvedValue({});

    const em = {
      getRepository: (entity: unknown) => {
        if (entity === ClientOrmEntity) return { save: clientRepoSave };
        if (entity === OutboxEventOrmEntity) return { save: outboxRepoSave };
        throw new Error(`Unexpected entity ${String(entity)}`);
      },
    } as unknown as EntityManager;

    const dataSource = {
      transaction: jest.fn(async (cb: (m: EntityManager) => Promise<void>) => {
        await cb(em);
      }),
    } as unknown as DataSource;

    handler = new CreateClientHandler(
      dataSource,
      {} as Repository<ClientOrmEntity>,
    );
  });

  it('persiste cliente y outbox ClientCreated con envelope coherente', async () => {
    const result = await handler.execute(
      new CreateClientCommand({ name: 'Ana', email: 'ana@example.com' }),
    );

    expect(result.clientId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );

    expect(clientRepoSave).toHaveBeenCalledWith({
      id: result.clientId,
      name: 'Ana',
      email: 'ana@example.com',
    });

    expect(outboxRepoSave).toHaveBeenCalledWith(
      expect.objectContaining({
        topic: TOPIC_ACCOUNT_EVENTS,
        partitionKey: result.clientId,
        eventType: 'ClientCreated',
        published: false,
      }),
    );

    const saved = outboxRepoSave.mock.calls[0][0] as { payload: string };
    const envelope = JSON.parse(saved.payload);
    expect(envelope.eventType).toBe('ClientCreated');
    expect(envelope.source).toBe('accounts-service');
    expect(envelope.payload).toEqual({
      clientId: result.clientId,
      name: 'Ana',
      email: 'ana@example.com',
    });
    expect(envelope.eventId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
  });
});
