import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Game, GameDocument, GameStatus, GameType } from './schemas/game.schema';
import { User, UserDocument } from './schemas/user.schema';
import { GameTemplate, GameTemplateDocument } from './schemas/game-template.schema';

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

@Injectable()
export class GamesService {
  private readonly logger = new Logger(GamesService.name);

  constructor(
    @InjectModel(Game.name) private readonly gameModel: Model<GameDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(GameTemplate.name) private readonly gameTemplateModel: Model<GameTemplateDocument>,
  ) {}

  async createGame(createGameDto: CreateGameDto): Promise<GameDocument> {
    // Encontrar la plantilla del juego
    const gameTemplate = await this.gameTemplateModel.findOne({ gameId: createGameDto.gameId });
    if (!gameTemplate) {
      throw new NotFoundException('Tipo de juego no encontrado');
    }

    if (!gameTemplate.isActive) {
      throw new NotFoundException('Este juego no está disponible actualmente');
    }

    // Encontrar al jugador
    const player = await this.userModel.findOne({ telegramId: createGameDto.playerTelegramId });
    if (!player) {
      throw new NotFoundException('Jugador no encontrado');
    }

    // Encontrar al oponente si existe
    let opponent = null;
    if (createGameDto.opponentTelegramId) {
      opponent = await this.userModel.findOne({ telegramId: createGameDto.opponentTelegramId });
      if (!opponent) {
        throw new NotFoundException('Oponente no encontrado');
      }
    }

    // Validar créditos suficientes si no se especifican créditos apostados
    const creditsToWager = createGameDto.creditsWagered || gameTemplate.entryCost;
    if (player.credits < creditsToWager) {
      throw new NotFoundException('Créditos insuficientes para jugar este juego');
    }

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

    const savedGame = await game.save();

    // Incrementar estadísticas de la plantilla
    await this.gameTemplateModel.findByIdAndUpdate(gameTemplate._id, {
      $inc: {
        totalGamesPlayed: 1,
        totalPlayersParticipated: opponent ? 2 : 1,
      },
    });

    return savedGame;
  }

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

    // Actualizar estadísticas generales
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
    } else {
      gameStatsUpdate.$set = { 'gameStats.currentWinStreak': 0 };
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

    await this.userModel.findOneAndUpdate({ telegramId }, gameStatsUpdate);

    // Actualizar racha máxima si es necesario
    if (isWin) {
      const updatedUser = await this.userModel.findOne({ telegramId });
      if (
        updatedUser &&
        updatedUser.gameStats.currentWinStreak > updatedUser.gameStats.longestWinStreak
      ) {
        await this.userModel.findOneAndUpdate(
          { telegramId },
          { $set: { 'gameStats.longestWinStreak': updatedUser.gameStats.currentWinStreak } },
        );
      }
    }

    // Actualizar estadísticas contra oponente específico
    if (game.opponentTelegramId && telegramId !== game.opponentTelegramId) {
      const opponentTelegramId = isMainPlayer ? game.opponentTelegramId : game.playerTelegramId;
      await this.updateOpponentStats(telegramId, opponentTelegramId, isWin, isLoss, isDraw);
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
