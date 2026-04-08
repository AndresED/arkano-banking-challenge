import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccountOrmEntity } from '../../infrastructure/persistence/account.orm-entity';
import { AppliedTransactionLegOrmEntity } from '../../infrastructure/persistence/applied-transaction-leg.orm-entity';
import { ClientOrmEntity } from '../../infrastructure/persistence/client.orm-entity';
import { OutboxEventOrmEntity } from '../../infrastructure/persistence/outbox-event.orm-entity';
import { ProcessedEventOrmEntity } from '../../infrastructure/persistence/processed-event.orm-entity';
import { KafkaService } from '../../infrastructure/kafka/kafka.service';
import { OutboxPublisherService } from '../../infrastructure/kafka/outbox-publisher.service';
import { TransactionCompletedApplierService } from '../../infrastructure/kafka/transaction-completed-applier.service';
import { TransactionEventsConsumer } from '../../infrastructure/kafka/transaction-events.consumer';
import { CreateAccountHandler } from './application/commands/create-account.handler';
import { CreateClientHandler } from './application/commands/create-client.handler';
import { GetAccountByIdHandler } from './application/queries/get-account-by-id.handler';
import { AccountsController } from './infrastructure/adapters/in/rest/accounts.controller';

const Handlers = [
  CreateClientHandler,
  CreateAccountHandler,
  GetAccountByIdHandler,
];

@Module({
  imports: [
    CqrsModule,
    TypeOrmModule.forFeature([
      ClientOrmEntity,
      AccountOrmEntity,
      OutboxEventOrmEntity,
      ProcessedEventOrmEntity,
      AppliedTransactionLegOrmEntity,
    ]),
  ],
  controllers: [AccountsController],
  providers: [
    ...Handlers,
    KafkaService,
    OutboxPublisherService,
    TransactionCompletedApplierService,
    TransactionEventsConsumer,
  ],
})
export class AccountsModule {}
