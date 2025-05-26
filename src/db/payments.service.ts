import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Pack } from '../telegram/constants/packs';
import { MercadoPagoService } from '../payments/mercadopago.service';
import { Payment, PaymentDocument } from './schemas/payment.schema';
import { UsersService } from './users.service';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private readonly PAYMENT_TIMEOUT = 30 * 60 * 1000; // 30 minutos

  constructor(
    @InjectModel(Payment.name) private readonly paymentModel: Model<PaymentDocument>,
    private readonly mercadopago: MercadoPagoService,
    private readonly users: UsersService,
  ) {
    // Iniciar el limpiador de pagos expirados
    this.startPaymentCleaner();
  }

  private async startPaymentCleaner() {
    setInterval(async () => {
      try {
        const expiredTime = new Date(Date.now() - this.PAYMENT_TIMEOUT);
        const expiredPayments = await this.paymentModel.find({
          status: 'pending',
          createdAt: { $lt: expiredTime }
        });

        for (const payment of expiredPayments) {
          await this.paymentModel.findByIdAndUpdate(payment._id, {
            status: 'expired',
            expiredAt: new Date(),
            statusDetail: 'Pago expirado por tiempo de espera'
          });
          this.logger.log(`Pago ${payment._id} marcado como expirado`);
        }
      } catch (error) {
        this.logger.error(`Error en el limpiador de pagos: ${error.message}`, error.stack);
      }
    }, 5 * 60 * 1000); // Ejecutar cada 5 minutos
  }

  async getPendingPayment(userId: string): Promise<PaymentDocument | null> {
    return this.paymentModel.findOne({
      userId,
      status: 'pending'
    });
  }

  async getPaymentById(paymentId: string): Promise<PaymentDocument | null> {
    return this.paymentModel.findById(paymentId);
  }

  async createInvoice(userId: string, pack: Pack, paymentMethod: string = 'mercadopago'): Promise<string> {
    try {
      if (!userId) {
        throw new Error('El ID del usuario es requerido');
      }

      if (!pack || !pack.id || !pack.price || !pack.credits) {
        throw new Error('El pack seleccionado no es válido');
      }

      this.logger.debug(`Creando pago para usuario ${userId} con pack ${pack.id} y monto ${pack.price} USDT`);

      const payment = await this.paymentModel.create({
        userId,
        packId: pack.id,
        amount: pack.price,
        credits: pack.credits,
        status: 'pending',
        statusDetail: 'Pago pendiente de confirmación',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + this.PAYMENT_TIMEOUT),
        paymentMethod
      });

      this.logger.debug(`Documento de pago creado con ID: ${payment._id}`);

      let url: string;

      switch (paymentMethod) {
        case 'USDT_TRC20':
          url = `https://tronlink.org/pay?address=${process.env.TRON_WALLET_ADDRESS}&amount=${pack.price}&token=TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t`; // USDT TRC20
          break;
        case 'USDT_BEP20':
          url = `https://trustwallet.com/pay?address=${process.env.BSC_WALLET_ADDRESS}&amount=${pack.price}&token=0x55d398326f99059fF775485246999027B3197955`; // USDT BEP20
          break;
        case 'BTC':
          url = `https://trustwallet.com/pay?address=${process.env.BTC_WALLET_ADDRESS}&amount=${pack.price}`;
          break;
        default:
          const response = await this.mercadopago.createPreference({
            amount: pack.price,
            description: `Pack ${pack.id} - ${pack.credits} créditos`,
            external_reference: payment._id.toString(),
            // Las back_urls son opcionales - el webhook es suficiente para procesar pagos
            // back_urls: {
            //   success: `${process.env.BASE_URL}/payment/success`,
            //   failure: `${process.env.BASE_URL}/payment/failure`, 
            //   pending: `${process.env.BASE_URL}/payment/pending`
            // },
            expires: false // Los enlaces no expiran
          });
          url = this.mercadopago.isProduction ? response.init_point : response.sandbox_init_point;
      }

      await this.paymentModel.findByIdAndUpdate(payment._id, {
        invoiceUrl: url,
        invoiceId: payment._id.toString(),
      });

      this.logger.debug(`Documento de pago actualizado con URL e ID de factura`);

      return url;
    } catch (error) {
      this.logger.error(`Error creando factura: ${error.message}`, error.stack);
      throw error;
    }
  }

  async updatePaymentMessageId(paymentId: string, messageId: number): Promise<void> {
    try {
      await this.paymentModel.findByIdAndUpdate(paymentId, {
        messageId,
      });
      this.logger.debug(`Mensaje de pago actualizado para el pago: ${paymentId}`);
    } catch (error) {
      this.logger.error(`Error actualizando ID de mensaje: ${error.message}`, error.stack);
      throw error;
    }
  }

  async markConfirmed(orderId: string): Promise<void> {
    try {
      const payment = await this.paymentModel.findById(orderId);
      if (!payment) {
        this.logger.warn(`Pago no encontrado para la orden: ${orderId}`);
        return;
      }

      if (payment.status === 'confirmed') {
        this.logger.warn(`Pago ya confirmado para la orden: ${orderId}`);
        return;
      }

      if (payment.status === 'expired') {
        this.logger.warn(`Pago expirado para la orden: ${orderId}`);
        return;
      }

      // Actualizar estado del pago
      await this.paymentModel.findByIdAndUpdate(orderId, {
        status: 'confirmed',
        statusDetail: 'Pago confirmado exitosamente',
        confirmedAt: new Date(),
      });

      // Añadir créditos al usuario
      const paymentDoc = payment.toObject();
      await this.users.addCredits(paymentDoc.userId, paymentDoc.credits);
      
      // Incrementar contador de compras
      await this.users.incrementTotalPurchases(paymentDoc.userId);

      this.logger.log(`Pago confirmado y créditos añadidos para la orden: ${orderId}`);
    } catch (error) {
      this.logger.error(`Error marcando pago como confirmado: ${error.message}`, error.stack);
      throw error;
    }
  }

  async markRejected(orderId: string, status: string, statusDetail: string): Promise<void> {
    try {
      const payment = await this.paymentModel.findById(orderId);
      if (!payment) {
        this.logger.warn(`Pago no encontrado para la orden: ${orderId}`);
        return;
      }

      if (payment.status !== 'pending') {
        this.logger.warn(`Pago no está en estado pendiente para la orden: ${orderId}`);
        return;
      }

      await this.paymentModel.findByIdAndUpdate(orderId, {
        status: 'rejected',
        statusDetail: `${status}: ${statusDetail}`,
        rejectedAt: new Date(),
      });

      this.logger.log(`Pago rechazado para la orden: ${orderId} - ${status}: ${statusDetail}`);
    } catch (error) {
      this.logger.error(`Error marcando pago como rechazado: ${error.message}`, error.stack);
      throw error;
    }
  }

  async markError(orderId: string, errorMessage: string): Promise<void> {
    try {
      const payment = await this.paymentModel.findById(orderId);
      if (!payment) {
        this.logger.warn(`Pago no encontrado para la orden: ${orderId}`);
        return;
      }

      if (payment.status !== 'pending') {
        this.logger.warn(`Pago no está en estado pendiente para la orden: ${orderId}`);
        return;
      }

      await this.paymentModel.findByIdAndUpdate(orderId, {
        status: 'error',
        statusDetail: 'Error en el procesamiento del pago',
        errorMessage,
        errorAt: new Date(),
      });

      this.logger.log(`Pago marcado como error para la orden: ${orderId} - ${errorMessage}`);
    } catch (error) {
      this.logger.error(`Error marcando pago como error: ${error.message}`, error.stack);
      throw error;
    }
  }

  async cancelPayment(paymentId: string): Promise<void> {
    try {
      const payment = await this.paymentModel.findById(paymentId);
      if (!payment) {
        throw new Error('Pago no encontrado');
      }

      if (payment.status !== 'pending') {
        throw new Error('El pago no puede ser cancelado en su estado actual');
      }

      const result = await this.paymentModel.updateOne(
        { _id: paymentId, status: 'pending' },
        { 
          $set: { 
            status: 'cancelled',
            statusDetail: 'Pago cancelado por el usuario',
            cancelledAt: new Date()
          }
        }
      );

      if (result.matchedCount === 0) {
        throw new Error('Pago no encontrado o no está en estado pendiente');
      }
    } catch (error) {
      this.logger.error(`Error cancelando pago: ${error.message}`, error.stack);
      throw error;
    }
  }
}
