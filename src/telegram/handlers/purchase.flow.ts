import { Action, Ctx, Command, Update } from 'nestjs-telegraf';
import { Context, Markup } from 'telegraf';
import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { UsersService } from '../../db/users.service';
import { PaymentsService } from '../../db/payments.service';
import { PACKS } from '../constants/packs';
import { PaymentDocument } from '../../db/schemas/payment.schema';

@Injectable()
@Update()
export class PurchaseFlow {
  private readonly logger = new Logger(PurchaseFlow.name);

  constructor(
    private readonly users: UsersService,
    @Inject(forwardRef(() => PaymentsService))
    private readonly pay: PaymentsService,
  ) {}

  private async deleteLastMessages(ctx: Context) {
    try {
      // Borrar el mensaje del usuario si existe
      if (ctx.message) {
        await ctx.deleteMessage(ctx.message.message_id);
      }
      
      // Borrar el último mensaje del bot si existe
      if (ctx.callbackQuery?.message) {
        await ctx.deleteMessage(ctx.callbackQuery.message.message_id);
      }
    } catch (error) {
      this.logger.warn(`No se pudo eliminar los mensajes anteriores: ${error.message}`);
    }
  }

  private async updatePaymentMessage(ctx: Context, paymentId: string, status: string) {
    try {
      const payment = await this.pay.getPaymentById(paymentId);
      if (!payment) {
        this.logger.warn(`Pago no encontrado para actualizar mensaje: ${paymentId}`);
        return;
      }

      const pack = PACKS.find(p => p.id === payment.packId);
      if (!pack) {
        this.logger.warn(`Pack no encontrado para el pago: ${paymentId}`);
        return;
      }

      let message = '';
      let keyboard = null;

      switch (status) {
        case 'confirmed':
          message = 
            `✅ <b>¡Pago Confirmado!</b>\n\n` +
            `🛍️ Pack: ${pack.name}\n` +
            `💰 Precio: ${pack.price} USDT\n` +
            `🎫 Créditos añadidos: ${pack.credits}\n\n` +
            `¡Gracias por tu compra!`;
          break;

        case 'expired':
          message = 
            `⏱️ <b>Pago Expirado</b>\n\n` +
            `🛍️ Pack: ${pack.name}\n` +
            `💰 Precio: ${pack.price} USDT\n` +
            `🎫 Créditos: ${pack.credits}\n\n` +
            `El tiempo para realizar el pago ha expirado.\n` +
            `Puedes generar un nuevo enlace de pago usando el comando /buy`;
          keyboard = Markup.inlineKeyboard([
            [Markup.button.callback('🛍️ Realizar nueva compra', 'new_purchase')]
          ]);
          break;

        case 'cancelled':
          message = 
            `❌ <b>Pago Cancelado</b>\n\n` +
            `🛍️ Pack: ${pack.name}\n` +
            `💰 Precio: ${pack.price} USDT\n` +
            `🎫 Créditos: ${pack.credits}\n\n` +
            `Has cancelado el pago.\n` +
            `Puedes generar un nuevo enlace de pago usando el comando /buy`;
          keyboard = Markup.inlineKeyboard([
            [Markup.button.callback('🛍️ Realizar nueva compra', 'new_purchase')]
          ]);
          break;

        case 'rejected':
        case 'error':
          message = 
            `❌ <b>Error en el Pago</b>\n\n` +
            `🛍️ Pack: ${pack.name}\n` +
            `💰 Precio: ${pack.price} USDT\n` +
            `🎫 Créditos: ${pack.credits}\n\n` +
            `Hubo un problema al procesar tu pago.\n` +
            `Puedes intentar nuevamente usando el comando /buy`;
          keyboard = Markup.inlineKeyboard([
            [Markup.button.callback('🛍️ Intentar nuevamente', 'new_purchase')]
          ]);
          break;
      }

      if (message) {
        await ctx.editMessageText(message, {
          parse_mode: 'HTML',
          ...(keyboard ? keyboard : {})
        });
      }
    } catch (error) {
      this.logger.error(`Error actualizando mensaje de pago: ${error.message}`, error.stack);
    }
  }

  @Action('new_purchase')
  async onNewPurchase(@Ctx() ctx: Context): Promise<void> {
    try {
      await this.deleteLastMessages(ctx);
      await this.buy(ctx);
      await ctx.answerCbQuery('Nueva compra iniciada');
    } catch (error) {
      this.logger.error(`Error iniciando nueva compra: ${error.message}`, error.stack);
      await ctx.reply('❌ Error al iniciar nueva compra. Por favor, usa el comando /buy');
      await ctx.answerCbQuery('Error al iniciar compra');
    }
  }

