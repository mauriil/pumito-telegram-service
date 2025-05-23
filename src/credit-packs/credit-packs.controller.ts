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
import { 
  ApiTags, 
  ApiOperation, 
  ApiResponse, 
  ApiParam, 
  ApiQuery, 
  ApiBody,
  ApiBearerAuth,
  ApiExtraModels,
  getSchemaPath
} from '@nestjs/swagger';
import { CreditPacksService, CreateCreditPackDto as ServiceCreateDto } from '../db/credit-packs.service';
import { 
  CreateCreditPackDto, 
  UpdateCreditPackDto, 
  CreditPackResponseDto, 
  CreditPackStatsDto,
  GlobalStatsDto,
  ApiResponseDto,
  CreditPackCategory
} from './dto/credit-pack.dto';

@ApiTags('Credit Packs')
@Controller('credit-packs')
@ApiExtraModels(CreditPackResponseDto, CreditPackStatsDto, GlobalStatsDto, ApiResponseDto)
export class CreditPacksController {
  constructor(
    private readonly creditPacksService: CreditPacksService,
  ) {}

  @Get()
  @ApiOperation({
    summary: '🛍️ Get Available Credit Packs',
    description: `
    Retrieves all available credit packs for purchase. This endpoint is optimized for frontend consumption 
    and includes payment links for each pack.
    
    **Use Cases:**
    - Display available packs in the mobile app
    - Show packs on the website store
    - Generate purchase options for users
    
    **Filtering Options:**
    - Filter by category (starter, value, premium, offer)
    - Include/exclude inactive packs
    - Control payment link generation
    `,
  })
  @ApiQuery({
    name: 'includeInactive',
    required: false,
    description: 'Include inactive packs in the response',
    example: false,
    type: Boolean
  })
  @ApiQuery({
    name: 'category',
    required: false,
    description: 'Filter packs by category',
    enum: CreditPackCategory,
    example: 'premium'
  })
  @ApiQuery({
    name: 'includePaymentLinks',
    required: false,
    description: 'Include payment links in the response (default: true)',
    example: true,
    type: Boolean
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully retrieved credit packs',
    schema: {
      allOf: [
        { $ref: getSchemaPath(ApiResponseDto) },
        {
          properties: {
            data: {
              type: 'array',
              items: { $ref: getSchemaPath(CreditPackResponseDto) }
            }
          }
        }
      ]
    }
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid query parameters',
    schema: {
      allOf: [
        { $ref: getSchemaPath(ApiResponseDto) },
        {
          properties: {
            success: { example: false },
            message: { example: 'Invalid category parameter' },
            data: { example: null }
          }
        }
      ]
    }
  })
  async getAvailablePacks(
    @Query('includeInactive') includeInactive?: string,
    @Query('category') category?: string,
    @Query('includePaymentLinks') includePaymentLinks?: string,
  ): Promise<ApiResponseDto<CreditPackResponseDto[]>> {
    const includeInactiveBoolean = includeInactive === 'true';
    const includePaymentLinksBoolean = includePaymentLinks !== 'false'; // por defecto true

    let packs;

    if (category) {
      packs = await this.creditPacksService.findByCategory(category);
    } else if (includeInactiveBoolean) {
      packs = await this.creditPacksService.findAll(true);
    } else {
      packs = await this.creditPacksService.findActivePacks();
    }

    // Transformar al formato que espera el frontend
    const transformedPacks = packs.map(pack => {
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

      // Incluir links de pago si se solicita
      if (includePaymentLinksBoolean) {
        result.paymentLink = `/api/payments/create-payment-link/${pack.packId}`;
        result.paymentMethods = pack.paymentMethods;
      }

      return result;
    });

    return {
      success: true,
      data: transformedPacks,
      message: 'Packs de créditos obtenidos exitosamente',
      timestamp: new Date().toISOString(),
      path: '/api/credit-packs'
    };
  }

