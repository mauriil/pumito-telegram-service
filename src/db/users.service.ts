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

  async getEnrichedUserData(telegramId: number): Promise<any> {
    const user = await this.userModel.findOne({ telegramId });
    if (!user) {
      return null;
    }

    // Calcular estadísticas adicionales
    const totalGames = user.gameStats.totalGames || 0;
    const winRate = totalGames > 0 ? ((user.gameStats.gamesWon || 0) / totalGames * 100) : 0;
    const lossRate = totalGames > 0 ? ((user.gameStats.gamesLost || 0) / totalGames * 100) : 0;
    const drawRate = totalGames > 0 ? ((user.gameStats.gamesDrawn || 0) / totalGames * 100) : 0;
    const abandonRate = totalGames > 0 ? ((user.gameStats.gamesAbandoned || 0) / totalGames * 100) : 0;

    // Calcular tiempo promedio de juego
    const avgGameDuration = totalGames > 0 ? (user.gameStats.totalPlayTime || 0) / totalGames : 0;

    // Calcular balance neto de créditos en juegos
    const netCreditsFromGames = (user.gameStats.totalCreditsWon || 0) - (user.gameStats.totalCreditsLost || 0);

    // Encontrar al oponente más frecuente
    let mostFrequentOpponent = null;
    if (user.opponentStats.length > 0) {
      const sortedOpponents = user.opponentStats.sort((a, b) => b.gamesPlayed - a.gamesPlayed);
      mostFrequentOpponent = {
        telegramId: sortedOpponents[0].opponentTelegramId,
        username: sortedOpponents[0].opponentUsername,
        gamesPlayed: sortedOpponents[0].gamesPlayed,
        wins: sortedOpponents[0].wins,
        losses: sortedOpponents[0].losses,
        draws: sortedOpponents[0].draws,
        winRateAgainst: sortedOpponents[0].gamesPlayed > 0 ? 
          (sortedOpponents[0].wins / sortedOpponents[0].gamesPlayed * 100) : 0
      };
    }

    // Determinar nivel del usuario basado en total de juegos y rating
    let level = 'Principiante';
    if (totalGames >= 100 && user.gameStats.rating >= 1200) {
      level = 'Experto';
    } else if (totalGames >= 50 && user.gameStats.rating >= 1100) {
      level = 'Avanzado';
    } else if (totalGames >= 20 && user.gameStats.rating >= 1000) {
      level = 'Intermedio';
    }

    // Calcular días desde el registro
    const daysSinceRegistration = user.registrationDate ? 
      Math.floor((new Date().getTime() - user.registrationDate.getTime()) / (1000 * 60 * 60 * 24)) : 0;

    return {
      // Datos básicos del usuario
      telegramId: user.telegramId,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      status: user.status,
      language: user.language,
      isPremium: user.isPremium,
      premiumExpiresAt: user.premiumExpiresAt,
      
      // Datos financieros
      balance: user.balance,
      credits: user.credits,
      totalPurchases: user.totalPurchases,
      
      // Estadísticas de juego calculadas
      gameStatistics: {
        // Estadísticas básicas
        totalGames,
        gamesWon: user.gameStats.gamesWon || 0,
        gamesLost: user.gameStats.gamesLost || 0,
        gamesDrawn: user.gameStats.gamesDrawn || 0,
        gamesAbandoned: user.gameStats.gamesAbandoned || 0,
        
        // Porcentajes
        winRate: Math.round(winRate * 100) / 100,
        lossRate: Math.round(lossRate * 100) / 100,
        drawRate: Math.round(drawRate * 100) / 100,
        abandonRate: Math.round(abandonRate * 100) / 100,
        
        // Rachas
        currentWinStreak: user.gameStats.currentWinStreak || 0,
        longestWinStreak: user.gameStats.longestWinStreak || 0,
        
        // Tiempo
        totalPlayTime: user.gameStats.totalPlayTime || 0,
        avgGameDuration: Math.round(avgGameDuration),
        totalPlayTimeFormatted: this.formatDuration(user.gameStats.totalPlayTime || 0),
        avgGameDurationFormatted: this.formatDuration(avgGameDuration),
        
        // Créditos
        totalCreditsWon: user.gameStats.totalCreditsWon || 0,
        totalCreditsLost: user.gameStats.totalCreditsLost || 0,
        netCreditsFromGames,
        
        // Rating y ranking
        rating: user.gameStats.rating || 1000,
        rankedGames: user.gameStats.rankedGames || 0,
        level,
      },
      
      // Datos de oponentes
      opponentStatistics: {
        totalOpponents: user.opponentStats.length,
        mostFrequentOpponent,
        recentOpponents: user.opponentStats
          .sort((a, b) => new Date(b.lastPlayedAt || 0).getTime() - new Date(a.lastPlayedAt || 0).getTime())
          .slice(0, 5)
          .map(opponent => ({
            telegramId: opponent.opponentTelegramId,
            username: opponent.opponentUsername,
            gamesPlayed: opponent.gamesPlayed,
            wins: opponent.wins,
            losses: opponent.losses,
            draws: opponent.draws,
            winRate: opponent.gamesPlayed > 0 ? 
              Math.round((opponent.wins / opponent.gamesPlayed * 100) * 100) / 100 : 0,
            lastPlayedAt: opponent.lastPlayedAt
          })),
      },
      
      // Metadatos
      metadata: {
        registrationDate: user.registrationDate,
        lastLoginAt: user.lastLoginAt,
        daysSinceRegistration,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
      
      // Flags y estados calculados
      flags: {
        isNewUser: daysSinceRegistration <= 7,
        isActivePlayer: totalGames > 0,
        hasWinStreak: (user.gameStats.currentWinStreak || 0) > 0,
        isOnLossStreak: this.isOnLossStreak(user),
        canPlayRanked: totalGames >= 10,
        hasPlayedRecently: this.hasPlayedRecently(user),
      }
    };
  }

  private formatDuration(seconds: number): string {
    if (seconds < 60) {
      return `${Math.round(seconds)}s`;
    } else if (seconds < 3600) {
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = Math.round(seconds % 60);
      return `${minutes}m ${remainingSeconds}s`;
    } else {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      return `${hours}h ${minutes}m`;
    }
  }

  private isOnLossStreak(user: UserDocument): boolean {
    // Simplificado: considerar que está en racha perdedora si no tiene racha ganadora
    // y ha perdido al menos 2 juegos
    return (user.gameStats.currentWinStreak || 0) === 0 && (user.gameStats.gamesLost || 0) >= 2;
  }

  private hasPlayedRecently(user: UserDocument): boolean {
    if (!user.lastLoginAt) return false;
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    return user.lastLoginAt > threeDaysAgo;
  }

  async updateLastLogin(telegramId: number): Promise<void> {
    await this.userModel.findOneAndUpdate(
      { telegramId },
      { lastLoginAt: new Date() }
    );
  }
}
