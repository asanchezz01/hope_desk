import fs from 'node:fs';
import path from 'node:path';
import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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
  UploadLogoDto,
} from './dto/parameter.dto';

const LOGO_MAX_BYTES = 1024 * 1024; // 1 MB

/** Tipos de imagem aceitos para a logo (contentType -> extensão). */
const LOGO_EXTENSIONS: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpeg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
};

/** Extensão -> contentType, usado ao servir a imagem gravada. */
const LOGO_CONTENT_TYPES: Record<string, string> = {
  png: 'image/png',
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  svg: 'image/svg+xml',
};

export interface LogoFile {
  buffer: Buffer;
  contentType: string;
  size: number;
}

export type LogoVariant = 'light' | 'dark';

const LOGO_VARIANTS = {
  light: { key: 'company_logo', stem: 'logo' },
  dark: { key: 'company_logo_dark', stem: 'logo-dark' },
} as const satisfies Record<LogoVariant, { key: SystemParameterKey; stem: string }>;

async function rmIfExists(target: string): Promise<void> {
  try {
    await fs.promises.unlink(target);
  } catch {
    // Arquivo ausente: nada a fazer.
  }
}

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
    private readonly configService: ConfigService,
  ) {}

  /** Pasta física onde a logo é gravada (legenda, não um caminho de URL). */
  private get logoDir(): string {
    return (
      this.configService.get<string>('app.logoDir') ??
      path.resolve(process.cwd(), 'media', 'logo')
    );
  }

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
      'company_logo_dark',
    ]);
    return {
      companyName: values.company_name,
      companyAddress: values.company_address,
      companyLogo: values.company_logo,
      companyLogoDark: values.company_logo_dark,
    };
  }

  async findAll(): Promise<CompanyParametersResponse> {
    await this.ensureDefaults();
    const values = await this.getMany([
      'company_name',
      'company_address',
      'company_logo',
      'company_logo_dark',
      'monthly_hours_allowance',
      'hours_bank_closing_date',
    ]);

    return {
      companyName: values.company_name,
      companyAddress: values.company_address,
      companyLogo: values.company_logo,
      companyLogoDark: values.company_logo_dark,
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
    if (dto.companyLogoDark !== undefined) {
      updates.set('company_logo_dark', dto.companyLogoDark);
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

  /**
   * Resolve o valor do parâmetro `company_logo` em um arquivo local dentro da
   * pasta de logos. Nunca aponta para fora dela, o que impede que um valor
   * gravado (legacy/URL ou caminho) vire leitura de arquivo arbitrário.
   */
  resolveLogoPath(value?: string | null): string | null {
    const dir = this.logoDir;
    const raw = (value ?? '').trim();
    if (!raw || /^https?:\/\//i.test(raw)) {
      return null; // vazio ou URL remota (legado) => sem logo local
    }
    const candidate = path.isAbsolute(raw) ? raw : path.resolve(dir, raw);
    const prefix = dir.endsWith(path.sep) ? dir : `${dir}${path.sep}`;
    if (candidate !== dir && !candidate.startsWith(prefix)) {
      return null; // escapou da pasta de logos
    }
    return fs.existsSync(candidate) ? candidate : null;
  }

  /**
   * Envia a logo (base64), grava na pasta de logos e registra o nome do
   * arquivo no parâmetro `company_logo`.
   */
  async uploadLogo(
    dto: UploadLogoDto,
    variant: LogoVariant = 'light',
  ): Promise<
    | { companyLogo: string; size: number; contentType: string }
    | { companyLogoDark: string; size: number; contentType: string }
  > {
    const extension = LOGO_EXTENSIONS[dto.contentType];
    if (!extension) {
      throw new BadRequestException(
        'Tipo de imagem não suportado para a logo (use PNG, JPEG, WebP, GIF ou SVG).',
      );
    }
    const base64 = (dto.dataBase64 ?? '').replace(/^data:[^,]*,/, '');
    if (!base64) {
      throw new BadRequestException('Envie a imagem da logo (campo dataBase64).');
    }
    const buffer = Buffer.from(base64, 'base64');
    if (buffer.length === 0) {
      throw new BadRequestException('A imagem da logo é inválida ou vazia.');
    }
    if (buffer.length > LOGO_MAX_BYTES) {
      throw new BadRequestException('A logo não pode exceder 1MB.');
    }

    const dir = this.logoDir;
    await fs.promises.mkdir(dir, { recursive: true });
    const config = LOGO_VARIANTS[variant];
    await this.clearLogoFiles(variant);
    const fileName = `${config.stem}.${extension}`;
    await fs.promises.writeFile(path.join(dir, fileName), buffer);

    await this.upsertLogo(variant, fileName);
    this.audit.record({
      action: AUDIT_ACTIONS.PARAMETERS_UPDATED,
      entityType: 'parameters',
      metadata: { keys: config.key, fileName, size: buffer.length },
    });

    return {
      [variant === 'light' ? 'companyLogo' : 'companyLogoDark']: fileName,
      size: buffer.length,
      contentType: dto.contentType,
    } as
      | { companyLogo: string; size: number; contentType: string }
      | { companyLogoDark: string; size: number; contentType: string };
  }

  /** Remove a logo gravada e limpa o parâmetro (volta a marca padrão "HD"). */
  async deleteLogo(
    variant: LogoVariant = 'light',
  ): Promise<{ companyLogo: string } | { companyLogoDark: string }> {
    const config = LOGO_VARIANTS[variant];
    await this.clearLogoFiles(variant);
    await this.upsertLogo(variant, '');
    this.audit.record({
      action: AUDIT_ACTIONS.PARAMETERS_UPDATED,
      entityType: 'parameters',
      metadata: { keys: config.key, removed: true },
    });
    return variant === 'light' ? { companyLogo: '' } : { companyLogoDark: '' };
  }

  /** Lê a logo gravada para streaming (ou `null` quando não há). */
  async getLogoFile(variant: LogoVariant = 'light'): Promise<LogoFile | null> {
    const config = LOGO_VARIANTS[variant];
    const record = await this.prisma.systemParameter.findUnique({
      where: { key: config.key },
    });
    const filePath = record ? this.resolveLogoPath(record.value) : null;
    if (!filePath) {
      return null;
    }
    const buffer = await fs.promises.readFile(filePath);
    const ext = path.extname(filePath).slice(1).toLowerCase();
    return {
      buffer,
      contentType: LOGO_CONTENT_TYPES[ext] ?? 'application/octet-stream',
      size: buffer.length,
    };
  }

  private async upsertLogo(variant: LogoVariant, value: string): Promise<void> {
    const key = LOGO_VARIANTS[variant].key;
    await this.prisma.systemParameter.upsert({
      where: { key },
      create: { key, value },
      update: { value },
    });
  }

  private async clearLogoFiles(variant: LogoVariant): Promise<void> {
    const dir = this.logoDir;
    const stem = LOGO_VARIANTS[variant].stem.replace('-', '\\-');
    let entries: string[];
    try {
      entries = await fs.promises.readdir(dir);
    } catch {
      return; // pasta inexistente
    }
    for (const entry of entries) {
      if (new RegExp(`^${stem}\\.`).test(entry)) {
        await rmIfExists(path.join(dir, entry));
      }
    }
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
