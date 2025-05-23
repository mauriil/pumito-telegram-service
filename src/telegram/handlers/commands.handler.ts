import { Ctx, Command, Update } from 'nestjs-telegraf';
import { Context } from 'telegraf';
import { Injectable, Logger } from '@nestjs/common';
import { UsersService } from '../../db/users.service';

@Injectable()
@Update()
export class CommandsHandler {
  private readonly logger = new Logger(CommandsHandler.name);

  constructor(private readonly users: UsersService) {}

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
                [{ text: '🎮 Jugar', web_app: { url: 'https://tu-app-url.com' } }]
              ]
            }
          }
        );
      } else {
        await ctx.reply(
          `¡Hola de nuevo ${userName}! 👋\n\n` +
          '📊 <b>Tus Estadísticas</b>\n' +
          `💰 Balance: ${user.balance} USDT\n` +
          `🎫 Créditos: ${user.credits}\n` +
          `🛍️ Compras totales: ${user.totalPurchases}\n\n` +
          '¿Qué te gustaría hacer?',
          {
            parse_mode: 'HTML',
            reply_markup: {
              inline_keyboard: [
                [{ text: '🎮 Jugar', web_app: { url: 'https://tu-app-url.com' } }],
                [{ text: '💎 Comprar Tokens', callback_data: 'buy_tokens' }]
              ]
            }
          }
        );
      }
    } catch (error) {
      this.logger.error(`Error en comando start: ${error.message}`, error.stack);
      await ctx.reply('❌ Lo siento, hubo un error al procesar tu solicitud. Por favor, intenta nuevamente.');
    }
  }
}
