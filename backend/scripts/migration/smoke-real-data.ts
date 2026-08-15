/**
 * Fase 12 — passo 5: exercita os cálculos sobre os dados REAIS migrados.
 *
 * Os testes das fases anteriores rodam contra fixtures desenhadas para cobrir
 * regras. Dado real traz o que ninguém desenha: atividade que atravessa o mês,
 * pagamento com centavo quebrado, chamado sem módulo, ano com buraco. Este
 * script chama os serviços de verdade — banco de horas e analytics — pelo
 * contexto da aplicação, sem HTTP e sem sessão.
 *
 * Só leitura. É a evidência de go/no-go que diz "a conta bate no dado real",
 * que nenhuma contagem de linhas consegue dar.
 *
 *   npx tsx scripts/migration/smoke-real-data.ts
 */
import { config as loadDotenv } from 'dotenv';

import { AnalyticsService } from '../../src/analytics/analytics.service';
import { AuditService } from '../../src/audit/audit.service';
import type { AuthenticatedUser } from '../../src/auth/auth.types';
import { assertDisposableDatabase } from '../../src/common/safety/disposable-database';
import { HoursBankService } from '../../src/hours-bank/hours-bank.service';
import { ParametersService } from '../../src/parameters/parameters.service';
import { PrismaService } from '../../src/prisma/prisma.service';

loadDotenv();

async function main(): Promise<void> {
  assertDisposableDatabase(process.env.DATABASE_URL, 'executar o smoke sobre os dados migrados');

  // Fiação manual em vez do container do Nest: este script roda por `tsx`, que
  // NÃO emite os metadados de decorator (`emitDecoratorMetadata`) dos quais a
  // injeção por tipo depende — o container sobe e falha com dependência
  // `undefined`. Instanciar à mão custa quatro linhas e mantém o script
  // executável pelo mesmo runner do seed.
  const prisma = new PrismaService();
  const audit = new AuditService(prisma);
  const parameters = new ParametersService(prisma, audit);
  const hoursBank = new HoursBankService(prisma, parameters);
  const analytics = new AnalyticsService(prisma, hoursBank);

  try {

    const superuser = await prisma.user.findFirst({ where: { isSuperuser: true } });
    if (!superuser) throw new Error('nenhum superuser na base migrada');

    // Identidade montada aqui, não emitida como token: o objetivo é exercitar o
    // CÁLCULO, e emitir sessão para isso seria criar credencial sem precisar.
    const actor: AuthenticatedUser = {
      id: superuser.id,
      email: superuser.email,
      role: superuser.role as AuthenticatedUser['role'],
      isSuperuser: true,
      mustChangePassword: false,
    };

    console.log(`ator: ${actor.email} (superuser)\n`);

    console.log('== Banco de horas (ciclo corrente) ==');
    const saldo = await hoursBank.getHoursBank(actor, {});
    console.log({
      ciclo: `${saldo.cycleStartLabel} a ${saldo.cycleEndLabel}`,
      referencia: saldo.reference,
      franquiaDoCiclo: saldo.franchiseHours,
      consumidoNoCiclo: saldo.totalConsumedHours,
      excedenteBruto: saldo.grossExcessHours,
      horasPagasNoCiclo: saldo.paidHoursInCycle,
      saldoAcumulado: saldo.netAccumulatedHours,
      mesesNoRecorte: saldo.monthlyBreakdown.length,
    });

    console.log('\nconsumo mês a mês:');
    console.table(
      saldo.monthlyBreakdown.map((mes) => ({
        mes: `${String(mes.month).padStart(2, '0')}/${mes.year}`,
        consumido: mes.consumedHours,
        excedente: mes.excessHours,
      })),
    );

    console.log('\n== Resumo do mês corrente ==');
    const resumo = await hoursBank.getMonthlySummary(actor, {});
    console.log({
      mes: `${String(resumo.month).padStart(2, '0')}/${resumo.year}`,
      horasDoPeriodo: resumo.periodActivityHours,
      horasDeChamadoDeFora: resumo.externalTicketActivityHours,
      horasPagasNoMes: resumo.paidHoursInMonth,
    });

    console.log('\n== Analytics ==');
    const painel = await analytics.getAnalytics(actor, {});
    console.log({
      periodo: painel.periodLabel,
      agrupamento: painel.bucketMode,
      faixas: painel.buckets.length,
      backlog: painel.backlog.total,
      chamadosNoPeriodo: painel.tickets.length,
      atividadesNoPeriodo: painel.activities.length,
      horasAcumuladas: painel.accumulatedHours,
      horasPagasNoPeriodo: painel.paidHoursInPeriod,
      anosDisponiveis: painel.availableYears,
      pontosDeTendencia: painel.trend.length,
    });

    console.log('\nKPIs:');
    console.log(painel.kpis);

    console.log('\nSmoke concluído: os cálculos rodaram sobre os dados reais sem erro.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error('\nFALHA:', error instanceof Error ? error.stack : error);
  process.exitCode = 1;
});
