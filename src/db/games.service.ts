import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Connection } from 'mongoose';
import { InjectConnection } from '@nestjs/mongoose';
import { Game, GameDocument, GameStatus, GameType } from './schemas/game.schema';
import { User, UserDocument } from './schemas/user.schema';
import { GameTemplate, GameTemplateDocument } from './schemas/game-template.schema';
import { TransactionsService } from './transactions.service';

export interface CreateGameDto {
  playerTelegramId: number;
  opponentTelegramId?: number;
  gameType: GameType;
  gameId: string; // ID de la plantilla del juego (ej: 'tap-reaction')
  creditsWagered?: number;
  isRanked?: boolean;
}

export interface UpdateGameDto {
  status?: GameStatus;
  playerScore?: number;
  opponentScore?: number;
  creditsWon?: number;
  gameData?: any;
  notes?: string;
}

export interface FinishGameDto {
  gameId: string;
  winnerTelegramId?: number;
  playerScore?: number;
  opponentScore?: number;
  status: GameStatus;
  gameData?: any;
  notes?: string;
}

@Injectable()
export class GamesService {
  private readonly logger = new Logger(GamesService.name);

  constructor(
    @InjectModel(Game.name) private readonly gameModel: Model<GameDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(GameTemplate.name) private readonly gameTemplateModel: Model<GameTemplateDocument>,
    @InjectConnection() private readonly connection: Connection,
    private readonly transactionsService: TransactionsService,
  ) {}

  /**
   * Iniciar una nueva partida con transferencia de créditos
   */
  async startGame(createGameDto: CreateGameDto): Promise<GameDocument> {
    const session = await this.connection.startSession();
    
    try {
      return await session.withTransaction(async () => {
        // Encontrar la plantilla del juego
        const gameTemplate = await this.gameTemplateModel.findOne({ gameId: createGameDto.gameId }).session(session);
        if (!gameTemplate) {
          throw new NotFoundException('Tipo de juego no encontrado');
        }

        if (!gameTemplate.isActive) {
          throw new NotFoundException('Este juego no está disponible actualmente');
        }

        // Encontrar al jugador
        const player = await this.userModel.findOne({ telegramId: createGameDto.playerTelegramId }).session(session);
        if (!player) {
          throw new NotFoundException('Jugador no encontrado');
        }

        // Encontrar al oponente si existe
        let opponent = null;
        if (createGameDto.opponentTelegramId) {
          opponent = await this.userModel.findOne({ telegramId: createGameDto.opponentTelegramId }).session(session);
          if (!opponent) {
            throw new NotFoundException('Oponente no encontrado');
          }
        }

        // Validar créditos suficientes
        const creditsToWager = createGameDto.creditsWagered || gameTemplate.entryCost;
        if (player.credits < creditsToWager) {
          throw new BadRequestException('Créditos insuficientes para jugar este juego');
        }

        if (opponent && opponent.credits < creditsToWager) {
          throw new BadRequestException('El oponente no tiene créditos suficientes para jugar');
        }

        // Descontar créditos apostados de ambos jugadores
        await this.userModel.findByIdAndUpdate(
          player._id,
          { $inc: { credits: -creditsToWager } },
          { session }
        );

        if (opponent) {
          await this.userModel.findByIdAndUpdate(
            opponent._id,
            { $inc: { credits: -creditsToWager } },
            { session }
          );
        }

        // Crear el juego
        const game = new this.gameModel({
          playerId: player._id,
          playerTelegramId: createGameDto.playerTelegramId,
          opponentId: opponent?._id,
          opponentTelegramId: createGameDto.opponentTelegramId,
          gameTemplateId: gameTemplate._id,
          gameId: createGameDto.gameId,
          gameType: createGameDto.gameType,
          creditsWagered: creditsToWager,
          isRanked: createGameDto.isRanked || false,
          startedAt: new Date(),
          status: GameStatus.STARTED,
        });

        const savedGame = await game.save({ session });

        // Incrementar estadísticas de la plantilla
        await this.gameTemplateModel.findByIdAndUpdate(gameTemplate._id, {
          $inc: {
            totalGamesPlayed: 1,
            totalPlayersParticipated: opponent ? 2 : 1,
          },
        }, { session });

        // Registrar transacciones iniciales de apuesta
        await this.transactionsService.createGameStartTransactions(savedGame, session);

        return savedGame;
      });
    } finally {
      await session.endSession();
    }
  }

  /**
   * Método legacy para compatibilidad
   */
  async createGame(createGameDto: CreateGameDto): Promise<GameDocument> {
    return this.startGame(createGameDto);
  }

