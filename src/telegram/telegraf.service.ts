import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { InjectBot } from 'nestjs-telegraf';
import { Telegraf } from 'telegraf';
import { PurchaseFlow } from './handlers/purchase.flow';
import { UsersService } from '../db/users.service';
import { PaymentsService } from '../db/payments.service';
import { CreditPacksService } from '../db/credit-packs.service';

@Injectable()
export class TelegrafService {
  private readonly logger = new Logger(TelegrafService.name);

  constructor(
    @InjectBot() private readonly bot: Telegraf,
    @Inject(forwardRef(() => PurchaseFlow))
    private readonly purchaseFlow: PurchaseFlow,
    private readonly users: UsersService,
    @Inject(forwardRef(() => PaymentsService))
    private readonly payments: PaymentsService,
    @Inject(forwardRef(() => CreditPacksService))
    private readonly creditPacksService: CreditPacksService,
  ) {}

  async updatePaymentMessage(userId: string, paymentId: string, status: string): Promise<void> {
    try {
      // Obtener el pago para conseguir el messageId
      const payment = await this.payments.getPaymentById(paymentId);
      if (!payment || !payment.messageId) {
        this.logger.warn(`Pago no encontrado o sin messageId para actualizar: ${paymentId}`);
        return;
      }

      // Obtener el usuario para conseguir el telegramId
      const user = await this.users.findById(userId);
      if (!user || !user.telegramId) {
        this.logger.warn(`Usuario no encontrado o sin telegramId: ${userId}`);
        return;
      }

      // Obtener información del pack
      const pack = await this.creditPacksService.findByPackId(payment.packId);
      if (!pack) {
        this.logger.warn(`Pack no encontrado para el pago: ${paymentId}`);
        return;
      }

      let message = '';
      let keyboard = null;

      switch (status) {
        case 'confirmed':
          message =
            `<b>¡Pago Confirmado!</b>\n\n` +
            `🛍️ Pack: ${pack.title}\n` +
            `💰 Precio: $${pack.price} ${pack.currency}\n` +
            `🎫 Créditos añadidos: ${pack.amount + (pack.bonusCredits || 0)}\n\n` +
            `¡Gracias por tu compra!`;
          break;

        case 'expired':
          message =
            `⏱️ <b>Pago Expirado</b>\n\n` +
            `🛍️ Pack: ${pack.title}\n` +
            `💰 Precio: $${pack.price} ${pack.currency}\n` +
            `🎫 Créditos: ${pack.amount + (pack.bonusCredits || 0)}\n\n` +
            `El tiempo para realizar el pago ha expirado.\n` +
            `Puedes generar un nuevo enlace de pago usando el comando /buy`;
          keyboard = {
            inline_keyboard: [
              [{ text: '🛍️ Realizar nueva compra', callback_data: 'new_purchase' }],
            ],
          };
          break;

        case 'cancelled':
          message =
            `<b>Pago Cancelado</b>\n\n` +
            `🛍️ Pack: ${pack.title}\n` +
            `💰 Precio: $${pack.price} ${pack.currency}\n` +
            `🎫 Créditos: ${pack.amount + (pack.bonusCredits || 0)}\n\n` +
            `Has cancelado el pago.\n` +
            `Puedes generar un nuevo enlace de pago usando el comando /buy`;
          keyboard = {
            inline_keyboard: [
              [{ text: '🛍️ Realizar nueva compra', callback_data: 'new_purchase' }],
            ],
          };
          break;

        case 'rejected':
        case 'error':
          message =
            `⚠️ <b>Error en el Pago</b>\n\n` +
            `🛍️ Pack: ${pack.title}\n` +
            `💰 Precio: $${pack.price} ${pack.currency}\n` +
            `🎫 Créditos: ${pack.amount + (pack.bonusCredits || 0)}\n\n` +
            `Hubo un problema al procesar tu pago.\n` +
            `Puedes intentar nuevamente usando el comando /buy o /failed_payments`;
          keyboard = {
            inline_keyboard: [
              [{ text: '🔄 Reintentar pago', callback_data: `retry_payment_${paymentId}` }],
              [{ text: '🛍️ Nueva compra', callback_data: 'new_purchase' }],
              [{ text: '📋 Ver pagos fallidos', callback_data: 'view_failed_payments' }],
            ],
          };
          break;

        case 'failed':
          message =
            `❌ <b>Pago Fallido</b>\n\n` +
            `🛍️ Pack: ${pack.title}\n` +
            `💰 Precio: $${pack.price} ${pack.currency}\n` +
            `🎫 Créditos: ${pack.amount + (pack.bonusCredits || 0)}\n\n` +
            `El pago ha fallado definitivamente.\n` +
            `Si el pago fue procesado en MercadoPago, contacta soporte.\n\n` +
            `Puedes reintentar con un nuevo pago usando /failed_payments`;
          keyboard = {
            inline_keyboard: [
              [{ text: '🔄 Reintentar pago', callback_data: `retry_payment_${paymentId}` }],
              [{ text: '🛍️ Nueva compra', callback_data: 'new_purchase' }],
              [{ text: '📋 Ver pagos fallidos', callback_data: 'view_failed_payments' }],
            ],
          };
          break;
      }

      if (message) {
        await this.bot.telegram.editMessageText(
          user.telegramId,
          payment.messageId,
          undefined,
          message,
          {
            parse_mode: 'HTML',
            reply_markup: keyboard,
          },
        );
      }
    } catch (error) {
      this.logger.error(`Error actualizando mensaje de pago: ${error.message}`, error.stack);
    }
  }

  async sendNotification(userId: string, message: string): Promise<void> {
    try {
      const user = await this.users.findById(userId);
      if (!user || !user.telegramId) {
        this.logger.warn(`Usuario no encontrado o sin telegramId: ${userId}`);
        return;
      }

      await this.bot.telegram.sendMessage(user.telegramId, message, {
        parse_mode: 'HTML',
      });
    } catch (error) {
      this.logger.error(`Error enviando notificación: ${error.message}`, error.stack);
    }
  }
}
