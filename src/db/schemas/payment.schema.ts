import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type PaymentStatus =
  | 'pending'
  | 'confirmed'
  | 'expired'
  | 'cancelled'
  | 'rejected'
  | 'error'
  | 'failed'
  | 'retried';

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

  @Prop({
    required: true,
    enum: [
      'pending',
      'confirmed',
      'rejected',
      'expired',
      'cancelled',
      'error',
      'failed',
      'retried',
    ],
  })
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

  @Prop()
  failedAt: Date;

  @Prop()
  retriedAt: Date;

  // Campos para el nuevo sistema de merchant orders
  @Prop()
  merchantOrderId: string;

  @Prop()
  preferenceId: string;

  @Prop()
  paymentId: string;

  @Prop()
  transactionAmount: number;

  @Prop()
  totalPaidAmount: number;

  @Prop()
  currencyId: string;

  @Prop()
  operationType: string;

  @Prop()
  dateApproved: Date;

  @Prop()
  dateCreated: Date;

  @Prop()
  lastModified: Date;

  @Prop()
  payerEmail: string;

  @Prop()
  payerId: string;

  @Prop()
  collectorId: string;

  @Prop()
  collectorEmail: string;

  @Prop()
  siteId: string;

  @Prop()
  isTest: boolean;

  @Prop()
  orderStatus: string;

  @Prop({ required: true })
  createdAt: Date;

  @Prop({ required: true })
  expiresAt: Date;

  @Prop({
    required: true,
    enum: ['mercadopago', 'USDT_TRC20', 'USDT_BEP20', 'BTC'],
    default: 'mercadopago',
  })
  paymentMethod: string;
}

export const PaymentSchema = SchemaFactory.createForClass(Payment);