  @Command('buy')
  async buy(@Ctx() ctx: Context) {
    try {
      await this.deleteLastMessages(ctx);
      // 1. Enviar mensaje de cargando
      const loadingMsg = await ctx.reply('🔎 Buscando ofertas y promociones especiales... 🛍️✨');

      const user = await this.users.upsertFromContext(ctx);
      
      // Verificar si el usuario puede hacer compras
      const canPurchase = await this.users.canMakePurchase(user.id);
      if (!canPurchase.can) {
        await ctx.reply(`❌ No puedes realizar compras en este momento: ${canPurchase.reason}`);
        // Borrar el mensaje de cargando si hay error
        if (loadingMsg && loadingMsg.message_id) {
          await ctx.deleteMessage(loadingMsg.message_id);
        }
        return;
      }

      // Generar los links de pago para cada pack
      const keyboard = [];
      for (const pack of PACKS) {
        const url = await this.pay.createInvoice(user.id, pack, 'mercadopago');
        keyboard.push([Markup.button.url(`${pack.name} - ${pack.price} USDT`, url)]);
      }

      // Mensaje final
      const message = 
        `💰 <b>Tu Balance Actual</b>\n` +
        `Balance: ${user.balance} USDT\n` +
        `Créditos: ${user.credits}\n\n` +
        `🛍️ <b>Packs Disponibles</b>\n` +
        PACKS.map(p => 
          `<b>${p.name}</b>\n` +
          `Precio: ${p.price} USDT\n` +
          `Créditos: ${p.credits}\n` +
          `Descripción: ${p.description}\n`
        ).join('\n') +
        `\nElige un pack:`;

      // 3. Borrar el mensaje de cargando
      if (loadingMsg && loadingMsg.message_id) {
        await ctx.deleteMessage(loadingMsg.message_id);
      }

      // 4. Enviar el mensaje final
      await ctx.reply(message, {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard(keyboard)
      });
    } catch (error) {
      this.logger.error(`Error in buy command: ${error.message}`, error.stack);
      await ctx.reply('❌ Error al procesar tu solicitud. Por favor, intenta nuevamente.');
    }
  }

