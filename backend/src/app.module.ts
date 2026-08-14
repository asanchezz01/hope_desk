import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ActivitiesModule } from './activities/activities.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { DomainEventsModule } from './common/events/domain-events.module';
import { RolesGuard } from './common/guards/roles.guard';
import configuration from './config/configuration';
import { HealthModule } from './health/health.module';
import { HoursBankModule } from './hours-bank/hours-bank.module';
import { SystemModulesModule } from './modules/system-modules.module';
import { NotificationsModule } from './notifications/notifications.module';
import { ParametersModule } from './parameters/parameters.module';
import { PaymentsModule } from './payments/payments.module';
import { PrismaModule } from './prisma/prisma.module';
import { ReportsModule } from './reports/reports.module';
import { TicketsModule } from './tickets/tickets.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      envFilePath: ['.env'],
      // `configuration` valida o ambiente e lança no boot se algo estiver faltando.
      load: [configuration],
    }),
    PrismaModule,
    DomainEventsModule,
    AuthModule,
    HealthModule,
    UsersModule,
    SystemModulesModule,
    ParametersModule,
    PaymentsModule,
    TicketsModule,
    ActivitiesModule,
    HoursBankModule,
    AnalyticsModule,
    ReportsModule,
    // Registra os handlers de e-mail no barramento de eventos.
    NotificationsModule,
  ],
  providers: [
    // Segurança por padrão: tudo autenticado, exceto o que for marcado @Public().
    // A ordem importa — autenticação antes de autorização.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
