import { IsNumber, IsString, IsOptional, IsBoolean, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { GameType } from '../../db/schemas/game.schema';

export class StartGameDto {
  @ApiProperty({
    description: 'ID de Telegram del jugador',
    example: 123456789
  })
  @IsNumber()
  playerTelegramId: number;

  @ApiPropertyOptional({
    description: 'ID de Telegram del oponente (solo para juegos multijugador)',
    example: 987654321
  })
  @IsOptional()
  @IsNumber()
  opponentTelegramId?: number;

  @ApiProperty({
    description: 'Tipo de juego',
    enum: GameType,
    example: GameType.MULTIPLAYER
  })
  @IsEnum(GameType)
  gameType: GameType;

  @ApiProperty({
    description: 'ID del template de juego',
    example: 'tap-reaction'
  })
  @IsString()
  gameId: string;

  @ApiPropertyOptional({
    description: 'Créditos apostados (opcional, usa el costo por defecto del juego si no se especifica)',
    example: 50
  })
  @IsOptional()
  @IsNumber()
  creditsWagered?: number;

  @ApiPropertyOptional({
    description: 'Si el juego es rankeado',
    example: true
  })
  @IsOptional()
  @IsBoolean()
  isRanked?: boolean;
} 