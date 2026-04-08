import { IsUUID } from 'class-validator';

export class CreateAccountDto {
  @IsUUID()
  clientId!: string;
}
