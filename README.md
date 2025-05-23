# tg-clean-bot

Telegram bot construido con **NestJS**, **MongoDB** y pagos cripto mediante **NOWPayments**.  
Sigue una arquitectura modular/clean e incluye:

* Comandos `/start` y `/buy` con flujo de compra en vivo.
* Colecciones Mongo: `users`, `conversations`, `payments`.
* Webhook `/webhook/nowpay` para recibir IPN seguros (firma HMAC).
* Dockerfile + docker‑compose para entorno local.

---

## Requisitos

* Node 20+
* Docker (opcional pero recomendado)
* MongoDB (si no usas Docker, instala localmente)
* Bot Token de Telegram (`BotFather`)
* Cuenta en [NOWPayments](https://nowpayments.io/) con IPN habilitado

---

## Running rápido (Docker)

```bash
cp .env.example .env                     # completa valores reales
docker compose up --build
```

* `bot` escucha en **http://localhost:3000**  
* Telegram usa *long‑polling* en dev; en producción configura webhook.

---

## Running local (sin Docker)

```bash
npm install
npm run start:dev
```

Asegúrate de que `MONGODB_URI` apunte a tu instancia local.

---

## Configuración de Webhook (producción)

Supón que tu bot corre en `https://mi-bot.com`, expón `/telegram`:

```bash
curl -X POST "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook" \
     -d "url=https://mi-bot.com/telegram"
```

El módulo `nestjs-telegraf` registra el handler automáticamente.

---

## Flujo de compra

1. Usuario envía `/buy`.
2. Elige uno de los packs (inline keyboard).
3. Se genera **invoice** via NOWPayments → se devuelve URL.
4. Usuario paga; NOWPayments envía IPN a `/webhook/nowpay`.
5. El servidor valida la firma y marca el pago como `confirmed`.
6. (Ejemplo) aquí podrías sumar `credits` al usuario.

---

## Estructura de carpetas

```
src/
├─ config/          # validación de env
├─ db/              # mongoose schemas + repos
├─ telegram/        # módulos y handlers del bot
├─ payments/        # integración NOWPayments
└─ main.ts
```

---

## Notas de seguridad

* **Nunca** hagas commit de tu `.env`.
* El IPN se verifica con `x-nowpayments-signature` (HMAC‑SHA512).
* Limita accesos al endpoint `/webhook/nowpay` por red o API Gateway si es posible.

---

### Próximos pasos sugeridos

* Agregar tests unit y e2e (`@nestjs/testing`, `supertest`).
* Implementar `Scenes` de Telegraf para flujos multistep más complejos.
* Expander `PaymentsService` para acreditar balance/credits automáticamente.
