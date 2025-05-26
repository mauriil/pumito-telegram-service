import { Body, Controller, Post, Req, Res, HttpStatus, Logger, Get, Query } from '@nestjs/common';
import { MercadoPagoService } from './mercadopago.service';
import { PaymentsService } from '../db/payments.service';
import { Response, Request } from 'express';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { TelegrafService } from 'src/telegram/telegraf.service';

@ApiTags('Payments')
@Controller('webhook')
export class MercadoPagoController {
  private readonly logger = new Logger(MercadoPagoController.name);

  constructor(
    private readonly mercadopago: MercadoPagoService,
    private readonly payments: PaymentsService,
    private readonly telegraf: TelegrafService,
  ) {}

  @Post('mercadopago')
  @ApiOperation({ summary: 'Handle MercadoPago webhook - Acepta cualquier formato de body' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Webhook processed successfully' })
  async handleWebhook(
    @Req() req: Request,
    @Res() res: Response,
    @Body() body: any, // Acepta cualquier tipo de body
  ): Promise<Response> {
    try {
      this.logger.log(`Webhook recibido de MercadoPago: ${JSON.stringify(body)}`);

      // Validar que el body tenga la estructura mínima esperada
      if (!body || typeof body !== 'object') {
        this.logger.warn('Body del webhook inválido o vacío');
        return res.status(HttpStatus.OK).json({ status: 'Invalid body format' });
      }

      // Extraer type y action de manera segura
      const type = body.type || body.eventType || null;
      const action = body.action || body.event || null;
      const data = body.data || body.payload || body;

      // Solo procesamos eventos de pago
      if (type !== 'payment') {
        this.logger.log(`Evento ignorado - tipo: ${type}`);
        return res.status(HttpStatus.OK).json({ status: 'Ignored non-payment event', type });
      }

      // Procesamos eventos de actualización y aprobación
      if (action === 'payment.updated' || action === 'payment.approved' || action === 'updated' || action === 'approved') {
        // Extraer payment ID de manera flexible
        const paymentId = data.id || data.paymentId || data.payment_id;
        
        if (!paymentId) {
          this.logger.warn('No se pudo extraer payment ID del webhook');
          return res.status(HttpStatus.OK).json({ status: 'Payment ID not found' });
        }

        this.logger.log(`Procesando pago ID: ${paymentId}`);

        const paymentStatus = await this.mercadopago.verifyPayment(paymentId);

        if (paymentStatus.approved) {
          await this.payments.markConfirmed(paymentId);
          this.logger.log(`Pago confirmado para la orden: ${paymentId}`);

          // Actualizar mensaje en Telegram
          const payment = await this.payments.getPaymentById(paymentId);
          if (payment && payment.messageId) {
            await this.telegraf.updatePaymentMessage(payment.userId, paymentId, 'confirmed');
          }
        } else {
          // Si el pago no está aprobado, lo marcamos como rechazado con el detalle
          await this.payments.markRejected(
            paymentId,
            paymentStatus.status,
            paymentStatus.statusDetail
          );
          this.logger.log(`Pago rechazado para la orden: ${paymentId} - ${paymentStatus.status}: ${paymentStatus.statusDetail}`);

          // Actualizar mensaje en Telegram
          const payment = await this.payments.getPaymentById(paymentId);
          if (payment && payment.messageId) {
            await this.telegraf.updatePaymentMessage(payment.userId, paymentId, 'rejected');
          }
        }
      } else {
        this.logger.log(`Acción ignorada - action: ${action}`);
        return res.status(HttpStatus.OK).json({ status: 'Ignored action', action });
      }

      return res.status(HttpStatus.OK).json({ status: 'OK' });
    } catch (error) {
      this.logger.error(`Error procesando webhook: ${error.message}`, error.stack);
      
      // Si hay un error, intentamos marcar el pago como error
      const data = body?.data || body?.payload || body;
      const paymentId = data?.id || data?.paymentId || data?.payment_id;
      
      if (paymentId) {
        try {
          await this.payments.markError(paymentId, error.message);
          
          // Actualizar mensaje en Telegram
          const payment = await this.payments.getPaymentById(paymentId);
          if (payment && payment.messageId) {
            await this.telegraf.updatePaymentMessage(payment.userId, paymentId, 'error');
          }
        } catch (markError) {
          this.logger.error(`Error marcando pago como error: ${markError.message}`, markError.stack);
        }
      }

      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ 
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  @Get('mercadopago')
  @ApiOperation({ summary: 'Handle MercadoPago back URLs - Success, Failure, Pending' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Payment status processed successfully' })
  async handleBackUrl(
    @Query() query: any,
    @Res() res: Response,
  ): Promise<Response> {
    try {
      this.logger.log(`Back URL recibida de MercadoPago: ${JSON.stringify(query)}`);

      // Extraer parámetros de la query
      const {
        status,
        collection_status,
        preference_id,
        external_reference,
        collection_id,
        payment_id,
        payment_type,
        merchant_order_id
      } = query;

      // Validar que tenemos los parámetros mínimos necesarios
      if (!external_reference) {
        this.logger.warn('external_reference no encontrado en los parámetros de back URL');
        return this.renderPaymentResult(res, 'error', 'Referencia de pago no encontrada');
      }

      // El external_reference es nuestro payment ID interno
      const paymentId = external_reference;
      this.logger.log(`Procesando back URL para pago ID: ${paymentId}`);

      // Verificar el estado del pago en MercadoPago usando el collection_id o payment_id
      const paymentStatus = {
        approved: status === 'approved' && collection_status === 'approved',
        status: status || 'unknown',
        statusDetail: `Status: ${status}, Collection Status: ${collection_status}`
      };

      // Procesar el pago según el estado
      if (paymentStatus.approved) {
        await this.payments.markConfirmed(paymentId);
        this.logger.log(`Pago confirmado via back URL para la orden: ${paymentId}`);

        // Actualizar mensaje en Telegram
        const payment = await this.payments.getPaymentById(paymentId);
        if (payment && payment.messageId) {
          await this.telegraf.updatePaymentMessage(payment.userId, paymentId, 'confirmed');
        }

        return this.renderPaymentResult(res, 'success', 'Pago confirmado exitosamente');
      } else {
        // Determinar si es un rechazo o está pendiente
        const isRejected = status === 'rejected' || status === 'cancelled' || status === 'failure';
        const isPending = status === 'pending' || status === 'in_process';

        if (isRejected) {
          await this.payments.markRejected(
            paymentId,
            paymentStatus.status,
            paymentStatus.statusDetail
          );
          this.logger.log(`Pago rechazado via back URL para la orden: ${paymentId} - ${paymentStatus.status}: ${paymentStatus.statusDetail}`);

          // Actualizar mensaje en Telegram
          const payment = await this.payments.getPaymentById(paymentId);
          if (payment && payment.messageId) {
            await this.telegraf.updatePaymentMessage(payment.userId, paymentId, 'rejected');
          }

          return this.renderPaymentResult(res, 'failure', 'El pago fue rechazado o cancelado');
        } else if (isPending) {
          this.logger.log(`Pago pendiente via back URL para la orden: ${paymentId}`);
          return this.renderPaymentResult(res, 'pending', 'El pago está siendo procesado');
        } else {
          this.logger.log(`Estado de pago desconocido via back URL para la orden: ${paymentId} - ${paymentStatus.status}`);
          return this.renderPaymentResult(res, 'pending', 'El pago está siendo verificado');
        }
      }
    } catch (error) {
      this.logger.error(`Error procesando back URL: ${error.message}`, error.stack);
      return this.renderPaymentResult(res, 'error', 'Error al procesar el pago');
    }
  }

  @Get('mercadopago/success')
  @ApiOperation({ summary: 'Handle MercadoPago success back URL' })
  async handleSuccessUrl(@Query() query: any, @Res() res: Response): Promise<Response> {
    this.logger.log(`Success URL recibida: ${JSON.stringify(query)}`);
    return this.handleBackUrl(query, res);
  }

  @Get('mercadopago/failure')
  @ApiOperation({ summary: 'Handle MercadoPago failure back URL' })
  async handleFailureUrl(@Query() query: any, @Res() res: Response): Promise<Response> {
    this.logger.log(`Failure URL recibida: ${JSON.stringify(query)}`);
    return this.handleBackUrl(query, res);
  }

  @Get('mercadopago/pending')
  @ApiOperation({ summary: 'Handle MercadoPago pending back URL' })
  async handlePendingUrl(@Query() query: any, @Res() res: Response): Promise<Response> {
    this.logger.log(`Pending URL recibida: ${JSON.stringify(query)}`);
    return this.handleBackUrl(query, res);
  }

  private renderPaymentResult(res: Response, status: 'success' | 'failure' | 'pending' | 'error', message: string): Response {
    const statusConfig = {
      success: {
        title: '✅ Pago Exitoso',
        color: '#28a745',
        icon: '✅',
        description: 'Tu pago ha sido procesado correctamente.'
      },
      failure: {
        title: '❌ Pago Rechazado',
        color: '#dc3545',
        icon: '❌',
        description: 'El pago no pudo ser procesado.'
      },
      pending: {
        title: '⏳ Pago Pendiente',
        color: '#ffc107',
        icon: '⏳',
        description: 'Tu pago está siendo procesado.'
      },
      error: {
        title: '⚠️ Error',
        color: '#fd7e14',
        icon: '⚠️',
        description: 'Ocurrió un error al procesar el pago.'
      }
    };

    const config = statusConfig[status];
    
    const html = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${config.title}</title>
        <style>
            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }
            body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                min-height: 100vh;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 20px;
            }
            .container {
                background: white;
                border-radius: 20px;
                padding: 40px;
                text-align: center;
                box-shadow: 0 20px 40px rgba(0,0,0,0.1);
                max-width: 500px;
                width: 100%;
            }
            .icon {
                font-size: 4rem;
                margin-bottom: 20px;
                display: block;
            }
            .title {
                color: ${config.color};
                font-size: 2rem;
                font-weight: bold;
                margin-bottom: 15px;
            }
            .description {
                color: #666;
                font-size: 1.1rem;
                margin-bottom: 10px;
                line-height: 1.5;
            }
            .message {
                color: #333;
                font-size: 1rem;
                margin-bottom: 30px;
                padding: 15px;
                background: #f8f9fa;
                border-radius: 10px;
                border-left: 4px solid ${config.color};
            }
            .button {
                display: inline-block;
                background: ${config.color};
                color: white;
                padding: 12px 30px;
                border-radius: 25px;
                text-decoration: none;
                font-weight: bold;
                transition: all 0.3s ease;
                border: none;
                cursor: pointer;
                font-size: 1rem;
            }
            .button:hover {
                transform: translateY(-2px);
                box-shadow: 0 5px 15px rgba(0,0,0,0.2);
            }
            .footer {
                margin-top: 30px;
                color: #999;
                font-size: 0.9rem;
            }
            @media (max-width: 480px) {
                .container {
                    padding: 30px 20px;
                }
                .title {
                    font-size: 1.5rem;
                }
                .icon {
                    font-size: 3rem;
                }
            }
        </style>
    </head>
    <body>
        <div class="container">
            <span class="icon">${config.icon}</span>
            <h1 class="title">${config.title}</h1>
            <p class="description">${config.description}</p>
            <div class="message">${message}</div>
            <button class="button" onclick="window.close()">Cerrar</button>
            <div class="footer">
                <p>Puedes cerrar esta ventana y regresar al bot de Telegram.</p>
            </div>
        </div>
        <script>
            // Auto-cerrar después de 5 segundos si es exitoso
            ${status === 'success' ? 'setTimeout(() => window.close(), 5000);' : ''}
        </script>
    </body>
    </html>
    `;

    return res.status(HttpStatus.OK).send(html);
  }
} 