import { 
  Controller, 
  Get, 
  Param, 
  Query, 
  NotFoundException,
  ParseIntPipe,
  BadRequestException 
} from '@nestjs/common';
import { GamesService } from '../db/games.service';
import { UsersService } from '../db/users.service';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('Games')
@Controller('api/games')
export class GamesController {
  constructor(
    private readonly gamesService: GamesService,
    private readonly usersService: UsersService,
  ) {}

  /**
   * Obtener detalles de un juego específico
   */
  @Get(':gameId')
  async getGameById(@Param('gameId') gameId: string) {
    try {
      const game = await this.gamesService.getGameById(gameId);
      
      return {
        success: true,
        data: game,
        message: 'Detalles del juego obtenidos exitosamente'
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
          limit: limitNumber
        }
      },
      message: 'Leaderboard obtenido exitosamente'
    };
  }

  /**
   * Obtener leaderboard por victorias
   */
  @Get('leaderboard/wins')
  async getLeaderboardByWins(
    @Query('limit') limit?: string,
  ) {
    const limitNumber = limit ? Math.min(parseInt(limit), 100) : 10;

    return {
      success: true,
      data: {
        leaderboard: [],
        criteria: {
          sortBy: 'wins',
          limit: limitNumber
        }
      },
      message: 'Leaderboard por victorias obtenido exitosamente'
    };
  }

  /**
   * Buscar juegos entre dos usuarios específicos
   */
  @Get('between/:playerTelegramId/:opponentTelegramId')
  async getGamesBetweenUsers(
    @Param('playerTelegramId', ParseIntPipe) playerTelegramId: number,
    @Param('opponentTelegramId', ParseIntPipe) opponentTelegramId: number,
    @Query('limit') limit?: string,
  ) {
    const limitNumber = limit ? parseInt(limit) : 10;

    // Verificar que ambos usuarios existen
    const [player, opponent] = await Promise.all([
      this.usersService.findByTelegramId(playerTelegramId),
      this.usersService.findByTelegramId(opponentTelegramId)
    ]);

    if (!player) {
      throw new NotFoundException('Jugador no encontrado');
    }
    if (!opponent) {
      throw new NotFoundException('Oponente no encontrado');
    }

    // Aquí necesitarías un método en GamesService para buscar juegos entre usuarios específicos
    // Por ahora simulo la respuesta
    
    return {
      success: true,
      data: {
        games: [],
        players: {
          player: {
            telegramId: player.telegramId,
            username: player.username,
            firstName: player.firstName
          },
          opponent: {
            telegramId: opponent.telegramId,
            username: opponent.username,
            firstName: opponent.firstName
          }
        },
        summary: {
          totalGames: 0,
          playerWins: 0,
          opponentWins: 0,
          draws: 0
        }
      },
      message: 'Historial entre usuarios obtenido exitosamente'
    };
  }

  /**
   * Obtener estadísticas globales del sistema de juegos
   */
  @Get('stats/global')
  async getGlobalStats() {
    // Aquí podrías implementar estadísticas globales como:
    // - Total de juegos jugados
    // - Usuarios activos
    // - Promedio de duración de juegos
    // - etc.
    
    return {
      success: true,
      data: {
        totalGames: 0,
        activeUsers: 0,
        avgGameDuration: 0,
        mostPopularGameType: 'single_player',
        totalCreditsCirculating: 0,
        lastUpdated: new Date()
      },
      message: 'Estadísticas globales obtenidas exitosamente'
    };
  }
} 