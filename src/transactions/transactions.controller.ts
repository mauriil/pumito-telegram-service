import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  NotFoundException,
  ParseIntPipe,
  BadRequestException,
} from '@nestjs/common';
import { TransactionsService, TransactionFilters } from '../db/transactions.service';
import { UsersService } from '../db/users.service';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { TransactionType, TransactionItemType } from '../db/schemas/transaction.schema';

@ApiTags('Transactions')
@Controller('transactions')
export class TransactionsController {
  constructor(
    private readonly transactionsService: TransactionsService,
    private readonly usersService: UsersService,
  ) {}

  /**
   * Obtener transacciones de un usuario con formato para frontend
   */
  @Get('user/:userTelegramId')
  @ApiOperation({ summary: 'Obtener historial de transacciones de un usuario' })
  @ApiResponse({ status: 200, description: 'Transacciones obtenidas exitosamente' })
  async getUserTransactions(
    @Param('userTelegramId', ParseIntPipe) userTelegramId: number,
    @Query('type') type?: TransactionType,
    @Query('itemType') itemType?: TransactionItemType,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const user = await this.usersService.findByTelegramId(userTelegramId);
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    const filters: TransactionFilters = {
      userTelegramId,
      type,
      itemType,
      dateFrom: dateFrom ? new Date(dateFrom) : undefined,
      dateTo: dateTo ? new Date(dateTo) : undefined,
      limit: limit ? Math.min(parseInt(limit), 100) : 20, // máximo 100
      offset: offset ? parseInt(offset) : 0,
    };

    const transactions = await this.transactionsService.getUserTransactions(filters);
    const stats = await this.transactionsService.getUserTransactionStats(userTelegramId);

    const hasTransactions = transactions.length > 0;
    const isFirstTime = stats.totalTransactions === 0;

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
        pagination: {
          limit: filters.limit,
          offset: filters.offset,
          hasMore: transactions.length === filters.limit,
          total: stats.totalTransactions,
        },
        meta: {
          hasTransactions,
          isFirstTime,
          isEmpty: !hasTransactions && filters.offset === 0,
          isFiltered: !!(type || itemType || dateFrom || dateTo),
        },
      },
      message: hasTransactions 
        ? 'Transacciones obtenidas exitosamente'
        : isFirstTime 
          ? 'Usuario sin transacciones aún. ¡Comienza jugando o comprando créditos!'
          : 'No se encontraron transacciones con los filtros aplicados',
    };
  }

  /**
   * Obtener estadísticas de transacciones de un usuario
   */
  @Get('stats/:userTelegramId')
  @ApiOperation({ summary: 'Obtener estadísticas de transacciones de un usuario' })
  async getUserTransactionStats(@Param('userTelegramId', ParseIntPipe) userTelegramId: number) {
    const user = await this.usersService.findByTelegramId(userTelegramId);
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    const stats = await this.transactionsService.getUserTransactionStats(userTelegramId);
    const hasActivity = stats.totalTransactions > 0;

    return {
      success: true,
      data: {
        stats,
        user: {
          telegramId: user.telegramId,
          username: user.username,
          firstName: user.firstName,
          currentBalance: user.credits,
        },
        meta: {
          hasActivity,
          isNewUser: !hasActivity,
        },
      },
      message: hasActivity 
        ? 'Estadísticas obtenidas exitosamente'
        : 'Usuario sin actividad aún. Las estadísticas se mostrarán después de la primera transacción.',
    };
  }

  /**
   * Crear transacción de compra/recarga
   */
  @Post('purchase')
  @ApiOperation({ summary: 'Registrar una transacción de compra/recarga' })
  @ApiResponse({ status: 201, description: 'Transacción registrada exitosamente' })
  async createPurchaseTransaction(
    @Body() body: {
      userTelegramId: number;
      amount: number;
      description: string;
      metadata?: any;
    }
  ) {
    const user = await this.usersService.findByTelegramId(body.userTelegramId);
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    try {
      const transaction = await this.transactionsService.createPurchaseTransaction(
        body.userTelegramId,
        body.amount,
        body.description,
        body.metadata
      );

      // Actualizar el balance del usuario
      await this.usersService.addCredits(user._id.toString(), body.amount);

      return {
        success: true,
        data: transaction,
        message: 'Transacción de compra registrada exitosamente',
      };
    } catch (error) {
      throw new BadRequestException('Error al registrar la transacción');
    }
  }

  /**
   * Crear transacción de reembolso
   */
  @Post('refund')
  @ApiOperation({ summary: 'Registrar una transacción de reembolso' })
  @ApiResponse({ status: 201, description: 'Reembolso registrado exitosamente' })
  async createRefundTransaction(
    @Body() body: {
      userTelegramId: number;
      amount: number;
      description: string;
      relatedGameId?: string;
      metadata?: any;
    }
  ) {
    const user = await this.usersService.findByTelegramId(body.userTelegramId);
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    try {
      const transaction = await this.transactionsService.createRefundTransaction(
        body.userTelegramId,
        body.amount,
        body.description,
        body.relatedGameId,
        body.metadata
      );

      // Actualizar el balance del usuario
      await this.usersService.addCredits(user._id.toString(), body.amount);

      return {
        success: true,
        data: transaction,
        message: 'Reembolso registrado exitosamente',
      };
    } catch (error) {
      throw new BadRequestException('Error al registrar el reembolso');
    }
  }
} 