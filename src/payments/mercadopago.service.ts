import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

interface MercadoPagoPreferenceRequest {
  amount: number;
  description: string;
  external_reference: string;
  back_urls?: {
    success: string;
    failure: string;
    pending: string;
  };
  expires?: boolean;
}

interface MercadoPagoPreferenceResponse {
  id: string;
  init_point: string;
  sandbox_init_point: string;
}

interface MercadoPagoMerchantOrder {
  id: number;
  status: string;
  external_reference: string;
  preference_id: string;
  payments: Array<{
    id: number;
    transaction_amount: number;
    total_paid_amount: number;
    shipping_cost: number;
    currency_id: string;
    status: string;
    status_detail: string;
    operation_type: string;
    date_approved: string;
    date_created: string;
    last_modified: string;
    amount_refunded: number;
  }>;
  shipments: any[];
  payouts: any[];
  collector: {
    id: number;
    email: string;
    nickname: string;
  };
  marketplace: string;
  notification_url: string;
  date_created: string;
  last_updated: string;
  sponsor_id: any;
  shipping_cost: number;
  total_amount: number;
  site_id: string;
  paid_amount: number;
  refunded_amount: number;
  payer: {
    id: number;
    email: string;
  };
  items: Array<{
    id: string;
    category_id: any;
    currency_id: string;
    description: any;
    picture_url: any;
    title: string;
    quantity: number;
    unit_price: number;
  }>;
  cancelled: boolean;
  additional_info: string;
  application_id: any;
  is_test: boolean;
  order_status: string;
  client_id: string;
}

@Injectable()
export class MercadoPagoService {
  private readonly logger = new Logger(MercadoPagoService.name);
  private readonly accessToken: string;
  private readonly baseUrl: string;
  private readonly apiBase = 'https://api.mercadolibre.com';
  readonly isProduction: boolean;
  private currencyId: string = 'ARS'; // Default currency

  constructor(private readonly configService: ConfigService) {
    this.accessToken = this.configService.get<string>('MERCADOPAGO_ACCESS_TOKEN');
    this.baseUrl = this.configService.get<string>('BASE_URL');
    this.isProduction = this.configService.get<string>('NODE_ENV') === 'production';

    if (!this.accessToken) {
      throw new Error('MERCADOPAGO_ACCESS_TOKEN no está configurada');
    }

    // Detectar el país basado en el access token para configurar la moneda correcta
    this.detectCurrencyFromToken();
  }

  private detectCurrencyFromToken(): void {
    // Los access tokens tienen prefijos que indican el país:
    // APP_USR (Argentina = ARS)
    // TEST- + país code (Brasil = BRL, México = MXN, etc.)

    if (this.accessToken.includes('TEST-') || this.accessToken.includes('APP_USR')) {
      // Para Argentina (por defecto)
      this.currencyId = 'ARS';

      // Si necesitas detectar otros países, puedes usar:
      // if (this.accessToken.includes('MLB')) this.currencyId = 'BRL'; // Brasil
      // if (this.accessToken.includes('MLM')) this.currencyId = 'MXN'; // México
      // if (this.accessToken.includes('MLU')) this.currencyId = 'UYU'; // Uruguay
      // if (this.accessToken.includes('MLC')) this.currencyId = 'CLP'; // Chile
      // if (this.accessToken.includes('MCO')) this.currencyId = 'COP'; // Colombia
      // if (this.accessToken.includes('MPE')) this.currencyId = 'PEN'; // Perú
    }

    this.logger.log(`Moneda detectada para MercadoPago: ${this.currencyId}`);
  }

  private async makeRequest<T>(method: string, endpoint: string, data?: any): Promise<T> {
    try {
      const response = await axios({
        method,
        url: `${this.apiBase}${endpoint}`,
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        data,
      });
      return response.data;
    } catch (error) {
      this.logger.error(`Error en la petición a MercadoPago: ${error.message}`, error.stack);
      if (error.response?.data) {
        this.logger.error(`Detalles del error: ${JSON.stringify(error.response.data)}`);
      }
      throw new Error(`Error en MercadoPago: ${error.response?.data?.message || error.message}`);
    }
  }