  /**
   * Finalizar una partida con transferencias automáticas de créditos
   */
  async finishGame(finishGameDto: FinishGameDto): Promise<GameDocument> {
    const session = await this.connection.startSession();
    
    try {
      let updatedGame: GameDocument;
      
      // Ejecutar las operaciones críticas en transacción
      updatedGame = await session.withTransaction(async () => {
        const game = await this.gameModel.findById(finishGameDto.gameId).session(session);
        if (!game) {
          throw new NotFoundException('Juego no encontrado');
        }

        if (game.status !== GameStatus.STARTED) {
          throw new BadRequestException('Este juego ya ha finalizado');
        }

        // Actualizar datos del juego
        game.endedAt = new Date();
        game.duration = Math.floor((game.endedAt.getTime() - game.startedAt.getTime()) / 1000);
        game.status = finishGameDto.status;
        game.playerScore = finishGameDto.playerScore || 0;
        game.opponentScore = finishGameDto.opponentScore || 0;
        
        if (finishGameDto.gameData) {
          game.gameData = finishGameDto.gameData;
        }
        if (finishGameDto.notes) {
          game.notes = finishGameDto.notes;
        }

        // Determinar ganador y procesar transferencias
        await this.processGameFinish(game, finishGameDto.winnerTelegramId, session);

        return await game.save({ session });
      });

      // Actualizar estadísticas fuera de la transacción de forma asíncrona
      // Esto evita que bloquee la respuesta principal
      setImmediate(async () => {
        try {
          await this.updateUserStats(updatedGame);
        } catch (error) {
          this.logger.error('Error actualizando estadísticas del usuario de forma asíncrona', error);
        }
      });

      return updatedGame;
    } finally {
      await session.endSession();
    }
  }

  /**
   * Procesar el final del juego con transferencias y transacciones
   */
  private async processGameFinish(
    game: GameDocument,
    explicitWinnerTelegramId?: number,
    session?: any
  ): Promise<void> {
    const creditsWagered = game.creditsWagered || 0;

    if (game.status === GameStatus.DRAW) {
      // En caso de empate, devolver créditos a ambos jugadores
      const updatePromises = [
        this.userModel.findByIdAndUpdate(
          game.playerId,
          { $inc: { credits: creditsWagered } },
          { session }
        )
      ];

      if (game.opponentId) {
        updatePromises.push(
          this.userModel.findByIdAndUpdate(
            game.opponentId,
            { $inc: { credits: creditsWagered } },
            { session }
          )
        );
      }

      // Ejecutar actualizaciones en paralelo
      await Promise.all(updatePromises);

      // Registrar transacciones de empate
      await this.transactionsService.processDrawTransaction(
        game,
        game.playerTelegramId,
        game.opponentTelegramId,
        session
      );

    } else if (game.status === GameStatus.COMPLETED || game.status === GameStatus.WON || game.status === GameStatus.LOST) {
      // Determinar ganador
      let winnerTelegramId: number;
      let loserTelegramId: number;

      if (explicitWinnerTelegramId) {
        winnerTelegramId = explicitWinnerTelegramId;
        loserTelegramId = winnerTelegramId === game.playerTelegramId 
          ? game.opponentTelegramId! 
          : game.playerTelegramId;
      } else if (game.status === GameStatus.WON) {
        winnerTelegramId = game.playerTelegramId;
        loserTelegramId = game.opponentTelegramId!;
      } else if (game.status === GameStatus.LOST) {
        winnerTelegramId = game.opponentTelegramId!;
        loserTelegramId = game.playerTelegramId;
      } else {
        // Determinar por puntuación
        if (game.playerScore > game.opponentScore) {
          winnerTelegramId = game.playerTelegramId;
          loserTelegramId = game.opponentTelegramId!;
        } else if (game.opponentScore > game.playerScore) {
          winnerTelegramId = game.opponentTelegramId!;
          loserTelegramId = game.playerTelegramId;
        } else {
          // Empate por puntuación
          game.status = GameStatus.DRAW;
          await this.processGameFinish(game, undefined, session);
          return;
        }
      }

      // Actualizar al ganador - SOLO devolver su apuesta + ganar la del oponente
      const winner = await this.userModel.findOne({ telegramId: winnerTelegramId }).session(session);
      if (winner) {
        // El ganador recibe: su apuesta devuelta + la apuesta del oponente = creditsWagered * 2
        const totalPrize = creditsWagered * 2;
        
        await this.userModel.findByIdAndUpdate(
          winner._id,
          { $inc: { credits: totalPrize } },
          { session }
        );

        game.creditsWon = creditsWagered; // Solo la ganancia neta

        // Registrar transacciones si hay oponente
        if (game.opponentTelegramId) {
          await this.transactionsService.processGameTransactions(
            game,
            winnerTelegramId,
            loserTelegramId,
            session
          );
        }
      }
    } else if (game.status === GameStatus.ABANDONED) {
      // En caso de abandono, devolver créditos a ambos jugadores
      const updatePromises = [
        this.userModel.findByIdAndUpdate(
          game.playerId,
          { $inc: { credits: creditsWagered } },
          { session }
        )
      ];

      if (game.opponentId) {
        updatePromises.push(
          this.userModel.findByIdAndUpdate(
            game.opponentId,
            { $inc: { credits: creditsWagered } },
            { session }
          )
        );
      }

      // Ejecutar actualizaciones en paralelo
      await Promise.all(updatePromises);

      // Registrar transacciones de abandono
      await this.transactionsService.processAbandonedGameTransactions(game, session);
    }
  }

