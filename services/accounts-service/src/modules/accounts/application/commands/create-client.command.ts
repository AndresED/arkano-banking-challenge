import { CreateClientDto } from '../dtos/create-client.dto';

export class CreateClientCommand {
  constructor(public readonly dto: CreateClientDto) {}
}