  @Action(/p\d+/)
  async onPack(@Ctx() ctx: Context & { match: RegExpExecArray }): Promise<void> {
    try {
      const packId = ctx.match[0];
      const pack = PACKS.find(p => p.id === packId);
      
      if (!pack) {
        this.logger.warn(`Invalid pack ID requested: ${packId}`);
        await ctx.reply('❌ Pack inválido. Por favor, selecciona un pack válido.');
        await ctx.answerCbQuery('Pack inválido');
        return;
      }

      const user = await this.users.upsertFromContext(ctx);
      
      if (!user) {
        this.logger.error('Failed to create/update user from context');
        await ctx.reply('❌ Error al procesar tu solicitud. Por favor, intenta nuevamente.');
        await ctx.answerCbQuery('Error al procesar usuario');
        return;
      }

      // Verificar si el usuario puede hacer compras
      const canPurchase = await this.users.canMakePurchase(user.id);
      if (!canPurchase.can) {
        await ctx.reply(`❌ No puedes realizar compras en este momento: ${canPurchase.reason}`);
        await ctx.answerCbQuery('Compra no permitida');
        return;
      }

      // Verificar si el usuario tiene suficiente balance
      if (user.balance >= pack.price) {
        // Usar balance existente
        await this.users.addBalance(user.id, -pack.price);
        await this.users.addCredits(user.id, pack.credits);
        
        await this.deleteLastMessages(ctx);
        await ctx.reply(
          `✅ <b>Compra Exitosa</b>\n\n` +
          `🛍️ Pack: ${pack.name}\n` +
          `💰 Precio: ${pack.price} USDT\n` +
          `🎫 Créditos añadidos: ${pack.credits}\n` +
          `💳 Balance restante: ${user.balance - pack.price} USDT`,
          { parse_mode: 'HTML' }
        );
        
        await ctx.answerCbQuery('✅ Compra completada con balance existente');
        return;
      }

      // Verificar si hay un pago pendiente
      const pendingPayment = await this.pay.getPendingPayment(user.id);
      if (pendingPayment) {
        const pendingPack = PACKS.find(p => p.id === pendingPayment.packId);
        if (!pendingPack) {
          this.logger.warn(`Pack no encontrado para el pago pendiente: ${pendingPayment.packId}`);
          await ctx.reply('❌ Error al recuperar información del pago pendiente.');
          await ctx.answerCbQuery('Error al procesar pago pendiente');
          return;
        }

        const message = 
          `⚠️ <b>Pago Pendiente</b>\n\n` +
          `🛍️ Pack: ${pendingPack.name}\n` +
          `💰 Precio: ${pendingPack.price} USDT\n` +
          `🎫 Créditos: ${pendingPack.credits}\n` +
          `📝 Descripción: ${pendingPack.description}\n\n` +
          `⏱️ El enlace expirará en 30 minutos.\n\n` +
          `¿Qué deseas hacer?`;

        const keyboard = Markup.inlineKeyboard([
          [Markup.button.url('💳 Continuar con Mercado Pago', pendingPayment.invoiceUrl)],
          [Markup.button.callback('❌ Cancelar pago', 'cancel_payment')],
          [Markup.button.callback('🛍️ Iniciar nueva compra', 'new_purchase')]
        ]);

        await ctx.reply(message, {
          parse_mode: 'HTML',
          ...keyboard
        });
        await ctx.answerCbQuery('Pago pendiente existente');
        return;
      }

      // Generar enlaces de pago para diferentes métodos
      const paymentMethods = [
        { name: '💳 Mercado Pago', url: await this.pay.createInvoice(user.id, pack, 'mercadopago') }
      ];

      const validPaymentMethods = paymentMethods.filter(method => method.url);

      if (validPaymentMethods.length === 0) {
        this.logger.error(`Failed to create payment methods for user ${user.id} and pack ${packId}`);
        await ctx.reply('❌ Error al generar el método de pago. Por favor, intenta nuevamente.');
        await ctx.answerCbQuery('Error al generar pago');
        return;
      }

      await this.deleteLastMessages(ctx);
      
      const message = 
        `🛍️ <b>Pack ${pack.name}</b>\n\n` +
        `💰 Precio: ${pack.price} USDT\n` +
        `🎫 Créditos: ${pack.credits}\n` +
        `📝 Descripción: ${pack.description}\n\n` +
        `💳 Haz clic en el botón para pagar con Mercado Pago:\n\n` +
        `⚠️ El pago se procesará automáticamente una vez confirmado.\n` +
        `⏱️ El enlace expirará en 30 minutos.`;

      const keyboard = Markup.inlineKeyboard([
        ...validPaymentMethods.map(method => [
          Markup.button.url(method.name, method.url)
        ]),
        [Markup.button.callback('❌ Cancelar pago', 'cancel_payment')]
      ]);

      const sentMessage = await ctx.reply(message, {
        parse_mode: 'HTML',
        ...keyboard
      });
      
      // Guardar el ID del mensaje para futuras actualizaciones
      if (sentMessage && pendingPayment) {
        await this.pay.updatePaymentMessageId(pendingPayment._id.toString(), sentMessage.message_id);
      }
      
      await ctx.answerCbQuery('✅ Métodos de pago generados');
    } catch (error) {
      this.logger.error(`Error in purchase flow: ${error.message}`, error.stack);
      await ctx.reply('❌ Ocurrió un error inesperado. Por favor, intenta nuevamente más tarde.');
      await ctx.answerCbQuery('Error inesperado');
    }
  }

  @Action('cancel_payment')
  async onCancelPayment(@Ctx() ctx: Context): Promise<void> {
    try {
      const user = await this.users.upsertFromContext(ctx);
      if (!user) {
        throw new Error('Usuario no encontrado');
      }

      const pendingPayment = await this.pay.getPendingPayment(user.id);
      if (!pendingPayment) {
        await ctx.reply('❌ No tienes ningún pago pendiente para cancelar.');
        await ctx.answerCbQuery('Sin pago pendiente');
        return;
      }

      await this.pay.cancelPayment(pendingPayment._id.toString());
      await this.updatePaymentMessage(ctx, pendingPayment._id.toString(), 'cancelled');
      await ctx.answerCbQuery('Pago cancelado');
    } catch (error) {
      this.logger.error(`Error al cancelar el pago: ${error.message}`, error.stack);
      await ctx.reply('❌ Error al procesar la cancelación. Por favor, intenta nuevamente.');
      await ctx.answerCbQuery('Error al cancelar');
    }
  }
}
