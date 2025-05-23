# tg-clean-bot

Telegram bot construido con **NestJS**, **MongoDB** y pagos mediante **MercadoPago**.  
Sigue una arquitectura modular/clean e incluye:

* Comandos `/start` y `/buy` con flujo de compra en vivo.
* Colecciones Mongo: `users`, `conversations`, `payments`.
* Webhook `/webhook/mercadopago` para recibir notificaciones de pagos.

---

## Requisitos

* Node 20+
* MongoDB (instalación local o servicio en la nube)
* Bot Token de Telegram (`BotFather`)
* Cuenta en [MercadoPago](https://www.mercadopago.com.ar/) con API habilitada

---

## Instalación y Configuración

1. Clona el repositorio:
```bash
git clone <url-del-repositorio>
cd tg-clean-bot
```

2. Instala las dependencias:
```bash
npm install
```

3. Configura las variables de entorno:
```bash
cp .env.example .env
```
Edita el archivo `.env` con tus credenciales:
- `TELEGRAM_BOT_TOKEN`: Token de tu bot de Telegram
- `MONGODB_URI`: URI de conexión a MongoDB
- `MERCADOPAGO_ACCESS_TOKEN`: Access Token de MercadoPago
- `MERCADOPAGO_PUBLIC_KEY`: Public Key de MercadoPago

4. Inicia el servidor en modo desarrollo:
```bash
npm run start:dev
```

El bot estará disponible en **http://localhost:3000**

---

## Configuración de Webhook (producción)

Para configurar el webhook en producción, asumiendo que tu bot corre en `https://mi-bot.com`:

```bash
curl -X POST "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook" \
     -d "url=https://mi-bot.com/telegram"
```

El módulo `nestjs-telegraf` registra el handler automáticamente.

---

## Flujo de compra

1. Usuario envía `/buy`
2. Elige uno de los packs (inline keyboard)
3. Se genera **preferencia de pago** via MercadoPago → se devuelve URL
4. Usuario paga; MercadoPago envía notificación a `/webhook/mercadopago`
5. El servidor valida la notificación y marca el pago como `confirmed`
6. Se actualiza el balance/credits del usuario

---

## Estructura del Proyecto

```
src/
├─ config/          # validación de variables de entorno
├─ db/              # schemas y repositorios de MongoDB
├─ telegram/        # módulos y handlers del bot
├─ payments/        # integración con MercadoPago
└─ main.ts          # punto de entrada de la aplicación
```

---

## Scripts Disponibles

* `npm run start:dev`: Inicia el servidor en modo desarrollo con hot-reload
* `npm run build`: Compila el proyecto
* `npm run start:prod`: Inicia el servidor en modo producción
* `npm run test`: Ejecuta los tests unitarios
* `npm run test:e2e`: Ejecuta los tests end-to-end
* `npm run lint`: Ejecuta el linter
* `npm run format`: Formatea el código

---

## Despliegue en Render

1. Crea una cuenta en [Render](https://render.com)

2. Crea un nuevo Web Service:
   - Conecta tu repositorio de GitHub
   - Selecciona la rama a desplegar
   - Configura el servicio:
     - **Runtime**: Node
     - **Build Command**: `npm install && npm run build`
     - **Start Command**: `npm run start:prod`
     - **Node Version**: 20.x

3. Configura las variables de entorno en Render:
   ```
   TELEGRAM_BOT_TOKEN=tu_token
   MONGODB_URI=tu_uri_mongodb
   MERCADOPAGO_ACCESS_TOKEN=tu_access_token
   MERCADOPAGO_PUBLIC_KEY=tu_public_key
   NODE_ENV=production
   ```

4. Configura el webhook de Telegram:
   ```bash
   curl -X POST "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook" \
        -d "url=https://tu-app.onrender.com/telegram"
   ```

5. Verifica el despliegue:
   - Revisa los logs en Render
   - Prueba el comando `/start` en tu bot
   - Verifica que los pagos funcionen correctamente

---

## Notas de Seguridad

* **Nunca** hagas commit de tu archivo `.env`
* Verifica las notificaciones de MercadoPago usando el `x-signature` header
* Limita accesos al endpoint `/webhook/mercadopago` por red o API Gateway
* Usa HTTPS en producción
* Implementa rate limiting para los endpoints públicos

---

## Próximos Pasos Sugeridos

* Implementar tests unitarios y e2e
* Agregar `Scenes` de Telegraf para flujos más complejos
* Expandir el sistema de pagos con más métodos
* Implementar sistema de logs y monitoreo
* Agregar documentación con Swagger