  @Get('active')
  @ApiOperation({
    summary: '✅ Get Active Credit Packs Only',
    description: `
    Simplified endpoint that returns only active credit packs with payment links included by default.
    This is the most commonly used endpoint for frontend applications.
    `,
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully retrieved active credit packs',
    schema: {
      allOf: [
        { $ref: getSchemaPath(ApiResponseDto) },
        {
          properties: {
            data: {
              type: 'array',
              items: { $ref: getSchemaPath(CreditPackResponseDto) }
            }
          }
        }
      ]
    }
  })
  async getActivePacks(): Promise<ApiResponseDto<CreditPackResponseDto[]>> {
    const packs = await this.creditPacksService.getPacksForFrontend();

    return {
      success: true,
      data: packs,
      message: 'Packs activos obtenidos exitosamente',
      timestamp: new Date().toISOString(),
      path: '/api/credit-packs/active'
    };
  }

  @Get('popular')
  @ApiOperation({
    summary: '🔥 Get Popular Credit Packs',
    description: `
    Returns credit packs marked as popular. These are typically featured packs with the best value 
    or special promotions that should be highlighted in the UI.
    `,
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully retrieved popular credit packs',
    schema: {
      allOf: [
        { $ref: getSchemaPath(ApiResponseDto) },
        {
          properties: {
            data: {
              type: 'array',
              items: { $ref: getSchemaPath(CreditPackResponseDto) }
            }
          }
        }
      ]
    }
  })
  async getPopularPacks(): Promise<ApiResponseDto<CreditPackResponseDto[]>> {
    const packs = await this.creditPacksService.findPopularPacks();

    const transformedPacks = packs.map(pack => ({
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
      paymentLink: `/api/payments/create-payment-link/${pack.packId}`,
      paymentMethods: pack.paymentMethods,
    }));

    return {
      success: true,
      data: transformedPacks,
      message: 'Packs populares obtenidos exitosamente',
      timestamp: new Date().toISOString(),
      path: '/api/credit-packs/popular'
    };
  }

  @Get('category/:category')
  @ApiOperation({
    summary: '🏷️ Get Credit Packs by Category',
    description: `
    Retrieves credit packs filtered by a specific category. Categories help organize packs 
    based on their target audience and value proposition.
    `,
  })
  @ApiParam({
    name: 'category',
    description: 'Pack category to filter by',
    enum: CreditPackCategory,
    example: 'premium'
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully retrieved credit packs by category',
    schema: {
      allOf: [
        { $ref: getSchemaPath(ApiResponseDto) },
        {
          properties: {
            data: {
              type: 'array',
              items: { $ref: getSchemaPath(CreditPackResponseDto) }
            }
          }
        }
      ]
    }
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid category parameter',
    schema: {
      allOf: [
        { $ref: getSchemaPath(ApiResponseDto) },
        {
          properties: {
            success: { example: false },
            message: { example: 'Invalid category parameter' },
            data: { example: null }
          }
        }
      ]
    }
  })
  async getPacksByCategory(@Param('category') category: string): Promise<ApiResponseDto<CreditPackResponseDto[]>> {
    const packs = await this.creditPacksService.findByCategory(category);

    const transformedPacks = packs.map(pack => ({
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
      paymentLink: `/api/payments/create-payment-link/${pack.packId}`,
      paymentMethods: pack.paymentMethods,
    }));

    return {
      success: true,
      data: transformedPacks,
      message: `Packs de categoría '${category}' obtenidos exitosamente`,
      timestamp: new Date().toISOString(),
      path: `/api/credit-packs/category/${category}`
    };
  }

