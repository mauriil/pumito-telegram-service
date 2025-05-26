import { Ctx, Command, Update, Action } from 'nestjs-telegraf';
import { Context, Markup } from 'telegraf';
import { Injectable, Logger } from '@nestjs/common';
import { UsersService } from '../../db/users.service';
import { PurchaseFlow } from './purchase.flow';
import { PaymentsService } from '../../db/payments.service';
import { CreditPacksService } from '../../db/credit-packs.service';

@Injectable()
@Update()
export class CommandsHandler {
  private readonly logger = new Logger(CommandsHandler.name);

  constructor(
    private readonly users: UsersService,
    private readonly purchaseFlow: PurchaseFlow,
    private readonly payments: PaymentsService,
    private readonly creditPacksService: CreditPacksService,
  ) {}

  @Command('start')
  async onStart(@Ctx() ctx: Context) {
    try {
      // Buscar si el usuario ya existe
      const existingUser = await this.users.findByTelegramId(ctx.from.id);
      const user = await this.users.upsertFromContext(ctx);
      const userName = ctx.from?.first_name || 'Usuario';

      if (!existingUser) {
        await ctx.reply(
          `¡Hola ${userName}! 👋\n\n` +
            '🎮 Puedes acceder a la aplicación haciendo clic en el botón "Jugar" en el menú.\n\n' +
            '📱 En la aplicación podrás:\n' +
            '• Ver tu perfil y estadísticas\n' +
            '• Gestionar tus tokens\n' +
            '• Y mucho más...\n\n' +
            '💎 Para comprar tokens, puedes usar el comando /buy o hacerlo directamente desde la aplicación.',
          {
            reply_markup: {
              inline_keyboard: [
                [{ text: '🎮 Jugar', web_app: { url: 'https://pumito-mini-app.onrender.com' } }],
              ],
            },
          },
        );
      } else {
        await ctx.reply(
          `¡Hola de nuevo ${userName}! 👋\n\n` +
            '📊 <b>Tus Estadísticas</b>\n' +
            `💰 Balance: ${user.balance} USDT\n` +
            `🎫 Créditos: ${user.credits}\n` +
            `🛍️ Compras totales: ${user.totalPurchases}\n\n` +
            '🤖 <b>Comandos disponibles:</b>\n' +
            '• /buy - Comprar fichas\n' +
            '• /failed_payments - Ver pagos fallidos\n' +
            '¿Qué te gustaría hacer?',
          {
            parse_mode: 'HTML',
            reply_markup: {
              inline_keyboard: [
                [{ text: '🎮 Jugar', web_app: { url: 'https://pumito-mini-app.onrender.com' } }],
                [{ text: '🪙 Comprar Fichas', callback_data: 'buy_tokens' }],
                [{ text: '📋 Pagos Fallidos', callback_data: 'view_failed_payments' }],
              ],
            },
          },
        );
      }
    } catch (error) {
      this.logger.error(`Error en comando start: ${error.message}`, error.stack);
      await ctx.reply(
        '❌ Lo siento, hubo un error al procesar tu solicitud. Por favor, intenta nuevamente.',
      );
    }
  }

  @Action('buy_tokens')
  async onBuyTokens(@Ctx() ctx: Context): Promise<void> {
    try {
      await ctx.answerCbQuery('🛍️ Abriendo menú de compras...');
      await this.purchaseFlow.buy(ctx);
    } catch (error) {
      this.logger.error(`Error en callback buy_tokens: ${error.message}`, error.stack);
      await ctx.reply('❌ Error al abrir el menú de compras. Por favor, intenta usar /buy');
      await ctx.answerCbQuery('Error al abrir menú');
    }
  }

