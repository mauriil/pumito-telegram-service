import { Body, Controller, Post, Get, HttpStatus, Logger, BadRequestException, NotFoundException, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsEnum } from 'class-validator';
import { PaymentsService } from '../db/payments.service';
import { CreditPacksService } from '../db/credit-packs.service';
import { UsersService } from '../db/users.service';
import { MercadoPagoDiagnosticsService } from './mercadopago-diagnostics.service';

class CreatePaymentLinkDto {
  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsString()
  @IsNotEmpty()
  packId: string;

  @IsOptional()
  @IsEnum(['mercadopago', 'USDT_TRC20', 'USDT_BEP20', 'BTC'])
  paymentMethod?: string = 'mercadopago';
}

interface PaymentLinkResponse {
  success: boolean;
  data: {
    paymentUrl: string;
    paymentId: string;
    amount: number;
    credits: number;
    packTitle: string;
    paymentMethod: string;
    expiresAt: string;
  };
  message: string;
  timestamp: string;
}

@ApiTags('Payments')
@Controller('payments')
export class PaymentsController {
  private readonly logger = new Logger(PaymentsController.name);

  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly creditPacksService: CreditPacksService,
    private readonly usersService: UsersService,
    private readonly diagnosticsService: MercadoPagoDiagnosticsService,
  ) {}

  @Post('create-payment-link')
  @ApiOperation({ 
    summary: 'Generar link de pago para un usuario y pack específico',
    description: 'Crea un enlace de pago personalizado para que un usuario pueda adquirir un pack de créditos'
  })
  @ApiBody({
    type: CreatePaymentLinkDto,
    description: 'Datos necesarios para generar el link de pago',
    examples: {
      'Ejemplo básico': {
        value: {
          userId: '123456789',
          packId: 'premium-pack-2024',
          paymentMethod: 'mercadopago'
        }
      },
      'Con crypto': {
        value: {
          userId: '123456789',
          packId: 'premium-pack-2024',
          paymentMethod: 'USDT_TRC20'
        }
      }
    }
  })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Link de pago generado exitosamente',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: {
          type: 'object',
          properties: {
            paymentUrl: { type: 'string', example: 'https://mercadopago.com.ar/checkout/v1/redirect?preference-id=...' },
            paymentId: { type: 'string', example: '64f1234567890abcdef12345' },
            amount: { type: 'number', example: 19.99 },
            credits: { type: 'number', example: 2500 },
            packTitle: { type: 'string', example: 'Pack Premium' },
            paymentMethod: { type: 'string', example: 'mercadopago' },
            expiresAt: { type: 'string', example: '2024-01-15T11:00:00.000Z' }
          }
        },
        message: { type: 'string', example: 'Link de pago generado exitosamente' },
        timestamp: { type: 'string', example: '2024-01-15T10:30:00.000Z' }
      }
    }
  })
  @ApiResponse({ 
    status: HttpStatus.BAD_REQUEST, 
    description: 'Datos inválidos o usuario no puede realizar compras' 
  })
  @ApiResponse({ 
    status: HttpStatus.NOT_FOUND, 
    description: 'Pack no encontrado' 
  })
  async createPaymentLink(@Body() createPaymentDto: CreatePaymentLinkDto): Promise<PaymentLinkResponse> {
    try {
      const { userId, packId, paymentMethod = 'mercadopago' } = createPaymentDto;

      this.logger.log(`Generando link de pago para usuario ${userId} y pack ${packId} con método ${paymentMethod}`);

      // 1. Verificar que el usuario existe y puede hacer compras
      const user = await this.usersService.findById(userId);
      if (!user) {
        throw new NotFoundException('Usuario no encontrado');
      }

      const canPurchase = await this.usersService.canMakePurchase(userId);
      if (!canPurchase.can) {
        throw new BadRequestException(`El usuario no puede realizar compras: ${canPurchase.reason}`);
      }

      // 2. Verificar que el pack existe y está activo
      const pack = await this.creditPacksService.findByPackId(packId);
      if (!pack) {
        throw new NotFoundException('Pack no encontrado');
      }

      if (!pack.isActive) {
        throw new BadRequestException('El pack seleccionado no está disponible');
      }

      // 3. Verificar si hay un pago pendiente para este usuario
      const pendingPayment = await this.paymentsService.getPendingPayment(userId);
      if (pendingPayment) {
        // Cancelar el pago pendiente anterior si existe
        await this.paymentsService.cancelPayment(pendingPayment._id.toString());
        this.logger.log(`Pago pendiente anterior cancelado para usuario ${userId}`);
      }

      // 4. Crear el formato de pack que espera el servicio de pagos
      const packForPayment = {
        id: pack.packId,
        name: pack.title,
        price: pack.price,
        credits: pack.amount + (pack.bonusCredits || 0), // Incluir créditos bonus si los hay
        description: pack.description
      };

      // 5. Generar el link de pago
      const paymentUrl = await this.paymentsService.createInvoice(userId, packForPayment, paymentMethod);

      // 6. Obtener el pago creado para devolver información completa
      const createdPayment = await this.paymentsService.getPendingPayment(userId);
      if (!createdPayment) {
        throw new Error('Error al crear el pago en la base de datos');
      }

      this.logger.log(`Link de pago generado exitosamente para usuario ${userId}, pago ID: ${createdPayment._id}`);

      return {
        success: true,
        data: {
          paymentUrl,
          paymentId: createdPayment._id.toString(),
          amount: pack.price,
          credits: packForPayment.credits,
          packTitle: pack.title,
          paymentMethod,
          expiresAt: createdPayment.expiresAt.toISOString()
        },
        message: 'Link de pago generado exitosamente',
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      this.logger.error(`Error generando link de pago: ${error.message}`, error.stack);
      
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }

      throw new BadRequestException(`Error generando link de pago: ${error.message}`);
    }
  }

  @Get('diagnostics')
  @ApiOperation({ 
    summary: 'Ejecutar diagnóstico de MercadoPago',
    description: 'Verifica la configuración de MercadoPago y detecta posibles problemas que causan errores como PXB01'
  })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Diagnóstico completado',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        errors: { type: 'array', items: { type: 'string' } },
        warnings: { type: 'array', items: { type: 'string' } },
        configuration: { type: 'object' },
        timestamp: { type: 'string' }
      }
    }
  })
  async runDiagnostics() {
    try {
      this.logger.log('Ejecutando diagnóstico de MercadoPago...');
      
      const result = await this.diagnosticsService.runDiagnostics();
      
      return {
        ...result,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      this.logger.error(`Error en diagnóstico: ${error.message}`, error.stack);
      throw new BadRequestException(`Error ejecutando diagnóstico: ${error.message}`);
    }
  }

  @Get('failed/:userId')
  @ApiOperation({ 
    summary: 'Obtener pagos fallidos de un usuario',
    description: 'Retorna los pagos que han fallado, expirado o fueron rechazados para un usuario específico'
  })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Lista de pagos fallidos',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          userId: { type: 'string' },
          packId: { type: 'string' },
          amount: { type: 'number' },
          credits: { type: 'number' },
          status: { type: 'string' },
          statusDetail: { type: 'string' },
          createdAt: { type: 'string' },
          errorMessage: { type: 'string' }
        }
      }
    }
  })
  async getFailedPayments(@Param('userId') userId: string) {
    try {
      if (!userId || userId.trim() === '') {
        throw new BadRequestException('El ID del usuario es requerido');
      }

      this.logger.log(`Obteniendo pagos fallidos para usuario: ${userId}`);
      
      const failedPayments = await this.paymentsService.getFailedPayments(userId);
      
      return {
        success: true,
        count: failedPayments.length,
        payments: failedPayments
      };
      
    } catch (error) {
      this.logger.error(`Error obteniendo pagos fallidos: ${error.message}`, error.stack);
      throw new BadRequestException(`Error obteniendo pagos fallidos: ${error.message}`);
    }
  }

  @Post('retry/:paymentId')
  @ApiOperation({ 
    summary: 'Reintentar un pago fallido',
    description: 'Crea un nuevo enlace de pago para un pago que falló, expiró o fue rechazado'
  })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Nuevo enlace de pago creado',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        paymentUrl: { type: 'string' },
        message: { type: 'string' }
      }
    }
  })
  async retryPayment(@Param('paymentId') paymentId: string) {
    try {
      if (!paymentId || paymentId.trim() === '') {
        throw new BadRequestException('El ID del pago es requerido');
      }

      this.logger.log(`Reintentando pago: ${paymentId}`);
      
      const newPaymentUrl = await this.paymentsService.retryFailedPayment(paymentId);
      
      return {
        success: true,
        paymentUrl: newPaymentUrl,
        message: 'Nuevo enlace de pago creado exitosamente'
      };
      
    } catch (error) {
      this.logger.error(`Error reintentando pago: ${error.message}`, error.stack);
      
      if (error.message.includes('no encontrado')) {
        throw new NotFoundException(error.message);
      }
      
      throw new BadRequestException(`Error reintentando pago: ${error.message}`);
    }
  }

  @Get('refund-status/:paymentId')
  @ApiOperation({ 
    summary: 'Consultar estado de devolución de un pago',
    description: 'Obtiene información sobre el estado de la devolución de un pago específico'
  })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Estado de devolución obtenido',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        refundInfo: {
          type: 'object',
          properties: {
            hasRefund: { type: 'boolean' },
            refundRequested: { type: 'boolean' },
            refundProcessed: { type: 'boolean' },
            refundFailed: { type: 'boolean' },
            refundId: { type: 'string' },
            refundStatus: { type: 'string' },
            refundFailedReason: { type: 'string' }
          }
        }
      }
    }
  })
  async getRefundStatus(@Param('paymentId') paymentId: string) {
    try {
      if (!paymentId || paymentId.trim() === '') {
        throw new BadRequestException('El ID del pago es requerido');
      }

      this.logger.log(`Consultando estado de devolución para pago: ${paymentId}`);
      
      const refundInfo = await this.paymentsService.getRefundStatus(paymentId);
      
      return {
        success: true,
        refundInfo
      };
      
    } catch (error) {
      this.logger.error(`Error consultando estado de devolución: ${error.message}`, error.stack);
      throw new BadRequestException(`Error consultando estado de devolución: ${error.message}`);
    }
  }

  @Get('pending-refunds')
  @ApiOperation({ 
    summary: 'Obtener pagos con devoluciones pendientes',
    description: 'Lista todos los pagos que tienen devoluciones solicitadas pero no procesadas'
  })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Lista de pagos con devoluciones pendientes'
  })
  async getPendingRefunds() {
    try {
      this.logger.log('Obteniendo pagos con devoluciones pendientes...');
      
      const pendingRefunds = await this.paymentsService.getPaymentsWithPendingRefunds();
      
      return {
        success: true,
        count: pendingRefunds.length,
        payments: pendingRefunds
      };
      
    } catch (error) {
      this.logger.error(`Error obteniendo devoluciones pendientes: ${error.message}`, error.stack);
      throw new BadRequestException(`Error obteniendo devoluciones pendientes: ${error.message}`);
    }
  }
} 