import { INestApplication } from '@nestjs/common';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { PasswordService } from '../../src/auth/password/password.service';
import { API, createTestHarness } from '../app-harness';
import { truncateAll } from '../test-database';

/** PNG 1x1 válido — pequeno o bastante para caber no limite de 1MB. */
const PNG_1PX_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
const PNG_1PX_BUFFER = Buffer.from(PNG_1PX_BASE64, 'base64');

/**
 * Logo da empresa — upload (superuser), serve público (imagem) e remoção.
 *
 * A pasta onde a logo é gravada é um diretório temporário isolado: a suíte não
 * pode deixar arquivos de teste no `media/logo` do repositório.
 */
describe('Logo da empresa (parâmetros)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let close: () => Promise<void>;
  let logoDir: string;

  const PASSWORD = 'Senha@123';
  let clientToken: string;
  let technicianToken: string;
  let superuserToken: string;

  beforeAll(async () => {
    // Antes de `loadConfig` do app: redireciona a pasta da logo para um temp.
    logoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hd-logo-'));
    process.env.LOGO_DIR = logoDir;

    const harness = await createTestHarness();
    app = harness.app;
    prisma = harness.prisma;
    close = harness.close;
  });

  afterAll(async () => {
    await close();
    fs.rmSync(logoDir, { recursive: true, force: true });
  });

  beforeEach(async () => {
    await truncateAll(prisma);
    await fs.promises.rm(logoDir, { recursive: true, force: true });
    await fs.promises.mkdir(logoDir, { recursive: true });

    const passwordHash = await new PasswordService().hash(PASSWORD);
    await prisma.user.createMany({
      data: [
        { name: 'Cliente', email: 'cliente@example.com', passwordHash, role: 'client' },
        {
          name: 'Tecnico',
          email: 'tecnico@example.com',
          passwordHash,
          role: 'technician',
        },
        {
          name: 'Super',
          email: 'super@example.com',
          passwordHash,
          role: 'technician',
          isSuperuser: true,
        },
      ],
    });

    [clientToken, technicianToken, superuserToken] = await Promise.all([
      loginAs('cliente@example.com'),
      loginAs('tecnico@example.com'),
      loginAs('super@example.com'),
    ]);
  });

  async function loginAs(email: string): Promise<string> {
    const response = await request(app.getHttpServer())
      .post(`${API}/auth/login`)
      .send({ email, password: PASSWORD })
      .expect(200);
    return response.body.accessToken;
  }

  function upload(payload: {
    contentType?: string;
    dataBase64?: string;
    fileName?: string;
  }) {
    return request(app.getHttpServer())
      .post(`${API}/parameters/logo`)
      .set('Authorization', `Bearer ${superuserToken}`)
      .send(payload);
  }

  /** GET da logo como binary (funciona tanto para 200 quanto para 401/403/404). */
  async function fetchLogo(): Promise<{
    status: number;
    contentType: string;
    contentLength: string;
    body: Buffer;
  }> {
    const res = await request(app.getHttpServer())
      .get(`${API}/parameters/logo`)
      .buffer(true)
      .parse((response, callback) => {
        const chunks: Buffer[] = [];
        response.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
        response.on('end', () => callback(null, Buffer.concat(chunks)));
      })
      .then((r) => r)
      .catch((err) => err.response);

    return {
      status: res.status,
      contentType: String(res.headers['content-type'] ?? ''),
      contentLength: String(res.headers['content-length'] ?? ''),
      body: res.body as Buffer,
    };
  }

  // =========================================================================
  describe('autorização — escrita é superuser-only', () => {
    it.each([
      ['cliente', () => clientToken],
      ['técnico comum', () => technicianToken],
    ])('%s não envia a logo', async (_label, token) => {
      await request(app.getHttpServer())
        .post(`${API}/parameters/logo`)
        .set('Authorization', `Bearer ${token()}`)
        .send({ contentType: 'image/png', dataBase64: PNG_1PX_BASE64 })
        .expect(403);
    });

    it.each([
      ['cliente', () => clientToken],
      ['técnico comum', () => technicianToken],
    ])('%s não remove a logo', async (_label, token) => {
      await request(app.getHttpServer())
        .delete(`${API}/parameters/logo`)
        .set('Authorization', `Bearer ${token()}`)
        .expect(403);
    });

    it('upload sem token é 401', async () => {
      await request(app.getHttpServer())
        .post(`${API}/parameters/logo`)
        .send({ contentType: 'image/png', dataBase64: PNG_1PX_BASE64 })
        .expect(401);
    });

    it('remoção sem token é 401', async () => {
      await request(app.getHttpServer()).delete(`${API}/parameters/logo`).expect(401);
    });
  });

  // =========================================================================
  describe('upload (superuser)', () => {
    it('grava um PNG, devolve o nome do arquivo e o tamanho', async () => {
      const response = await upload({
        contentType: 'image/png',
        dataBase64: PNG_1PX_BASE64,
      }).expect(200);

      expect(response.body).toEqual({
        companyLogo: 'logo.png',
        size: PNG_1PX_BUFFER.length,
        contentType: 'image/png',
      });

      const onDisk = await fs.promises.readFile(path.join(logoDir, 'logo.png'));
      expect(onDisk.equals(PNG_1PX_BUFFER)).toBe(true);
    });

    it('aceita cada tipo suportado e grava com a extensão correta', async () => {
      const cases: Array<[string, string]> = [
        ['image/png', 'logo.png'],
        ['image/jpeg', 'logo.jpeg'],
        ['image/webp', 'logo.webp'],
        ['image/gif', 'logo.gif'],
        ['image/svg+xml', 'logo.svg'],
      ];
      for (const [contentType, expected] of cases) {
        const response = await upload({
          contentType,
          dataBase64: PNG_1PX_BASE64,
        }).expect(200);
        expect(response.body.companyLogo).toBe(expected);
        expect(await fs.promises.stat(path.join(logoDir, expected))).toBeTruthy();
      }
    });

    it('remove o prefixo data:...;base64 antes de codificar', async () => {
      const response = await upload({
        contentType: 'image/png',
        dataBase64: `data:image/png;base64,${PNG_1PX_BASE64}`,
      }).expect(200);

      expect(response.body.size).toBe(PNG_1PX_BUFFER.length);
      const served = await fetchLogo();
      expect(served.status).toBe(200);
      expect(served.body.equals(PNG_1PX_BUFFER)).toBe(true);
    });

    it('substitui a logo anterior (não acumula arquivos)', async () => {
      await upload({ contentType: 'image/gif', dataBase64: PNG_1PX_BASE64 }).expect(
        200,
      );
      await upload({ contentType: 'image/png', dataBase64: PNG_1PX_BASE64 }).expect(
        200,
      );

      const entries = (await fs.promises.readdir(logoDir)).sort();
      expect(entries).toEqual(['logo.png']);
    });

    it.each(['image/bmp', 'image/tiff', 'text/plain'])(
      'rejeita tipo não suportado: %s',
      async (contentType) => {
        await upload({ contentType, dataBase64: PNG_1PX_BASE64 }).expect(400);
      },
    );

    it('rejeita quando falta o dataBase64', async () => {
      await upload({ contentType: 'image/png' }).expect(400);
    });

    it('rejeita dataBase64 vazio', async () => {
      await request(app.getHttpServer())
        .post(`${API}/parameters/logo`)
        .set('Authorization', `Bearer ${superuserToken}`)
        .send({ contentType: 'image/png', dataBase64: '   ' })
        .expect(400);
    });

    it('rejeita imagem acima de 1MB', async () => {
      const oversized = Buffer.alloc(1024 * 1024 + 1);
      await upload({
        contentType: 'image/png',
        dataBase64: oversized.toString('base64'),
      }).expect(400);
      expect(await fs.promises.readdir(logoDir)).toEqual([]);
    });
  });

  // =========================================================================
  describe('serve — GET /parameters/logo', () => {
    it('é público e devolve 404 quando não há logo', async () => {
      // Sem token nenhum: @Public() pula o guard de autenticação.
      const res = await request(app.getHttpServer())
        .get(`${API}/parameters/logo`)
        .catch((err) => err.response);
      expect(res.status).toBe(404);
    });

    it('serve a imagem com o content-type correto e o buffer exato', async () => {
      await upload({ contentType: 'image/png', dataBase64: PNG_1PX_BASE64 }).expect(
        200,
      );

      const served = await fetchLogo();
      expect(served.status).toBe(200);
      expect(served.contentType).toContain('image/png');
      expect(served.contentLength).toBe(String(PNG_1PX_BUFFER.length));
      expect(served.body.equals(PNG_1PX_BUFFER)).toBe(true);
    });

    it('é cacheável e revalida com 304 (o cabeçalho não pisca a cada navegação)', async () => {
      await upload({ contentType: 'image/png', dataBase64: PNG_1PX_BASE64 }).expect(
        200,
      );

      const first = await request(app.getHttpServer()).get(`${API}/parameters/logo`);
      expect(first.status).toBe(200);
      expect(first.headers['cache-control']).toContain('max-age=');
      expect(first.headers['cache-control']).not.toContain('no-store');
      expect(first.headers.etag).toBeTruthy();

      // Mesma logo: o navegador revalida e recebe 304 (sem baixar de novo).
      const revalidated = await request(app.getHttpServer())
        .get(`${API}/parameters/logo`)
        .set('If-None-Match', first.headers.etag as string);
      expect(revalidated.status).toBe(304);
    });

    it('serve o SVG com content-type image/svg+xml', async () => {
      await upload({ contentType: 'image/svg+xml', dataBase64: PNG_1PX_BASE64 }).expect(
        200,
      );

      const served = await fetchLogo();
      expect(served.status).toBe(200);
      expect(served.contentType).toContain('image/svg+xml');
    });
  });

  // =========================================================================
  describe('remoção (superuser)', () => {
    it('limpa o parâmetro, remove o arquivo e o serve volta a 404', async () => {
      await upload({ contentType: 'image/png', dataBase64: PNG_1PX_BASE64 }).expect(
        200,
      );
      expect((await fetchLogo()).status).toBe(200);

      const response = await request(app.getHttpServer())
        .delete(`${API}/parameters/logo`)
        .set('Authorization', `Bearer ${superuserToken}`)
        .expect(200);

      expect(response.body).toEqual({ companyLogo: '' });
      expect(await fs.promises.readdir(logoDir)).toEqual([]);

      const param = await prisma.systemParameter.findUnique({
        where: { key: 'company_logo' },
      });
      expect(param?.value).toBe('');
      expect((await fetchLogo()).status).toBe(404);
    });

    it('é idempotente: remover sem logo não falha', async () => {
      await request(app.getHttpServer())
        .delete(`${API}/parameters/logo`)
        .set('Authorization', `Bearer ${superuserToken}`)
        .expect(200);
    });
  });
});
