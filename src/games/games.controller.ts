import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Query,
  Body,
  NotFoundException,
  ParseIntPipe,
  BadRequestException,
} from '@nestjs/common';
import { GamesService } from '../db/games.service';
import { UsersService } from '../db/users.service';
import { TransactionsService } from '../db/transactions.service';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { GameType } from '../db/schemas/game.schema';
import { StartGameDto } from './dto/start-game.dto';
import { FinishGameDto } from './dto/finish-game.dto';

@ApiTags('Games')
@Controller('games')
export class GamesController {
  constructor(
    private readonly gamesService: GamesService,
    private readonly usersService: UsersService,
    private readonly transactionsService: TransactionsService,
  ) {}

  /**
   * Iniciar una nueva partida
   */
  @Post('start')
  @ApiOperation({ summary: 'Iniciar una nueva partida' })
  @ApiResponse({ status: 201, description: 'Partida iniciada exitosamente' })
  async startGame(@Body() createGameDto: StartGameDto) {
    try {
      const game = await this.gamesService.startGame(createGameDto);

      return {
        success: true,
        data: game,
        message: 'Partida iniciada exitosamente',
      };
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Error al iniciar la partida');
    }
  }

  /**
   * Finalizar una partida
   */
  @Put('finish')
  @ApiOperation({ summary: 'Finalizar una partida' })
  @ApiResponse({ status: 200, description: 'Partida finalizada exitosamente' })
  async finishGame(@Body() finishGameDto: FinishGameDto) {
    try {
      const game = await this.gamesService.finishGame(finishGameDto);

      return {
        success: true,
        data: game,
        message: 'Partida finalizada exitosamente',
      };
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Error al finalizar la partida');
    }
  }

  /**
   * Obtener detalles de un juego específico
   */
  @Get(':gameId')
  @ApiOperation({ summary: 'Obtener detalles de un juego específico' })
  async getGameById(@Param('gameId') gameId: string) {
    try {
      const game = await this.gamesService.getGameById(gameId);

      return {
        success: true,
        data: game,
        message: 'Detalles del juego obtenidos exitosamente',
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException('ID de juego inválido');
    }
  }

  /**
   * Obtener leaderboard/ranking de jugadores
   */
  @Get('leaderboard/rating')
  async getLeaderboardByRating(
    @Query('limit') limit?: string,
    @Query('minGames') minGames?: string,
  ) {
    const limitNumber = limit ? Math.min(parseInt(limit), 100) : 10; // máximo 100
    const minGamesNumber = minGames ? parseInt(minGames) : 5;

    // Este sería un método que necesitarías agregar al UsersService
    // Por ahora simulo la estructura de respuesta

    return {
      success: true,
      data: {
        leaderboard: [],
        criteria: {
          sortBy: 'rating',
          minGames: minGamesNumber,
          limit: limitNumber,
        },
      },
      message: 'Leaderboard obtenido exitosamente',
    };
  }

  /**
   * Obtener leaderboard por victorias
   */
  @Get('leaderboard/wins')
  async getLeaderboardByWins(@Query('limit') limit?: string) {
    const limitNumber = limit ? Math.min(parseInt(limit), 100) : 10;

    return {
      success: true,
      data: {
        leaderboard: [],
        criteria: {
          sortBy: 'wins',
          limit: limitNumber,
        },
      },
      message: 'Leaderboard por victorias obtenido exitosamente',
    };
  }

  /**
   * Buscar juegos entre dos usuarios específicos
   */
  @Get('between/:playerTelegramId/:opponentTelegramId')
  @ApiOperation({ summary: 'Obtener historial de juegos entre dos usuarios' })
  async getGamesBetweenUsers(
    @Param('playerTelegramId', ParseIntPipe) playerTelegramId: number,
    @Param('opponentTelegramId', ParseIntPipe) opponentTelegramId: number,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const [player, opponent] = await Promise.all([
      this.usersService.findByTelegramId(playerTelegramId),
      this.usersService.findByTelegramId(opponentTelegramId),
    ]);

    if (!player) {
      throw new NotFoundException('Jugador no encontrado');
    }
    if (!opponent) {
      throw new NotFoundException('Oponente no encontrado');
    }

    const limitNumber = limit ? parseInt(limit) : 10;
    const offsetNumber = offset ? parseInt(offset) : 0;

    const { games, summary } = await this.gamesService.getGamesBetweenUsers(
      playerTelegramId,
      opponentTelegramId,
      limitNumber,
      offsetNumber
    );

    return {
      success: true,
      data: {
        games,
        players: {
          player: {
            telegramId: player.telegramId,
            username: player.username,
            firstName: player.firstName,
          },
          opponent: {
            telegramId: opponent.telegramId,
            username: opponent.username,
            firstName: opponent.firstName,
          },
        },
        summary,
      },
      message: 'Historial entre usuarios obtenido exitosamente',
    };
  }

  /**
   * Obtener estadísticas globales del sistema de juegos
   */
  @Get('stats/global')
  @ApiOperation({ summary: 'Obtener estadísticas globales del sistema' })
  async getGlobalStats() {
    const stats = await this.gamesService.getGlobalStats();

    return {
      success: true,
      data: stats,
      message: 'Estadísticas globales obtenidas exitosamente',
    };
  }

  /**
   * Obtener transacciones de un usuario
   */
  @Get('transactions/:userTelegramId')
  @ApiOperation({ summary: 'Obtener historial de transacciones de un usuario' })
  async getUserTransactions(
    @Param('userTelegramId', ParseIntPipe) userTelegramId: number,
    @Query('type') type?: string,
    @Query('itemType') itemType?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const user = await this.usersService.findByTelegramId(userTelegramId);
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    const filters = {
      userTelegramId,
      type: type as any,
      itemType: itemType as any,
      dateFrom: dateFrom ? new Date(dateFrom) : undefined,
      dateTo: dateTo ? new Date(dateTo) : undefined,
      limit: limit ? parseInt(limit) : 20,
      offset: offset ? parseInt(offset) : 0,
    };

    const transactions = await this.transactionsService.getUserTransactions(filters);
    const stats = await this.transactionsService.getUserTransactionStats(userTelegramId);

    return {
      success: true,
      data: {
        transactions,
        stats,
        user: {
          telegramId: user.telegramId,
          username: user.username,
          firstName: user.firstName,
          currentBalance: user.credits,
        },
      },
      message: 'Transacciones obtenidas exitosamente',
    };
  }
}
