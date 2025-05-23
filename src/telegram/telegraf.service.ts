import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { Context } from 'telegraf';
import { PurchaseFlow } from './handlers/purchase.flow';
import { UsersService } from '../db/users.service';

@Injectable()
export class TelegrafService {
  private readonly logger = new Logger(TelegrafService.name);

  constructor(
    @Inject(forwardRef(() => PurchaseFlow))
    private readonly purchaseFlow: PurchaseFlow,
    private readonly users: UsersService,
  ) {}

  async updatePaymentMessage(userId: string, paymentId: string, status: string): Promise<void> {
    try {
      // Obtener el contexto del usuario
      const ctx = await this.getUserContext(userId);
      if (!ctx) {
        this.logger.warn(`No se pudo obtener el contexto para el usuario ${userId}`);
        return;
      }

      // Actualizar el mensaje usando el método del PurchaseFlow
      await this.purchaseFlow['updatePaymentMessage'](ctx, paymentId, status);
    } catch (error) {
      this.logger.error(`Error actualizando mensaje de pago: ${error.message}`, error.stack);
    }
  }

  async sendNotification(userId: string, message: string) {
    try {
      const user = await this.users.findById(userId);
      if (!user || !user.telegramId) {
        this.logger.warn(`Usuario no encontrado o sin telegramId: ${userId}`);
        return;
      }

      const ctx = await this.getUserContext(userId);
      if (!ctx) {
        this.logger.warn(`No se pudo obtener el contexto para el usuario ${userId}`);
        return;
      }

      await ctx.reply(message);
    } catch (error) {
      this.logger.error(`Error enviando notificación: ${error.message}`, error.stack);
    }
  }

  private async getUserContext(userId: string): Promise<Context | null> {
    try {
      const user = await this.users.findById(userId);
      if (!user || !user.telegramId) {
        this.logger.warn(`Usuario no encontrado o sin telegramId: ${userId}`);
        return null;
      }

      // Crear un contexto básico con el chat_id del usuario
      return {
        chat: {
          id: user.telegramId,
          type: 'private',
          username: user.username,
          first_name: user.firstName
        },
        from: {
          id: user.telegramId,
          username: user.username,
          first_name: user.firstName
        },
        message: {
          message_id: 0,
          date: Date.now() / 1000,
          chat: {
            id: user.telegramId,
            type: 'private',
            username: user.username,
            first_name: user.firstName
          },
          from: {
            id: user.telegramId,
            username: user.username,
            first_name: user.firstName
          }
        }
      } as Context;
    } catch (error) {
      this.logger.error(`Error obteniendo contexto de usuario: ${error.message}`, error.stack);
      return null;
    }
  }
} 