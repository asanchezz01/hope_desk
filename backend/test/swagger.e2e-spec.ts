import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { OpenAPIObject } from '@nestjs/swagger';
import { createTestHarness } from './app-harness';

/**
 * Garante que o Swagger é gerado de fato e que rotas/segurança estão coerentes.
 *
 * Um documento que não gera é uma falha silenciosa: o app sobe, mas `/docs`
 * quebra em produção.
 */
describe('Documento Swagger', () => {
  let app: INestApplication;
  let close: () => Promise<void>;
  let document: OpenAPIObject;

  beforeAll(async () => {
    const harness = await createTestHarness();
    app = harness.app;
    close = harness.close;

    const config = new DocumentBuilder()
      .setTitle('Hope Desk API')
      .setVersion('0.1.0')
      .addBearerAuth(
        { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        'access-token',
      )
      .build();

    document = SwaggerModule.createDocument(app, config);
  });

  afterAll(async () => {
    await close();
  });

  it('gera o documento sem erro', () => {
    expect(document.openapi).toMatch(/^3\./);
    expect(document.info.title).toBe('Hope Desk API');
  });

  it('declara o esquema de segurança bearer', () => {
    expect(document.components?.securitySchemes).toHaveProperty('access-token');
  });

  it('documenta todas as rotas implementadas até a Fase 11', () => {
    const paths = Object.keys(document.paths).sort();

    expect(paths).toEqual([
      '/api/v1/analytics',
      // Fase 11: consulta da trilha de auditoria (superuser).
      '/api/v1/audit',
      '/api/v1/auth/change-password',
      '/api/v1/auth/forgot-password',
      '/api/v1/auth/login',
      '/api/v1/auth/logout',
      '/api/v1/auth/logout-all',
      '/api/v1/auth/me',
      '/api/v1/auth/refresh',
      '/api/v1/auth/reset-password',
      '/api/v1/health',
      '/api/v1/health/ready',
      '/api/v1/hours-bank',
      '/api/v1/hours-bank/monthly-summary',
      '/api/v1/parameters',
      '/api/v1/parameters/public',
      '/api/v1/payments',
      '/api/v1/payments/{id}',
      '/api/v1/reports/activities',
      '/api/v1/reports/activities.pdf',
      '/api/v1/reports/services',
      '/api/v1/reports/services.pdf',
      '/api/v1/system-modules',
      '/api/v1/system-modules/active',
      '/api/v1/system-modules/{id}',
      '/api/v1/system-modules/{id}/toggle',
      '/api/v1/tickets',
      '/api/v1/tickets/available-years',
      '/api/v1/tickets/{id}',
      '/api/v1/tickets/{id}/status',
      '/api/v1/tickets/{ticketId}/activities',
      '/api/v1/tickets/{ticketId}/activities/{id}',
      '/api/v1/users',
      '/api/v1/users/clients',
      '/api/v1/users/technicians',
      '/api/v1/users/{id}',
    ]);
  });

  it('exige bearer nas rotas administrativas', () => {
    const usersGet = document.paths['/api/v1/users'].get!;
    expect(usersGet.security).toEqual(expect.arrayContaining([{ 'access-token': [] }]));
  });

  it('não exige bearer nas rotas públicas', () => {
    for (const path of [
      '/api/v1/auth/login',
      '/api/v1/auth/forgot-password',
      '/api/v1/auth/reset-password',
      '/api/v1/health',
    ]) {
      const operation = Object.values(document.paths[path])[0] as {
        security?: unknown[];
      };
      expect(operation.security ?? []).toEqual([]);
    }
  });

  it('nenhum schema exposto contém hash de senha ou token de recuperação', () => {
    const schemas = JSON.stringify(document.components?.schemas ?? {});
    expect(schemas).not.toMatch(/passwordHash/);
    expect(schemas).not.toMatch(/resetToken/);
  });

  it('documenta os DTOs de entrada e saída principais', () => {
    const schemas = Object.keys(document.components?.schemas ?? {});
    expect(schemas).toEqual(
      expect.arrayContaining([
        'LoginDto',
        'LoginResponse',
        'AuthUserResponse',
        'TokenPairResponse',
        'ChangePasswordDto',
        'ForgotPasswordDto',
        'ResetPasswordDto',
        'CreateUserDto',
        'UpdateUserDto',
        'PaginatedUsersResponse',
        'CreateSystemModuleDto',
        'UpdateSystemModuleDto',
        'PaginatedSystemModulesResponse',
        'UpdateCompanyParametersDto',
        'CompanyParametersResponse',
        'PublicCompanyParametersResponse',
        'CreatePaymentDto',
        'PaymentResponse',
        'PaginatedPaymentsResponse',
        'CreateTicketDto',
        'UpdateTicketDto',
        'ChangeTicketStatusDto',
        'TicketResponse',
        'PaginatedTicketsResponse',
      ]),
    );
  });

  it('chamados não exigem papel específico no Swagger (cliente também usa)', () => {
    // O legado só usa @login_required em new_ticket e ticket_detail; a
    // autorização fina é do service, não do guard de papel.
    const ticketsPost = document.paths['/api/v1/tickets'].post!;
    expect(ticketsPost.security).toEqual(
      expect.arrayContaining([{ 'access-token': [] }]),
    );
  });

  it('expõe valores monetários com valor exato e apresentação separados', () => {
    const paymentSchema = document.components?.schemas?.PaymentResponse as {
      properties?: Record<string, unknown>;
    };
    expect(paymentSchema.properties).toHaveProperty('amount');
    expect(paymentSchema.properties).toHaveProperty('paidHours');

    // O contrato é { value, formatted }: cálculo usa `value`, tela usa `formatted`.
    const decimalView = document.components?.schemas?.DecimalViewResponse as {
      properties?: Record<string, unknown>;
    };
    expect(Object.keys(decimalView.properties ?? {}).sort()).toEqual([
      'formatted',
      'value',
    ]);
  });
});