  /**
   * Método legacy para compatibilidad
   */
  async updateGame(gameId: string, updateGameDto: UpdateGameDto): Promise<GameDocument> {
    const game = await this.gameModel.findById(gameId);
    if (!game) {
      throw new NotFoundException('Juego no encontrado');
    }

    // Si el juego está terminando, calcular duración
    if (updateGameDto.status && updateGameDto.status !== GameStatus.STARTED && !game.endedAt) {
      game.endedAt = new Date();
      game.duration = Math.floor((game.endedAt.getTime() - game.startedAt.getTime()) / 1000);
    }

    Object.assign(game, updateGameDto);
    const updatedGame = await game.save();

    // Si el juego terminó, actualizar estadísticas del usuario
    if (updateGameDto.status && updateGameDto.status !== GameStatus.STARTED) {
      await this.updateUserStats(updatedGame);
    }

    return updatedGame;
  }

  async getGameById(gameId: string): Promise<GameDocument> {
    const game = await this.gameModel
      .findById(gameId)
      .populate('playerId', 'telegramId username firstName')
      .populate('opponentId', 'telegramId username firstName')
      .populate('gameTemplateId');

    if (!game) {
      throw new NotFoundException('Juego no encontrado');
    }

    return game;
  }

  async getGamesByPlayer(telegramId: number, limit = 10, offset = 0): Promise<GameDocument[]> {
    return this.gameModel
      .find({
        $or: [{ playerTelegramId: telegramId }, { opponentTelegramId: telegramId }],
      })
      .populate('playerId', 'telegramId username firstName')
      .populate('opponentId', 'telegramId username firstName')
      .populate('gameTemplateId', 'gameId name backgroundImage estimatedTime')
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(offset);
  }

  async getActiveGames(telegramId: number): Promise<GameDocument[]> {
    return this.gameModel
      .find({
        $or: [{ playerTelegramId: telegramId }, { opponentTelegramId: telegramId }],
        status: GameStatus.STARTED,
      })
      .populate('playerId', 'telegramId username firstName')
      .populate('opponentId', 'telegramId username firstName')
      .populate('gameTemplateId', 'gameId name backgroundImage estimatedTime')
      .sort({ createdAt: -1 });
  }

  /**
   * Buscar juegos entre dos usuarios específicos
   */
  async getGamesBetweenUsers(
    playerTelegramId: number,
    opponentTelegramId: number,
    limit = 10,
    offset = 0
  ): Promise<{ games: GameDocument[]; summary: any }> {
    const games = await this.gameModel
      .find({
        $or: [
          { 
            playerTelegramId: playerTelegramId, 
            opponentTelegramId: opponentTelegramId 
          },
          { 
            playerTelegramId: opponentTelegramId, 
            opponentTelegramId: playerTelegramId 
          }
        ],
        status: { $ne: GameStatus.STARTED }
      })
      .populate('playerId', 'telegramId username firstName')
      .populate('opponentId', 'telegramId username firstName')
      .populate('gameTemplateId', 'gameId name backgroundImage estimatedTime')
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(offset);

    // Calcular estadísticas del enfrentamiento
    const totalGames = games.length;
    let playerWins = 0;
    let opponentWins = 0;
    let draws = 0;

    games.forEach(game => {
      if (game.status === GameStatus.DRAW) {
        draws++;
      } else if (game.status === GameStatus.WON) {
        if (game.playerTelegramId === playerTelegramId) {
          playerWins++;
        } else {
          opponentWins++;
        }
      } else if (game.status === GameStatus.LOST) {
        if (game.playerTelegramId === playerTelegramId) {
          opponentWins++;
        } else {
          playerWins++;
        }
      } else if (game.status === GameStatus.COMPLETED) {
        // Determinar ganador por puntuación
        if (game.playerScore > game.opponentScore) {
          if (game.playerTelegramId === playerTelegramId) {
            playerWins++;
          } else {
            opponentWins++;
          }
        } else if (game.opponentScore > game.playerScore) {
          if (game.playerTelegramId === playerTelegramId) {
            opponentWins++;
          } else {
            playerWins++;
          }
        } else {
          draws++;
        }
      }
    });

    const summary = {
      totalGames,
      playerWins,
      opponentWins,
      draws,
    };

    return { games, summary };
  }

