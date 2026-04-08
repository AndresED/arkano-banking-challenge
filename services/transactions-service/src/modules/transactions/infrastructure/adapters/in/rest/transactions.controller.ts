import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { RequestTransactionCommand } from '../../../../application/commands/request-transaction.command';
import { RequestTransactionDto } from '../../../../application/dtos/request-transaction.dto';
import { GetTransactionByIdQuery } from '../../../../application/queries/get-transaction-by-id.query';

@Controller()
export class TransactionsController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Post('transactions')
  @HttpCode(202)
  requestTransaction(@Body() dto: RequestTransactionDto) {
    return this.commandBus.execute(new RequestTransactionCommand(dto));
  }

  @Get('transactions/:id')
  getTransaction(@Param('id', ParseUUIDPipe) id: string) {
    return this.queryBus.execute(new GetTransactionByIdQuery(id));
  }
}
