import { Ctx, On, Update } from 'nestjs-telegraf';
import { Context } from 'telegraf';
import { Injectable, Logger } from '@nestjs/common';
import { ConversationsService } from '../../db/conversations.service';
import { UsersService } from '../../db/users.service';

@Injectable()
@Update()
export class MessageHandler {
  private readonly logger = new Logger(MessageHandler.name);

  constructor(
    private readonly conversations: ConversationsService,
    private readonly users: UsersService,
  ) {}

  @On('text')
  async onMessage(@Ctx() ctx: Context) {
    try {
      if (!ctx.from || !ctx.message || !('text' in ctx.message)) {
        return;
      }

      // Guardar el mensaje del usuario
      await this.conversations.addMessage(
        ctx.chat.id,
        ctx.from.id.toString(),
        ctx.message.text,
        'user'
      );

      // Aquí puedes agregar la lógica para procesar el mensaje y generar una respuesta
      const response = await this.processMessage(ctx.message.text);

      // Enviar la respuesta del bot
      const sentMessage = await ctx.reply(response);

      // Guardar la respuesta del bot
      if (sentMessage && 'text' in sentMessage) {
        await this.conversations.addMessage(
          ctx.chat.id,
          ctx.from.id.toString(),
          sentMessage.text,
          'bot'
        );
      }
    } catch (error) {
      this.logger.error(`Error procesando mensaje: ${error.message}`, error.stack);
      await ctx.reply('❌ Lo siento, hubo un error al procesar tu mensaje.');
    }
  }

  private async processMessage(text: string): Promise<string> {
    // Aquí puedes implementar la lógica para procesar el mensaje
    // Por ahora, solo devolvemos un mensaje simple
    return `Recibí tu mensaje: "${text}"`;
  }
} 