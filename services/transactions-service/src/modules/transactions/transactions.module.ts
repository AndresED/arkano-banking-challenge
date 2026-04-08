import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccountSnapshotOrmEntity } from '../../infrastructure/persistence/account-snapshot.orm-entity';
import { OutboxEventOrmEntity } from '../../infrastructure/persistence/outbox-event.orm-entity';
import { ProcessedEventOrmEntity } from '../../infrastructure/persistence/processed-event.orm-entity';
import { TransactionOrmEntity } from '../../infrastructure/persistence/transaction.orm-entity';
import { AccountEventApplierService } from '../../infrastructure/kafka/account-event-applier.service';
import { AccountEventsConsumer } from '../../infrastructure/kafka/account-events.consumer';
import { KafkaService } from '../../infrastructure/kafka/kafka.service';
import { OutboxPublisherService } from '../../infrastructure/kafka/outbox-publisher.service';
import { TransactionExecuteService } from '../../infrastructure/kafka/transaction-execute.service';
import { TransactionRequestedConsumer } from '../../infrastructure/kafka/transaction-requested.consumer';
import { RequestTransactionHandler } from './application/commands/request-transaction.handler';
import { GetTransactionByIdHandler } from './application/queries/get-transaction-by-id.handler';
import { TransactionsController } from './infrastructure/adapters/in/rest/transactions.controller';

const Handlers = [RequestTransactionHandler, GetTransactionByIdHandler];

@Module({
  imports: [
    CqrsModule,
    TypeOrmModule.forFeature([
      TransactionOrmEntity,
      AccountSnapshotOrmEntity,
      OutboxEventOrmEntity,
      ProcessedEventOrmEntity,
    ]),
  ],
  controllers: [TransactionsController],
  providers: [
    ...Handlers,
    KafkaService,
    OutboxPublisherService,
    AccountEventApplierService,
    AccountEventsConsumer,
    TransactionExecuteService,
    TransactionRequestedConsumer,
  ],
})
export class TransactionsModule {}
