import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { Pack } from '../telegram/constants/packs';

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

@Injectable()
export class MercadoPagoService {
  private readonly logger = new Logger(MercadoPagoService.name);
  private readonly accessToken: string;
  private readonly baseUrl: string;
  private readonly apiBase = 'https://api.mercadopago.com';
  readonly isProduction: boolean;
  private currencyId: string = 'ARS'; // Default currency

  constructor(
    private readonly configService: ConfigService,
  ) {
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
          'Authorization': `Bearer ${this.accessToken}`,
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

  async createPreference(payload: MercadoPagoPreferenceRequest): Promise<MercadoPagoPreferenceResponse> {
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
    console.log("🚀 ~ MercadoPagoService ~ createPreference ~ this.baseUrl:", this.baseUrl)

          const preferenceData = {
        items: [{
          id: payload.external_reference,
          title: payload.description.substring(0, 256), // MercadoPago limita el título a 256 caracteres
          quantity: 1,
          unit_price: Number(Number(payload.amount).toFixed(2)), // Asegurar formato decimal correcto
          currency_id: this.currencyId
        }],
        external_reference: payload.external_reference,
        auto_return: 'approved',
        back_urls: {
          success: `${this.baseUrl}/api/webhook/mercadopago/success`,
          failure: `${this.baseUrl}/api/webhook/mercadopago/failure`,
          pending: `${this.baseUrl}/api/webhook/mercadopago/pending`
        },
        notification_url: `${this.baseUrl}/api/webhook/mercadopago`
      };

    this.logger.debug(`Datos de preferencia a enviar: ${JSON.stringify(preferenceData, null, 2)}`);

    const response = await this.makeRequest<any>('POST', '/checkout/preferences', preferenceData);
    
    return {
      id: response.id,
      init_point: response.init_point,
      sandbox_init_point: response.sandbox_init_point
    };
  }

  async verifyPayment(paymentId: string): Promise<{ approved: boolean; status: string; statusDetail: string }> {
    try {
      let response: any;
      try {
        response = await this.makeRequest<any>('GET', `/checkout/preferences/${paymentId}`);
        console.log("🚀 ~ MercadoPagoService ~ verifyPayment ~ respons1e:", response)
      } catch (error) {
        this.logger.debug(`Error al obtener la preferencia: ${error.message}`, error.stack);
        response = await this.makeRequest<any>('GET', `/v1/payments/${paymentId}`);
        console.log("🚀 ~ MercadoPagoService ~ verifyPayment ~ response2:", response)
      }

      
      return {
        approved: response.status === 'approved',
        status: response.status,
        statusDetail: response.status_detail || 'No hay detalles disponibles'
      };
    } catch (error) {
      this.logger.error(`Error verificando pago: ${error.message}`, error.stack);
      return {
        approved: false,
        status: 'error',
        statusDetail: error.message
      };
    }
  }

  async cancelPayment(paymentId: string): Promise<void> {
    try {
      // Primero obtenemos el estado actual del pago
      const paymentInfo = await this.makeRequest<any>('GET', `/v1/payments/${paymentId}`);
      
      // Solo intentamos cancelar si el pago está en un estado que permite cancelación
      if (paymentInfo.status === 'pending' || paymentInfo.status === 'in_process') {
        await this.makeRequest('PUT', `/v1/payments/${paymentId}`, {
          status: 'cancelled'
        });
        this.logger.debug(`Pago ${paymentId} cancelado exitosamente`);
      } else {
        this.logger.warn(`El pago ${paymentId} no puede ser cancelado. Estado actual: ${paymentInfo.status}`);
        throw new Error(`El pago no puede ser cancelado en su estado actual: ${paymentInfo.status}`);
      }
    } catch (error) {
      this.logger.error(`Error cancelando pago ${paymentId}: ${error.message}`, error.stack);
      throw new Error(`Error al cancelar el pago: ${error.message}`);
    }
  }

  async processRefund(paymentId: string, amount?: number): Promise<{ success: boolean; refundId?: string; status?: string; error?: string }> {
    try {
      // Primero verificamos que el pago existe y está aprobado
      const paymentInfo = await this.makeRequest<any>('GET', `/v1/payments/${paymentId}`);
      
      if (paymentInfo.status !== 'approved') {
        throw new Error(`El pago no está aprobado. Estado actual: ${paymentInfo.status}`);
      }

      // Preparar datos de la devolución
      const refundData: any = {};
      
      // Si se especifica un monto, usarlo; si no, devolver el monto completo
      if (amount && amount > 0) {
        if (amount > paymentInfo.transaction_amount) {
          throw new Error(`El monto de devolución (${amount}) no puede ser mayor al monto del pago (${paymentInfo.transaction_amount})`);
        }
        refundData.amount = Number(Number(amount).toFixed(2));
      }

      this.logger.log(`Procesando devolución para pago ${paymentId}, monto: ${refundData.amount || 'completo'}`);

      // Crear la devolución
      const refundResponse = await this.makeRequest<any>('POST', `/v1/payments/${paymentId}/refunds`, refundData);

      this.logger.log(`Devolución creada exitosamente: ${refundResponse.id}`);

      return {
        success: true,
        refundId: refundResponse.id,
        status: refundResponse.status
      };

    } catch (error) {
      this.logger.error(`Error procesando devolución para pago ${paymentId}: ${error.message}`, error.stack);
      return {
        success: false,
        error: error.message
      };
    }
  }
} 