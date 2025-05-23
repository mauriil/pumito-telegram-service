import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreditPack, CreditPackDocument } from './schemas/credit-pack.schema';

export interface CreateCreditPackDto {
  packId: string;
  title: string;
  description: string;
  amount: number;
  price: number;
  popular?: boolean;
  features: string[];
  isActive?: boolean;
  currency?: string;
  discountPercentage?: number;
  originalPrice?: number;
  bonusCredits?: number;
  sortOrder?: number;
  emoji?: string;
  color?: string;
  paymentMethods?: string[];
  validUntil?: Date;
  isLimitedOffer?: boolean;
  category?: string;
  metadata?: any;
}

@Injectable()
export class CreditPacksService {
  private readonly logger = new Logger(CreditPacksService.name);

  constructor(
    @InjectModel(CreditPack.name) private readonly creditPackModel: Model<CreditPackDocument>,
  ) {}

  async createCreditPack(createDto: CreateCreditPackDto): Promise<CreditPackDocument> {
    const creditPack = new this.creditPackModel(createDto);
    return creditPack.save();
  }

  async findAll(includeInactive = false): Promise<CreditPackDocument[]> {
    const filter = includeInactive ? {} : { isActive: true };
    return this.creditPackModel.find(filter).sort({ sortOrder: 1, price: 1 });
  }

  async findByPackId(packId: string): Promise<CreditPackDocument | null> {
    return this.creditPackModel.findOne({ packId });
  }

  async findById(id: string): Promise<CreditPackDocument | null> {
    return this.creditPackModel.findById(id);
  }

  async findActivePacks(): Promise<CreditPackDocument[]> {
    return this.creditPackModel.find({ 
      isActive: true,
      $or: [
        { validUntil: { $exists: false } },
        { validUntil: { $gte: new Date() } }
      ]
    }).sort({ sortOrder: 1, price: 1 });
  }

  async findByCategory(category: string): Promise<CreditPackDocument[]> {
    return this.creditPackModel.find({ 
      category, 
      isActive: true,
      $or: [
        { validUntil: { $exists: false } },
        { validUntil: { $gte: new Date() } }
      ]
    }).sort({ sortOrder: 1, price: 1 });
  }

  async findPopularPacks(): Promise<CreditPackDocument[]> {
    return this.creditPackModel.find({ 
      popular: true, 
      isActive: true,
      $or: [
        { validUntil: { $exists: false } },
        { validUntil: { $gte: new Date() } }
      ]
    }).sort({ sortOrder: 1, price: 1 });
  }

  async updateCreditPack(packId: string, updateData: Partial<CreateCreditPackDto>): Promise<CreditPackDocument> {
    const creditPack = await this.creditPackModel.findOneAndUpdate(
      { packId },
      updateData,
      { new: true }
    );
    
    if (!creditPack) {
      throw new NotFoundException('Pack de créditos no encontrado');
    }
    
    return creditPack;
  }

  async toggleActive(packId: string): Promise<CreditPackDocument> {
    const creditPack = await this.findByPackId(packId);
    if (!creditPack) {
      throw new NotFoundException('Pack de créditos no encontrado');
    }

    creditPack.isActive = !creditPack.isActive;
    return creditPack.save();
  }

  async incrementPurchaseStats(packId: string, price: number): Promise<void> {
    await this.creditPackModel.findOneAndUpdate(
      { packId },
      {
        $inc: {
          totalPurchases: 1,
          totalRevenue: price
        }
      }
    );
  }

  async getPackStats(packId: string): Promise<any> {
    const creditPack = await this.findByPackId(packId);
    if (!creditPack) {
      throw new NotFoundException('Pack de créditos no encontrado');
    }

    return {
      packId: creditPack.packId,
      title: creditPack.title,
      totalPurchases: creditPack.totalPurchases,
      totalRevenue: creditPack.totalRevenue,
      averageRevenuePerPurchase: creditPack.totalPurchases > 0 ? 
        (creditPack.totalRevenue / creditPack.totalPurchases) : 0,
      isActive: creditPack.isActive,
      popular: creditPack.popular,
    };
  }

  async getGlobalStats(): Promise<any> {
    const allPacks = await this.creditPackModel.find();
    
    const totalPacks = allPacks.length;
    const activePacks = allPacks.filter(pack => pack.isActive).length;
    const totalRevenue = allPacks.reduce((sum, pack) => sum + pack.totalRevenue, 0);
    const totalPurchases = allPacks.reduce((sum, pack) => sum + pack.totalPurchases, 0);
    const averagePackPrice = allPacks.length > 0 ? 
      allPacks.reduce((sum, pack) => sum + pack.price, 0) / allPacks.length : 0;

    return {
      totalPacks,
      activePacks,
      totalRevenue,
      totalPurchases,
      averagePackPrice,
      averageRevenuePerPurchase: totalPurchases > 0 ? totalRevenue / totalPurchases : 0,
    };
  }

