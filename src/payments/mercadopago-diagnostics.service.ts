import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MercadoPagoService } from './mercadopago.service';

@Injectable()
export class MercadoPagoDiagnosticsService {
  private readonly logger = new Logger(MercadoPagoDiagnosticsService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly mercadoPagoService: MercadoPagoService,
  ) {}

  async runDiagnostics(): Promise<{
    success: boolean;
    errors: string[];
    warnings: string[];
    configuration: any;
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const configuration: any = {};

    this.logger.log('Iniciando diagnóstico de MercadoPago...');

    // 1. Verificar variables de entorno
    const accessToken = this.configService.get<string>('MERCADOPAGO_ACCESS_TOKEN');
    const baseUrl = this.configService.get<string>('BASE_URL');
    const nodeEnv = this.configService.get<string>('NODE_ENV');

    configuration.nodeEnv = nodeEnv;
    configuration.isProduction = this.mercadoPagoService.isProduction;
    configuration.hasAccessToken = !!accessToken;
    configuration.hasBaseUrl = !!baseUrl;
    configuration.baseUrl = baseUrl;

    if (!accessToken) {
      errors.push('MERCADOPAGO_ACCESS_TOKEN no está configurada');
    } else {
      // Verificar formato del token
      if (accessToken.startsWith('TEST-')) {
        configuration.tokenType = 'TEST';
        if (this.mercadoPagoService.isProduction) {
          warnings.push('Usando token de TEST en ambiente de PRODUCCIÓN');
        }
      } else if (accessToken.startsWith('APP_USR-')) {
        configuration.tokenType = 'PRODUCTION';
        if (!this.mercadoPagoService.isProduction) {
          warnings.push('Usando token de PRODUCCIÓN en ambiente de TEST');
        }
      } else {
        errors.push('Formato de token no reconocido. Debe empezar con TEST- o APP_USR-');
      }

      // Mostrar info del token (sin revelar el token completo)
      const tokenPreview = accessToken.substring(0, 12) + '***' + accessToken.substring(accessToken.length - 4);
      configuration.tokenPreview = tokenPreview;
    }

    if (!baseUrl) {
      errors.push('BASE_URL no está configurada');
    } else {
      configuration.webhookUrl = `${baseUrl}/webhook/mercadopago`;
      
      // Verificar que la URL sea válida
      try {
        new URL(baseUrl);
      } catch {
        errors.push('BASE_URL no es una URL válida');
      }
    }

    // 2. Probar creación de preferencia con datos de prueba
    if (errors.length === 0) {
      try {
        this.logger.log('Probando creación de preferencia...');
        
        const testPreference = await this.mercadoPagoService.createPreference({
          amount: 100,
          description: 'Test de diagnóstico - Pack Premium',
          external_reference: `test-${Date.now()}`,
        });

        configuration.testPreferenceCreated = true;
        configuration.testPreferenceId = testPreference.id;
        
        this.logger.log(`Preferencia de prueba creada exitosamente: ${testPreference.id}`);
        
      } catch (error) {
        errors.push(`Error creando preferencia de prueba: ${error.message}`);
        configuration.testPreferenceCreated = false;
      }
    }

    // 3. Resultados del diagnóstico
    const success = errors.length === 0;
    
    this.logger.log(`Diagnóstico completado. Éxito: ${success}`);
    if (errors.length > 0) {
      this.logger.error(`Errores encontrados: ${errors.join(', ')}`);
    }
    if (warnings.length > 0) {
      this.logger.warn(`Advertencias: ${warnings.join(', ')}`);
    }

    return {
      success,
      errors,
      warnings,
      configuration
    };
  }

  async validatePaymentData(amount: number, description: string, externalReference: string): Promise<{
    valid: boolean;
    errors: string[];
  }> {
    const errors: string[] = [];

    // Validaciones específicas que pueden causar PXB01
    if (!amount || isNaN(amount) || amount <= 0) {
      errors.push('El monto debe ser un número mayor a 0');
    }

    if (amount > 999999999.99) {
      errors.push('El monto es demasiado alto (máximo: 999,999,999.99)');
    }

    if (!description || description.trim() === '') {
      errors.push('La descripción es requerida');
    }

    if (description && description.length > 256) {
      errors.push('La descripción no puede exceder 256 caracteres');
    }

    if (!externalReference || externalReference.trim() === '') {
      errors.push('La referencia externa es requerida');
    }

    if (externalReference && externalReference.length > 256) {
      errors.push('La referencia externa no puede exceder 256 caracteres');
    }

    // Verificar caracteres especiales que pueden causar problemas
    const invalidChars = /[<>\"\'&]/;
    if (description && invalidChars.test(description)) {
      errors.push('La descripción contiene caracteres no permitidos: < > " \' &');
    }

    if (externalReference && invalidChars.test(externalReference)) {
      errors.push('La referencia externa contiene caracteres no permitidos: < > " \' &');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
} 