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
import { CreateAccountCommand } from '../../../../application/commands/create-account.command';
import { CreateClientCommand } from '../../../../application/commands/create-client.command';
import { CreateAccountDto } from '../../../../application/dtos/create-account.dto';
import { CreateClientDto } from '../../../../application/dtos/create-client.dto';
import { GetAccountByIdQuery } from '../../../../application/queries/get-account-by-id.query';

@Controller()
export class AccountsController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Post('clients')
  @HttpCode(201)
  createClient(@Body() dto: CreateClientDto) {
    return this.commandBus.execute(new CreateClientCommand(dto));
  }

  @Post('accounts')
  @HttpCode(201)
  createAccount(@Body() dto: CreateAccountDto) {
    return this.commandBus.execute(new CreateAccountCommand(dto));
  }

  @Get('accounts/:id')
  getAccount(@Param('id', ParseUUIDPipe) id: string) {
    return this.queryBus.execute(new GetAccountByIdQuery(id));
  }
}
