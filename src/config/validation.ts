import * as Joi from 'joi';

export const validationSchema = Joi.object({
  TELEGRAM_BOT_TOKEN: Joi.string().required(),
  MONGODB_URI: Joi.string().required(),
  MERCADOPAGO_ACCESS_TOKEN: Joi.string().required(),
  BASE_URL: Joi.string().default('http://localhost:3000'),
  NODE_ENV: Joi.string().valid('development', 'production').default('development'),
});
