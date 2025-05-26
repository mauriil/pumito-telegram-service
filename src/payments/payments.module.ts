import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { HttpModule } from '@nestjs/axios';
import { Payment, PaymentSchema } from '../db/schemas/payment.schema';
import { PaymentsService } from '../db/payments.service';
import { MercadoPagoService } from './mercadopago.service';
import { MercadoPagoController } from './mercadopago.controller';
import { PaymentsController } from './payments.controller';
import { MercadoPagoDiagnosticsService } from './mercadopago-diagnostics.service';
import { SharedModule } from '../shared/shared.module';
import { TelegramModule } from '../telegram/telegram.module';

@Module({
  imports: [
    SharedModule,
    HttpModule,
    forwardRef(() => TelegramModule),
    MongooseModule.forFeature([{ name: Payment.name, schema: PaymentSchema }]),
  ],
  controllers: [MercadoPagoController, PaymentsController],
  providers: [PaymentsService, MercadoPagoService, MercadoPagoDiagnosticsService],
  exports: [PaymentsService, MercadoPagoService, MercadoPagoDiagnosticsService],
})
export class PaymentsModule {}
