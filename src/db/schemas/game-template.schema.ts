import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

@Schema({ timestamps: true })
export class GameTemplate {
  @Prop({ unique: true, required: true })
  gameId: string; // 'tap-reaction', 'memory-cards', etc.

  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  description: string;

  @Prop({ required: true })
  entryCost: number; // costo en créditos

  @Prop({ required: true })
  maxWinnings: number; // máximas ganancias posibles

  @Prop({ required: true })
  backgroundImage: string; // emoji o URL de imagen

  @Prop({ required: true })
  estimatedTime: string; // tiempo estimado como string

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ required: true })
  route: string; // ruta del frontend

  @Prop({ default: 0 })
  minPlayersToStart: number; // mínimo de jugadores para empezar

  @Prop({ default: 2 })
  maxPlayers: number; // máximo de jugadores

  @Prop({ default: 0 })
  difficultyLevel: number; // 1-5, nivel de dificultad

  @Prop({ type: Object })
  gameConfig?: any; // configuración específica del juego

  @Prop({ default: 0 })
  totalGamesPlayed: number; // estadística global

  @Prop({ default: 0 })
  totalPlayersParticipated: number; // estadística global

  @Prop()
  category?: string; // categoría del juego (reflejos, memoria, lógica, etc.)

  @Prop({ type: [String], default: [] })
  tags: string[]; // etiquetas para filtrar

  @Prop({ default: 1.0 })
  winRateMultiplier: number; // multiplicador de ganancias

  // Timestamps automáticos de Mongoose
  createdAt?: Date;
  updatedAt?: Date;
}

export type GameTemplateDocument = HydratedDocument<GameTemplate>;
export const GameTemplateSchema = SchemaFactory.createForClass(GameTemplate);
