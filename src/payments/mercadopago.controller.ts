import { Body, Controller, Post, Req, Res, HttpStatus, Logger } from '@nestjs/common';
import { MercadoPagoService } from './mercadopago.service';
import { PaymentsService } from '../db/payments.service';
import { Response, Request } from 'express';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsObject } from 'class-validator';
import { TelegrafService } from 'src/telegram/telegraf.service';

class MercadoPagoWebhookDto {
  @IsString()
  @IsNotEmpty()
  action: string;

  @IsObject()
  @IsNotEmpty()
  data: {
    id: string;
  };

  @IsString()
  @IsNotEmpty()
  type: string;
}

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
  @ApiOperation({ summary: 'Handle MercadoPago webhook' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Webhook processed successfully' })
  async handleWebhook(
    @Req() req: Request,
    @Res() res: Response,
    @Body() body: MercadoPagoWebhookDto,
  ): Promise<Response> {
    try {
      // Solo procesamos eventos de pago
      if (body.type !== 'payment') {
        return res.status(HttpStatus.OK).json({ status: 'Ignored non-payment event' });
      }

      // Procesamos eventos de actualización y aprobación
      if (body.action === 'payment.updated' || body.action === 'payment.approved') {
        const paymentId = body.data.id;
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
      }

      return res.status(HttpStatus.OK).json({ status: 'OK' });
    } catch (error) {
      this.logger.error(`Error procesando webhook: ${error.message}`, error.stack);
      
      // Si hay un error, intentamos marcar el pago como error
      if (body?.data?.id) {
        try {
          await this.payments.markError(body.data.id, error.message);
          
          // Actualizar mensaje en Telegram
          const payment = await this.payments.getPaymentById(body.data.id);
          if (payment && payment.messageId) {
            await this.telegraf.updatePaymentMessage(payment.userId, body.data.id, 'error');
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