  /**
   * Obtener estadísticas globales del sistema
   */
  async getGlobalStats(): Promise<any> {
    const totalGames = await this.gameModel.countDocuments();
    const activeGames = await this.gameModel.countDocuments({ status: GameStatus.STARTED });
    const completedGames = await this.gameModel.countDocuments({ 
      status: { $in: [GameStatus.COMPLETED, GameStatus.WON, GameStatus.LOST, GameStatus.DRAW] }
    });

    // Calcular duración promedio
    const avgDurationResult = await this.gameModel.aggregate([
      { $match: { duration: { $gt: 0 } } },
      { $group: { _id: null, avgDuration: { $avg: '$duration' } } }
    ]);
    const avgGameDuration = avgDurationResult.length > 0 ? avgDurationResult[0].avgDuration : 0;

    // Obtener tipo de juego más popular
    const popularGameResult = await this.gameModel.aggregate([
      { $group: { _id: '$gameType', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 1 }
    ]);
    const mostPopularGameType = popularGameResult.length > 0 ? popularGameResult[0]._id : 'single_player';

    // Calcular total de créditos en circulación
    const totalCreditsResult = await this.userModel.aggregate([
      { $group: { _id: null, totalCredits: { $sum: '$credits' } } }
    ]);
    const totalCreditsCirculating = totalCreditsResult.length > 0 ? totalCreditsResult[0].totalCredits : 0;

    // Contar usuarios activos (que han jugado al menos una vez)
    const activeUsers = await this.userModel.countDocuments({ 'gameStats.totalGames': { $gt: 0 } });

    return {
      totalGames,
      activeGames,
      completedGames,
      activeUsers,
      avgGameDuration: Math.round(avgGameDuration),
      mostPopularGameType,
      totalCreditsCirculating,
      lastUpdated: new Date(),
    };
  }

  private async updateUserStats(game: GameDocument): Promise<void> {
    try {
      // Actualizar estadísticas del jugador principal
      await this.updatePlayerStats(game.playerTelegramId, game, true);

      // Actualizar estadísticas del oponente si existe
      if (game.opponentTelegramId) {
        await this.updatePlayerStats(game.opponentTelegramId, game, false);
      }
    } catch (error) {
      this.logger.error('Error actualizando estadísticas del usuario', error);
    }
  }

  private async updatePlayerStats(
    telegramId: number,
    game: GameDocument,
    isMainPlayer: boolean,
  ): Promise<void> {
    const user = await this.userModel.findOne({ telegramId });
    if (!user) return;

    // Determinar el resultado para este jugador
    let isWin = false;
    let isLoss = false;
    let isDraw = false;
    let isAbandoned = false;

    if (game.status === GameStatus.ABANDONED) {
      isAbandoned = true;
    } else if (game.status === GameStatus.DRAW) {
      isDraw = true;
    } else if (game.status === GameStatus.WON) {
      isWin = isMainPlayer;
      isLoss = !isMainPlayer;
    } else if (game.status === GameStatus.LOST) {
      isLoss = isMainPlayer;
      isWin = !isMainPlayer;
    } else if (game.status === GameStatus.COMPLETED) {
      // Comparar puntuaciones
      const playerScore = isMainPlayer ? game.playerScore : game.opponentScore;
      const opponentScore = isMainPlayer ? game.opponentScore : game.playerScore;

      if (playerScore > opponentScore) {
        isWin = true;
      } else if (playerScore < opponentScore) {
        isLoss = true;
      } else {
        isDraw = true;
      }
    }

    // Calcular créditos ganados/perdidos
    const creditsChange = isMainPlayer
      ? (game.creditsWon || 0) - (game.creditsWagered || 0)
      : -(game.creditsWon || 0);

    // Preparar todas las actualizaciones en una sola operación
    const gameStatsUpdate: any = {
      $inc: {
        'gameStats.totalGames': 1,
        'gameStats.totalPlayTime': game.duration || 0,
      },
    };

    if (isWin) {
      gameStatsUpdate.$inc['gameStats.gamesWon'] = 1;
      gameStatsUpdate.$inc['gameStats.currentWinStreak'] = 1;
      if (creditsChange > 0) {
        gameStatsUpdate.$inc['gameStats.totalCreditsWon'] = creditsChange;
      }
      
      // Calcular la nueva racha y actualizar la máxima si es necesario
      const newWinStreak = (user.gameStats?.currentWinStreak || 0) + 1;
      const currentLongestStreak = user.gameStats?.longestWinStreak || 0;
      if (newWinStreak > currentLongestStreak) {
        gameStatsUpdate.$set = gameStatsUpdate.$set || {};
        gameStatsUpdate.$set['gameStats.longestWinStreak'] = newWinStreak;
      }
    } else {
      gameStatsUpdate.$set = gameStatsUpdate.$set || {};
      gameStatsUpdate.$set['gameStats.currentWinStreak'] = 0;
      
      if (isLoss) {
        gameStatsUpdate.$inc['gameStats.gamesLost'] = 1;
        if (creditsChange < 0) {
          gameStatsUpdate.$inc['gameStats.totalCreditsLost'] = Math.abs(creditsChange);
        }
      } else if (isDraw) {
        gameStatsUpdate.$inc['gameStats.gamesDrawn'] = 1;
      } else if (isAbandoned) {
        gameStatsUpdate.$inc['gameStats.gamesAbandoned'] = 1;
      }
    }

    if (game.isRanked) {
      gameStatsUpdate.$inc['gameStats.rankedGames'] = 1;
    }

    // Ejecutar la actualización principal de estadísticas
    await this.userModel.findOneAndUpdate({ telegramId }, gameStatsUpdate);

    // Actualizar estadísticas contra oponente específico de forma paralela si existe
    if (game.opponentTelegramId && telegramId !== game.opponentTelegramId) {
      const opponentTelegramId = isMainPlayer ? game.opponentTelegramId : game.playerTelegramId;
      // Ejecutar esta operación de forma asíncrona para no bloquear
      setImmediate(async () => {
        try {
          await this.updateOpponentStats(telegramId, opponentTelegramId, isWin, isLoss, isDraw);
        } catch (error) {
          this.logger.error('Error actualizando estadísticas de oponente', error);
        }
      });
    }
  }

  private async updateOpponentStats(
    playerTelegramId: number,
    opponentTelegramId: number,
    isWin: boolean,
    isLoss: boolean,
    isDraw: boolean,
  ): Promise<void> {
    const user = await this.userModel.findOne({ telegramId: playerTelegramId });
    if (!user) return;

    const opponent = await this.userModel.findOne({ telegramId: opponentTelegramId });
    const opponentUsername = opponent?.username;

    // Buscar si ya existe estadística contra este oponente
    const existingOpponentIndex = user.opponentStats.findIndex(
      stat => stat.opponentTelegramId === opponentTelegramId,
    );

    if (existingOpponentIndex >= 0) {
      // Actualizar estadística existente
      const updateQuery: any = {
        $inc: {
          [`opponentStats.${existingOpponentIndex}.gamesPlayed`]: 1,
        },
        $set: {
          [`opponentStats.${existingOpponentIndex}.lastPlayedAt`]: new Date(),
          [`opponentStats.${existingOpponentIndex}.opponentUsername`]: opponentUsername,
        },
      };

      if (isWin) {
        updateQuery.$inc[`opponentStats.${existingOpponentIndex}.wins`] = 1;
      } else if (isLoss) {
        updateQuery.$inc[`opponentStats.${existingOpponentIndex}.losses`] = 1;
      } else if (isDraw) {
        updateQuery.$inc[`opponentStats.${existingOpponentIndex}.draws`] = 1;
      }

      await this.userModel.findOneAndUpdate({ telegramId: playerTelegramId }, updateQuery);
    } else {
      // Crear nueva estadística contra oponente
      const newOpponentStat = {
        opponentTelegramId,
        opponentUsername,
        gamesPlayed: 1,
        wins: isWin ? 1 : 0,
        losses: isLoss ? 1 : 0,
        draws: isDraw ? 1 : 0,
        lastPlayedAt: new Date(),
      };

      await this.userModel.findOneAndUpdate(
        { telegramId: playerTelegramId },
        { $push: { opponentStats: newOpponentStat } },
      );
    }
  }
}