  @Get(':packId')
  @ApiOperation({
    summary: '🔍 Get Credit Pack Details',
    description: `
    Retrieves detailed information about a specific credit pack, including all metadata, 
    statistics, and configuration details. Useful for detailed views and administrative purposes.
    `,
  })
  @ApiParam({
    name: 'packId',
    description: 'Unique identifier of the credit pack',
    example: 'premium-pack-2024'
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully retrieved credit pack details',
    schema: {
      allOf: [
        { $ref: getSchemaPath(ApiResponseDto) },
        {
          properties: {
            data: { $ref: getSchemaPath(CreditPackResponseDto) }
          }
        }
      ]
    }
  })
  @ApiResponse({
    status: 404,
    description: 'Credit pack not found',
    schema: {
      allOf: [
        { $ref: getSchemaPath(ApiResponseDto) },
        {
          properties: {
            success: { example: false },
            message: { example: 'Pack de créditos no encontrado' },
            data: { example: null }
          }
        }
      ]
    }
  })
  async getPackById(@Param('packId') packId: string): Promise<ApiResponseDto<CreditPackResponseDto>> {
    const pack = await this.creditPacksService.findByPackId(packId);
    
    if (!pack) {
      throw new NotFoundException('Pack de créditos no encontrado');
    }

    return {
      success: true,
      data: {
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
        paymentMethods: pack.paymentMethods,
        paymentLink: `/api/payments/create-payment-link/${pack.packId}`,
      },
      message: 'Detalles del pack obtenidos exitosamente',
      timestamp: new Date().toISOString(),
      path: `/api/credit-packs/${packId}`
    };
  }

