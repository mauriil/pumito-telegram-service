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
  @ApiOperation({ summary: 'Handle MercadoPago webhook - Merchant Orders' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Webhook processed successfully' })
  async handleWebhook(
    @Req() req: Request,
    @Res() res: Response,
    @Body() body: any,
  ): Promise<Response> {
    try {
      this.logger.log(`Webhook recibido de MercadoPago: ${JSON.stringify(body)}`);

      // Validar que el body tenga la estructura esperada del nuevo webhook
      if (!body || typeof body !== 'object') {
        this.logger.warn('Body del webhook inválido o vacío');
        return res.status(HttpStatus.OK).json({ status: 'Invalid body format' });
      }

      // Extraer información del webhook de merchant order
      const { resource, topic } = body;

      // Solo procesamos webhooks de merchant_order
      if (topic !== 'merchant_order') {
        this.logger.log(`Webhook ignorado - topic: ${topic}`);
        return res
          .status(HttpStatus.OK)
          .json({ status: 'Ignored non-merchant_order topic', topic });
      }

      // Extraer el merchant order ID de la URL del resource
      const merchantOrderIdMatch = resource?.match(/merchant_orders\/(\d+)/);
      if (!merchantOrderIdMatch) {
        this.logger.warn('No se pudo extraer merchant order ID del resource URL');
        return res
          .status(HttpStatus.OK)
          .json({ status: 'Merchant order ID not found in resource' });
      }

      const merchantOrderId = merchantOrderIdMatch[1];
      this.logger.log(`Procesando merchant order ID: ${merchantOrderId}`);

      // Obtener la merchant order directamente
      const merchantOrder = await this.mercadopago.getMerchantOrder(merchantOrderId);
      
      if (!merchantOrder) {
        this.logger.warn(`No se pudo obtener merchant order: ${merchantOrderId}`);
        return res.status(HttpStatus.OK).json({ status: 'Merchant order not found' });
      }

      // Extraer external_reference que es nuestro payment ID
      const externalReference = merchantOrder.external_reference;
      if (!externalReference) {
        this.logger.warn(`External reference no encontrado en merchant order: ${merchantOrderId}`);
        return res.status(HttpStatus.OK).json({ status: 'External reference not found' });
      }

      this.logger.log(`Procesando pago con external reference: ${externalReference}`);
      this.logger.log(`Estado de merchant order: ${merchantOrder.status}, Order status: ${merchantOrder.order_status}, Cancelled: ${merchantOrder.cancelled}`);

      // Verificar si la orden fue cancelada
      if (merchantOrder.cancelled) {
        this.logger.log(`Merchant order cancelada: ${merchantOrderId}`);
        await this.payments.markRejected(
          externalReference,
          'cancelled',
          'Orden cancelada por el usuario o por el sistema'
        );

        // Actualizar mensaje en Telegram
        const payment = await this.payments.getPaymentById(externalReference);
        if (payment && payment.messageId) {
          await this.telegraf.updatePaymentMessage(payment.userId, externalReference, 'rejected');
        }

        return res.status(HttpStatus.OK).json({ status: 'Order cancelled' });
      }

      // Evaluar el estado según las reglas de MercadoPago
      let paymentStatus: 'confirmed' | 'rejected' | 'pending' | 'expired';
      let statusDetail: string;

      switch (merchantOrder.status) {
        case 'closed':
          // Order with payments covering total amount
          if (merchantOrder.order_status === 'paid') {
            paymentStatus = 'confirmed';
            statusDetail = 'Pago completado exitosamente';
          } else {
            // Closed pero no paid, verificar si hay reembolsos
            if (merchantOrder.order_status === 'reverted') {
              paymentStatus = 'rejected';
              statusDetail = 'Pago revertido - todos los pagos fueron reembolsados o contracargados';
            } else {
              paymentStatus = 'pending';
              statusDetail = `Orden cerrada pero estado de pago: ${merchantOrder.order_status}`;
            }
          }
          break;

        case 'expired':
          // Canceled order that does not have approved or pending payments
          paymentStatus = 'expired';
          statusDetail = 'Orden expirada - no tiene pagos aprobados o pendientes';
          break;

        case 'opened':
        default:
          // Order without payments or with pending payments
          if (merchantOrder.order_status === 'payment_required') {
            paymentStatus = 'pending';
            statusDetail = 'Orden abierta - esperando pago';
          } else if (merchantOrder.order_status === 'paid') {
            // Caso especial: opened pero paid (puede pasar durante procesamiento)
            paymentStatus = 'confirmed';
            statusDetail = 'Pago completado exitosamente';
          } else {
            paymentStatus = 'pending';
            statusDetail = `Orden abierta - estado: ${merchantOrder.order_status}`;
          }
          break;
      }

      this.logger.log(`Estado determinado para ${externalReference}: ${paymentStatus} - ${statusDetail}`);

      // Preparar datos de la merchant order para actualizar en BD
      const merchantOrderData = {
        merchantOrder: {
          id: merchantOrder.id,
          status: merchantOrder.status,
          orderStatus: merchantOrder.order_status,
          totalAmount: merchantOrder.total_amount,
          paidAmount: merchantOrder.paid_amount,
          refundedAmount: merchantOrder.refunded_amount,
          siteId: merchantOrder.site_id,
          isTest: merchantOrder.is_test,
          cancelled: merchantOrder.cancelled,
          preferenceId: merchantOrder.preference_id,
          externalReference: merchantOrder.external_reference,
          collectorId: merchantOrder.collector.id,
          collectorEmail: merchantOrder.collector.email,
          payerEmail: merchantOrder.payer?.email || null,
          payerId: merchantOrder.payer?.id || null,
        },
        // Datos del último pago si existe
        ...(merchantOrder.payments && merchantOrder.payments.length > 0 && {
          paymentId: merchantOrder.payments[merchantOrder.payments.length - 1].id,
          transactionAmount: merchantOrder.payments[merchantOrder.payments.length - 1].transaction_amount,
          totalPaidAmount: merchantOrder.payments[merchantOrder.payments.length - 1].total_paid_amount,
          currencyId: merchantOrder.payments[merchantOrder.payments.length - 1].currency_id,
          operationType: merchantOrder.payments[merchantOrder.payments.length - 1].operation_type,
          dateApproved: merchantOrder.payments[merchantOrder.payments.length - 1].date_approved,
          dateCreated: merchantOrder.payments[merchantOrder.payments.length - 1].date_created,
          lastModified: merchantOrder.payments[merchantOrder.payments.length - 1].last_modified,
        }),
      };

      // Siempre actualizar el pago con los datos de la merchant order
      try {
        await this.payments.updatePaymentWithMerchantOrderData(externalReference, merchantOrderData);
        this.logger.log(`Datos de merchant order actualizados para: ${externalReference}`);
      } catch (updateError) {
        this.logger.error(`Error actualizando datos de merchant order: ${updateError.message}`, updateError.stack);
        // Continuar con el procesamiento aunque falle la actualización de datos
      }

      // Procesar según el estado determinado
      try {
        switch (paymentStatus) {
          case 'confirmed':
            await this.payments.markConfirmed(externalReference);
            this.logger.log(`Pago confirmado para external reference: ${externalReference}`);

            // Actualizar mensaje en Telegram
            const confirmedPayment = await this.payments.getPaymentById(externalReference);
            if (confirmedPayment && confirmedPayment.messageId) {
              await this.telegraf.updatePaymentMessage(
                confirmedPayment.userId,
                externalReference,
                'confirmed',
              );
            }
            break;

          case 'rejected':
            await this.payments.markRejected(externalReference, merchantOrder.status, statusDetail);
            this.logger.log(`Pago rechazado para external reference: ${externalReference} - ${statusDetail}`);

            // Actualizar mensaje en Telegram
            const rejectedPayment = await this.payments.getPaymentById(externalReference);
            if (rejectedPayment && rejectedPayment.messageId) {
              await this.telegraf.updatePaymentMessage(rejectedPayment.userId, externalReference, 'rejected');
            }
            break;

          case 'expired':
            await this.payments.markExpired(externalReference, statusDetail);
            this.logger.log(`Pago expirado para external reference: ${externalReference} - ${statusDetail}`);

            // Actualizar mensaje en Telegram
            const expiredPayment = await this.payments.getPaymentById(externalReference);
            if (expiredPayment && expiredPayment.messageId) {
              await this.telegraf.updatePaymentMessage(expiredPayment.userId, externalReference, 'expired');
            }
            break;

          case 'pending':
          default:
            // Para pending, solo logueamos pero no cambiamos el estado si ya está en pending
            this.logger.log(`Pago pendiente para external reference: ${externalReference} - ${statusDetail}`);
            
            // Verificar si necesitamos actualizar el mensaje en Telegram
            const pendingPayment = await this.payments.getPaymentById(externalReference);
            if (pendingPayment && pendingPayment.messageId && pendingPayment.status !== 'pending') {
              await this.telegraf.updatePaymentMessage(pendingPayment.userId, externalReference, 'pending');
            }
            break;
        }
      } catch (statusError) {
        this.logger.error(`Error procesando estado ${paymentStatus} para ${externalReference}: ${statusError.message}`, statusError.stack);

        // Si es un pago confirmado pero falla el procesamiento, manejar especialmente
        if (paymentStatus === 'confirmed') {
          try {
            await this.payments.markFailed(
              externalReference,
              `Pago exitoso pero falló al procesar créditos: ${statusError.message}`,
            );

            // Actualizar mensaje en Telegram
            const failedPayment = await this.payments.getPaymentById(externalReference);
            if (failedPayment && failedPayment.messageId) {
              await this.telegraf.updatePaymentMessage(failedPayment.userId, externalReference, 'failed');
            }

            // Notificar al usuario sobre el problema
            if (failedPayment) {
              await this.telegraf.sendNotification(
                failedPayment.userId,
                `⚠️ <b>Problema con tu pago</b>\n\n` +
                  `Tu pago fue procesado exitosamente en MercadoPago, pero hubo un error al añadir los créditos.\n` +
                  `Por favor contacta soporte con el ID de pago: ${externalReference}\n\n` +
                  `Nuestro equipo resolverá este problema lo antes posible.`,
              );
            }
          } catch (failError) {
            this.logger.error(`Error marcando pago como fallido: ${failError.message}`, failError.stack);
          }
        }
      }

      return res.status(HttpStatus.OK).json({ status: 'OK', processed: externalReference });
    } catch (error) {
      this.logger.error(`Error procesando webhook: ${error.message}`, error.stack);

      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? error.message : undefined,
      });
    }
  }

  @Get('mercadopago')
  @ApiOperation({ summary: 'Handle MercadoPago back URLs - Success, Failure, Pending' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Payment status processed successfully' })
  async handleBackUrl(@Query() query: any, @Res() res: Response): Promise<Response> {
    try {
      this.logger.log(`Back URL recibida de MercadoPago: ${JSON.stringify(query)}`);

      // Extraer parámetros de la query
      const { status, collection_status, preference_id, external_reference } = query;

      // Validar que tenemos los parámetros mínimos necesarios
      if (!external_reference) {
        this.logger.warn('external_reference no encontrado en los parámetros de back URL');
        return this.renderPaymentResult(res, 'error', 'Referencia de pago no encontrada');
      }

      // El external_reference es nuestro payment ID interno
      const paymentId = preference_id;
      this.logger.log(`Procesando back URL para pago ID: ${paymentId}`);

      // Verificar el estado del pago en MercadoPago usando el collection_id o payment_id
      const paymentStatus = {
        approved: status === 'approved' && collection_status === 'approved',
        status: status || 'unknown',
        statusDetail: `Status: ${status}, Collection Status: ${collection_status}`,
      };

      // Procesar el pago según el estado
      if (paymentStatus.approved) {
        try {
          // Intentar confirmar el pago y procesar los créditos
          await this.payments.markConfirmed(paymentId);
          this.logger.log(`Pago confirmado via back URL para la orden: ${paymentId}`);

          // Actualizar mensaje en Telegram
          const payment = await this.payments.getPaymentById(paymentId);
          if (payment && payment.messageId) {
            await this.telegraf.updatePaymentMessage(payment.userId, paymentId, 'confirmed');
          }

          return this.renderPaymentResult(res, 'success', 'Pago confirmado exitosamente');
        } catch (confirmError) {
          this.logger.error(
            `Error confirmando pago exitoso: ${confirmError.message}`,
            confirmError.stack,
          );

          // Marcar como fallido sin intentar reembolso (ya no está disponible)
          await this.payments.markFailed(
            paymentId,
            `Pago exitoso pero falló al procesar créditos: ${confirmError.message}`,
          );

          // Actualizar mensaje en Telegram
          const paymentForUpdate = await this.payments.getPaymentById(paymentId);
          if (paymentForUpdate && paymentForUpdate.messageId) {
            await this.telegraf.updatePaymentMessage(paymentForUpdate.userId, paymentId, 'failed');
          }

          // Notificar al usuario sobre el problema
          const paymentForNotification = await this.payments.getPaymentById(paymentId);
          if (paymentForNotification) {
            await this.telegraf.sendNotification(
              paymentForNotification.userId,
              `⚠️ <b>Problema con tu pago</b>\n\n` +
                `Tu pago fue procesado exitosamente en MercadoPago, pero hubo un error al añadir los créditos.\n` +
                `Por favor contacta soporte con el ID de pago: ${paymentId}\n\n` +
                `Nuestro equipo resolverá este problema lo antes posible.`,
            );
          }

          return this.renderPaymentResult(
            res,
            'error',
            'Pago procesado pero hubo un error. Por favor contacta soporte.',
          );
        }
      } else {
        // Determinar si es un rechazo o está pendiente
        const isRejected = status === 'rejected' || status === 'cancelled' || status === 'failure';
        const isPending = status === 'pending' || status === 'in_process';

        if (isRejected) {
          await this.payments.markRejected(
            paymentId,
            paymentStatus.status,
            paymentStatus.statusDetail,
          );
          this.logger.log(
            `Pago rechazado via back URL para la orden: ${paymentId} - ${paymentStatus.status}: ${paymentStatus.statusDetail}`,
          );

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
          this.logger.log(
            `Estado de pago desconocido via back URL para la orden: ${paymentId} - ${paymentStatus.status}`,
          );
          return this.renderPaymentResult(res, 'pending', 'El pago está siendo verificado');
        }
      }
    } catch (error) {
      this.logger.error(`Error procesando back URL: ${error.message}`, error.stack);

      // Intentar marcar el pago como error si tenemos el ID
      const { preference_id, external_reference } = query;
      const paymentId = preference_id || external_reference;

      if (paymentId) {
        try {
          await this.payments.markError(paymentId, `Error en back URL: ${error.message}`);

          // Actualizar mensaje en Telegram
          const payment = await this.payments.getPaymentById(paymentId);
          if (payment && payment.messageId) {
            await this.telegraf.updatePaymentMessage(payment.userId, paymentId, 'error');
          }
        } catch (markError) {
          this.logger.error(
            `Error marcando pago como error en back URL: ${markError.message}`,
            markError.stack,
          );
        }
      }

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

  private renderPaymentResult(
    res: Response,
    status: 'success' | 'failure' | 'pending' | 'error',
    message: string,
  ): Response {
    const statusConfig = {
      success: {
        title: '✅ Pago Exitoso',
        color: '#28a745',
        icon: '✅',
        description: 'Tu pago ha sido procesado correctamente.',
      },
      failure: {
        title: '❌ Pago Rechazado',
        color: '#dc3545',
        icon: '❌',
        description: 'El pago no pudo ser procesado.',
      },
      pending: {
        title: '⏳ Pago Pendiente',
        color: '#ffc107',
        icon: '⏳',
        description: 'Tu pago está siendo procesado.',
      },
      error: {
        title: '⚠️ Error',
        color: '#fd7e14',
        icon: '⚠️',
        description: 'Ocurrió un error al procesar el pago.',
      },
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
            <h1 class="title">${config.title}</h1>
            <p class="description">${config.description}</p>
            <div class="message">${message}</div>
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
