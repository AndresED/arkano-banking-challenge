import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { ExplanationsService } from './explanations.service';

@Controller()
export class ExplanationsController {
  constructor(private readonly explanations: ExplanationsService) {}

  /** Debe declararse antes de :transactionId para no capturar "account" como UUID. */
  @Get('explanations/account/:accountId/summary')
  getAccountSummary(@Param('accountId', ParseUUIDPipe) accountId: string) {
    return this.explanations.getAccountHistorySummary(accountId);
  }

  @Get('explanations/:transactionId')
  getByTransaction(
    @Param('transactionId', ParseUUIDPipe) transactionId: string,
  ) {
    return this.explanations.getByTransactionId(transactionId);
  }
}
