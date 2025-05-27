import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, ClientSession } from 'mongoose';
import { Transaction, TransactionDocument, TransactionType, TransactionItemType } from './schemas/transaction.schema';
import { User, UserDocument } from './schemas/user.schema';
import { Game, GameDocument } from './schemas/game.schema';
import { GameTemplate, GameTemplateDocument } from './schemas/game-template.schema';

export interface CreateTransactionDto {
  userTelegramId: number;
  type: TransactionType;
  itemType: TransactionItemType;
  amount: number;
  description?: string;
  gameId?: string;
  gameTemplateId?: string;
  betAmount?: number;
  winnings?: number;
  winnerId?: string;
  winnerTelegramId?: number;
  opponentId?: string;
  opponentTelegramId?: number;
  metadata?: any;
}

export interface TransactionFilters {
  userTelegramId: number;
  type?: TransactionType;
  itemType?: TransactionItemType;
  dateFrom?: Date;
  dateTo?: Date;
  limit?: number;
  offset?: number;
}

@Injectable()
export class TransactionsService {
  private readonly logger = new Logger(TransactionsService.name);

  constructor(
    @InjectModel(Transaction.name) private readonly transactionModel: Model<TransactionDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Game.name) private readonly gameModel: Model<GameDocument>,
    @InjectModel(GameTemplate.name) private readonly gameTemplateModel: Model<GameTemplateDocument>,
  ) {}

  /**
   * Crear una nueva transacción
   */
  async createTransaction(
    createTransactionDto: CreateTransactionDto,
    session?: ClientSession
  ): Promise<TransactionDocument> {
    const user = await this.userModel.findOne({ telegramId: createTransactionDto.userTelegramId }).session(session);
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    const balanceBefore = user.credits;
    const balanceAfter = balanceBefore + createTransactionDto.amount;

    const transaction = new this.transactionModel({
      userId: user._id,
      userTelegramId: createTransactionDto.userTelegramId,
      type: createTransactionDto.type,
      itemType: createTransactionDto.itemType,
      amount: createTransactionDto.amount,
      description: createTransactionDto.description,
      betAmount: createTransactionDto.betAmount || 0,
      winnings: createTransactionDto.winnings || 0,
      balanceBefore,
      balanceAfter,
      metadata: createTransactionDto.metadata,
      date: new Date(),
      sortDate: new Date(),
    });

    if (createTransactionDto.gameId) {
      const game = await this.gameModel.findById(createTransactionDto.gameId).session(session);
      if (game) {
        transaction.gameId = game._id;
        transaction.gameTemplateId = game.gameTemplateId;
      }
    }

    if (createTransactionDto.winnerId) {
      const winner = await this.userModel.findById(createTransactionDto.winnerId).session(session);
      if (winner) {
        transaction.winnerId = winner._id;
        transaction.winnerTelegramId = winner.telegramId;
      }
    }

    if (createTransactionDto.winnerTelegramId) {
      transaction.winnerTelegramId = createTransactionDto.winnerTelegramId;
    }

    if (createTransactionDto.opponentId) {
      const opponent = await this.userModel.findById(createTransactionDto.opponentId).session(session);
      if (opponent) {
        transaction.opponentId = opponent._id;
        transaction.opponentTelegramId = opponent.telegramId;
      }
    }

    if (createTransactionDto.opponentTelegramId) {
      transaction.opponentTelegramId = createTransactionDto.opponentTelegramId;
    }

    return transaction.save({ session });
  }

  /**
   * Procesar transacciones de partida (ganador y perdedor)
   */
  async processGameTransactions(
    game: GameDocument,
    winnerTelegramId: number,
    loserTelegramId: number,
    session?: ClientSession
  ): Promise<{ winnerTransaction: TransactionDocument; loserTransaction: TransactionDocument }> {
    const creditsWagered = game.creditsWagered || 0;
    const totalPrize = creditsWagered * 2; // El ganador se lleva el doble de lo apostado

    // Crear transacción para el ganador
    const winnerTransaction = await this.createTransaction({
      userTelegramId: winnerTelegramId,
      type: TransactionType.MATCH,
      itemType: TransactionItemType.WIN,
      amount: totalPrize,
      betAmount: creditsWagered,
      winnings: totalPrize,
      gameId: game._id.toString(),
      winnerId: game.playerId.toString(),
      winnerTelegramId,
      opponentTelegramId: loserTelegramId,
      metadata: {
        gameType: game.gameType,
        gameDuration: game.duration,
        playerScore: game.playerScore,
        opponentScore: game.opponentScore,
      }
    }, session);

    // Crear transacción para el perdedor
    const loserTransaction = await this.createTransaction({
      userTelegramId: loserTelegramId,
      type: TransactionType.MATCH,
      itemType: TransactionItemType.LOSS,
      amount: -creditsWagered,
      betAmount: creditsWagered,
      winnings: 0,
      gameId: game._id.toString(),
      winnerId: game.playerId.toString(),
      winnerTelegramId,
      opponentTelegramId: winnerTelegramId,
      metadata: {
        gameType: game.gameType,
        gameDuration: game.duration,
        playerScore: game.playerScore,
        opponentScore: game.opponentScore,
      }
    }, session);

    return { winnerTransaction, loserTransaction };
  }

  /**
   * Procesar transacción de empate
   */
  async processDrawTransaction(
    game: GameDocument,
    playerTelegramId: number,
    opponentTelegramId?: number,
    session?: ClientSession
  ): Promise<TransactionDocument[]> {
    const transactions: TransactionDocument[] = [];

    // Transacción para el jugador principal
    const playerTransaction = await this.createTransaction({
      userTelegramId: playerTelegramId,
      type: TransactionType.MATCH,
      itemType: TransactionItemType.DRAW,
      amount: 0, // En empate, no hay transferencia de créditos
      betAmount: game.creditsWagered || 0,
      winnings: 0,
      gameId: game._id.toString(),
      opponentTelegramId,
      metadata: {
        gameType: game.gameType,
        gameDuration: game.duration,
        playerScore: game.playerScore,
        opponentScore: game.opponentScore,
      }
    }, session);

    transactions.push(playerTransaction);

    // Transacción para el oponente si existe
    if (opponentTelegramId) {
      const opponentTransaction = await this.createTransaction({
        userTelegramId: opponentTelegramId,
        type: TransactionType.MATCH,
        itemType: TransactionItemType.DRAW,
        amount: 0,
        betAmount: game.creditsWagered || 0,
        winnings: 0,
        gameId: game._id.toString(),
        opponentTelegramId: playerTelegramId,
        metadata: {
          gameType: game.gameType,
          gameDuration: game.duration,
          playerScore: game.playerScore,
          opponentScore: game.opponentScore,
        }
      }, session);

      transactions.push(opponentTransaction);
    }

    return transactions;
  }

  /**
   * Obtener transacciones de un usuario con formato para frontend
   */
  async getUserTransactions(filters: TransactionFilters): Promise<any[]> {
    const {
      userTelegramId,
      type,
      itemType,
      dateFrom,
      dateTo,
      limit = 20,
      offset = 0
    } = filters;

    const query: any = { userTelegramId };
    
    if (type) query.type = type;
    if (itemType) query.itemType = itemType;
    if (dateFrom || dateTo) {
      query.sortDate = {};
      if (dateFrom) query.sortDate.$gte = dateFrom;
      if (dateTo) query.sortDate.$lte = dateTo;
    }

    const transactions = await this.transactionModel
      .find(query)
      .populate('gameTemplateId', 'name gameId')
      .sort({ sortDate: -1 })
      .limit(limit)
      .skip(offset)
      .lean();

    return transactions.map(transaction => this.formatTransactionForFrontend(transaction));
  }

  /**
   * Formatear transacción para el frontend
   */
  private formatTransactionForFrontend(transaction: any): any {
    const formatted: any = {
      id: transaction._id,
      type: transaction.type,
      itemType: transaction.itemType,
      amount: transaction.amount,
      date: transaction.date,
      sortDate: transaction.sortDate,
    };

    // Agregar campos específicos según el tipo
    if (transaction.type === TransactionType.MATCH) {
      formatted.betAmount = transaction.betAmount;
      
      if (transaction.itemType === TransactionItemType.WIN) {
        formatted.winnings = transaction.winnings;
      }
      
      if (transaction.winnerId) {
        formatted.winnerId = transaction.winnerId;
      }

      if (transaction.gameTemplateId?.name) {
        formatted.gameTemplate = {
          name: transaction.gameTemplateId.name
        };
      }
    }

    if (transaction.description) {
      formatted.description = transaction.description;
    }

    return formatted;
  }

  /**
   * Crear transacción de compra/recarga
   */
  async createPurchaseTransaction(
    userTelegramId: number,
    amount: number,
    description: string,
    metadata?: any,
    session?: ClientSession
  ): Promise<TransactionDocument> {
    return this.createTransaction({
      userTelegramId,
      type: TransactionType.TRANSACTION,
      itemType: TransactionItemType.INCOME,
      amount,
      description,
      metadata
    }, session);
  }

  /**
   * Crear transacción de reembolso
   */
  async createRefundTransaction(
    userTelegramId: number,
    amount: number,
    description: string,
    relatedGameId?: string,
    metadata?: any,
    session?: ClientSession
  ): Promise<TransactionDocument> {
    return this.createTransaction({
      userTelegramId,
      type: TransactionType.TRANSACTION,
      itemType: TransactionItemType.REFUND,
      amount,
      description,
      gameId: relatedGameId,
      metadata
    }, session);
  }

  /**
   * Obtener estadísticas de transacciones de un usuario
   */
  async getUserTransactionStats(userTelegramId: number): Promise<any> {
    const pipeline = [
      { $match: { userTelegramId } },
      {
        $group: {
          _id: '$itemType',
          totalAmount: { $sum: '$amount' },
          count: { $sum: 1 },
          totalBetAmount: { $sum: '$betAmount' },
          totalWinnings: { $sum: '$winnings' }
        }
      }
    ];

    const stats = await this.transactionModel.aggregate(pipeline);
    
    const result = {
      totalTransactions: 0,
      totalWins: 0,
      totalLosses: 0,
      totalDraws: 0,
      totalIncome: 0,
      totalExpenses: 0,
      totalRefunds: 0,
      netAmount: 0,
      totalBetAmount: 0,
      totalWinnings: 0,
    };

    stats.forEach(stat => {
      result.totalTransactions += stat.count;
      result.netAmount += stat.totalAmount;
      result.totalBetAmount += stat.totalBetAmount || 0;
      result.totalWinnings += stat.totalWinnings || 0;

      switch (stat._id) {
        case TransactionItemType.WIN:
          result.totalWins = stat.count;
          break;
        case TransactionItemType.LOSS:
          result.totalLosses = stat.count;
          break;
        case TransactionItemType.DRAW:
          result.totalDraws = stat.count;
          break;
        case TransactionItemType.INCOME:
          result.totalIncome = stat.totalAmount;
          break;
        case TransactionItemType.EXPENSE:
          result.totalExpenses = Math.abs(stat.totalAmount);
          break;
        case TransactionItemType.REFUND:
          result.totalRefunds = stat.totalAmount;
          break;
      }
    });

    return result;
  }
} 