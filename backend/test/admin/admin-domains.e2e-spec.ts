import { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { PasswordService } from '../../src/auth/password/password.service';
import { API, createTestHarness } from '../app-harness';
import { truncateAll } from '../test-database';

/**
 * Fase 03 — módulos do sistema, parâmetros da empresa e pagamentos.
 *
 * O ponto central de autorização: as três áreas são **superuser-only** no
 * legado (`if not session.get("is_superuser", False)`), não apenas técnico.
 */
describe('Domínios administrativos (Fase 03)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let close: () => Promise<void>;

  const PASSWORD = 'Senha@123';
  let clientToken: string;
  let technicianToken: string;
  let superuserToken: string;

  beforeAll(async () => {
    const harness = await createTestHarness();
    app = harness.app;
    prisma = harness.prisma;
    close = harness.close;
  });

  afterAll(async () => {
    await close();
  });

  beforeEach(async () => {
    await truncateAll(prisma);

    const passwordHash = await new PasswordService().hash(PASSWORD);
    await prisma.user.createMany({
      data: [
        {
          name: 'Cliente',
          email: 'cliente@example.com',
          passwordHash,
          role: 'client',
        },
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

  // =========================================================================
  describe('módulos do sistema', () => {
    describe('autorização — superuser-only', () => {
      it.each([
        ['cliente', () => clientToken],
        ['técnico comum', () => technicianToken],
      ])('%s não lista módulos pela rota administrativa', async (_label, token) => {
        await request(app.getHttpServer())
          .get(`${API}/system-modules`)
          .set('Authorization', `Bearer ${token()}`)
          .expect(403);
      });

      it.each([
        ['cliente', () => clientToken],
        ['técnico comum', () => technicianToken],
      ])('%s não cadastra módulo', async (_label, token) => {
        await request(app.getHttpServer())
          .post(`${API}/system-modules`)
          .set('Authorization', `Bearer ${token()}`)
          .send({ name: 'Indevido' })
          .expect(403);

        expect(await prisma.systemModule.count()).toBe(0);
      });

      it('técnico comum não ativa nem desativa módulo', async () => {
        const created = await prisma.systemModule.create({
          data: { name: 'Financeiro' },
        });

        await request(app.getHttpServer())
          .post(`${API}/system-modules/${created.id}/toggle`)
          .set('Authorization', `Bearer ${technicianToken}`)
          .expect(403);

        const after = await prisma.systemModule.findUniqueOrThrow({
          where: { id: created.id },
        });
        expect(after.isActive).toBe(true);
      });

      it('a mensagem de erro identifica a exigência de superuser', async () => {
        const response = await request(app.getHttpServer())
          .get(`${API}/system-modules`)
          .set('Authorization', `Bearer ${technicianToken}`)
          .expect(403);
        expect(response.body.message).toMatch(/superuser/i);
      });

      it('módulos ativos são legíveis por qualquer autenticado', async () => {
        await prisma.systemModule.createMany({
          data: [
            { name: 'Ativo', isActive: true },
            { name: 'Inativo', isActive: false },
          ],
        });

        for (const token of [clientToken, technicianToken, superuserToken]) {
          const response = await request(app.getHttpServer())
            .get(`${API}/system-modules/active`)
            .set('Authorization', `Bearer ${token}`)
            .expect(200);

          expect(response.body).toHaveLength(1);
          expect(response.body[0].name).toBe('Ativo');
        }
      });

      it('módulos ativos exige autenticação', async () => {
        await request(app.getHttpServer())
          .get(`${API}/system-modules/active`)
          .expect(401);
      });
    });

    describe('CRUD (superuser)', () => {
      it('cadastra módulo ativo por padrão', async () => {
        const response = await request(app.getHttpServer())
          .post(`${API}/system-modules`)
          .set('Authorization', `Bearer ${superuserToken}`)
          .send({ name: 'Financeiro' })
          .expect(201);

        expect(response.body).toMatchObject({ name: 'Financeiro', isActive: true });
      });

      it('normaliza espaços no nome', async () => {
        const response = await request(app.getHttpServer())
          .post(`${API}/system-modules`)
          .set('Authorization', `Bearer ${superuserToken}`)
          .send({ name: '  Estoque  ' })
          .expect(201);

        expect(response.body.name).toBe('Estoque');
      });

      it('recusa nome vazio', async () => {
        for (const name of ['', '   ']) {
          await request(app.getHttpServer())
            .post(`${API}/system-modules`)
            .set('Authorization', `Bearer ${superuserToken}`)
            .send({ name })
            .expect(400);
        }
      });

      it('recusa nome duplicado', async () => {
        await request(app.getHttpServer())
          .post(`${API}/system-modules`)
          .set('Authorization', `Bearer ${superuserToken}`)
          .send({ name: 'Financeiro' })
          .expect(201);

        await request(app.getHttpServer())
          .post(`${API}/system-modules`)
          .set('Authorization', `Bearer ${superuserToken}`)
          .send({ name: 'Financeiro' })
          .expect(409);
      });

      it.each(['financeiro', 'FINANCEIRO', 'FiNaNcEiRo'])(
        'recusa nome duplicado sem diferenciar maiúsculas: %s',
        async (variant) => {
          await request(app.getHttpServer())
            .post(`${API}/system-modules`)
            .set('Authorization', `Bearer ${superuserToken}`)
            .send({ name: 'Financeiro' })
            .expect(201);

          const response = await request(app.getHttpServer())
            .post(`${API}/system-modules`)
            .set('Authorization', `Bearer ${superuserToken}`)
            .send({ name: variant })
            .expect(409);

          expect(response.body.message).toMatch(/já existe um módulo/i);
        },
      );

      it('o banco também impede duplicata case-insensitive', async () => {
        await prisma.systemModule.create({ data: { name: 'Financeiro' } });
        // Índice funcional lower(name), não só a checagem de aplicação.
        await expect(
          prisma.systemModule.create({ data: { name: 'financeiro' } }),
        ).rejects.toThrow(/system_module_name_lower_key|constraint/i);
      });

      it('lista ordenado por nome', async () => {
        await prisma.systemModule.createMany({
          data: [{ name: 'Zebra' }, { name: 'Alfa' }, { name: 'Meio' }],
        });

        const response = await request(app.getHttpServer())
          .get(`${API}/system-modules`)
          .set('Authorization', `Bearer ${superuserToken}`)
          .expect(200);

        expect(response.body.items.map((m: { name: string }) => m.name)).toEqual([
          'Alfa',
          'Meio',
          'Zebra',
        ]);
      });

      it('filtra por situação', async () => {
        await prisma.systemModule.createMany({
          data: [
            { name: 'Ativo', isActive: true },
            { name: 'Inativo', isActive: false },
          ],
        });

        const active = await request(app.getHttpServer())
          .get(`${API}/system-modules?isActive=true`)
          .set('Authorization', `Bearer ${superuserToken}`)
          .expect(200);
        expect(active.body.total).toBe(1);
        expect(active.body.items[0].name).toBe('Ativo');

        const inactive = await request(app.getHttpServer())
          .get(`${API}/system-modules?isActive=false`)
          .set('Authorization', `Bearer ${superuserToken}`)
          .expect(200);
        expect(inactive.body.total).toBe(1);
        expect(inactive.body.items[0].name).toBe('Inativo');
      });

      it('sem filtro devolve ativos e inativos', async () => {
        await prisma.systemModule.createMany({
          data: [
            { name: 'Ativo', isActive: true },
            { name: 'Inativo', isActive: false },
          ],
        });

        const response = await request(app.getHttpServer())
          .get(`${API}/system-modules`)
          .set('Authorization', `Bearer ${superuserToken}`)
          .expect(200);
        expect(response.body.total).toBe(2);
      });

      it('alterna a situação (toggle do legado)', async () => {
        const created = await prisma.systemModule.create({
          data: { name: 'Financeiro', isActive: true },
        });

        const first = await request(app.getHttpServer())
          .post(`${API}/system-modules/${created.id}/toggle`)
          .set('Authorization', `Bearer ${superuserToken}`)
          .expect(200);
        expect(first.body.isActive).toBe(false);

        const second = await request(app.getHttpServer())
          .post(`${API}/system-modules/${created.id}/toggle`)
          .set('Authorization', `Bearer ${superuserToken}`)
          .expect(200);
        expect(second.body.isActive).toBe(true);
      });

      it('renomeia o módulo', async () => {
        const created = await prisma.systemModule.create({
          data: { name: 'Antigo' },
        });

        const response = await request(app.getHttpServer())
          .patch(`${API}/system-modules/${created.id}`)
          .set('Authorization', `Bearer ${superuserToken}`)
          .send({ name: 'Novo' })
          .expect(200);
        expect(response.body.name).toBe('Novo');
      });

      it('permite ajustar apenas a caixa do próprio nome', async () => {
        const created = await prisma.systemModule.create({
          data: { name: 'financeiro' },
        });

        const response = await request(app.getHttpServer())
          .patch(`${API}/system-modules/${created.id}`)
          .set('Authorization', `Bearer ${superuserToken}`)
          .send({ name: 'Financeiro' })
          .expect(200);
        expect(response.body.name).toBe('Financeiro');
      });

      it('recusa renomear para nome de outro módulo', async () => {
        await prisma.systemModule.create({ data: { name: 'Existente' } });
        const other = await prisma.systemModule.create({ data: { name: 'Outro' } });

        await request(app.getHttpServer())
          .patch(`${API}/system-modules/${other.id}`)
          .set('Authorization', `Bearer ${superuserToken}`)
          .send({ name: 'existente' })
          .expect(409);
      });

      it('devolve 404 para módulo inexistente', async () => {
        await request(app.getHttpServer())
          .get(`${API}/system-modules/999999`)
          .set('Authorization', `Bearer ${superuserToken}`)
          .expect(404);

        await request(app.getHttpServer())
          .post(`${API}/system-modules/999999/toggle`)
          .set('Authorization', `Bearer ${superuserToken}`)
          .expect(404);
      });

      it('exclui módulo sem chamados', async () => {
        const created = await prisma.systemModule.create({ data: { name: 'Livre' } });

        await request(app.getHttpServer())
          .delete(`${API}/system-modules/${created.id}`)
          .set('Authorization', `Bearer ${superuserToken}`)
          .expect(204);

        expect(await prisma.systemModule.count()).toBe(0);
      });

      it('recusa excluir módulo com chamados vinculados', async () => {
        const systemModule = await prisma.systemModule.create({
          data: { name: 'Em uso' },
        });
        const client = await prisma.user.findUniqueOrThrow({
          where: { email: 'cliente@example.com' },
        });
        await prisma.ticket.create({
          data: {
            title: 'Chamado',
            description: 'Descrição',
            clientId: client.id,
            systemModuleId: systemModule.id,
          },
        });

        const response = await request(app.getHttpServer())
          .delete(`${API}/system-modules/${systemModule.id}`)
          .set('Authorization', `Bearer ${superuserToken}`)
          .expect(409);

        expect(response.body.message).toMatch(/desative/i);
      });
    });
  });

  // =========================================================================
  describe('parâmetros da empresa', () => {
    describe('autorização', () => {
      it.each([
        ['cliente', () => clientToken],
        ['técnico comum', () => technicianToken],
      ])('%s não lê os parâmetros completos', async (_label, token) => {
        await request(app.getHttpServer())
          .get(`${API}/parameters`)
          .set('Authorization', `Bearer ${token()}`)
          .expect(403);
      });

      it.each([
        ['cliente', () => clientToken],
        ['técnico comum', () => technicianToken],
      ])('%s não edita os parâmetros', async (_label, token) => {
        await request(app.getHttpServer())
          .patch(`${API}/parameters`)
          .set('Authorization', `Bearer ${token()}`)
          .send({ companyName: 'Invadida' })
          .expect(403);
      });

      it('qualquer autenticado lê nome, endereço e logo', async () => {
        for (const token of [clientToken, technicianToken, superuserToken]) {
          const response = await request(app.getHttpServer())
            .get(`${API}/parameters/public`)
            .set('Authorization', `Bearer ${token}`)
            .expect(200);

          expect(response.body).toHaveProperty('companyName');
          expect(response.body).toHaveProperty('companyAddress');
          expect(response.body).toHaveProperty('companyLogo');
          expect(response.body).toHaveProperty('companyLogoDark');
          // Não expõe dados de cobrança nem data de fechamento.
          expect(response.body.monthlyHoursAllowance).toBeUndefined();
          expect(response.body.activityHourlyRate).toBeUndefined();
          expect(response.body.hoursBankClosingDate).toBeUndefined();
        }
      });
    });

    describe('leitura e defaults', () => {
      it('devolve os defaults do legado quando a base está vazia', async () => {
        const response = await request(app.getHttpServer())
          .get(`${API}/parameters`)
          .set('Authorization', `Bearer ${superuserToken}`)
          .expect(200);

        expect(response.body).toEqual({
          companyName: 'Hope Desk',
          companyAddress: 'Endereço não informado',
          companyLogo: '',
          companyLogoDark: '',
          monthlyHoursAllowance: '16',
          activityHourlyRate: '0',
          hoursBankClosingDate: '2000-01-01',
        });
      });

      it('cria as 7 chaves na primeira leitura (ensure_system_parameters)', async () => {
        await request(app.getHttpServer())
          .get(`${API}/parameters`)
          .set('Authorization', `Bearer ${superuserToken}`)
          .expect(200);

        const keys = await prisma.systemParameter.findMany({
          select: { key: true },
          orderBy: { key: 'asc' },
        });
        expect(keys.map((k) => k.key)).toEqual([
          'activity_hourly_rate',
          'company_address',
          'company_logo',
          'company_logo_dark',
          'company_name',
          'hours_bank_closing_date',
          'monthly_hours_allowance',
        ]);
      });

      it('valor vazio no banco cai para o default, como get_system_parameter', async () => {
        await prisma.systemParameter.create({
          data: { key: 'company_name', value: '   ' },
        });

        const response = await request(app.getHttpServer())
          .get(`${API}/parameters`)
          .set('Authorization', `Bearer ${superuserToken}`)
          .expect(200);

        expect(response.body.companyName).toBe('Hope Desk');
      });

      it('aplica strip ao ler', async () => {
        await prisma.systemParameter.create({
          data: { key: 'company_name', value: '  Empresa X  ' },
        });

        const response = await request(app.getHttpServer())
          .get(`${API}/parameters`)
          .set('Authorization', `Bearer ${superuserToken}`)
          .expect(200);

        expect(response.body.companyName).toBe('Empresa X');
      });
    });

    describe('edição (superuser)', () => {
      it('atualiza todos os parâmetros', async () => {
        const response = await request(app.getHttpServer())
          .patch(`${API}/parameters`)
          .set('Authorization', `Bearer ${superuserToken}`)
          .send({
            companyName: 'Nova Empresa',
            companyAddress: 'Rua Nova, 123',
            companyLogo: 'https://example.com/logo.png',
            companyLogoDark: 'logo-dark.png',
            monthlyHoursAllowance: '20',
            activityHourlyRate: '150,75',
            hoursBankClosingDate: '2026-01-15',
          })
          .expect(200);

        expect(response.body).toEqual({
          companyName: 'Nova Empresa',
          companyAddress: 'Rua Nova, 123',
          companyLogo: 'https://example.com/logo.png',
          companyLogoDark: 'logo-dark.png',
          // Sempre 2 casas, como f"{value:.2f}" do legado.
          monthlyHoursAllowance: '20.00',
          activityHourlyRate: '150.75',
          hoursBankClosingDate: '2026-01-15',
        });
      });

      it('atualiza apenas o campo informado', async () => {
        await request(app.getHttpServer())
          .patch(`${API}/parameters`)
          .set('Authorization', `Bearer ${superuserToken}`)
          .send({ companyName: 'Só o Nome' })
          .expect(200);

        const response = await request(app.getHttpServer())
          .get(`${API}/parameters`)
          .set('Authorization', `Bearer ${superuserToken}`)
          .expect(200);

        expect(response.body.companyName).toBe('Só o Nome');
        expect(response.body.companyAddress).toBe('Endereço não informado');
      });

      it.each([
        ['16', '16.00'],
        ['16,5', '16.50'],
        ['16.5', '16.50'],
        ['0', '0.00'],
        ['8,25', '8.25'],
        ['100', '100.00'],
      ])('aceita franquia "%s" e grava "%s"', async (input, expected) => {
        const response = await request(app.getHttpServer())
          .patch(`${API}/parameters`)
          .set('Authorization', `Bearer ${superuserToken}`)
          .send({ monthlyHoursAllowance: input })
          .expect(200);

        expect(response.body.monthlyHoursAllowance).toBe(expected);
      });

      it.each([
        ['negativo', '-1'],
        ['texto', 'abc'],
        ['vazio', ''],
        ['dois separadores', '1,2,3'],
      ])('recusa franquia inválida: %s', async (_label, value) => {
        await request(app.getHttpServer())
          .patch(`${API}/parameters`)
          .set('Authorization', `Bearer ${superuserToken}`)
          .send({ monthlyHoursAllowance: value })
          .expect(400);
      });

      it.each([
        ['150', '150.00'],
        ['150,75', '150.75'],
        ['0', '0.00'],
      ])('aceita valor/hora "%s" e grava "%s"', async (input, expected) => {
        const response = await request(app.getHttpServer())
          .patch(`${API}/parameters`)
          .set('Authorization', `Bearer ${superuserToken}`)
          .send({ activityHourlyRate: input })
          .expect(200);

        expect(response.body.activityHourlyRate).toBe(expected);
      });

      it.each([
        ['negativo', '-1'],
        ['texto', 'abc'],
        ['vazio', ''],
        ['dois separadores', '1,2,3'],
      ])('recusa valor/hora inválido: %s', async (_label, value) => {
        await request(app.getHttpServer())
          .patch(`${API}/parameters`)
          .set('Authorization', `Bearer ${superuserToken}`)
          .send({ activityHourlyRate: value })
          .expect(400);
      });

      it.each([
        ['formato errado', '15/01/2026'],
        ['dia inexistente', '2026-02-30'],
        ['mês inválido', '2026-13-01'],
        ['texto', 'amanhã'],
      ])('recusa data de fechamento inválida: %s', async (_label, value) => {
        await request(app.getHttpServer())
          .patch(`${API}/parameters`)
          .set('Authorization', `Bearer ${superuserToken}`)
          .send({ hoursBankClosingDate: value })
          .expect(400);
      });

      it('aceita 29 de fevereiro em ano bissexto', async () => {
        const response = await request(app.getHttpServer())
          .patch(`${API}/parameters`)
          .set('Authorization', `Bearer ${superuserToken}`)
          .send({ hoursBankClosingDate: '2028-02-29' })
          .expect(200);
        expect(response.body.hoursBankClosingDate).toBe('2028-02-29');
      });

      it('recusa nome e endereço vazios', async () => {
        await request(app.getHttpServer())
          .patch(`${API}/parameters`)
          .set('Authorization', `Bearer ${superuserToken}`)
          .send({ companyName: '   ' })
          .expect(400);

        await request(app.getHttpServer())
          .patch(`${API}/parameters`)
          .set('Authorization', `Bearer ${superuserToken}`)
          .send({ companyAddress: '' })
          .expect(400);
      });

      it('aceita logo vazio, significando "sem logo"', async () => {
        await request(app.getHttpServer())
          .patch(`${API}/parameters`)
          .set('Authorization', `Bearer ${superuserToken}`)
          .send({ companyLogo: 'https://example.com/logo.png' })
          .expect(200);

        const response = await request(app.getHttpServer())
          .patch(`${API}/parameters`)
          .set('Authorization', `Bearer ${superuserToken}`)
          .send({ companyLogo: '' })
          .expect(200);

        expect(response.body.companyLogo).toBe('');
      });
    });
  });

  // =========================================================================
  describe('pagamentos', () => {
    describe('autorização — superuser-only', () => {
      it.each([
        ['cliente', () => clientToken],
        ['técnico comum', () => technicianToken],
      ])('%s não lista pagamentos', async (_label, token) => {
        await request(app.getHttpServer())
          .get(`${API}/payments`)
          .set('Authorization', `Bearer ${token()}`)
          .expect(403);
      });

      it.each([
        ['cliente', () => clientToken],
        ['técnico comum', () => technicianToken],
      ])('%s não registra pagamento', async (_label, token) => {
        await request(app.getHttpServer())
          .post(`${API}/payments`)
          .set('Authorization', `Bearer ${token()}`)
          .send({ paidAt: '2026-07-15', amount: '100', paidHours: '5' })
          .expect(403);

        expect(await prisma.paymentRecord.count()).toBe(0);
      });

      it('técnico comum não exclui pagamento', async () => {
        const payment = await prisma.paymentRecord.create({
          data: { paidAt: new Date(Date.UTC(2026, 6, 15)), amount: 100, paidHours: 5 },
        });

        await request(app.getHttpServer())
          .delete(`${API}/payments/${payment.id}`)
          .set('Authorization', `Bearer ${technicianToken}`)
          .expect(403);

        expect(await prisma.paymentRecord.count()).toBe(1);
      });

      it('exige autenticação', async () => {
        await request(app.getHttpServer()).get(`${API}/payments`).expect(401);
      });
    });

    describe('precisão decimal', () => {
      it('preserva centavos exatos e formata em pt-BR', async () => {
        const response = await request(app.getHttpServer())
          .post(`${API}/payments`)
          .set('Authorization', `Bearer ${superuserToken}`)
          .send({ paidAt: '2026-07-15', amount: '1234.56', paidHours: '10.25' })
          .expect(201);

        expect(response.body.amount).toEqual({
          value: '1234.56',
          formatted: '1.234,56',
        });
        expect(response.body.paidHours).toEqual({
          value: '10.25',
          formatted: '10,25',
        });
      });

      it('aceita vírgula decimal na entrada, como o legado', async () => {
        const response = await request(app.getHttpServer())
          .post(`${API}/payments`)
          .set('Authorization', `Bearer ${superuserToken}`)
          .send({ paidAt: '2026-07-15', amount: '1500,75', paidHours: '8,5' })
          .expect(201);

        expect(response.body.amount.value).toBe('1500.75');
        expect(response.body.paidHours.value).toBe('8.50');
      });

      it('soma totais sem erro de ponto flutuante', async () => {
        // 0.1 + 0.2 em float daria 0.30000000000000004.
        for (const amount of ['0.10', '0.20']) {
          await request(app.getHttpServer())
            .post(`${API}/payments`)
            .set('Authorization', `Bearer ${superuserToken}`)
            .send({ paidAt: '2026-07-15', amount, paidHours: '0.1' })
            .expect(201);
        }

        const response = await request(app.getHttpServer())
          .get(`${API}/payments`)
          .set('Authorization', `Bearer ${superuserToken}`)
          .expect(200);

        expect(response.body.totals.amount.value).toBe('0.30');
        expect(response.body.totals.paidHours.value).toBe('0.20');
      });

      it('mantém a precisão em valores grandes', async () => {
        await request(app.getHttpServer())
          .post(`${API}/payments`)
          .set('Authorization', `Bearer ${superuserToken}`)
          .send({ paidAt: '2026-07-15', amount: '9999999.99', paidHours: '999.99' })
          .expect(201);

        const response = await request(app.getHttpServer())
          .get(`${API}/payments`)
          .set('Authorization', `Bearer ${superuserToken}`)
          .expect(200);

        expect(response.body.totals.amount).toEqual({
          value: '9999999.99',
          formatted: '9.999.999,99',
        });
      });

      it.each([
        ['negativo', '-1'],
        ['texto', 'abc'],
        ['vazio', ''],
        ['com moeda', 'R$ 100,00'],
        ['separador de milhar', '1.234,56'],
      ])('recusa valor inválido: %s', async (_label, amount) => {
        await request(app.getHttpServer())
          .post(`${API}/payments`)
          .set('Authorization', `Bearer ${superuserToken}`)
          .send({ paidAt: '2026-07-15', amount, paidHours: '5' })
          .expect(400);
      });

      it('recusa horas pagas negativas', async () => {
        await request(app.getHttpServer())
          .post(`${API}/payments`)
          .set('Authorization', `Bearer ${superuserToken}`)
          .send({ paidAt: '2026-07-15', amount: '100', paidHours: '-1' })
          .expect(400);
      });

      it('aceita zero em valor e horas', async () => {
        const response = await request(app.getHttpServer())
          .post(`${API}/payments`)
          .set('Authorization', `Bearer ${superuserToken}`)
          .send({ paidAt: '2026-07-15', amount: '0', paidHours: '0' })
          .expect(201);

        expect(response.body.amount.value).toBe('0.00');
      });
    });

    describe('data pura em paid_at', () => {
      it('devolve a data sem deslocamento de fuso', async () => {
        const response = await request(app.getHttpServer())
          .post(`${API}/payments`)
          .set('Authorization', `Bearer ${superuserToken}`)
          .send({ paidAt: '2026-07-15', amount: '100', paidHours: '5' })
          .expect(201);

        // Em São Paulo (UTC-3), um tratamento ingênuo devolveria 2026-07-14.
        expect(response.body.paidAt).toBe('2026-07-15');
      });

      it('grava exatamente a data informada no banco', async () => {
        await request(app.getHttpServer())
          .post(`${API}/payments`)
          .set('Authorization', `Bearer ${superuserToken}`)
          .send({ paidAt: '2026-01-01', amount: '100', paidHours: '5' })
          .expect(201);

        const [row] = await prisma.$queryRaw<{ paid_at_text: string }[]>`
          SELECT to_char(paid_at, 'YYYY-MM-DD') AS paid_at_text
          FROM payment_record LIMIT 1
        `;
        expect(row.paid_at_text).toBe('2026-01-01');
      });

      it.each([
        ['formato errado', '15/07/2026'],
        ['dia inexistente', '2026-02-30'],
        ['vazio', ''],
      ])('recusa data inválida: %s', async (_label, paidAt) => {
        await request(app.getHttpServer())
          .post(`${API}/payments`)
          .set('Authorization', `Bearer ${superuserToken}`)
          .send({ paidAt, amount: '100', paidHours: '5' })
          .expect(400);
      });
    });

    describe('listagem', () => {
      beforeEach(async () => {
        await prisma.paymentRecord.createMany({
          data: [
            { paidAt: new Date(Date.UTC(2026, 0, 15)), amount: 100, paidHours: 1 },
            { paidAt: new Date(Date.UTC(2026, 5, 15)), amount: 200, paidHours: 2 },
            { paidAt: new Date(Date.UTC(2026, 6, 15)), amount: 300, paidHours: 3 },
          ],
        });
      });

      it('ordena por paid_at desc, como o legado', async () => {
        const response = await request(app.getHttpServer())
          .get(`${API}/payments`)
          .set('Authorization', `Bearer ${superuserToken}`)
          .expect(200);

        expect(response.body.items.map((p: { paidAt: string }) => p.paidAt)).toEqual([
          '2026-07-15',
          '2026-06-15',
          '2026-01-15',
        ]);
      });

      it('filtra por período, inclusivo nas duas pontas', async () => {
        const response = await request(app.getHttpServer())
          .get(`${API}/payments?from=2026-01-15&to=2026-06-15`)
          .set('Authorization', `Bearer ${superuserToken}`)
          .expect(200);

        expect(response.body.total).toBe(2);
        expect(response.body.totals.amount.value).toBe('300.00');
      });

      it('os totais referem-se ao período, não à página', async () => {
        const response = await request(app.getHttpServer())
          .get(`${API}/payments?pageSize=1`)
          .set('Authorization', `Bearer ${superuserToken}`)
          .expect(200);

        expect(response.body.items).toHaveLength(1);
        // 100 + 200 + 300, não apenas o item da página.
        expect(response.body.totals.amount.value).toBe('600.00');
        expect(response.body.totals.paidHours.value).toBe('6.00');
      });

      it('pagina corretamente', async () => {
        const response = await request(app.getHttpServer())
          .get(`${API}/payments?page=2&pageSize=2`)
          .set('Authorization', `Bearer ${superuserToken}`)
          .expect(200);

        expect(response.body.items).toHaveLength(1);
        expect(response.body.totalPages).toBe(2);
      });

      it('recusa período invertido', async () => {
        await request(app.getHttpServer())
          .get(`${API}/payments?from=2026-07-15&to=2026-01-15`)
          .set('Authorization', `Bearer ${superuserToken}`)
          .expect(400);
      });

      it('devolve totais zerados quando não há pagamentos no período', async () => {
        const response = await request(app.getHttpServer())
          .get(`${API}/payments?from=2030-01-01&to=2030-12-31`)
          .set('Authorization', `Bearer ${superuserToken}`)
          .expect(200);

        expect(response.body.total).toBe(0);
        expect(response.body.totals.amount.value).toBe('0.00');
      });
    });

    describe('exclusão', () => {
      it('exclui pagamento (superuser)', async () => {
        const payment = await prisma.paymentRecord.create({
          data: { paidAt: new Date(Date.UTC(2026, 6, 15)), amount: 100, paidHours: 5 },
        });

        await request(app.getHttpServer())
          .delete(`${API}/payments/${payment.id}`)
          .set('Authorization', `Bearer ${superuserToken}`)
          .expect(204);

        expect(await prisma.paymentRecord.count()).toBe(0);
      });

      it('exclui pagamento antigo sem janela temporal, como o legado', async () => {
        // Contraste deliberado com chamados e atividades, que só o mês corrente
        // permite a técnico comum. Ver LEGACY_CONTRACTS.md §6.4.
        const payment = await prisma.paymentRecord.create({
          data: { paidAt: new Date(Date.UTC(2020, 0, 1)), amount: 100, paidHours: 5 },
        });

        await request(app.getHttpServer())
          .delete(`${API}/payments/${payment.id}`)
          .set('Authorization', `Bearer ${superuserToken}`)
          .expect(204);
      });

      it('devolve 404 para pagamento inexistente', async () => {
        await request(app.getHttpServer())
          .delete(`${API}/payments/999999`)
          .set('Authorization', `Bearer ${superuserToken}`)
          .expect(404);
      });
    });
  });
});
