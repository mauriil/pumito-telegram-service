import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  // Configuración de seguridad
  app.use(helmet());
  app.enableCors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });

  // Configuración de validación global
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Configuración de Swagger
  const config = new DocumentBuilder()
    .setTitle('Pumito Telegram Gaming Bot API')
    .setDescription(`
    ### Comprehensive API Documentation for Pumito Telegram Gaming Bot
    
    This API provides comprehensive endpoints for managing:
    - 👤 **Users**: User management, profiles, and statistics
    - 🎮 **Games**: Game sessions, templates, and management
    - 💳 **Credit Packs**: In-app purchase packages and transactions  
    - 💰 **Payments**: Payment processing and webhook handling
    - 📊 **Analytics**: Game statistics and user insights
    
    #### Authentication
    Most endpoints require proper authentication. Use the Bearer token in the Authorization header.
    
    #### Response Format
    All endpoints return responses in the following format:
    \`\`\`json
    {
      "success": boolean,
      "data": any,
      "message": string,
      "timestamp": string (ISO),
      "path": string
    }
    \`\`\`
    
    #### Error Handling
    Errors follow standard HTTP status codes:
    - **400**: Bad Request - Invalid input parameters
    - **401**: Unauthorized - Authentication required
    - **403**: Forbidden - Insufficient permissions
    - **404**: Not Found - Resource doesn't exist
    - **422**: Unprocessable Entity - Validation errors
    - **500**: Internal Server Error - Server-side issues
    
    #### Rate Limiting
    API calls are rate-limited to ensure fair usage and system stability.
    `)
    .setVersion('1.0.0')
    .setContact('Development Team', 'https://t.me/your_support_bot', 'support@yourgamingbot.com')
    .setLicense('Proprietary', 'https://yourdomain.com/license')
    .addServer('http://localhost:3000', 'Development Server')
    .addServer('https://api.yourgamingbot.com', 'Production Server')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Enter JWT token',
        in: 'header',
      },
      'JWT-auth',
    )
    .addApiKey(
      {
        type: 'apiKey',
        name: 'X-API-Key',
        in: 'header',
        description: 'API Key for server-to-server communication',
      },
      'API-Key',
    )
    .addTag('Users', 'User management and profile operations')
    .addTag('Games', 'Game sessions and template management')
    .addTag('Credit Packs', 'In-app purchase packages and credit management')
    .addTag('Payments', 'Payment processing and transaction handling')
    .addTag('Game Templates', 'Game type definitions and configurations')
    .addTag('Analytics', 'Statistics and reporting endpoints')
    .addTag('Admin', 'Administrative and maintenance operations')
    .build();

  const document = SwaggerModule.createDocument(app, config, {
    operationIdFactory: (controllerKey: string, methodKey: string) => methodKey,
  });

  SwaggerModule.setup('api-docs', app, document, {
    customSiteTitle: 'Gaming Bot API Documentation',
    customfavIcon: '/favicon.ico',
    customCss: `
      .swagger-ui .topbar { display: none }
      .swagger-ui .info .title { color: #1976d2; }
      .swagger-ui .scheme-container { background: #fafafa; padding: 15px; }
    `,
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
      filter: true,
      showExtensions: true,
      showCommonExtensions: true,
      docExpansion: 'none',
      defaultModelsExpandDepth: 2,
      defaultModelExpandDepth: 2,
    },
  });

  // Configuración de prefijos globales
  app.setGlobalPrefix('api');

  const port = process.env.PORT || 3000;
  await app.listen(port);
  logger.log(`🚀 Application is running on: http://localhost:${port}`);
  logger.log(`📚 Swagger documentation is available at: http://localhost:${port}/api-docs`);
  logger.log(`🔗 API Base URL: http://localhost:${port}/api`);
}

bootstrap();
