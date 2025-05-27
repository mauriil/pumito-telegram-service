import { IsString, IsNumber, IsOptional, IsEnum, IsObject } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { GameStatus } from '../../db/schemas/game.schema';

export class FinishGameDto {
  @ApiProperty({
    description: 'ID del juego a finalizar',
    example: '64a1b2c3d4e5f6789012345a'
  })
  @IsString()
  gameId: string;

  @ApiProperty({
    description: 'Estado final del juego',
    enum: [GameStatus.COMPLETED, GameStatus.WON, GameStatus.LOST, GameStatus.DRAW, GameStatus.ABANDONED],
    example: GameStatus.COMPLETED
  })
  @IsEnum([GameStatus.COMPLETED, GameStatus.WON, GameStatus.LOST, GameStatus.DRAW, GameStatus.ABANDONED])
  status: GameStatus;

  @ApiPropertyOptional({
    description: 'ID de Telegram del ganador (opcional, se determina automáticamente si no se especifica)',
    example: 123456789
  })
  @IsOptional()
  @IsNumber()
  winnerTelegramId?: number;

  @ApiPropertyOptional({
    description: 'Puntuación del jugador principal',
    example: 150
  })
  @IsOptional()
  @IsNumber()
  playerScore?: number;

  @ApiPropertyOptional({
    description: 'Puntuación del oponente',
    example: 120
  })
  @IsOptional()
  @IsNumber()
  opponentScore?: number;

  @ApiPropertyOptional({
    description: 'Datos específicos del juego (movimientos, configuración, etc.)',
    example: { moves: 15, timeLeft: 30 }
  })
  @IsOptional()
  @IsObject()
  gameData?: any;

  @ApiPropertyOptional({
    description: 'Notas adicionales sobre el juego',
    example: 'Partida muy reñida'
  })
  @IsOptional()
  @IsString()
  notes?: string;
} 