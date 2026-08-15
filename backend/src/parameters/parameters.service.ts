import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  SYSTEM_PARAMETER_DEFAULTS,
  SystemParameterKey,
} from '../common/domain/legacy-enums';
import { AuditService } from '../audit/audit.service';
import { AUDIT_ACTIONS } from '../audit/audit.types';
import { PrismaService } from '../prisma/prisma.service';
import {
  CompanyParametersResponse,
  PublicCompanyParametersResponse,
  UpdateCompanyParametersDto,
} from './dto/parameter.dto';

/**
 * Parâmetros da empresa (`system_parameter`).
 *
 * Reproduz `ensure_system_parameters`, `get_system_parameter` e
 * `set_system_parameter` do legado, incluindo os detalhes:
 *   - valor vazio cai para o default;
 *   - todo valor sofre `.strip()`;
 *   - `monthly_hours_allowance` aceita vírgula e é gravado com 2 casas.
 */
@Injectable()
export class ParametersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** `get_system_parameter(key, default)`: default quando ausente OU vazio. */
  async get(key: SystemParameterKey): Promise<string> {
    const record = await this.prisma.systemParameter.findUnique({ where: { key } });
    const value = record?.value?.trim();
    return value ? value : SYSTEM_PARAMETER_DEFAULTS[key];
  }

  /** Lê várias chaves numa consulta só. */
  async getMany(
    keys: SystemParameterKey[],
  ): Promise<Record<SystemParameterKey, string>> {
    const records = await this.prisma.systemParameter.findMany({
      where: { key: { in: keys } },
    });
    const byKey = new Map(records.map((record) => [record.key, record.value]));

    const result = {} as Record<SystemParameterKey, string>;
    for (const key of keys) {
      const value = byKey.get(key)?.trim();
      result[key] = value ? value : SYSTEM_PARAMETER_DEFAULTS[key];
    }
    return result;
  }

  /** `ensure_system_parameters()`: cria o que falta, sem sobrescrever. */
  async ensureDefaults(): Promise<void> {
    const keys = Object.keys(SYSTEM_PARAMETER_DEFAULTS) as SystemParameterKey[];
    const existing = await this.prisma.systemParameter.findMany({
      where: { key: { in: keys } },
      select: { key: true },
    });
    const present = new Set(existing.map((record) => record.key));

    const missing = keys.filter((key) => !present.has(key));
    if (missing.length === 0) return;

    await this.prisma.systemParameter.createMany({
      data: missing.map((key) => ({
        key,
        value: SYSTEM_PARAMETER_DEFAULTS[key],
      })),
      skipDuplicates: true,
    });
  }

  async findPublic(): Promise<PublicCompanyParametersResponse> {
    const values = await this.getMany([
      'company_name',
      'company_address',
      'company_logo',
    ]);
    return {
      companyName: values.company_name,
      companyAddress: values.company_address,
      companyLogo: values.company_logo,
    };
  }

  async findAll(): Promise<CompanyParametersResponse> {
    await this.ensureDefaults();
    const values = await this.getMany([
      'company_name',
      'company_address',
      'company_logo',
      'monthly_hours_allowance',
      'hours_bank_closing_date',
    ]);

    return {
      companyName: values.company_name,
      companyAddress: values.company_address,
      companyLogo: values.company_logo,
      monthlyHoursAllowance: values.monthly_hours_allowance,
      hoursBankClosingDate: values.hours_bank_closing_date,
    };
  }

  async update(dto: UpdateCompanyParametersDto): Promise<CompanyParametersResponse> {
    const updates = new Map<SystemParameterKey, string>();

    if (dto.companyName !== undefined) {
      updates.set('company_name', dto.companyName);
    }
    if (dto.companyAddress !== undefined) {
      updates.set('company_address', dto.companyAddress);
    }
    if (dto.companyLogo !== undefined) {
      // Pode ser vazio: significa "sem logo", como no legado.
      updates.set('company_logo', dto.companyLogo);
    }
    if (dto.monthlyHoursAllowance !== undefined) {
      updates.set(
        'monthly_hours_allowance',
        normalizeHoursAllowance(dto.monthlyHoursAllowance),
      );
    }
    if (dto.hoursBankClosingDate !== undefined) {
      updates.set(
        'hours_bank_closing_date',
        normalizeClosingDate(dto.hoursBankClosingDate),
      );
    }

    if (updates.size > 0) {
      // Uma transação só: os parâmetros são lidos em conjunto pelo banco de horas.
      await this.prisma.$transaction(
        Array.from(updates.entries()).map(([key, value]) =>
          this.prisma.systemParameter.upsert({
            where: { key },
            update: { value },
            create: { key, value },
          }),
        ),
      );

      // So as CHAVES alteradas, nao os valores: o logo pode ser uma URL longa e
      // o endereco e dado da empresa. Quem precisa do valor consulta o estado
      // atual; a trilha responde "quem mexeu em que, e quando".
      await this.audit.record({
        action: AUDIT_ACTIONS.PARAMETERS_UPDATED,
        entityType: 'parameters',
        metadata: { keys: Array.from(updates.keys()).join(', ') },
      });
    }

    return this.findAll();
  }
}

/**
 * `monthly_hours_allowance`: aceita vírgula decimal, exige >= 0 e grava sempre
 * com 2 casas — `f"{monthly_hours_allowance:.2f}"` do legado.
 */
export function normalizeHoursAllowance(raw: string): string {
  const normalized = raw.trim().replace(',', '.');
  if (!normalized) {
    throw new BadRequestException('Informe a quantidade de horas de franquia mensal.');
  }
  if (!/^\d+(\.\d+)?$/.test(normalized)) {
    throw new BadRequestException(
      'A franquia mensal deve ser um número válido maior ou igual a zero.',
    );
  }

  let value: Prisma.Decimal;
  try {
    value = new Prisma.Decimal(normalized);
  } catch {
    throw new BadRequestException(
      'A franquia mensal deve ser um número válido maior ou igual a zero.',
    );
  }

  if (value.isNegative()) {
    throw new BadRequestException(
      'A franquia mensal deve ser um número válido maior ou igual a zero.',
    );
  }

  return value.toFixed(2);
}

/** `hours_bank_closing_date`: valida a data e grava em ISO, como o legado. */
export function normalizeClosingDate(raw: string): string {
  const text = raw.trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!match) {
    throw new BadRequestException(
      'Informe uma data de fechamento do banco de horas válida.',
    );
  }

  const [year, month, day] = match.slice(1).map(Number);
  const candidate = new Date(Date.UTC(year, month - 1, day));

  // Rejeita 2026-02-30, que o Date normalizaria em silêncio.
  if (
    candidate.getUTCFullYear() !== year ||
    candidate.getUTCMonth() + 1 !== month ||
    candidate.getUTCDate() !== day
  ) {
    throw new BadRequestException(
      'Informe uma data de fechamento do banco de horas válida.',
    );
  }

  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}