  @Post()
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: '➕ Create New Credit Pack',
    description: `
    Creates a new credit pack. This endpoint is restricted to administrators.
    
    **Validation Rules:**
    - Pack ID must be unique
    - Price must be positive
    - At least one feature is required
    - Description must be descriptive (min 10 characters)
    
    **Business Logic:**
    - Automatically activates the pack unless specified otherwise
    - Assigns default currency (USD) if not provided
    - Sets sort order to maintain proper display sequence
    `,
  })
  @ApiBody({
    type: CreateCreditPackDto,
    description: 'Credit pack data to create',
    examples: {
      'Premium Pack': {
        summary: 'Premium Pack Example',
        description: 'Example of creating a premium credit pack',
        value: {
          packId: 'premium-pack-2024',
          title: 'Pack Premium',
          description: 'Ideal para usuarios que buscan el máximo valor en créditos',
          amount: 2500,
          price: 19.99,
          popular: true,
          features: ['Mejor relación precio-valor', 'Créditos bonus', 'Soporte prioritario'],
          currency: 'USD',
          bonusCredits: 500,
          emoji: '💎',
          color: '#9C27B0',
          category: 'premium',
          paymentMethods: ['stripe', 'paypal', 'mercadopago']
        }
      },
      'Starter Pack': {
        summary: 'Starter Pack Example',
        description: 'Example of creating a starter pack',
        value: {
          packId: 'starter-pack-basic',
          title: 'Pack Básico',
          description: 'Perfecto para empezar a jugar y probar la plataforma',
          amount: 500,
          price: 4.99,
          popular: false,
          features: ['Ideal para principiantes', 'Sin comisiones', 'Soporte estándar'],
          currency: 'USD',
          emoji: '🎯',
          color: '#4CAF50',
          category: 'starter'
        }
      }
    }
  })
  @ApiResponse({
    status: 201,
    description: 'Credit pack created successfully',
    schema: {
      allOf: [
        { $ref: getSchemaPath(ApiResponseDto) },
        {
          properties: {
            data: { $ref: getSchemaPath(CreditPackResponseDto) }
          }
        }
      ]
    }
  })
  @ApiResponse({
    status: 400,
    description: 'Pack with this ID already exists',
    schema: {
      allOf: [
        { $ref: getSchemaPath(ApiResponseDto) },
        {
          properties: {
            success: { example: false },
            message: { example: 'Ya existe un pack con ese ID' },
            data: { example: null }
          }
        }
      ]
    }
  })
  @ApiResponse({
    status: 422,
    description: 'Validation errors in request body',
    schema: {
      allOf: [
        { $ref: getSchemaPath(ApiResponseDto) },
        {
          properties: {
            success: { example: false },
            message: { example: 'Validation failed' },
            data: { 
              example: {
                errors: [
                  { field: 'price', message: 'price must be a positive number' },
                  { field: 'packId', message: 'packId must be longer than or equal to 3 characters' }
                ]
              }
            }
          }
        }
      ]
    }
  })
  @HttpCode(HttpStatus.CREATED)
  async createPack(@Body() createPackData: CreateCreditPackDto): Promise<ApiResponseDto<any>> {
    try {
      const pack = await this.creditPacksService.createCreditPack(createPackData as ServiceCreateDto);
      
      return {
        success: true,
        data: pack,
        message: 'Pack de créditos creado exitosamente',
        timestamp: new Date().toISOString(),
        path: '/api/credit-packs'
      };
    } catch (error: any) {
      if (error.code === 11000) {
        throw new BadRequestException('Ya existe un pack con ese ID');
      }
      throw error;
    }
  }

  @Put(':packId')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: '✏️ Update Credit Pack',
    description: `
    Updates an existing credit pack. Only provided fields will be updated, 
    making this a partial update operation.
    
    **Note:** Some fields like statistics (totalPurchases, totalRevenue) cannot be updated 
    through this endpoint as they are calculated automatically.
    `,
  })
  @ApiParam({
    name: 'packId',
    description: 'Unique identifier of the credit pack to update',
    example: 'premium-pack-2024'
  })
  @ApiBody({
    type: UpdateCreditPackDto,
    description: 'Fields to update (partial update)',
    examples: {
      'Update Price': {
        summary: 'Update pack price',
        value: {
          price: 22.99,
          bonusCredits: 600
        }
      },
      'Update Status': {
        summary: 'Deactivate pack',
        value: {
          isActive: false
        }
      }
    }
  })
  @ApiResponse({
    status: 200,
    description: 'Credit pack updated successfully',
    schema: {
      allOf: [
        { $ref: getSchemaPath(ApiResponseDto) },
        {
          properties: {
            data: { $ref: getSchemaPath(CreditPackResponseDto) }
          }
        }
      ]
    }
  })
  @ApiResponse({
    status: 404,
    description: 'Credit pack not found',
    schema: {
      allOf: [
        { $ref: getSchemaPath(ApiResponseDto) },
        {
          properties: {
            success: { example: false },
            message: { example: 'Plantilla de juego no encontrada' },
            data: { example: null }
          }
        }
      ]
    }
  })
  async updatePack(
    @Param('packId') packId: string,
    @Body() updateData: UpdateCreditPackDto
  ): Promise<ApiResponseDto<any>> {
    const pack = await this.creditPacksService.updateCreditPack(packId, updateData as Partial<ServiceCreateDto>);
    
    return {
      success: true,
      data: pack,
      message: 'Pack de créditos actualizado exitosamente',
      timestamp: new Date().toISOString(),
      path: `/api/credit-packs/${packId}`
    };
  }

  @Put(':packId/toggle')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: '🔄 Toggle Pack Active Status',
    description: `
    Toggles the active status of a credit pack. This is a quick way to enable/disable 
    a pack without updating other fields.
    
    **Use Cases:**
    - Temporarily disable a pack during maintenance
    - Enable seasonal packs
    - Quick activation/deactivation for A/B testing
    `,
  })
  @ApiParam({
    name: 'packId',
    description: 'Unique identifier of the credit pack',
    example: 'premium-pack-2024'
  })
  @ApiResponse({
    status: 200,
    description: 'Pack status toggled successfully',
    schema: {
      allOf: [
        { $ref: getSchemaPath(ApiResponseDto) },
        {
          properties: {
            data: { $ref: getSchemaPath(CreditPackResponseDto) },
            message: { example: 'Pack activado exitosamente' }
          }
        }
      ]
    }
  })
  @ApiResponse({
    status: 404,
    description: 'Credit pack not found'
  })
  async togglePackActive(@Param('packId') packId: string): Promise<ApiResponseDto<any>> {
    const pack = await this.creditPacksService.toggleActive(packId);
    
    return {
      success: true,
      data: pack,
      message: `Pack ${pack.isActive ? 'activado' : 'desactivado'} exitosamente`,
      timestamp: new Date().toISOString(),
      path: `/api/credit-packs/${packId}/toggle`
    };
  }

  @Get(':packId/stats')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: '📊 Get Pack Statistics',
    description: `
    Retrieves detailed statistics for a specific credit pack including purchase history, 
    revenue data, and performance metrics.
    
    **Metrics Included:**
    - Total number of purchases
    - Total revenue generated
    - Average revenue per purchase
    - Current status information
    `,
  })
  @ApiParam({
    name: 'packId',
    description: 'Unique identifier of the credit pack',
    example: 'premium-pack-2024'
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully retrieved pack statistics',
    schema: {
      allOf: [
        { $ref: getSchemaPath(ApiResponseDto) },
        {
          properties: {
            data: { $ref: getSchemaPath(CreditPackStatsDto) }
          }
        }
      ]
    }
  })
  @ApiResponse({
    status: 404,
    description: 'Credit pack not found'
  })
  async getPackStats(@Param('packId') packId: string): Promise<ApiResponseDto<CreditPackStatsDto>> {
    const stats = await this.creditPacksService.getPackStats(packId);
    
    return {
      success: true,
      data: stats,
      message: 'Estadísticas del pack obtenidas exitosamente',
      timestamp: new Date().toISOString(),
      path: `/api/credit-packs/${packId}/stats`
    };
  }

  @Get('stats/global')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: '🌍 Get Global Statistics',
    description: `
    Retrieves comprehensive statistics across all credit packs. This endpoint provides 
    high-level insights for business intelligence and reporting.
    
    **Metrics Included:**
    - Total number of packs (active and inactive)
    - Total revenue across all packs
    - Purchase volume statistics
    - Average pricing insights
    `,
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully retrieved global statistics',
    schema: {
      allOf: [
        { $ref: getSchemaPath(ApiResponseDto) },
        {
          properties: {
            data: { $ref: getSchemaPath(GlobalStatsDto) }
          }
        }
      ]
    }
  })
  async getGlobalStats(): Promise<ApiResponseDto<GlobalStatsDto>> {
    const stats = await this.creditPacksService.getGlobalStats();
    
    return {
      success: true,
      data: stats,
      message: 'Estadísticas globales obtenidas exitosamente',
      timestamp: new Date().toISOString(),
      path: '/api/credit-packs/stats/global'
    };
  }

  @Post('seed/initial')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: '🌱 Initialize Default Packs',
    description: `
    Creates the initial set of credit packs if none exist. This is typically used during 
    application setup or when resetting the pack catalog.
    
    **Default Packs Created:**
    - Starter Offer (limited time)
    - Basic Pack
    - Popular Pack (most value)
    - Premium Pack
    - Mega Pack
    
    **Note:** This operation is idempotent - it will not create duplicates if packs already exist.
    `,
    deprecated: false,
  })
  @ApiResponse({
    status: 201,
    description: 'Initial packs created successfully',
    schema: {
      allOf: [
        { $ref: getSchemaPath(ApiResponseDto) },
        {
          properties: {
            data: { example: null },
            message: { example: 'Packs de créditos iniciales creados exitosamente' }
          }
        }
      ]
    }
  })
  @ApiResponse({
    status: 200,
    description: 'Packs already exist, no action taken',
    schema: {
      allOf: [
        { $ref: getSchemaPath(ApiResponseDto) },
        {
          properties: {
            message: { example: 'Los packs de créditos ya están inicializados' }
          }
        }
      ]
    }
  })
  @HttpCode(HttpStatus.CREATED)
  async seedInitialPacks(): Promise<ApiResponseDto<null>> {
    await this.creditPacksService.seedInitialPacks();
    
    return {
      success: true,
      data: null,
      message: 'Packs de créditos iniciales creados exitosamente',
      timestamp: new Date().toISOString(),
      path: '/api/credit-packs/seed/initial'
    };
  }
} 