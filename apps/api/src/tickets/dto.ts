import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PaymentMethod } from '@ailin/shared';

export class SellSeatDto {
  @IsString() @IsNotEmpty() seatId!: string;
  @IsString() @IsNotEmpty() categoryId!: string;
}

export class SellTicketsDto {
  @IsString() @IsNotEmpty() sessionId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SellSeatDto)
  seats!: SellSeatDto[];

  @IsEnum(PaymentMethod) paymentMethod!: PaymentMethod;

  /** Опционально — товары бара в том же чеке (объединение по ТЗ). */
  @IsOptional() @IsArray() barItems?: { productId: string; quantity: number }[];
}

export class ReturnTicketDto {
  @IsString() @IsNotEmpty() ticketId!: string;
  @IsString() @IsNotEmpty() reason!: string;
}
