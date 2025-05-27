import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Connection } from 'mongoose';
import { InjectConnection } from '@nestjs/mongoose';
import { Pack } from '../telegram/constants/packs';
import { MercadoPagoService } from '../payments/mercadopago.service';
import { Payment, PaymentDocument } from './schemas/payment.schema';
import { UsersService } from './users.service';
import { CreditPacksService } from './credit-packs.service';
import { TransactionsService } from './transactions.service';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private readonly PAYMENT_TIMEOUT = 30 * 60 * 1000; // 30 minutos

  constructor(
    @InjectModel(Payment.name) private readonly paymentModel: Model<PaymentDocument>,
    private readonly mercadopago: MercadoPagoService,
    private readonly users: UsersService,
    private readonly creditPacksService: CreditPacksService,
    @InjectConnection() private readonly connection: Connection,
    private readonly transactionsService: TransactionsService,
  ) {
    // Iniciar el limpiador de pagos expirados
    this.startPaymentCleaner();
  }

  private async startPaymentCleaner() {
    setInterval(
      async () => {
        try {
          const expiredTime = new Date(Date.now() - this.PAYMENT_TIMEOUT);
          const expiredPayments = await this.paymentModel.find({
            status: 'pending',
            createdAt: { $lt: expiredTime },
          });

          for (const payment of expiredPayments) {
            await this.paymentModel.findByIdAndUpdate(payment._id, {
              status: 'expired',
              expiredAt: new Date(),
              statusDetail: 'Pago expirado por tiempo de espera',
            });
            this.logger.log(`Pago ${payment._id} marcado como expirado`);
          }

          // También limpiar pagos que están en error por mucho tiempo
          const errorTime = new Date(Date.now() - this.PAYMENT_TIMEOUT * 2); // 1 hora
          const errorPayments = await this.paymentModel.find({
            status: 'error',
            errorAt: { $lt: errorTime },
          });

          for (const payment of errorPayments) {
            await this.paymentModel.findByIdAndUpdate(payment._id, {
              status: 'failed',
              statusDetail: 'Pago marcado como fallido después de error prolongado',
              failedAt: new Date(),
            });
            this.logger.log(`Pago ${payment._id} marcado como fallido después de error prolongado`);
          }
        } catch (error) {
          this.logger.error(`Error en el limpiador de pagos: ${error.message}`, error.stack);
        }
      },
      5 * 60 * 1000,
    ); // Ejecutar cada 5 minutos
  }

  async getPendingPayment(userId: string): Promise<PaymentDocument | null> {
    return this.paymentModel.findOne({
      userId,
      status: 'pending',
    });
  }

  async getPaymentById(paymentId: string): Promise<PaymentDocument | null> {
    // Primero intentar buscar por paymentId (ID de MercadoPago)
    let payment = await this.paymentModel.findOne({ paymentId: paymentId });

    // Si no se encuentra y el paymentId parece ser un ObjectId de MongoDB, buscar por _id
    if (!payment && paymentId.match(/^[0-9a-fA-F]{24}$/)) {
      payment = await this.paymentModel.findById(paymentId);
    }

    return payment;
  }

  async createInvoice(
    userId: string,
    pack: Pack,
    paymentMethod: string = 'mercadopago',
  ): Promise<string> {
    try {
      if (!userId) {
        throw new Error('El ID del usuario es requerido');
      }

      if (!pack || !pack.id || !pack.price || !pack.credits) {
        throw new Error('El pack seleccionado no es válido');
      }

      this.logger.debug(
        `Creando pago para usuario ${userId} con pack ${pack.id} y monto ${pack.price} USDT`,
      );

      const payment = await this.paymentModel.create({
        userId,
        packId: pack.id,
        amount: pack.price,
        credits: pack.credits,
        status: 'pending',
        statusDetail: 'Pago pendiente de confirmación',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + this.PAYMENT_TIMEOUT),
        paymentMethod,
      });

      this.logger.debug(`Documento de pago creado con ID: ${payment._id}`);

      let url: string;
      let paymentId: string;

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
            expires: false, // Los enlaces no expiran
          });
          url = this.mercadopago.isProduction ? response.init_point : response.sandbox_init_point;
          paymentId = response.id;
      }

      await this.paymentModel.findByIdAndUpdate(payment._id, {
        invoiceUrl: url,
        invoiceId: payment._id.toString(),
        paymentId: paymentId,
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
      // Buscar el pago primero para obtener el _id correcto
      const payment = await this.getPaymentById(paymentId);
      if (!payment) {
        throw new Error(`Pago no encontrado: ${paymentId}`);
      }

      await this.paymentModel.findByIdAndUpdate(payment._id, {
        messageId,
      });
      this.logger.debug(`Mensaje de pago actualizado para el pago: ${paymentId}`);
    } catch (error) {
      this.logger.error(`Error actualizando ID de mensaje: ${error.message}`, error.stack);
      throw error;
    }
  }

  async markConfirmed(orderId: string): Promise<void> {
    const session = await this.connection.startSession();
    
    try {
      await session.withTransaction(async () => {
        // El orderId puede ser el _id del documento o el paymentId de MercadoPago
        let payment = await this.paymentModel.findById(orderId).session(session);
        if (!payment) {
          // Si no se encuentra por _id, buscar por paymentId
          payment = await this.paymentModel.findOne({ paymentId: orderId }).session(session);
        }
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

        // Obtener información del usuario para la transacción
        const user = await this.users.findById(payment.userId);
        if (!user) {
          throw new Error(`Usuario no encontrado: ${payment.userId}`);
        }

        // Actualizar estado del pago usando el _id del documento encontrado
        await this.paymentModel.findByIdAndUpdate(payment._id, {
          status: 'confirmed',
          statusDetail: 'Pago confirmado exitosamente',
          confirmedAt: new Date(),
        }, { session });

        // Añadir créditos al usuario
        await this.users.addCredits(payment.userId, payment.credits);

        // Incrementar contador de compras
        await this.users.incrementTotalPurchases(payment.userId);

        // 🆕 REGISTRAR TRANSACCIÓN DE COMPRA
        await this.transactionsService.createPurchaseTransaction(
          user.telegramId,
          payment.credits,
          `Compra de ${payment.credits} créditos - Pack ${payment.packId}`,
          {
            paymentMethod: payment.paymentMethod || 'mercadopago',
            paymentId: payment.paymentId,
            merchantOrderId: payment.merchantOrderId,
            packId: payment.packId,
            amount: payment.amount,
            transactionAmount: payment.transactionAmount,
            currencyId: payment.currencyId || 'ARS',
            operationType: payment.operationType,
            payerId: payment.payerId,
            payerEmail: payment.payerEmail,
            siteId: payment.siteId,
            isTest: payment.isTest,
            dateApproved: payment.dateApproved,
            externalReference: orderId,
          },
          session
        );

        this.logger.log(`Pago confirmado, créditos añadidos y transacción registrada para la orden: ${orderId}`);
      });
    } catch (error) {
      this.logger.error(`Error marcando pago como confirmado: ${error.message}`, error.stack);
      throw error;
    } finally {
      await session.endSession();
    }
  }

  async markRejected(orderId: string, status: string, statusDetail: string): Promise<void> {
    try {
      // El orderId puede ser el _id del documento o el paymentId de MercadoPago
      let payment = await this.paymentModel.findById(orderId);
      if (!payment) {
        // Si no se encuentra por _id, buscar por paymentId
        payment = await this.paymentModel.findOne({ paymentId: orderId });
      }
      if (!payment) {
        this.logger.warn(`Pago no encontrado para la orden: ${orderId}`);
        return;
      }

      if (payment.status !== 'pending') {
        this.logger.warn(`Pago no está en estado pendiente para la orden: ${orderId}`);
        return;
      }

      await this.paymentModel.findByIdAndUpdate(payment._id, {
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
      // El orderId puede ser el _id del documento o el paymentId de MercadoPago
      let payment = await this.paymentModel.findById(orderId);
      if (!payment) {
        // Si no se encuentra por _id, buscar por paymentId
        payment = await this.paymentModel.findOne({ paymentId: orderId });
      }
      if (!payment) {
        this.logger.warn(`Pago no encontrado para la orden: ${orderId}`);
        return;
      }

      if (payment.status !== 'pending') {
        this.logger.warn(`Pago no está en estado pendiente para la orden: ${orderId}`);
        return;
      }

      await this.paymentModel.findByIdAndUpdate(payment._id, {
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

  async markFailed(orderId: string, reason: string): Promise<void> {
    try {
      // El orderId puede ser el _id del documento o el paymentId de MercadoPago
      let payment = await this.paymentModel.findById(orderId);
      if (!payment) {
        // Si no se encuentra por _id, buscar por paymentId
        payment = await this.paymentModel.findOne({ paymentId: orderId });
      }
      if (!payment) {
        this.logger.warn(`Pago no encontrado para la orden: ${orderId}`);
        return;
      }

      if (payment.status === 'confirmed' || payment.status === 'failed') {
        this.logger.warn(`Pago ya está en estado final para la orden: ${orderId}`);
        return;
      }

      await this.paymentModel.findByIdAndUpdate(payment._id, {
        status: 'failed',
        statusDetail: `Pago fallido: ${reason}`,
        failedAt: new Date(),
        errorMessage: reason,
      });

      this.logger.log(`Pago marcado como fallido para la orden: ${orderId} - ${reason}`);
    } catch (error) {
      this.logger.error(`Error marcando pago como fallido: ${error.message}`, error.stack);
      throw error;
    }
  }

  async markExpired(orderId: string, reason: string): Promise<void> {
    try {
      // El orderId puede ser el _id del documento o el paymentId de MercadoPago
      let payment = await this.paymentModel.findById(orderId);
      if (!payment) {
        // Si no se encuentra por _id, buscar por paymentId
        payment = await this.paymentModel.findOne({ paymentId: orderId });
      }
      if (!payment) {
        this.logger.warn(`Pago no encontrado para la orden: ${orderId}`);
        return;
      }

      if (payment.status !== 'pending') {
        this.logger.warn(`Pago no está en estado pendiente para la orden: ${orderId}`);
        return;
      }

      await this.paymentModel.findByIdAndUpdate(payment._id, {
        status: 'expired',
        statusDetail: `Pago expirado: ${reason}`,
        expiredAt: new Date(),
      });

      this.logger.log(`Pago marcado como expirado para la orden: ${orderId} - ${reason}`);
    } catch (error) {
      this.logger.error(`Error marcando pago como expirado: ${error.message}`, error.stack);
      throw error;
    }
  }

  async updatePaymentWithMerchantOrderData(
    externalReference: string,
    merchantOrderData: any,
  ): Promise<void> {
    try {
      // El external_reference es el _id del documento de pago
      const payment = await this.paymentModel.findById(externalReference);
      if (!payment) {
        this.logger.warn(
          `Pago no encontrado para actualizar con merchant order data: ${externalReference}`,
        );
        return;
      }

      const updateData: any = {
        merchantOrderId: merchantOrderData.merchantOrder.id,
        preferenceId: merchantOrderData.merchantOrder.preferenceId,
        transactionAmount: merchantOrderData.transactionAmount,
        totalPaidAmount: merchantOrderData.totalPaidAmount,
        currencyId: merchantOrderData.currencyId,
        operationType: merchantOrderData.operationType,
        payerId: merchantOrderData.merchantOrder.payerId,
        payerEmail: merchantOrderData.merchantOrder.payerEmail,
        collectorId: merchantOrderData.merchantOrder.collectorId,
        collectorEmail: merchantOrderData.merchantOrder.collectorEmail,
        siteId: merchantOrderData.merchantOrder.siteId,
        isTest: merchantOrderData.merchantOrder.isTest,
        orderStatus: merchantOrderData.merchantOrder.orderStatus,
      };

      // Agregar fechas si están disponibles
      if (merchantOrderData.dateApproved) {
        updateData.dateApproved = new Date(merchantOrderData.dateApproved);
      }
      if (merchantOrderData.dateCreated) {
        updateData.dateCreated = new Date(merchantOrderData.dateCreated);
      }
      if (merchantOrderData.lastModified) {
        updateData.lastModified = new Date(merchantOrderData.lastModified);
      }

      await this.paymentModel.findByIdAndUpdate(payment._id, updateData);
      this.logger.log(`Pago actualizado con datos de merchant order: ${externalReference}`);
    } catch (error) {
      this.logger.error(
        `Error actualizando pago con merchant order data: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async retryFailedPayment(paymentId: string): Promise<string> {
    try {
      const payment = await this.getPaymentById(paymentId);
      if (!payment) {
        throw new Error('Pago no encontrado');
      }

      if (
        payment.status !== 'error' &&
        payment.status !== 'failed' &&
        payment.status !== 'expired'
      ) {
        throw new Error('El pago no está en un estado que permita reintento');
      }

      // Buscar el pack original
      const pack = await this.creditPacksService.findByPackId(payment.packId);
      if (!pack) {
        throw new Error('Pack no encontrado');
      }

      // Crear nuevo pago
      const newPaymentUrl = await this.createInvoice(
        payment.userId,
        {
          id: pack.packId,
          name: pack.title,
          price: pack.price,
          credits: pack.amount + (pack.bonusCredits || 0),
          description: pack.description,
        },
        payment.paymentMethod,
      );

      // Marcar el pago anterior como reintentado
      await this.paymentModel.findByIdAndUpdate(payment._id, {
        status: 'retried',
        statusDetail: 'Pago reintentado con nueva transacción',
        retriedAt: new Date(),
      });

      this.logger.log(`Pago reintentado para la orden: ${paymentId}`);
      return newPaymentUrl;
    } catch (error) {
      this.logger.error(`Error reintentando pago: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getFailedPayments(userId: string): Promise<PaymentDocument[]> {
    return this.paymentModel
      .find({
        userId,
        status: { $in: ['error', 'failed', 'expired', 'rejected'] },
      })
      .sort({ createdAt: -1 })
      .limit(5);
  }

  async cancelPayment(paymentId: string): Promise<void> {
    try {
      const payment = await this.getPaymentById(paymentId);
      if (!payment) {
        throw new Error('Pago no encontrado');
      }

      if (payment.status !== 'pending') {
        throw new Error('El pago no puede ser cancelado en su estado actual');
      }

      const result = await this.paymentModel.updateOne(
        { _id: payment._id, status: 'pending' },
        {
          $set: {
            status: 'cancelled',
            statusDetail: 'Pago cancelado por el usuario',
            cancelledAt: new Date(),
          },
        },
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
