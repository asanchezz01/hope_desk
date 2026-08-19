import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import { applyGlobalSetup } from '../src/app-setup';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

export interface TestHarness {
  app: INestApplication;
  prisma: PrismaClient;
  close: () => Promise<void>;
}

/**
 * Sobe a aplicação real (mesmos guards, pipes e prefixo do main.ts) contra o
 * PostgreSQL efêmero de testes. Sem mocks: o objetivo é testar o comportamento
 * de ponta a ponta, incluindo autorização.
 */
export async function createTestHarness(): Promise<TestHarness> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  // Casa com o main.ts: desligamos o parser padrão do Nest (100kb, insuficiente
  // para a logo em base64) — o parser real é registrado em applyGlobalSetup.
  const app = moduleRef.createNestApplication({ bodyParser: false });

  // Mesma configuração do main.ts: sem isto a suíte testaria uma aplicação
  // sem headers de segurança nem CORS, justamente o que a Fase 11 introduz.
  applyGlobalSetup(app, {
    apiPrefix: 'api/v1',
    corsOrigins: ['http://localhost:8081'],
  });

  await app.init();

  const prisma = app.get(PrismaService);

  return {
    app,
    prisma,
    close: async () => {
      await app.close();
    },
  };
}

export const API = '/api/v1';
