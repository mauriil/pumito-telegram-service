import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { 
  IsString, 
  IsNumber, 
  IsBoolean, 
  IsOptional, 
  IsDateString,
  IsEnum,
  IsPositive,
  Min,
  Max,
  Length,
  IsEmail,
  IsUrl,
  IsObject
} from 'class-validator';

export enum UserStatus {
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
  BANNED = 'banned',
  PENDING = 'pending'
}

export enum GameType {
  TAP_REACTION = 'tap-reaction',
  MEMORY_CARDS = 'memory-cards',
  WORD_PUZZLE = 'word-puzzle',
  COLOR_MATCH = 'color-match',
  NUMBER_SEQUENCE = 'number-sequence',
  TRIVIA_CHALLENGE = 'trivia-challenge'
}

export enum GameStatus {
  PENDING = 'pending',
  ACTIVE = 'active',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled'
}

export class CreateUserDto {
  @ApiProperty({
    description: 'Telegram user ID',
    example: 123456789
  })
  @IsNumber()
  @IsPositive()
  telegramId: number;

  @ApiPropertyOptional({
    description: 'User first name',
    example: 'Juan'
  })
  @IsOptional()
  @IsString()
  @Length(1, 50)
  firstName?: string;

  @ApiPropertyOptional({
    description: 'User last name',
    example: 'Pérez'
  })
  @IsOptional()
  @IsString()
  @Length(1, 50)
  lastName?: string;

  @ApiPropertyOptional({
    description: 'Telegram username',
    example: 'juanperez'
  })
  @IsOptional()
  @IsString()
  @Length(3, 32)
  username?: string;

