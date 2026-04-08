import { RequestTransactionDto } from '../dtos/request-transaction.dto';

export class RequestTransactionCommand {
  constructor(public readonly dto: RequestTransactionDto) {}
}
