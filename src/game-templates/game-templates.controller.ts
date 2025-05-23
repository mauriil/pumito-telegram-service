import { 
  Controller, 
  Get, 
  Post, 
  Put, 
  Param, 
  Body, 
  Query, 
  NotFoundException,
  HttpStatus,
  HttpCode,
  BadRequestException 
} from '@nestjs/common';
import { GameTemplatesService, CreateGameTemplateDto } from '../db/game-templates.service';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('Game Templates')
@Controller('game-templates')
export class GameTemplatesController {
  constructor(
    private readonly gameTemplatesService: GameTemplatesService,
  ) {}

  /**
   * Obtener todos los juegos disponibles (formato para frontend)
   * Este endpoint reemplaza el mock del frontend
   */
  @Get()
  async getAvailableGames(
    @Query('includeInactive') includeInactive?: string,
    @Query('category') category?: string,
    @Query('difficulty') difficulty?: string,
  ) {
    let games;

    if (category) {
      games = await this.gameTemplatesService.findByCategory(category);
    } else if (difficulty) {
      const difficultyLevel = parseInt(difficulty);
      games = await this.gameTemplatesService.findByDifficultyLevel(difficultyLevel);
    } else {
      const includeInactiveBoolean = includeInactive === 'true';
      games = await this.gameTemplatesService.findAll(includeInactiveBoolean);
    }

    // Transformar al formato que espera el frontend
    const transformedGames = games.map(game => ({
      id: game.gameId,
      name: game.name,
      description: game.description,
      entryCost: game.entryCost,
      maxWinnings: game.maxWinnings,
      backgroundImage: game.backgroundImage,
      estimatedTime: game.estimatedTime,
      isActive: game.isActive,
      route: game.route,
      // Datos adicionales para el backend
      category: game.category,
      difficultyLevel: game.difficultyLevel,
      tags: game.tags,
      totalGamesPlayed: game.totalGamesPlayed,
      winRateMultiplier: game.winRateMultiplier,
    }));

    return {
      success: true,
      data: transformedGames,
      message: 'Juegos disponibles obtenidos exitosamente'
    };
  }

  /**
   * Obtener solo juegos activos (versión simplificada para el frontend)
   */
  @Get('active')
  async getActiveGames() {
    const games = await this.gameTemplatesService.findActiveGames();

    const transformedGames = games.map(game => ({
      id: game.gameId,
      name: game.name,
      description: game.description,
      entryCost: game.entryCost,
      maxWinnings: game.maxWinnings,
      backgroundImage: game.backgroundImage,
      estimatedTime: game.estimatedTime,
      isActive: game.isActive,
      route: game.route,
    }));

    return {
      success: true,
      data: transformedGames,
      message: 'Juegos activos obtenidos exitosamente'
    };
  }

  /**
   * Obtener un juego específico por ID
   */
  @Get(':gameId')
  async getGameById(@Param('gameId') gameId: string) {
    const game = await this.gameTemplatesService.findByGameId(gameId);
    
    if (!game) {
      throw new NotFoundException('Juego no encontrado');
    }

    return {
      success: true,
      data: {
        id: game.gameId,
        name: game.name,
        description: game.description,
        entryCost: game.entryCost,
        maxWinnings: game.maxWinnings,
        backgroundImage: game.backgroundImage,
        estimatedTime: game.estimatedTime,
        isActive: game.isActive,
        route: game.route,
        category: game.category,
        difficultyLevel: game.difficultyLevel,
        tags: game.tags,
        totalGamesPlayed: game.totalGamesPlayed,
        totalPlayersParticipated: game.totalPlayersParticipated,
        winRateMultiplier: game.winRateMultiplier,
        minPlayersToStart: game.minPlayersToStart,
        maxPlayers: game.maxPlayers,
        gameConfig: game.gameConfig,
      },
      message: 'Detalles del juego obtenidos exitosamente'
    };
  }

  /**
   * Obtener juegos por categoría
   */
  @Get('category/:category')
  async getGamesByCategory(@Param('category') category: string) {
    const games = await this.gameTemplatesService.findByCategory(category);

    const transformedGames = games.map(game => ({
      id: game.gameId,
      name: game.name,
      description: game.description,
      entryCost: game.entryCost,
      maxWinnings: game.maxWinnings,
      backgroundImage: game.backgroundImage,
      estimatedTime: game.estimatedTime,
      isActive: game.isActive,
      route: game.route,
    }));

    return {
      success: true,
      data: transformedGames,
      message: `Juegos de categoría '${category}' obtenidos exitosamente`
    };
  }

  /**
   * Buscar juegos
   */
  @Get('search/:query')
  async searchGames(@Param('query') query: string) {
    const games = await this.gameTemplatesService.searchGames(query);

    const transformedGames = games.map(game => ({
      id: game.gameId,
      name: game.name,
      description: game.description,
      entryCost: game.entryCost,
      maxWinnings: game.maxWinnings,
      backgroundImage: game.backgroundImage,
      estimatedTime: game.estimatedTime,
      isActive: game.isActive,
      route: game.route,
    }));

    return {
      success: true,
      data: transformedGames,
      message: `Resultados de búsqueda para '${query}'`
    };
  }

  /**
   * Crear un nuevo juego (admin)
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createGame(@Body() createGameData: CreateGameTemplateDto) {
    try {
      const game = await this.gameTemplatesService.createGameTemplate(createGameData);
      
      return {
        success: true,
        data: game,
        message: 'Juego creado exitosamente'
      };
    } catch (error) {
      if (error.code === 11000) {
        throw new BadRequestException('Ya existe un juego con ese ID');
      }
      throw error;
    }
  }

  /**
   * Actualizar un juego (admin)
   */
  @Put(':gameId')
  async updateGame(
    @Param('gameId') gameId: string,
    @Body() updateData: Partial<CreateGameTemplateDto>
  ) {
    const game = await this.gameTemplatesService.updateGameTemplate(gameId, updateData);
    
    return {
      success: true,
      data: game,
      message: 'Juego actualizado exitosamente'
    };
  }

  /**
   * Activar/desactivar un juego (admin)
   */
  @Put(':gameId/toggle')
  async toggleGameActive(@Param('gameId') gameId: string) {
    const game = await this.gameTemplatesService.toggleActive(gameId);
    
    return {
      success: true,
      data: game,
      message: `Juego ${game.isActive ? 'activado' : 'desactivado'} exitosamente`
    };
  }

  /**
   * Obtener estadísticas de un juego específico
   */
  @Get(':gameId/stats')
  async getGameStats(@Param('gameId') gameId: string) {
    const stats = await this.gameTemplatesService.getGameStats(gameId);
    
    return {
      success: true,
      data: stats,
      message: 'Estadísticas del juego obtenidas exitosamente'
    };
  }

  /**
   * Inicializar juegos por defecto (desarrollo/admin)
   */
  @Post('seed/initial')
  @HttpCode(HttpStatus.CREATED)
  async seedInitialGames() {
    await this.gameTemplatesService.seedInitialGames();
    
    return {
      success: true,
      message: 'Juegos iniciales creados exitosamente'
    };
  }
} 