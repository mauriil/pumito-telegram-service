import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export enum GameStatus {
  STARTED = 'started',
  COMPLETED = 'completed',
  ABANDONED = 'abandoned',
  WON = 'won',
  LOST = 'lost',
  DRAW = 'draw',
}

export enum GameType {
  SINGLE_PLAYER = 'single_player',
  MULTIPLAYER = 'multiplayer',
  TOURNAMENT = 'tournament',
}

@Schema({ timestamps: true })
export class Game {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  playerId: Types.ObjectId;

  @Prop({ required: true })
  playerTelegramId: number;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  opponentId?: Types.ObjectId;

  @Prop()
  opponentTelegramId?: number;

  @Prop({ type: Types.ObjectId, ref: 'GameTemplate', required: true })
  gameTemplateId: Types.ObjectId;

  @Prop({ required: true })
  gameId: string; // referencia rápida al gameId de la template (ej: 'tap-reaction')

  @Prop({ type: String, enum: GameStatus, default: GameStatus.STARTED })
  status: GameStatus;

  @Prop({ type: String, enum: GameType, default: GameType.SINGLE_PLAYER })
  gameType: GameType;

  @Prop({ default: 0 })
  playerScore: number;

  @Prop({ default: 0 })
  opponentScore: number;

  @Prop({ default: 0 })
  duration: number; // duración en segundos

  @Prop()
  startedAt: Date;

  @Prop()
  endedAt?: Date;

  @Prop({ default: 0 })
  creditsWagered: number;

  @Prop({ default: 0 })
  creditsWon: number;

  @Prop({ type: Object })
  gameData?: any; // datos específicos del juego (movimientos, configuración, etc.)

  @Prop({ default: false })
  isRanked: boolean;

  @Prop()
  notes?: string;
}

export type GameDocument = HydratedDocument<Game>;
export const GameSchema = SchemaFactory.createForClass(Game);
