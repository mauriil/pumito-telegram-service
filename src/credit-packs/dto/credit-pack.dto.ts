import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { 
  IsString, 
  IsNumber, 
  IsBoolean, 
  IsArray, 
  IsOptional, 
  IsDateString,
  IsEnum,
  IsPositive,
  Min,
  Max,
  Length,
  ArrayMinSize,
  ValidateNested,
  IsObject
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

export enum CreditPackCategory {
  STARTER = 'starter',
  VALUE = 'value', 
  PREMIUM = 'premium',
  OFFER = 'offer',
  SPECIAL = 'special'
}

export enum CreditPackCurrency {
  USD = 'USD',
  EUR = 'EUR',
  ARS = 'ARS'
}

export class CreateCreditPackDto {
  @ApiProperty({
    description: 'Unique identifier for the pack',
    example: 'premium-pack-2024',
    minLength: 3,
    maxLength: 50
  })
  @IsString()
  @Length(3, 50)
  packId: string;

  @ApiProperty({
    description: 'Display name of the credit pack',
    example: 'Pack Premium',
    minLength: 3,
    maxLength: 100
  })
  @IsString()
  @Length(3, 100)
  title: string;

  @ApiProperty({
    description: 'Detailed description of what the pack offers',
    example: 'Ideal para usuarios que buscan el máximo valor en créditos',
    minLength: 10,
    maxLength: 500
  })
  @IsString()
  @Length(10, 500)
  description: string;

  @ApiProperty({
    description: 'Number of credits included in the pack',
    example: 2500,
    minimum: 1
  })
  @IsNumber()
  @IsPositive()
  amount: number;

  @ApiProperty({
    description: 'Price of the pack in the specified currency',
    example: 19.99,
    minimum: 0.01
  })
  @IsNumber()
  @Min(0.01)
  price: number;

  @ApiPropertyOptional({
    description: 'Whether this pack should be highlighted as popular',
    example: true,
    default: false
  })
  @IsOptional()
  @IsBoolean()
  popular?: boolean;

  @ApiProperty({
    description: 'Array of features/benefits included in this pack',
    example: ['Mejor relación precio-valor', 'Créditos bonus', 'Soporte prioritario'],
    type: [String]
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  features: string[];

  @ApiPropertyOptional({
    description: 'Whether the pack is currently active and purchasable',
    example: true,
    default: true
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    description: 'Currency for the pack price',
    example: 'USD',
    enum: CreditPackCurrency,
    default: 'USD'
  })
  @IsOptional()
  @IsEnum(CreditPackCurrency)
  currency?: CreditPackCurrency;

  @ApiPropertyOptional({
    description: 'Discount percentage applied to the pack',
    example: 25,
    minimum: 0,
    maximum: 100
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  discountPercentage?: number;

  @ApiPropertyOptional({
    description: 'Original price before discount',
    example: 24.99,
    minimum: 0.01
  })
  @IsOptional()
  @IsNumber()
  @Min(0.01)
  originalPrice?: number;

  @ApiPropertyOptional({
    description: 'Additional bonus credits given with the pack',
    example: 500,
    minimum: 0
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  bonusCredits?: number;

  @ApiPropertyOptional({
    description: 'Sort order for displaying packs (lower numbers appear first)',
    example: 1,
    minimum: 0
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  sortOrder?: number;

  @ApiPropertyOptional({
    description: 'Emoji to display with the pack',
    example: '💎'
  })
  @IsOptional()
  @IsString()
  emoji?: string;

  @ApiPropertyOptional({
    description: 'Hex color code for pack theming',
    example: '#FF5722'
  })
  @IsOptional()
  @IsString()
  color?: string;

  @ApiPropertyOptional({
    description: 'Supported payment methods for this pack',
    example: ['stripe', 'paypal', 'mercadopago'],
    type: [String]
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  paymentMethods?: string[];

  @ApiPropertyOptional({
    description: 'Expiration date for limited-time offers',
    example: '2024-12-31T23:59:59.000Z',
    type: 'string',
    format: 'date-time'
  })
  @IsOptional()
  @IsDateString()
  validUntil?: Date;

  @ApiPropertyOptional({
    description: 'Whether this is a limited-time offer',
    example: false,
    default: false
  })
  @IsOptional()
  @IsBoolean()
  isLimitedOffer?: boolean;

  @ApiPropertyOptional({
    description: 'Category of the pack',
    example: 'premium',
    enum: CreditPackCategory
  })
  @IsOptional()
  @IsEnum(CreditPackCategory)
  category?: CreditPackCategory;

  @ApiPropertyOptional({
    description: 'Additional metadata for the pack',
    example: { target_audience: 'power_users', promotion_id: 'SUMMER2024' }
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

export class UpdateCreditPackDto {
  @ApiPropertyOptional({
    description: 'Display name of the credit pack',
    example: 'Pack Premium Updated'
  })
  @IsOptional()
  @IsString()
  @Length(3, 100)
  title?: string;

  @ApiPropertyOptional({
    description: 'Detailed description of what the pack offers',
    example: 'Updated description with new benefits'
  })
  @IsOptional()
  @IsString()
  @Length(10, 500)
  description?: string;

  @ApiPropertyOptional({
    description: 'Number of credits included in the pack',
    example: 3000
  })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  amount?: number;

  @ApiPropertyOptional({
    description: 'Price of the pack in the specified currency',
    example: 22.99
  })
  @IsOptional()
  @IsNumber()
  @Min(0.01)
  price?: number;

  @ApiPropertyOptional({
    description: 'Whether this pack should be highlighted as popular',
    example: true
  })
  @IsOptional()
  @IsBoolean()
  popular?: boolean;

  @ApiPropertyOptional({
    description: 'Array of features/benefits included in this pack',
    type: [String]
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  features?: string[];

  @ApiPropertyOptional({
    description: 'Whether the pack is currently active and purchasable',
    example: true
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    description: 'Additional bonus credits given with the pack',
    example: 600
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  bonusCredits?: number;

  @ApiPropertyOptional({
    description: 'Sort order for displaying packs',
    example: 2
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  sortOrder?: number;
}

export class CreditPackResponseDto {
  @ApiProperty({
    description: 'Unique identifier for the pack',
    example: 'premium-pack-2024'
  })
  id: string;

  @ApiProperty({
    description: 'Display name of the credit pack',
    example: 'Pack Premium'
  })
  title: string;

  @ApiProperty({
    description: 'Detailed description of what the pack offers',
    example: 'Ideal para usuarios que buscan el máximo valor en créditos'
  })
  description: string;

  @ApiProperty({
    description: 'Number of credits included in the pack',
    example: 2500
  })
  amount: number;

  @ApiProperty({
    description: 'Price of the pack in the specified currency',
    example: 19.99
  })
  price: number;

  @ApiProperty({
    description: 'Whether this pack is highlighted as popular',
    example: true
  })
  popular: boolean;

  @ApiProperty({
    description: 'Array of features/benefits included in this pack',
    example: ['Mejor relación precio-valor', 'Créditos bonus', 'Soporte prioritario'],
    type: [String]
  })
  features: string[];

  @ApiProperty({
    description: 'Currency for the pack price',
    example: 'USD'
  })
  currency: string;

  @ApiPropertyOptional({
    description: 'Emoji to display with the pack',
    example: '💎'
  })
  emoji?: string;

  @ApiPropertyOptional({
    description: 'Hex color code for pack theming',
    example: '#FF5722'
  })
  color?: string;

  @ApiPropertyOptional({
    description: 'Category of the pack',
    example: 'premium'
  })
  category?: string;

  @ApiPropertyOptional({
    description: 'Additional bonus credits given with the pack',
    example: 500
  })
  bonusCredits?: number;

  @ApiPropertyOptional({
    description: 'Discount percentage applied to the pack',
    example: 25
  })
  discountPercentage?: number;

  @ApiPropertyOptional({
    description: 'Original price before discount',
    example: 24.99
  })
  originalPrice?: number;

  @ApiPropertyOptional({
    description: 'Whether this is a limited-time offer',
    example: false
  })
  isLimitedOffer?: boolean;

  @ApiPropertyOptional({
    description: 'Expiration date for limited-time offers',
    example: '2024-12-31T23:59:59.000Z',
    type: 'string',
    format: 'date-time'
  })
  validUntil?: Date;

  @ApiPropertyOptional({
    description: 'Payment link for purchasing this pack',
    example: '/api/payments/create-payment-link/premium-pack-2024'
  })
  paymentLink?: string;

  @ApiPropertyOptional({
    description: 'Supported payment methods for this pack',
    example: ['stripe', 'paypal', 'mercadopago'],
    type: [String]
  })
  paymentMethods?: string[];
}

export class CreditPackStatsDto {
  @ApiProperty({
    description: 'Pack identifier',
    example: 'premium-pack-2024'
  })
  packId: string;

  @ApiProperty({
    description: 'Pack title',
    example: 'Pack Premium'
  })
  title: string;

  @ApiProperty({
    description: 'Total number of purchases',
    example: 156
  })
  totalPurchases: number;

  @ApiProperty({
    description: 'Total revenue generated by this pack',
    example: 3119.44
  })
  totalRevenue: number;

  @ApiProperty({
    description: 'Average revenue per purchase',
    example: 19.99
  })
  averageRevenuePerPurchase: number;

  @ApiProperty({
    description: 'Whether the pack is currently active',
    example: true
  })
  isActive: boolean;

  @ApiProperty({
    description: 'Whether the pack is marked as popular',
    example: true
  })
  popular: boolean;
}

export class GlobalStatsDto {
  @ApiProperty({
    description: 'Total number of credit packs',
    example: 5
  })
  totalPacks: number;

  @ApiProperty({
    description: 'Number of currently active packs',
    example: 4
  })
  activePacks: number;

  @ApiProperty({
    description: 'Total revenue from all packs',
    example: 15847.32
  })
  totalRevenue: number;

  @ApiProperty({
    description: 'Total number of purchases across all packs',
    example: 892
  })
  totalPurchases: number;

  @ApiProperty({
    description: 'Average price across all packs',
    example: 16.78
  })
  averagePackPrice: number;

  @ApiProperty({
    description: 'Average revenue per purchase across all packs',
    example: 17.77
  })
  averageRevenuePerPurchase: number;
}

export class ApiResponseDto<T = any> {
  @ApiProperty({
    description: 'Indicates if the request was successful',
    example: true
  })
  success: boolean;

  @ApiProperty({
    description: 'The response data',
  })
  data: T;

  @ApiProperty({
    description: 'Human-readable message describing the result',
    example: 'Packs de créditos obtenidos exitosamente'
  })
  message: string;

  @ApiPropertyOptional({
    description: 'Timestamp of the response',
    example: '2024-01-15T10:30:00.000Z'
  })
  timestamp?: string;

  @ApiPropertyOptional({
    description: 'Request path',
    example: '/api/credit-packs'
  })
  path?: string;
} 