  // Transformar al formato que espera el frontend (incluyendo link de pago)
  async getPacksForFrontend(includePaymentLinks = true): Promise<any[]> {
    const packs = await this.findActivePacks();
    
    return packs.map(pack => {
      const result: any = {
        id: pack.packId,
        title: pack.title,
        description: pack.description,
        amount: pack.amount,
        price: pack.price,
        popular: pack.popular,
        features: pack.features,
        currency: pack.currency,
        emoji: pack.emoji,
        color: pack.color,
        category: pack.category,
        bonusCredits: pack.bonusCredits,
        discountPercentage: pack.discountPercentage,
        originalPrice: pack.originalPrice,
        isLimitedOffer: pack.isLimitedOffer,
        validUntil: pack.validUntil,
      };

      // Si se requiere incluir links de pago, aquí se pueden generar
      if (includePaymentLinks) {
        result.paymentLink = `/api/payments/create-payment-link/${pack.packId}`;
        result.paymentMethods = pack.paymentMethods;
      }

      return result;
    });
  }

  // Método para inicializar los packs del frontend
  async seedInitialPacks(): Promise<void> {
    const existingPacks = await this.creditPackModel.countDocuments();
    if (existingPacks > 0) {
      this.logger.log('Los packs de créditos ya están inicializados');
      return;
    }

    const initialPacks: CreateCreditPackDto[] = [
      {
        packId: 'basic-pack',
        title: 'Pack Básico',
        description: 'Perfecto para empezar a jugar',
        amount: 500,
        price: 5,
        popular: false,
        features: ['Ideal para principiantes', 'Múltiples partidas', 'Sin comisiones'],
        sortOrder: 1,
        emoji: '🎯',
        color: '#4CAF50',
        category: 'starter',
        currency: 'USD',
        paymentMethods: ['stripe', 'paypal', 'mercadopago']
      },
      {
        packId: 'popular-pack',
        title: 'Pack Popular',
        description: 'El más elegido por jugadores',
        amount: 1200,
        price: 10,
        popular: true,
        features: ['Mejor relación precio-valor', 'Fichas extra bonus', 'Soporte prioritario'],
        bonusCredits: 100,
        sortOrder: 2,
        emoji: '🔥',
        color: '#FF5722',
        category: 'value',
        currency: 'USD',
        paymentMethods: ['stripe', 'paypal', 'mercadopago']
      },
      {
        packId: 'premium-pack',
        title: 'Pack Premium',
        description: 'Máximo valor para expertos',
        amount: 3000,
        price: 20,
        popular: false,
        features: ['Máximo rendimiento', 'Fichas premium', 'Acceso VIP'],
        bonusCredits: 500,
        sortOrder: 3,
        emoji: '💎',
        color: '#9C27B0',
        category: 'premium',
        currency: 'USD',
        paymentMethods: ['stripe', 'paypal', 'mercadopago']
      },
      {
        packId: 'mega-pack',
        title: 'Pack Mega',
        description: 'Para los jugadores más ambiciosos',
        amount: 7500,
        price: 40,
        popular: false,
        features: ['Valor excepcional', 'Bonus masivo', 'Soporte VIP 24/7', 'Acceso exclusivo'],
        bonusCredits: 1500,
        sortOrder: 4,
        emoji: '🚀',
        color: '#2196F3',
        category: 'premium',
        currency: 'USD',
        paymentMethods: ['stripe', 'paypal', 'mercadopago']
      },
      {
        packId: 'starter-offer',
        title: 'Oferta Inicio',
        description: 'Oferta especial para nuevos usuarios',
        amount: 250,
        price: 1.99,
        popular: false,
        features: ['Solo para nuevos usuarios', 'Precio especial', 'Ideal para probar'],
        originalPrice: 2.99,
        discountPercentage: 33,
        sortOrder: 0,
        emoji: '🎁',
        color: '#FFC107',
        category: 'offer',
        currency: 'USD',
        isLimitedOffer: true,
        paymentMethods: ['stripe', 'paypal', 'mercadopago']
      }
    ];

    try {
      await this.creditPackModel.insertMany(initialPacks);
      this.logger.log('Packs de créditos iniciales creados exitosamente');
    } catch (error) {
      this.logger.error('Error creando packs de créditos iniciales', error);
    }
  }
} 