  async createPreference(
    payload: MercadoPagoPreferenceRequest,
  ): Promise<MercadoPagoPreferenceResponse> {
    this.logger.debug(`Creando preferencia con payload: ${JSON.stringify(payload)}`);

    if (!payload.amount || payload.amount <= 0) {
      throw new Error('El monto debe ser mayor a 0');
    }

    if (!payload.description || payload.description.trim() === '') {
      throw new Error('La descripción es requerida y no puede estar vacía');
    }

    if (!payload.external_reference || payload.external_reference.trim() === '') {
      throw new Error('La referencia externa es requerida y no puede estar vacía');
    }

    // Validar que baseUrl esté configurado para el notification_url
    if (!this.baseUrl) {
      throw new Error('BASE_URL no está configurada en las variables de entorno');
    }

    const preferenceData = {
      items: [
        {
          id: payload.external_reference,
          title: payload.description.substring(0, 256), // MercadoPago limita el título a 256 caracteres
          quantity: 1,
          unit_price: Number(Number(payload.amount).toFixed(2)), // Asegurar formato decimal correcto
          currency_id: this.currencyId,
        },
      ],
      external_reference: payload.external_reference,
      auto_return: 'approved',
      back_urls: {
        success: `${this.baseUrl}/api/webhook/mercadopago/success`,
        failure: `${this.baseUrl}/api/webhook/mercadopago/failure`,
        pending: `${this.baseUrl}/api/webhook/mercadopago/pending`,
      },
      notification_url: `${this.baseUrl}/api/webhook/mercadopago`,
    };

    this.logger.debug(`Datos de preferencia a enviar: ${JSON.stringify(preferenceData, null, 2)}`);

    const response = await this.makeRequest<any>('POST', '/checkout/preferences', preferenceData);

    return {
      id: response.id,
      init_point: response.init_point,
      sandbox_init_point: response.sandbox_init_point,
    };
  }

  async getMerchantOrder(merchantOrderId: string): Promise<MercadoPagoMerchantOrder> {
    try {
      this.logger.log(`Obteniendo merchant order: ${merchantOrderId}`);
      const response = await this.makeRequest<MercadoPagoMerchantOrder>(
        'GET',
        `/merchant_orders/${merchantOrderId}`,
      );
      this.logger.debug(`Merchant order obtenida: ${JSON.stringify(response, null, 2)}`);
      return response;
    } catch (error) {
      this.logger.error(
        `Error obteniendo merchant order ${merchantOrderId}: ${error.message}`,
        error.stack,
      );
      throw new Error(`Error al obtener merchant order: ${error.message}`);
    }
  }

  async verifyMerchantOrderPayment(merchantOrderId: string): Promise<{
    approved: boolean;
    status: string;
    statusDetail: string;
    paymentData?: any;
  }> {
    try {
      const merchantOrder = await this.getMerchantOrder(merchantOrderId);

      // Verificar si hay pagos en la orden
      if (!merchantOrder.payments || merchantOrder.payments.length === 0) {
        return {
          approved: false,
          status: 'no_payments',
          statusDetail: 'No hay pagos asociados a esta orden',
        };
      }

      // Buscar el primer pago aprobado
      const approvedPayment = merchantOrder.payments.find(payment => payment.status === 'approved');

      if (approvedPayment) {
        return {
          approved: true,
          status: 'approved',
          statusDetail: approvedPayment.status_detail,
          paymentData: {
            paymentId: approvedPayment.id,
            transactionAmount: approvedPayment.transaction_amount,
            totalPaidAmount: approvedPayment.total_paid_amount,
            currencyId: approvedPayment.currency_id,
            operationType: approvedPayment.operation_type,
            dateApproved: approvedPayment.date_approved,
            dateCreated: approvedPayment.date_created,
            lastModified: approvedPayment.last_modified,
            merchantOrder: {
              id: merchantOrder.id,
              status: merchantOrder.status,
              orderStatus: merchantOrder.order_status,
              totalAmount: merchantOrder.total_amount,
              paidAmount: merchantOrder.paid_amount,
              siteId: merchantOrder.site_id,
              isTest: merchantOrder.is_test,
              payerEmail: merchantOrder.payer.email,
              payerId: merchantOrder.payer.id,
              collectorId: merchantOrder.collector.id,
              collectorEmail: merchantOrder.collector.email,
              preferenceId: merchantOrder.preference_id,
              externalReference: merchantOrder.external_reference,
            },
          },
        };
      }

      // Si no hay pagos aprobados, verificar otros estados
      const latestPayment = merchantOrder.payments[merchantOrder.payments.length - 1];
      return {
        approved: false,
        status: latestPayment.status,
        statusDetail: latestPayment.status_detail,
        paymentData: {
          paymentId: latestPayment.id,
          transactionAmount: latestPayment.transaction_amount,
          currencyId: latestPayment.currency_id,
          operationType: latestPayment.operation_type,
          dateCreated: latestPayment.date_created,
          lastModified: latestPayment.last_modified,
          merchantOrder: {
            id: merchantOrder.id,
            status: merchantOrder.status,
            orderStatus: merchantOrder.order_status,
            totalAmount: merchantOrder.total_amount,
            paidAmount: merchantOrder.paid_amount,
            siteId: merchantOrder.site_id,
            isTest: merchantOrder.is_test,
            payerEmail: merchantOrder.payer.email,
            payerId: merchantOrder.payer.id,
            collectorId: merchantOrder.collector.id,
            collectorEmail: merchantOrder.collector.email,
            preferenceId: merchantOrder.preference_id,
            externalReference: merchantOrder.external_reference,
          },
        },
      };
    } catch (error) {
      this.logger.error(
        `Error verificando merchant order payment ${merchantOrderId}: ${error.message}`,
        error.stack,
      );
      return {
        approved: false,
        status: 'error',
        statusDetail: error.message,
      };
    }
  }
}
