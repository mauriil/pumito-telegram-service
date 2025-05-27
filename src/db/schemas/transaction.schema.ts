import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export enum TransactionType {
  MATCH = 'match',
  TRANSACTION = 'transaction',
}

export enum TransactionItemType {
  WIN = 'win',
  LOSS = 'loss',
  DRAW = 'draw',
  INCOME = 'income',
  EXPENSE = 'expense',
  REFUND = 'refund',
}

@Schema({ timestamps: true })
export class Transaction {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ required: true, index: true })
  userTelegramId: number;

  @Prop({ type: String, enum: TransactionType, required: true })
  type: TransactionType;

  @Prop({ type: String, enum: TransactionItemType, required: true })
  itemType: TransactionItemType;

  @Prop({ type: Types.ObjectId, ref: 'Game' })
  gameId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'GameTemplate' })
  gameTemplateId?: Types.ObjectId;

  @Prop()
  description?: string;

  @Prop({ required: true })
  amount: number; // Monto final de la transacción (positivo = ganancia, negativo = pérdida)

  @Prop({ default: 0 })
  betAmount: number; // Monto apostado (solo para partidas)

  @Prop({ default: 0 })
  winnings: number; // Monto ganado (solo para partidas ganadoras)

  @Prop({ type: Types.ObjectId, ref: 'User' })
  winnerId?: Types.ObjectId;

  @Prop()
  winnerTelegramId?: number;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  opponentId?: Types.ObjectId;

  @Prop()
  opponentTelegramId?: number;

  @Prop({ default: 0 })
  balanceBefore: number; // Balance del usuario antes de la transacción

  @Prop({ default: 0 })
  balanceAfter: number; // Balance del usuario después de la transacción

  @Prop({ type: Object })
  metadata?: any; // Datos adicionales específicos del tipo de transacción

  @Prop({ default: new Date() })
  date: Date;

  @Prop({ default: new Date() })
  sortDate: Date;
}

export type TransactionDocument = HydratedDocument<Transaction>;
export const TransactionSchema = SchemaFactory.createForClass(Transaction);

// Índices para optimizar consultas
TransactionSchema.index({ userTelegramId: 1, sortDate: -1 });
TransactionSchema.index({ type: 1, itemType: 1 });
TransactionSchema.index({ gameId: 1 }); 