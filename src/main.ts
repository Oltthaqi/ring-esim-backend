import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';
import { AllExceptionsFilter } from './http-exception.filter';
import * as bodyParser from 'body-parser';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug'],
  });
  const rawJsonMiddleware = bodyParser.raw({ type: 'application/json' });

  app.use('/api/calendly/webhook', rawJsonMiddleware);
  app.use('/api/payments/webhook', rawJsonMiddleware);

  app.setGlobalPrefix('api');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());

  app.enableCors({
    origin: '*',
    methods: ['GET', 'POST', 'DELETE', 'PATCH', 'PUT', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  const config = new DocumentBuilder()
    .setTitle('Internet Kudo API')
    .setDescription('API documentation for Internet Kudo backend')
    .setVersion('1.0')
    .addTag('Internet Kudo')
    .addBearerAuth()
    .addSecurityRequirements('bearer')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/swagger', app, document);

  await app.listen(process.env.PORT || 3000, process.env.HOST || '0.0.0.0');
}
void bootstrap();
