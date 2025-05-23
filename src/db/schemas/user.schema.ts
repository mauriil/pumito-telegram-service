import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

// Subdocumento para estadísticas de juegos
@Schema({ _id: false })
export class GameStats {
  @Prop({ default: 0 })
  totalGames: number;

  @Prop({ default: 0 })
  gamesWon: number;

  @Prop({ default: 0 })
  gamesLost: number;

  @Prop({ default: 0 })
  gamesDrawn: number;

  @Prop({ default: 0 })
  gamesAbandoned: number;

  @Prop({ default: 0 })
  totalPlayTime: number; // en segundos

  @Prop({ default: 0 })
  totalCreditsWon: number;

  @Prop({ default: 0 })
  totalCreditsLost: number;

  @Prop({ default: 0 })
  longestWinStreak: number;

  @Prop({ default: 0 })
  currentWinStreak: number;

  @Prop({ default: 0 })
  rankedGames: number;

  @Prop({ default: 1000 })
  rating: number;
}

// Subdocumento para estadísticas contra oponentes específicos
@Schema({ _id: false })
export class OpponentStats {
  @Prop({ required: true })
  opponentTelegramId: number;

  @Prop()
  opponentUsername?: string;

  @Prop({ default: 0 })
  gamesPlayed: number;

  @Prop({ default: 0 })
  wins: number;

  @Prop({ default: 0 })
  losses: number;

  @Prop({ default: 0 })
  draws: number;

  @Prop()
  lastPlayedAt?: Date;
}

// Subdocumento para estadísticas por tipo de juego
@Schema({ _id: false })
export class GameTypeStats {
  @Prop({ required: true })
  gameId: string; // 'tap-reaction', 'memory-cards', etc.

  @Prop()
  gameName?: string;

  @Prop({ default: 0 })
  gamesPlayed: number;

  @Prop({ default: 0 })
  wins: number;

  @Prop({ default: 0 })
  losses: number;

  @Prop({ default: 0 })
  draws: number;

  @Prop({ default: 0 })
  abandoned: number;

  @Prop({ default: 0 })
  totalPlayTime: number;

  @Prop({ default: 0 })
  bestScore: number;

  @Prop({ default: 0 })
  creditsWon: number;

  @Prop({ default: 0 })
  creditsLost: number;

  @Prop()
  lastPlayedAt?: Date;

  @Prop({ default: 0 })
  currentStreak: number;

  @Prop({ default: 0 })
  bestStreak: number;
}

@Schema({ timestamps: true })
export class User {
  @Prop({ unique: true, index: true })
  telegramId: number;

  @Prop()
  username?: string;

  @Prop()
  firstName?: string;

  @Prop()
  lastName?: string;

  @Prop({ default: 0 })
  balance: number;

  @Prop({ default: 0 })
  credits: number;

  @Prop({ default: 'active' })
  status: 'active' | 'suspended' | 'banned';

  @Prop({ default: 0 })
  totalPurchases: number;

  @Prop({ type: GameStats, default: () => ({}) })
  gameStats: GameStats;

  @Prop({ type: [OpponentStats], default: [] })
  opponentStats: OpponentStats[];

  @Prop({ type: [GameTypeStats], default: [] })
  gameTypeStats: GameTypeStats[];

  @Prop()
  lastLoginAt?: Date;

  @Prop()
  registrationDate?: Date;

  @Prop({ default: 'es' })
  language: string;

  @Prop({ default: false })
  isPremium: boolean;

  @Prop()
  premiumExpiresAt?: Date;

  // Timestamps automáticos de Mongoose
  createdAt?: Date;
  updatedAt?: Date;
}

export type UserDocument = HydratedDocument<User>;
export const UserSchema = SchemaFactory.createForClass(User);
