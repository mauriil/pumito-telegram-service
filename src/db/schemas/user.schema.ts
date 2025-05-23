import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

@Schema({ timestamps: true })
export class User {
  @Prop({ unique: true, index: true })
  telegramId: number;

  @Prop()
  username?: string;

  @Prop()
  firstName?: string;

  @Prop({ default: 0 })
  balance: number;

  @Prop({ default: 0 })
  credits: number;

  @Prop({ default: 'active' })
  status: 'active' | 'suspended' | 'banned';

  @Prop({ default: 0 })
  totalPurchases: number;
}

export type UserDocument = HydratedDocument<User>;
export const UserSchema = SchemaFactory.createForClass(User);
