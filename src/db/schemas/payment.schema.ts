import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type PaymentStatus = 'pending' | 'confirmed' | 'expired' | 'cancelled' | 'rejected' | 'error';

export type PaymentDocument = Payment & Document;

@Schema({ timestamps: true })
export class Payment {
  @Prop({ required: true })
  userId: string;

  @Prop({ required: true })
  packId: string;

  @Prop({ required: true })
  amount: number;

  @Prop({ required: true })
  credits: number;

  @Prop({ required: true, enum: ['pending', 'confirmed', 'rejected', 'expired', 'cancelled', 'error'] })
  status: string;

  @Prop()
  statusDetail: string;

  @Prop()
  invoiceUrl: string;

  @Prop()
  invoiceId: string;

  @Prop()
  errorMessage: string;

  @Prop()
  messageId: number;

  @Prop()
  confirmedAt: Date;

  @Prop()
  rejectedAt: Date;

  @Prop()
  expiredAt: Date;

  @Prop()
  cancelledAt: Date;

  @Prop()
  errorAt: Date;

  @Prop({ required: true })
  createdAt: Date;

  @Prop({ required: true })
  expiresAt: Date;

  @Prop({ required: true, enum: ['mercadopago', 'USDT_TRC20', 'USDT_BEP20', 'BTC'], default: 'mercadopago' })
  paymentMethod: string;

  @Prop()
  paymentId: string;
}

export const PaymentSchema = SchemaFactory.createForClass(Payment);
