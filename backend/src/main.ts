import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { applyGlobalSetup } from './app-setup';
import { StructuredLogger } from './common/observability/structured-logger';
import { APP_CONFIG_NAMESPACE, AppConfig } from './config/configuration';
import { PrismaService } from './prisma/prisma.service';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  const configService = app.get(ConfigService);
  const config = configService.getOrThrow<AppConfig>(APP_CONFIG_NAMESPACE);

  // JSON só em produção: no terminal do desenvolvedor ele atrapalha mais do que
  // ajuda, e o coletor de logs não está lá para consumi-lo.
  app.useLogger(new StructuredLogger(config.nodeEnv === 'production'));

  // Prefixo, ValidationPipe, helmet e CORS ficam num ponto só, compartilhado
  // com o harness de testes.
  applyGlobalSetup(app, {
    apiPrefix: config.apiPrefix,
    corsOrigins: config.corsOrigins,
    // Só fora de produção: em desenvolvimento a mesma aplicação é aberta por
    // localhost, por 127.0.0.1, pelo emulador (10.0.2.2) e pelo IP da máquina.
    allowLocalNetworkOrigins: config.nodeEnv !== 'production',
  });

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Hope Desk API')
    .setDescription(
      'API REST do Hope Desk. Substitui progressivamente o monólito Flask.',
    )
    .setVersion('0.1.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'access-token',
    )
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup(`${config.apiPrefix}/docs`, app, document);

  app.get(PrismaService).enableShutdownHooks(app);
  app.enableShutdownHooks();

  await app.listen(config.port);

  new Logger('Bootstrap').log(
    `Hope Desk API em http://localhost:${config.port}/${config.apiPrefix} (${config.nodeEnv})`,
  );
}

void bootstrap();
