import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Context } from 'telegraf';
import { User, UserDocument } from './schemas/user.schema';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);
  private readonly MAX_DAILY_PURCHASES = 5;

  constructor(@InjectModel(User.name) private readonly userModel: Model<UserDocument>) {}

  async findByTelegramId(telegramId: number): Promise<UserDocument | null> {
    return this.userModel.findOne({ telegramId });
  }

  async upsertFromContext(ctx: Context) {
    const from = ctx.from;
    return this.userModel.findOneAndUpdate(
      { telegramId: from.id },
      {
        telegramId: from.id,
        username: from.username,
        firstName: from.first_name,
      },
      { upsert: true, new: true },
    );
  }

  async addBalance(userId: string, amount: number) {
    return this.userModel.findByIdAndUpdate(userId, { $inc: { balance: amount } }, { new: true });
  }

  async addCredits(userId: string, amount: number) {
    return this.userModel.findByIdAndUpdate(userId, { $inc: { credits: amount } }, { new: true });
  }

  async incrementTotalPurchases(userId: string) {
    return this.userModel.findByIdAndUpdate(userId, { $inc: { totalPurchases: 1 } }, { new: true });
  }

  async canMakePurchase(userId: string): Promise<{ can: boolean; reason?: string }> {
    const user = await this.userModel.findById(userId);
    
    if (!user) {
      return { can: false, reason: 'Usuario no encontrado' };
    }

    if (user.status !== 'active') {
      return { can: false, reason: `Cuenta ${user.status}` };
    }

    // Verificar límite diario de compras
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const purchasesToday = await this.userModel.countDocuments({
      _id: userId,
      'purchases.createdAt': { $gte: today }
    });

    if (purchasesToday >= this.MAX_DAILY_PURCHASES) {
      return { can: false, reason: 'Límite diario de compras alcanzado' };
    }

    return { can: true };
  }

  async getUserInfo(userId: string) {
    return this.userModel.findById(userId);
  }

  async findById(userId: string): Promise<UserDocument | null> {
    return this.userModel.findById(userId);
  }
}
