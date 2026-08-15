import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { parseDecimalInput, toDecimalView } from '../common/money/decimal.util';
import { AuditService } from '../audit/audit.service';
import { AUDIT_ACTIONS } from '../audit/audit.types';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreatePaymentDto,
  ListPaymentsQueryDto,
  PaginatedPaymentsResponse,
  PaymentResponse,
} from './dto/payment.dto';

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;

interface PaymentRecordRow {
  id: number;
  paidAt: Date;
  amount: Prisma.Decimal;
  paidHours: Prisma.Decimal;
  createdAt: Date;
}

/**
 * Registro de pagamentos, que alimenta o desconto de horas do banco de horas.
 *
 * Precisão: `amount` e `paidHours` são `Decimal` de ponta a ponta. Nenhum valor
 * passa por `number` — é exatamente o defeito do legado (`db.Float`) que esta
 * fase corrige. A apresentação pt-BR é derivada do Decimal, nunca o contrário.
 *
 * `paid_at` é uma **data pura** (sem hora e sem fuso), como no legado.
 */
@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(query: ListPaymentsQueryDto): Promise<PaginatedPaymentsResponse> {
    const page = Math.max(query.page ?? 1, 1);
    const pageSize = Math.min(query.pageSize ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);

    const where: Prisma.PaymentRecordWhereInput = {};
    const from = query.from ? parseIsoDate(query.from, 'data inicial') : undefined;
    const to = query.to ? parseIsoDate(query.to, 'data final') : undefined;

    if (from && to && from.getTime() > to.getTime()) {
      throw new BadRequestException(
        'A data inicial não pode ser posterior à data final.',
      );
    }

    if (from || to) {
      where.paidAt = {};
      if (from) where.paidAt.gte = from;
      // Intervalo inclusivo nas duas pontas, como as telas do legado.
      if (to) where.paidAt.lte = to;
    }

    const [items, total, aggregate] = await this.prisma.$transaction([
      this.prisma.paymentRecord.findMany({
        where,
        // Mesma ordenação do legado: paid_at DESC, created_at DESC.
        orderBy: [{ paidAt: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.paymentRecord.count({ where }),
      this.prisma.paymentRecord.aggregate({
        where,
        _sum: { amount: true, paidHours: true },
      }),
    ]);

    return {
      items: items.map(toPaymentResponse),
      total,
      page,
      pageSize,
      totalPages: Math.max(Math.ceil(total / pageSize), 1),
      totals: {
        // A soma vem do PostgreSQL em numeric: exata, e do período inteiro.
        amount: toDecimalView(aggregate._sum.amount ?? new Prisma.Decimal(0)),
        paidHours: toDecimalView(aggregate._sum.paidHours ?? new Prisma.Decimal(0)),
      },
    };
  }

  async findOne(id: number): Promise<PaymentResponse> {
    const payment = await this.prisma.paymentRecord.findUnique({ where: { id } });
    if (!payment) {
      throw new NotFoundException('Pagamento não encontrado.');
    }
    return toPaymentResponse(payment);
  }

  async create(dto: CreatePaymentDto): Promise<PaymentResponse> {
    const paidAt = parseIsoDate(dto.paidAt, 'data de pagamento');
    const amount = parseDecimalInput(dto.amount, 'o valor do pagamento');
    const paidHours = parseDecimalInput(dto.paidHours, 'as horas pagas');

    const payment = await this.prisma.paymentRecord.create({
      data: { paidAt, amount, paidHours },
    });

    // Valores gravados como Decimal exato, não como veio no DTO: é o que o
    // banco tem, e a diferenca entre os dois seria justamente o bug de "1.500".
    await this.audit.record({
      action: AUDIT_ACTIONS.PAYMENT_CREATED,
      entityType: 'payment',
      entityId: payment.id,
      metadata: {
        paidAt: formatIsoDate(payment.paidAt),
        amount: payment.amount.toString(),
        paidHours: payment.paidHours.toString(),
        rawAmountInput: dto.amount,
      },
    });

    return toPaymentResponse(payment);
  }

  /**
   * `delete_payment` do legado exige apenas superuser — **sem** janela temporal,
   * ao contrário de chamados e atividades. Comportamento preservado
   * deliberadamente (ver docs/LEGACY_CONTRACTS.md §6.4).
   */
  async remove(id: number): Promise<void> {
    const existing = await this.prisma.paymentRecord.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Pagamento não encontrado.');
    }
    await this.prisma.paymentRecord.delete({ where: { id } });

    await this.audit.record({
      action: AUDIT_ACTIONS.PAYMENT_DELETED,
      entityType: 'payment',
      entityId: id,
      metadata: {
        paidAt: formatIsoDate(existing.paidAt),
        amount: existing.amount.toString(),
        paidHours: existing.paidHours.toString(),
      },
    });
  }
}

/** Converte AAAA-MM-DD numa data pura (meia-noite UTC), como o legado. */
export function parseIsoDate(raw: string, fieldName: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw.trim());
  if (!match) {
    throw new BadRequestException(`Informe uma ${fieldName} válida (AAAA-MM-DD).`);
  }

  const [year, month, day] = match.slice(1).map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  // Rejeita 2026-02-30, que o Date normalizaria em silêncio.
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() + 1 !== month ||
    date.getUTCDate() !== day
  ) {
    throw new BadRequestException(`Informe uma ${fieldName} válida (AAAA-MM-DD).`);
  }

  return date;
}

/** Serializa `paid_at` de volta como data pura, sem deslocamento de fuso. */
export function formatIsoDate(date: Date): string {
  const year = String(date.getUTCFullYear()).padStart(4, '0');
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function toPaymentResponse(payment: PaymentRecordRow): PaymentResponse {
  return {
    id: payment.id,
    paidAt: formatIsoDate(payment.paidAt),
    amount: toDecimalView(payment.amount),
    paidHours: toDecimalView(payment.paidHours),
    createdAt: payment.createdAt.toISOString(),
  };
}