  @Command('failed_payments')
  async onFailedPayments(@Ctx() ctx: Context) {
    try {
      const user = await this.users.upsertFromContext(ctx);
      if (!user) {
        await ctx.reply('❌ Error al obtener información del usuario.');
        return;
      }

      const failedPayments = await this.payments.getFailedPayments(user.id);

      if (failedPayments.length === 0) {
        await ctx.reply(
          '✅ <b>No tienes pagos fallidos</b>\n\n' +
            'Todos tus pagos han sido procesados correctamente.\n\n' +
            '💡 Puedes realizar una nueva compra con /buy',
          { parse_mode: 'HTML' },
        );
        return;
      }

      let message = '❌ <b>Pagos Fallidos</b>\n\n';
      const keyboard = [];

      for (const payment of failedPayments) {
        const pack = await this.creditPacksService.findByPackId(payment.packId);
        if (!pack) continue;

        const statusEmoji =
          {
            error: '⚠️',
            failed: '❌',
            expired: '⏱️',
            rejected: '🚫',
          }[payment.status] || '❓';

        const timeAgo = this.getTimeAgo(payment.createdAt);

        message += `${statusEmoji} <b>${pack.title}</b>\n`;
        message += `💰 Precio: $${pack.price} ${pack.currency}\n`;
        message += `🎫 Créditos: ${pack.amount + (pack.bonusCredits || 0)}\n`;
        message += `📅 ${timeAgo}\n`;
        message += `📝 ${payment.statusDetail}\n\n`;

        // Solo agregar botón de reintentar si el pago puede ser reintentado
        if (['error', 'failed', 'expired'].includes(payment.status)) {
          keyboard.push([
            Markup.button.callback(`🔄 Reintentar ${pack.title}`, `retry_payment_${payment._id}`),
          ]);
        }
      }

      message += '💡 Puedes reintentar los pagos fallidos o realizar una nueva compra con /buy';

      keyboard.push([Markup.button.callback('🛍️ Nueva compra', 'new_purchase')]);

      await ctx.reply(message, {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard(keyboard),
      });
    } catch (error) {
      this.logger.error(`Error en comando failed_payments: ${error.message}`, error.stack);
      await ctx.reply('❌ Error al obtener los pagos fallidos. Por favor, intenta nuevamente.');
    }
  }

  @Action(/retry_payment_(.+)/)
  async onRetryPayment(@Ctx() ctx: Context & { match: RegExpExecArray }): Promise<void> {
    try {
      const paymentId = ctx.match[1];

      await ctx.answerCbQuery('🔄 Reintentando pago...');

      const newPaymentUrl = await this.payments.retryFailedPayment(paymentId);

      // Obtener información del pago original
      const originalPayment = await this.payments.getPaymentById(paymentId);
      if (!originalPayment) {
        await ctx.reply('❌ No se pudo encontrar el pago original.');
        return;
      }

      const pack = await this.creditPacksService.findByPackId(originalPayment.packId);
      if (!pack) {
        await ctx.reply('❌ No se pudo encontrar información del pack.');
        return;
      }

      const bonusText = pack.bonusCredits > 0 ? ` (+${pack.bonusCredits} bonus)` : '';

      const message =
        `🔄 <b>Pago Reintentado</b>\n\n` +
        `🛍️ Pack: ${pack.title}\n` +
        `💰 Precio: $${pack.price} ${pack.currency}\n` +
        `🎫 Créditos: ${pack.amount + (pack.bonusCredits || 0)}${bonusText}\n\n` +
        `✅ Se ha generado un nuevo enlace de pago.\n` +
        `⏱️ El enlace expirará en 30 minutos.`;

      const keyboard = Markup.inlineKeyboard([
        [Markup.button.url('💳 Pagar con Mercado Pago', newPaymentUrl)],
        [Markup.button.callback('❌ Cancelar', 'cancel_payment')],
      ]);

      await ctx.editMessageText(message, {
        parse_mode: 'HTML',
        ...keyboard,
      });
    } catch (error) {
      this.logger.error(`Error reintentando pago: ${error.message}`, error.stack);
      await ctx.reply('❌ Error al reintentar el pago. Por favor, intenta nuevamente.');
      await ctx.answerCbQuery('Error al reintentar');
    }
  }

  @Action('view_failed_payments')
  async onViewFailedPayments(@Ctx() ctx: Context): Promise<void> {
    try {
      await ctx.answerCbQuery('📋 Cargando pagos fallidos...');
      await this.onFailedPayments(ctx);
    } catch (error) {
      this.logger.error(`Error en callback view_failed_payments: ${error.message}`, error.stack);
      await ctx.reply('❌ Error al cargar los pagos fallidos. Por favor, usa /failed_payments');
      await ctx.answerCbQuery('Error al cargar');
    }
  }

  private getTimeAgo(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 60) {
      return `Hace ${diffMins} minuto${diffMins !== 1 ? 's' : ''}`;
    } else if (diffHours < 24) {
      return `Hace ${diffHours} hora${diffHours !== 1 ? 's' : ''}`;
    } else {
      return `Hace ${diffDays} día${diffDays !== 1 ? 's' : ''}`;
    }
  }
}
