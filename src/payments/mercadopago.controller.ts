import { Body, Controller, Post, Req, Res, HttpStatus, Logger } from '@nestjs/common';
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
} 