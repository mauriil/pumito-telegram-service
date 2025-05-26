import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

@Schema({ timestamps: true })
export class CreditPack {
  @Prop({ unique: true, required: true })
  packId: string; // 'basic-pack', 'popular-pack', etc.

  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  description: string;

  @Prop({ required: true })
  amount: number; // cantidad de fichas/créditos

  @Prop({ required: true })
  price: number; // precio en la moneda base (USD)

  @Prop({ default: false })
  popular: boolean; // destacar como pack popular

  @Prop({ type: [String], required: true })
  features: string[]; // características del pack

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ default: 'USD' })
  currency: string;

  @Prop({ default: 0 })
  discountPercentage: number; // descuento aplicado

  @Prop()
  originalPrice?: number; // precio original antes del descuento

  @Prop({ default: 0 })
  bonusCredits: number; // créditos extra de bonus

  @Prop({ default: 1 })
  sortOrder: number; // orden de visualización

  @Prop()
  emoji?: string; // emoji para el pack

  @Prop()
  color?: string; // color hex para el pack

  @Prop({ type: [String], default: ['stripe', 'paypal'] })
  paymentMethods: string[]; // métodos de pago soportados

  @Prop({ default: 0 })
  totalPurchases: number; // estadística: total de compras

  @Prop({ default: 0 })
  totalRevenue: number; // estadística: ingresos totales

  @Prop()
  validUntil?: Date; // fecha de expiración del pack (ofertas limitadas)

  @Prop({ default: false })
  isLimitedOffer: boolean; // si es una oferta por tiempo limitado

  @Prop()
  category?: string; // categoría del pack: 'starter', 'value', 'premium'

  @Prop({ type: Object })
  metadata?: any; // datos adicionales del pack

  // Timestamps automáticos de Mongoose
  createdAt?: Date;
  updatedAt?: Date;
}

export type CreditPackDocument = HydratedDocument<CreditPack>;
export const CreditPackSchema = SchemaFactory.createForClass(CreditPack);
