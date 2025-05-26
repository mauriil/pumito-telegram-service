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
  ParseIntPipe,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBody,
  ApiBearerAuth,
  ApiExtraModels,
  getSchemaPath,
} from '@nestjs/swagger';
import { UsersService } from '../db/users.service';
import { GamesService, CreateGameDto as ServiceCreateGameDto } from '../db/games.service';
import { GameType, GameStatus } from '../db/schemas/game.schema';
import {
  CreateUserDto,
  UpdateUserDto,
  UserResponseDto,
  CreateGameDto,
  GameResponseDto,
  UserStatsDto,
  BalanceUpdateDto,
  CreditsUpdateDto,
  UserStatus,
  ApiResponseDto,
} from './dto/user.dto';

@ApiTags('Users')
@Controller('users')
@ApiExtraModels(UserResponseDto, GameResponseDto, UserStatsDto, ApiResponseDto)
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly gamesService: GamesService,
  ) {}

  private transformUserToResponse(user: any): UserResponseDto {
    return {
      id: user._id.toString(),
      telegramId: user.telegramId,
      firstName: user.firstName,
      lastName: user.lastName,
      fullName:
        user.firstName && user.lastName
          ? `${user.firstName} ${user.lastName}`
          : user.firstName || user.lastName,
      username: user.username,
      balance: user.balance,
      credits: user.credits,
      status: (user.status as UserStatus) || UserStatus.ACTIVE,
      totalGamesPlayed: user.gameStats?.totalGames || 0,
      totalGamesWon: user.gameStats?.gamesWon || 0,
      winRate:
        (user.gameStats?.totalGames || 0) > 0
          ? ((user.gameStats?.gamesWon || 0) / user.gameStats.totalGames) * 100
          : 0,
      totalPurchases: user.totalPurchases || 0,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      lastLoginAt: user.lastLoginAt,
    };
  }

  private transformGameToResponse(game: any): GameResponseDto {
    return {
      id: game._id.toString(),
      playerTelegramId: game.playerTelegramId,
      opponentTelegramId: game.opponentTelegramId,
      gameType: game.gameType,
      gameId: game.gameId,
      status: game.status,
      creditsWagered: game.creditsWagered,
      isRanked: game.isRanked,
      startedAt: game.startedAt,
      endedAt: game.endedAt,
      duration: game.duration,
      playerScore: game.playerScore,
      opponentScore: game.opponentScore,
    };
  }

  private transformUserToStats(user: any): UserStatsDto {
    return {
      userId: user._id.toString(),
      telegramId: user.telegramId,
      displayName:
        user.firstName && user.lastName
          ? `${user.firstName} ${user.lastName}`
          : user.firstName || user.username || `User ${user.telegramId}`,
      balance: user.balance,
      credits: user.credits,
      totalGamesPlayed: user.gameStats?.totalGames || 0,
      totalGamesWon: user.gameStats?.gamesWon || 0,
      winRate:
        (user.gameStats?.totalGames || 0) > 0
          ? ((user.gameStats?.gamesWon || 0) / user.gameStats.totalGames) * 100
          : 0,
      totalPurchases: user.totalPurchases || 0,
      status: (user.status as UserStatus) || UserStatus.ACTIVE,
      lastActivityAt: user.lastLoginAt || user.updatedAt,
    };
  }

  @Get()
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: '👥 Get All Users',
    description: `
    Retrieves a paginated list of all users in the system. This endpoint is restricted to administrators.
    
    **Filtering Options:**
    - Filter by status (active, suspended, banned, pending)
    - Search by name or username
    - Pagination support
    
    **Use Cases:**
    - Admin dashboard user listing
    - User management operations
    - Analytics and reporting
    `,
  })
  @ApiQuery({
    name: 'status',
    required: false,
    description: 'Filter users by status',
    enum: UserStatus,
    example: 'active',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    description: 'Search users by name or username',
    example: 'juan',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Number of users to return (max 100)',
    example: 20,
    type: Number,
  })
  @ApiQuery({
    name: 'offset',
    required: false,
    description: 'Number of users to skip',
    example: 0,
    type: Number,
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully retrieved users',
    schema: {
      allOf: [
        { $ref: getSchemaPath(ApiResponseDto) },
        {
          properties: {
            data: {
              type: 'object',
              properties: {
                users: {
                  type: 'array',
                  items: { $ref: getSchemaPath(UserResponseDto) },
                },
                total: { type: 'number', example: 156 },
                limit: { type: 'number', example: 20 },
                offset: { type: 'number', example: 0 },
              },
            },
          },
        },
      ],
    },
  })
  async getAllUsers(
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('limit') limit = 20,
    @Query('offset') offset = 0,
  ): Promise<ApiResponseDto<any>> {
    // TODO: Implement findAll method in UsersService
    const users: any[] = await this.usersService.findAll(limit, offset, status, search);

    // Transform users to response format
    const transformedUsers = users.map(user => this.transformUserToResponse(user));

    return {
      success: true,
      data: {
        users: transformedUsers,
        total: transformedUsers.length,
        limit: Number(limit),
        offset: Number(offset),
      },
      message: 'Usuarios obtenidos exitosamente',
      timestamp: new Date().toISOString(),
      path: '/api/users',
    };
  }

  @Get(':telegramId')
  @ApiOperation({
    summary: '👤 Get User by Telegram ID',
    description: `
    Retrieves detailed information about a specific user by their Telegram ID.
    
    **Includes:**
    - User profile information
    - Account balance and credits
    - Game statistics
    - Purchase history summary
    `,
  })
  @ApiParam({
    name: 'telegramId',
    description: 'Telegram user ID',
    example: 123456789,
    type: Number,
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully retrieved user',
    schema: {
      allOf: [
        { $ref: getSchemaPath(ApiResponseDto) },
        {
          properties: {
            data: { $ref: getSchemaPath(UserResponseDto) },
          },
        },
      ],
    },
  })
  @ApiResponse({
    status: 404,
    description: 'User not found',
    schema: {
      allOf: [
        { $ref: getSchemaPath(ApiResponseDto) },
        {
          properties: {
            success: { example: false },
            message: { example: 'Usuario no encontrado' },
            data: { example: null },
          },
        },
      ],
    },
  })
  async getUserByTelegramId(
    @Param('telegramId', ParseIntPipe) telegramId: number,
  ): Promise<ApiResponseDto<UserResponseDto>> {
    const user = await this.usersService.findByTelegramId(telegramId);
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    const userResponse = this.transformUserToResponse(user);

    return {
      success: true,
      data: userResponse,
      message: 'Usuario obtenido exitosamente',
      timestamp: new Date().toISOString(),
      path: `/api/users/${telegramId}`,
    };
  }

  @Post()
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: '➕ Create New User',
    description: `
    Creates a new user account. This endpoint can be used for manual user creation 
    or when users register through external systems.
    
    **Validation Rules:**
    - Telegram ID must be unique
    - Username must be unique (if provided)
    - Email must be valid format (if provided)
    
    **Default Values:**
    - Balance: 0 USD
    - Credits: 100 (welcome bonus)
    - Status: active
    - Verified: false
    `,
  })
  @ApiBody({
    type: CreateUserDto,
    description: 'User data to create',
    examples: {
      'Basic User': {
        summary: 'Basic user creation',
        value: {
          telegramId: 123456789,
          firstName: 'Juan',
          lastName: 'Pérez',
          username: 'juanperez',
          email: 'juan@example.com',
        },
      },
      'Minimal User': {
        summary: 'Minimal required data',
        value: {
          telegramId: 987654321,
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'User created successfully',
    schema: {
      allOf: [
        { $ref: getSchemaPath(ApiResponseDto) },
        {
          properties: {
            data: { $ref: getSchemaPath(UserResponseDto) },
          },
        },
      ],
    },
  })
  @ApiResponse({
    status: 400,
    description: 'User with this Telegram ID already exists',
    schema: {
      allOf: [
        { $ref: getSchemaPath(ApiResponseDto) },
        {
          properties: {
            success: { example: false },
            message: { example: 'Ya existe un usuario con este Telegram ID' },
            data: { example: null },
          },
        },
      ],
    },
  })
  @HttpCode(HttpStatus.CREATED)
  async createUser(
    @Body() createUserData: CreateUserDto,
  ): Promise<ApiResponseDto<UserResponseDto>> {
    try {
      // Crear un contexto simulado para usar upsertFromContext
      const mockContext = {
        from: {
          id: createUserData.telegramId,
          username: createUserData.username,
          first_name: createUserData.firstName,
        },
      } as any;

      const user = await this.usersService.upsertFromContext(mockContext);

      const userResponse = this.transformUserToResponse(user);

      return {
        success: true,
        data: userResponse,
        message: 'Usuario creado exitosamente',
        timestamp: new Date().toISOString(),
        path: '/api/users',
      };
    } catch (error: any) {
      if (error.code === 11000) {
        throw new BadRequestException('Ya existe un usuario con este Telegram ID');
      }
      throw error;
    }
  }

  @Put(':telegramId')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: '✏️ Update User',
    description: `
    Updates user information. This is a partial update operation - only provided fields will be updated.
    
    **Updateable Fields:**
    - Profile information (name, username, email)
    - Account status
    - Verification status
    
    **Note:** Balance and credits should be updated through their specific endpoints for audit trail purposes.
    `,
  })
  @ApiParam({
    name: 'telegramId',
    description: 'Telegram user ID',
    example: 123456789,
    type: Number,
  })
  @ApiBody({
    type: UpdateUserDto,
    description: 'Fields to update (partial update)',
    examples: {
      'Update Profile': {
        summary: 'Update profile information',
        value: {
          firstName: 'Juan Carlos',
          lastName: 'Pérez García',
          email: 'juan.carlos@example.com',
        },
      },
      'Update Status': {
        summary: 'Change user status',
        value: {
          status: 'suspended',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'User updated successfully',
    schema: {
      allOf: [
        { $ref: getSchemaPath(ApiResponseDto) },
        {
          properties: {
            data: { $ref: getSchemaPath(UserResponseDto) },
          },
        },
      ],
    },
  })
  @ApiResponse({
    status: 404,
    description: 'User not found',
  })
  async updateUser(
    @Param('telegramId', ParseIntPipe) telegramId: number,
    @Body() updateData: UpdateUserDto,
  ): Promise<ApiResponseDto<UserResponseDto>> {
    const user = await this.usersService.findByTelegramId(telegramId);
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    // Actualizar campos permitidos
    if (updateData.firstName !== undefined) user.firstName = updateData.firstName;
    if (updateData.lastName !== undefined) user.lastName = updateData.lastName;
    if (updateData.username !== undefined) user.username = updateData.username;
    if (updateData.status !== undefined) user.status = updateData.status as any;

    const updatedUser = await user.save();

    const userResponse = this.transformUserToResponse(updatedUser);

    return {
      success: true,
      data: userResponse,
      message: 'Usuario actualizado exitosamente',
      timestamp: new Date().toISOString(),
      path: `/api/users/${telegramId}`,
    };
  }

  @Post(':telegramId/balance')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: '💰 Update User Balance',
    description: `
    Adds or subtracts from a user's balance. This operation creates an audit trail 
    for all balance changes.
    
    **Use Cases:**
    - Processing refunds
    - Manual balance adjustments
    - Promotional credits
    - Penalty deductions
    
    **Important:** Use negative values to subtract from balance.
    `,
  })
  @ApiParam({
    name: 'telegramId',
    description: 'Telegram user ID',
    example: 123456789,
    type: Number,
  })
  @ApiBody({
    type: BalanceUpdateDto,
    description: 'Balance update information',
    examples: {
      'Add Balance': {
        summary: 'Add funds to balance',
        value: {
          amount: 25.5,
          reason: 'Purchase refund',
        },
      },
      'Subtract Balance': {
        summary: 'Deduct from balance',
        value: {
          amount: -10.0,
          reason: 'Penalty for violation',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Balance updated successfully',
    schema: {
      allOf: [
        { $ref: getSchemaPath(ApiResponseDto) },
        {
          properties: {
            data: {
              type: 'object',
              properties: {
                newBalance: { type: 'number', example: 35.5 },
                previousBalance: { type: 'number', example: 10.0 },
                changeAmount: { type: 'number', example: 25.5 },
                reason: { type: 'string', example: 'Purchase refund' },
              },
            },
          },
        },
      ],
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Insufficient balance for negative amounts',
  })
  @ApiResponse({
    status: 404,
    description: 'User not found',
  })
  async updateBalance(
    @Param('telegramId', ParseIntPipe) telegramId: number,
    @Body() balanceUpdate: BalanceUpdateDto,
  ): Promise<ApiResponseDto<any>> {
    const user = await this.usersService.findByTelegramId(telegramId);
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    const previousBalance = user.balance;

    // Check for insufficient balance if trying to subtract
    if (balanceUpdate.amount < 0 && Math.abs(balanceUpdate.amount) > user.balance) {
      throw new BadRequestException('Saldo insuficiente');
    }

    await this.usersService.addBalance(user._id.toString(), balanceUpdate.amount);
    const newBalance = user.balance + balanceUpdate.amount;

    return {
      success: true,
      data: {
        newBalance,
        previousBalance,
        changeAmount: balanceUpdate.amount,
        reason: balanceUpdate.reason || 'Manual balance adjustment',
      },
      message: 'Balance actualizado exitosamente',
      timestamp: new Date().toISOString(),
      path: `/api/users/${telegramId}/balance`,
    };
  }

  @Post(':telegramId/credits')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: '🎫 Update User Credits',
    description: `
    Adds or subtracts from a user's gaming credits. This operation creates an audit trail 
    for all credit changes.
    
    **Use Cases:**
    - Game rewards
    - Manual credit adjustments
    - Promotional bonuses
    - Credit deductions for violations
    
    **Important:** Use negative values to subtract credits.
    `,
  })
  @ApiParam({
    name: 'telegramId',
    description: 'Telegram user ID',
    example: 123456789,
    type: Number,
  })
  @ApiBody({
    type: CreditsUpdateDto,
    description: 'Credits update information',
    examples: {
      'Add Credits': {
        summary: 'Award credits',
        value: {
          amount: 500,
          reason: 'Daily login bonus',
        },
      },
      'Subtract Credits': {
        summary: 'Deduct credits',
        value: {
          amount: -100,
          reason: 'Game penalty',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Credits updated successfully',
    schema: {
      allOf: [
        { $ref: getSchemaPath(ApiResponseDto) },
        {
          properties: {
            data: {
              type: 'object',
              properties: {
                newCredits: { type: 'number', example: 2500 },
                previousCredits: { type: 'number', example: 2000 },
                changeAmount: { type: 'number', example: 500 },
                reason: { type: 'string', example: 'Daily login bonus' },
              },
            },
          },
        },
      ],
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Insufficient credits for negative amounts',
  })
  @ApiResponse({
    status: 404,
    description: 'User not found',
  })
  async updateCredits(
    @Param('telegramId', ParseIntPipe) telegramId: number,
    @Body() creditsUpdate: CreditsUpdateDto,
  ): Promise<ApiResponseDto<any>> {
    const user = await this.usersService.findByTelegramId(telegramId);
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    const previousCredits = user.credits;

    // Check for insufficient credits if trying to subtract
    if (creditsUpdate.amount < 0 && Math.abs(creditsUpdate.amount) > user.credits) {
      throw new BadRequestException('Créditos insuficientes');
    }

    await this.usersService.addCredits(user._id.toString(), creditsUpdate.amount);
    const newCredits = user.credits + creditsUpdate.amount;

    return {
      success: true,
      data: {
        newCredits,
        previousCredits,
        changeAmount: creditsUpdate.amount,
        reason: creditsUpdate.reason || 'Manual credits adjustment',
      },
      message: 'Créditos actualizados exitosamente',
      timestamp: new Date().toISOString(),
      path: `/api/users/${telegramId}/credits`,
    };
  }

  @Get(':telegramId/games')
  @ApiOperation({
    summary: '🎮 Get User Games',
    description: `
    Retrieves all games associated with a specific user, including game history, 
    current active games, and detailed game information.
    
    **Filtering Options:**
    - Filter by game status
    - Filter by game type
    - Pagination support
    `,
  })
  @ApiParam({
    name: 'telegramId',
    description: 'Telegram user ID',
    example: 123456789,
    type: Number,
  })
  @ApiQuery({
    name: 'status',
    required: false,
    description: 'Filter games by status',
    enum: GameStatus,
    example: 'completed',
  })
  @ApiQuery({
    name: 'gameType',
    required: false,
    description: 'Filter games by type',
    enum: GameType,
    example: 'tap-reaction',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Number of games to return',
    example: 10,
    type: Number,
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully retrieved user games',
    schema: {
      allOf: [
        { $ref: getSchemaPath(ApiResponseDto) },
        {
          properties: {
            data: {
              type: 'array',
              items: { $ref: getSchemaPath(GameResponseDto) },
            },
          },
        },
      ],
    },
  })
  @ApiResponse({
    status: 404,
    description: 'User not found',
  })
  async getUserGames(
    @Param('telegramId', ParseIntPipe) telegramId: number,
    @Query('status') status?: string,
    @Query('gameType') gameType?: string,
    @Query('limit') limit = 10,
  ): Promise<ApiResponseDto<GameResponseDto[]>> {
    const user = await this.usersService.findByTelegramId(telegramId);
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    const games = await this.gamesService.getGamesByPlayer(telegramId, limit);

    const transformedGames = games.map(game => this.transformGameToResponse(game));

    return {
      success: true,
      data: transformedGames,
      message: 'Juegos del usuario obtenidos exitosamente',
      timestamp: new Date().toISOString(),
      path: `/api/users/${telegramId}/games`,
    };
  }

  @Post(':telegramId/games')
  @ApiOperation({
    summary: '🎯 Create Game for User',
    description: `
    Creates a new game session for a user. This endpoint handles credit validation, 
    opponent matching, and game initialization.
    
    **Validation Rules:**
    - User must have sufficient credits for wagered amount
    - User must be able to make purchases (if credits are wagered)
    - Game template must exist and be active
    
    **Game Flow:**
    1. Validate user and credits
    2. Create game session
    3. Deduct wagered credits
    4. Return game details for frontend
    `,
  })
  @ApiParam({
    name: 'telegramId',
    description: 'Telegram user ID',
    example: 123456789,
    type: Number,
  })
  @ApiBody({
    type: CreateGameDto,
    description: 'Game creation data',
    examples: {
      'Single Player Game': {
        summary: 'Create single player game',
        value: {
          gameId: 'tap-reaction',
          gameType: 'tap-reaction',
          creditsWagered: 50,
          isRanked: true,
        },
      },
      'Multiplayer Game': {
        summary: 'Create multiplayer game',
        value: {
          gameId: 'tap-reaction',
          opponentTelegramId: 987654321,
          gameType: 'tap-reaction',
          creditsWagered: 100,
          isRanked: true,
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Game created successfully',
    schema: {
      allOf: [
        { $ref: getSchemaPath(ApiResponseDto) },
        {
          properties: {
            data: { $ref: getSchemaPath(GameResponseDto) },
          },
        },
      ],
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Insufficient credits or invalid game data',
  })
  @ApiResponse({
    status: 404,
    description: 'User not found',
  })
  @HttpCode(HttpStatus.CREATED)
  async createGame(
    @Param('telegramId', ParseIntPipe) telegramId: number,
    @Body() createGameData: CreateGameDto,
  ): Promise<ApiResponseDto<GameResponseDto>> {
    const user = await this.usersService.findByTelegramId(telegramId);
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    // Validar que el usuario puede hacer la compra/apuesta si hay créditos involucrados
    if (createGameData.creditsWagered && createGameData.creditsWagered > 0) {
      if (user.credits < createGameData.creditsWagered) {
        throw new BadRequestException('Créditos insuficientes');
      }

      const canPurchase = await this.usersService.canMakePurchase(user._id.toString());
      if (!canPurchase.can) {
        throw new BadRequestException(`No se puede crear el juego: ${canPurchase.reason}`);
      }
    }

    const createGameDto: ServiceCreateGameDto = {
      playerTelegramId: telegramId,
      opponentTelegramId: createGameData.opponentTelegramId,
      gameType: createGameData.gameType as any, // Los enums ahora coinciden
      gameId: createGameData.gameId,
      creditsWagered: createGameData.creditsWagered,
      isRanked: createGameData.isRanked,
    };

    const game = await this.gamesService.createGame(createGameDto);

    // Si hay créditos apostados, descontarlos del usuario
    if (createGameData.creditsWagered && createGameData.creditsWagered > 0) {
      await this.usersService.addCredits(user._id.toString(), -createGameData.creditsWagered);
    }

    const gameResponse = this.transformGameToResponse(game);

    return {
      success: true,
      data: gameResponse,
      message: 'Juego creado exitosamente',
      timestamp: new Date().toISOString(),
      path: `/api/users/${telegramId}/games`,
    };
  }

  @Get(':telegramId/stats')
  @ApiOperation({
    summary: '📊 Get User Statistics',
    description: `
    Retrieves comprehensive statistics for a user including gaming performance, 
    financial data, and activity metrics.
    
    **Statistics Include:**
    - Gaming performance (win rate, games played)
    - Financial data (balance, credits, spending)
    - Account information (status, verification)
    - Activity data (last login, creation date)
    `,
  })
  @ApiParam({
    name: 'telegramId',
    description: 'Telegram user ID',
    example: 123456789,
    type: Number,
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully retrieved user statistics',
    schema: {
      allOf: [
        { $ref: getSchemaPath(ApiResponseDto) },
        {
          properties: {
            data: { $ref: getSchemaPath(UserStatsDto) },
          },
        },
      ],
    },
  })
  @ApiResponse({
    status: 404,
    description: 'User not found',
  })
  async getUserStats(
    @Param('telegramId', ParseIntPipe) telegramId: number,
  ): Promise<ApiResponseDto<UserStatsDto>> {
    const user = await this.usersService.findByTelegramId(telegramId);
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    const userStats = this.transformUserToStats(user);

    return {
      success: true,
      data: userStats,
      message: 'Estadísticas del usuario obtenidas exitosamente',
      timestamp: new Date().toISOString(),
      path: `/api/users/${telegramId}/stats`,
    };
  }
}