  @ApiPropertyOptional({
    description: 'User email address',
    example: 'juan@example.com'
  })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({
    description: 'Initial balance for the user',
    example: 0,
    default: 0
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  balance?: number;

  @ApiPropertyOptional({
    description: 'Initial credits for the user',
    example: 100,
    default: 100
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  credits?: number;
}

export class UpdateUserDto {
  @ApiPropertyOptional({
    description: 'User first name',
    example: 'Juan Carlos'
  })
  @IsOptional()
  @IsString()
  @Length(1, 50)
  firstName?: string;

  @ApiPropertyOptional({
    description: 'User last name',
    example: 'Pérez García'
  })
  @IsOptional()
  @IsString()
  @Length(1, 50)
  lastName?: string;

  @ApiPropertyOptional({
    description: 'Telegram username',
    example: 'juancperez'
  })
  @IsOptional()
  @IsString()
  @Length(3, 32)
  username?: string;

  @ApiPropertyOptional({
    description: 'User email address',
    example: 'juan.carlos@example.com'
  })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({
    description: 'User status',
    enum: UserStatus,
    example: 'active'
  })
  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;

  @ApiPropertyOptional({
    description: 'Whether the user is verified',
    example: true
  })
  @IsOptional()
  @IsBoolean()
  isVerified?: boolean;
}

export class UserResponseDto {
  @ApiProperty({
    description: 'Unique user identifier',
    example: '507f1f77bcf86cd799439011'
  })
  id: string;

  @ApiProperty({
    description: 'Telegram user ID',
    example: 123456789
  })
  telegramId: number;

  @ApiPropertyOptional({
    description: 'User first name',
    example: 'Juan'
  })
  firstName?: string;

  @ApiPropertyOptional({
    description: 'User last name',
    example: 'Pérez'
  })
  lastName?: string;

  @ApiPropertyOptional({
    description: 'Full name (computed from first and last name)',
    example: 'Juan Pérez'
  })
  fullName?: string;

  @ApiPropertyOptional({
    description: 'Telegram username',
    example: 'juanperez'
  })
  username?: string;

  @ApiPropertyOptional({
    description: 'User email address',
    example: 'juan@example.com'
  })
  email?: string;

  @ApiProperty({
    description: 'User balance in USD',
    example: 15.50
  })
  balance: number;

  @ApiProperty({
    description: 'User credits for gaming',
    example: 2500
  })
  credits: number;

  @ApiProperty({
    description: 'User account status',
    enum: UserStatus,
    example: 'active'
  })
  status: UserStatus;

  @ApiProperty({
    description: 'Whether the user is verified',
    example: true
  })
  isVerified: boolean;

  @ApiProperty({
    description: 'Total number of games played',
    example: 45
  })
  totalGamesPlayed: number;

  @ApiProperty({
    description: 'Total number of games won',
    example: 28
  })
  totalGamesWon: number;

  @ApiProperty({
    description: 'Win rate percentage',
    example: 62.22
  })
  winRate: number;

  @ApiProperty({
    description: 'Total number of purchases made',
    example: 3
  })
  totalPurchases: number;

  @ApiProperty({
    description: 'Total amount spent',
    example: 45.97
  })
  totalSpent: number;

  @ApiProperty({
    description: 'Date when user was created',
    example: '2024-01-15T10:30:00.000Z',
    type: 'string',
    format: 'date-time'
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Date when user was last updated',
    example: '2024-01-20T15:45:00.000Z',
    type: 'string',
    format: 'date-time'
  })
  updatedAt: Date;

  @ApiPropertyOptional({
    description: 'Date of last login',
    example: '2024-01-20T15:45:00.000Z',
    type: 'string',
    format: 'date-time'
  })
  lastLoginAt?: Date;
}

export class CreateGameDto {
  @ApiProperty({
    description: 'ID of the game template',
    example: 'tap-reaction',
    enum: GameType
  })
  @IsString()
  @IsEnum(GameType)
  gameId: string;

  @ApiPropertyOptional({
    description: 'Telegram ID of the opponent (for multiplayer games)',
    example: 987654321
  })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  opponentTelegramId?: number;

  @ApiProperty({
    description: 'Type of game',
    enum: GameType,
    example: 'tap-reaction'
  })
  @IsEnum(GameType)
  gameType: GameType;

  @ApiPropertyOptional({
    description: 'Credits wagered on this game',
    example: 50,
    minimum: 0
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  creditsWagered?: number;

  @ApiPropertyOptional({
    description: 'Whether this is a ranked game',
    example: true,
    default: false
  })
  @IsOptional()
  @IsBoolean()
  isRanked?: boolean;
}

export class GameResponseDto {
  @ApiProperty({
    description: 'Unique game identifier',
    example: '507f1f77bcf86cd799439012'
  })
  id: string;

  @ApiProperty({
    description: 'Telegram ID of the player',
    example: 123456789
  })
  playerTelegramId: number;

  @ApiPropertyOptional({
    description: 'Telegram ID of the opponent',
    example: 987654321
  })
  opponentTelegramId?: number;

  @ApiProperty({
    description: 'Type of game',
    enum: GameType,
    example: 'tap-reaction'
  })
  gameType: GameType;

  @ApiProperty({
    description: 'ID of the game template',
    example: 'tap-reaction'
  })
  gameId: string;

  @ApiProperty({
    description: 'Current game status',
    enum: GameStatus,
    example: 'active'
  })
  status: GameStatus;

  @ApiPropertyOptional({
    description: 'Credits wagered on this game',
    example: 50
  })
  creditsWagered?: number;

  @ApiPropertyOptional({
    description: 'Telegram ID of the winner',
    example: 123456789
  })
  winnerTelegramId?: number;

  @ApiProperty({
    description: 'Whether this is a ranked game',
    example: true
  })
  isRanked: boolean;

  @ApiPropertyOptional({
    description: 'Game result data',
    example: { playerScore: 850, opponentScore: 720, duration: 30000 }
  })
  result?: any;

  @ApiProperty({
    description: 'Date when game was created',
    example: '2024-01-20T15:45:00.000Z',
    type: 'string',
    format: 'date-time'
  })
  createdAt: Date;

  @ApiPropertyOptional({
    description: 'Date when game was completed',
    example: '2024-01-20T15:47:30.000Z',
    type: 'string',
    format: 'date-time'
  })
  completedAt?: Date;
}

export class UserStatsDto {
  @ApiProperty({
    description: 'User identifier',
    example: '507f1f77bcf86cd799439011'
  })
  userId: string;

  @ApiProperty({
    description: 'Telegram ID',
    example: 123456789
  })
  telegramId: number;

  @ApiPropertyOptional({
    description: 'User display name',
    example: 'Juan Pérez'
  })
  displayName?: string;

  @ApiProperty({
    description: 'Current balance',
    example: 15.50
  })
  balance: number;

  @ApiProperty({
    description: 'Current credits',
    example: 2500
  })
  credits: number;

  @ApiProperty({
    description: 'Total games played',
    example: 45
  })
  totalGamesPlayed: number;

  @ApiProperty({
    description: 'Total games won',
    example: 28
  })
  totalGamesWon: number;

  @ApiProperty({
    description: 'Win rate percentage',
    example: 62.22
  })
  winRate: number;

  @ApiProperty({
    description: 'Total purchases made',
    example: 3
  })
  totalPurchases: number;

  @ApiProperty({
    description: 'Total amount spent',
    example: 45.97
  })
  totalSpent: number;

  @ApiProperty({
    description: 'Account status',
    enum: UserStatus,
    example: 'active'
  })
  status: UserStatus;

  @ApiPropertyOptional({
    description: 'Date of last activity',
    example: '2024-01-20T15:45:00.000Z',
    type: 'string',
    format: 'date-time'
  })
  lastActivityAt?: Date;
}

export class BalanceUpdateDto {
  @ApiProperty({
    description: 'Amount to add/subtract from balance (negative values subtract)',
    example: 10.50
  })
  @IsNumber()
  amount: number;

  @ApiPropertyOptional({
    description: 'Reason for the balance change',
    example: 'Purchase refund'
  })
  @IsOptional()
  @IsString()
  @Length(1, 200)
  reason?: string;
}

export class CreditsUpdateDto {
  @ApiProperty({
    description: 'Amount of credits to add/subtract (negative values subtract)',
    example: 500
  })
  @IsNumber()
  amount: number;

  @ApiPropertyOptional({
    description: 'Reason for the credits change',
    example: 'Game reward'
  })
  @IsOptional()
  @IsString()
  @Length(1, 200)
  reason?: string;
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
    example: 'Operación completada exitosamente'
  })
  message: string;

  @ApiPropertyOptional({
    description: 'Timestamp of the response',
    example: '2024-01-15T10:30:00.000Z'
  })
  timestamp?: string;

  @ApiPropertyOptional({
    description: 'Request path',
    example: '/api/users'
  })
  path?: string;
} 