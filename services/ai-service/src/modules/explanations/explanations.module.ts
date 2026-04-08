import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TransactionExplanationOrmEntity } from '../../infrastructure/persistence/transaction-explanation.orm-entity';
import { ProcessedEventOrmEntity } from '../../infrastructure/persistence/processed-event.orm-entity';
import { KafkaService } from '../../infrastructure/kafka/kafka.service';
import { MockLlmService } from '../../infrastructure/kafka/mock-llm.service';
import { OllamaLlmService } from '../../infrastructure/kafka/ollama-llm.service';
import { LlmOrchestratorService } from '../../infrastructure/kafka/llm-orchestrator.service';
import { AiTransactionEventApplierService } from '../../infrastructure/kafka/ai-transaction-event-applier.service';
import { TransactionEventsConsumer } from '../../infrastructure/kafka/transaction-events.consumer';
import { ExplanationsController } from './explanations.controller';
import { ExplanationsService } from './explanations.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ProcessedEventOrmEntity,
      TransactionExplanationOrmEntity,
    ]),
  ],
  controllers: [ExplanationsController],
  providers: [
    ExplanationsService,
    KafkaService,
    MockLlmService,
    OllamaLlmService,
    LlmOrchestratorService,
    AiTransactionEventApplierService,
    TransactionEventsConsumer,
  ],
})
export class ExplanationsModule {}
