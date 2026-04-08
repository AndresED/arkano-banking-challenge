import { EntityManager, Repository } from 'typeorm';
import { AccountEventApplierService } from './account-event-applier.service';
import { ProcessedEventOrmEntity } from '../persistence/processed-event.orm-entity';
import { AccountSnapshotOrmEntity } from '../persistence/account-snapshot.orm-entity';
import { EVENT_VERSION } from '../../common/events/event-envelope';

describe('AccountEventApplierService', () => {
  let service: AccountEventApplierService;
  let processedFindOne: jest.Mock;
  let procRepo: { findOne: jest.Mock; save: jest.Mock };
  let snapRepo: { findOne: jest.Mock; save: jest.Mock };
  let transaction: jest.Mock;

  beforeEach(() => {
    processedFindOne = jest.fn();
    procRepo = {
      findOne: jest.fn(),
      save: jest.fn().mockResolvedValue({}),
    };
    snapRepo = {
      findOne: jest.fn(),
      save: jest.fn().mockResolvedValue({}),
    };
    transaction = jest.fn(async (cb: (m: EntityManager) => Promise<void>) => {
      const em = {
        getRepository: (entity: unknown) => {
          if (entity === ProcessedEventOrmEntity) return procRepo;
          if (entity === AccountSnapshotOrmEntity) return snapRepo;
          throw new Error(`Unexpected ${String(entity)}`);
        },
      } as unknown as EntityManager;
      await cb(em);
    });

    const snapshots = {
      manager: { transaction },
    } as unknown as Repository<AccountSnapshotOrmEntity>;

    const processed = {
      findOne: processedFindOne,
    } as unknown as Repository<ProcessedEventOrmEntity>;

    service = new AccountEventApplierService(processed, snapshots);
  });

  it('AccountCreated: ignora si ya visto', async () => {
    processedFindOne.mockResolvedValue({ eventId: 'e1' });
    await service.applyAccountCreated({
      eventId: 'e1',
      eventType: 'AccountCreated',
      source: 'accounts-service',
      occurredAt: '2026-01-01T00:00:00.000Z',
      version: EVENT_VERSION,
      payload: { accountId: 'a1', clientId: 'c1', balance: 0 },
    });
    expect(transaction).not.toHaveBeenCalled();
  });

  it('AccountCreated: inserta snapshot y processed', async () => {
    processedFindOne.mockResolvedValue(null);
    procRepo.findOne.mockResolvedValue(null);

    await service.applyAccountCreated({
      eventId: 'e-ac-1',
      eventType: 'AccountCreated',
      source: 'accounts-service',
      occurredAt: '2026-01-01T00:00:00.000Z',
      version: EVENT_VERSION,
      payload: { accountId: 'a1', clientId: 'c1', balance: 0 },
    });

    expect(snapRepo.save).toHaveBeenCalledWith({
      accountId: 'a1',
      clientId: 'c1',
      balance: '0.00',
    });
    expect(procRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ eventId: 'e-ac-1' }),
    );
  });

  it('BalanceUpdated: actualiza fila existente', async () => {
    processedFindOne.mockResolvedValue(null);
    procRepo.findOne.mockResolvedValue(null);
    const row = { accountId: 'a1', clientId: 'c1', balance: '10.00' };
    snapRepo.findOne.mockResolvedValue(row);

    await service.applyBalanceUpdated({
      eventId: 'e-bu-1',
      eventType: 'BalanceUpdated',
      source: 'accounts-service',
      occurredAt: '2026-01-01T00:00:00.000Z',
      version: EVENT_VERSION,
      payload: { accountId: 'a1', newBalance: 250.5 },
    });

    expect(row.balance).toBe('250.50');
    expect(snapRepo.save).toHaveBeenCalledWith(row);
    expect(procRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ eventId: 'e-bu-1' }),
    );
  });

  it('BalanceUpdated: sin snapshot aún marca processed igualmente', async () => {
    processedFindOne.mockResolvedValue(null);
    procRepo.findOne.mockResolvedValue(null);
    snapRepo.findOne.mockResolvedValue(null);

    await service.applyBalanceUpdated({
      eventId: 'e-bu-2',
      eventType: 'BalanceUpdated',
      source: 'accounts-service',
      occurredAt: '2026-01-01T00:00:00.000Z',
      version: EVENT_VERSION,
      payload: { accountId: 'ghost', newBalance: 1 },
    });

    expect(snapRepo.save).not.toHaveBeenCalled();
    expect(procRepo.save).toHaveBeenCalled();
  });
});
