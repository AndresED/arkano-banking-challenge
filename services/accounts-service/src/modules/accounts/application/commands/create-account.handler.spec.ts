import { DataSource, EntityManager, Repository } from 'typeorm';
import { NotFoundException } from '@nestjs/common';
import { CreateAccountHandler } from './create-account.handler';
import { CreateAccountCommand } from './create-account.command';
import { ClientOrmEntity } from '../../../../infrastructure/persistence/client.orm-entity';
import { AccountOrmEntity } from '../../../../infrastructure/persistence/account.orm-entity';
import { OutboxEventOrmEntity } from '../../../../infrastructure/persistence/outbox-event.orm-entity';
import { TOPIC_ACCOUNT_EVENTS } from '../../../../common/topics';

describe('CreateAccountHandler', () => {
  let handler: CreateAccountHandler;
  let clientsFindOne: jest.Mock;
  let accountRepoSave: jest.Mock;
  let outboxRepoSave: jest.Mock;

  beforeEach(() => {
    clientsFindOne = jest.fn();
    accountRepoSave = jest.fn().mockResolvedValue({});
    outboxRepoSave = jest.fn().mockResolvedValue({});

    const em = {
      getRepository: (entity: unknown) => {
        if (entity === AccountOrmEntity) return { save: accountRepoSave };
        if (entity === OutboxEventOrmEntity) return { save: outboxRepoSave };
        throw new Error(`Unexpected entity ${String(entity)}`);
      },
    } as unknown as EntityManager;

    const dataSource = {
      transaction: jest.fn(async (cb: (m: EntityManager) => Promise<void>) => {
        await cb(em);
      }),
    } as unknown as DataSource;

    const clients = {
      findOne: clientsFindOne,
    } as unknown as Repository<ClientOrmEntity>;

    handler = new CreateAccountHandler(dataSource, clients);
  });

  it('lanza NotFoundException si el cliente no existe', async () => {
    clientsFindOne.mockResolvedValue(null);
    await expect(
      handler.execute(
        new CreateAccountCommand({
          clientId: '00000000-0000-4000-8000-000000000099',
        }),
      ),
    ).rejects.toThrow(NotFoundException);
    expect(accountRepoSave).not.toHaveBeenCalled();
  });

  it('crea cuenta en 0 y outbox AccountCreated', async () => {
    const clientId = '00000000-0000-4000-8000-000000000001';
    clientsFindOne.mockResolvedValue({
      id: clientId,
      name: 'X',
      email: 'x@y.z',
    });

    const result = await handler.execute(
      new CreateAccountCommand({ clientId }),
    );

    expect(result.accountId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
    expect(accountRepoSave).toHaveBeenCalledWith({
      id: result.accountId,
      clientId,
      balance: '0.00',
    });
    expect(outboxRepoSave).toHaveBeenCalledWith(
      expect.objectContaining({
        topic: TOPIC_ACCOUNT_EVENTS,
        partitionKey: result.accountId,
        eventType: 'AccountCreated',
        published: false,
      }),
    );
    const payload = JSON.parse(
      (outboxRepoSave.mock.calls[0][0] as { payload: string }).payload,
    );
    expect(payload.eventType).toBe('AccountCreated');
    expect(payload.payload).toMatchObject({
      accountId: result.accountId,
      clientId,
      balance: 0,
    });
  });
});
