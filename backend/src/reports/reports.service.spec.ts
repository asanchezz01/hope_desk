import type { AuthenticatedUser } from '../auth/auth.types';
import { parseWallClockInput } from '../common/time/legacy-clock';
import type { ParametersService } from '../parameters/parameters.service';
import type { PrismaService } from '../prisma/prisma.service';
import { ReportsService } from './reports.service';

describe('ReportsService', () => {
  const user: AuthenticatedUser = {
    id: 10,
    email: 'tecnico@example.com',
    role: 'technician',
    isSuperuser: false,
    mustChangePassword: false,
  };

  it('calcula o valor devido com o total de horas e o valor/hora configurado', async () => {
    const prisma = {
      activity: {
        findMany: jest.fn().mockResolvedValue([
          {
            startedAt: parseWallClockInput('2026-03-05T08:00'),
            endedAt: parseWallClockInput('2026-03-05T10:30'),
            notes: 'Atividade faturável',
            createdBy: { id: 20, name: 'Ana Técnica' },
            ticket: {
              id: 100,
              title: 'Chamado de teste',
              description: 'Descrição',
              status: 'aberto',
              createdAt: parseWallClockInput('2026-03-01T09:00'),
              client: { name: 'Cliente' },
              technician: { name: 'Ana Técnica' },
              systemModule: { name: 'Financeiro' },
            },
          },
        ]),
      },
    } as unknown as PrismaService;
    const parameters = {
      getMany: jest.fn().mockResolvedValue({
        company_name: 'Hope Tecnologia',
        company_address: 'Rua Exemplo, 100',
        company_logo: '',
        activity_hourly_rate: '125,50',
      }),
      resolveLogoPath: jest.fn().mockReturnValue(null),
    } as unknown as ParametersService;

    const report = await new ReportsService(prisma, parameters).buildActivityReport(
      user,
      '2026-03-01',
      '2026-03-31',
    );

    expect(report.totalHours).toBe(2.5);
    expect(report.hourlyRate).toBe('125.50');
    expect(report.amountDue).toBe('313.75');
  });
});
