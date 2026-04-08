import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsPositive,
  IsUUID,
} from 'class-validator';

export class RequestTransactionDto {
  @IsEnum(['deposit', 'withdrawal', 'transfer'])
  type!: 'deposit' | 'withdrawal' | 'transfer';

  @IsNumber()
  @IsPositive()
  amount!: number;

  @IsOptional()
  @IsUUID()
  sourceAccountId?: string;

  @IsOptional()
  @IsUUID()
  targetAccountId?: string;
}
