import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

/**
 * Dinheiro e horas pagas.
 *
 * Regra do projeto: **valor exato em Decimal na borda e no banco; formatação
 * pt-BR apenas na apresentação.** Nada de `number` no caminho do cálculo — o
 * legado usava `float`, o que é justamente o que estamos corrigindo.
 *
 * A API aceita entrada em dois formatos, como o legado
 * (`.replace(",", ".")`):
 *   - ponto decimal:  `"1234.56"`
 *   - vírgula decimal: `"1234,56"`
 * e devolve tanto o valor canônico (`"1234.56"`) quanto a apresentação
 * pt-BR (`"1.234,56"`).
 */

export type DecimalLike = Prisma.Decimal | string | number;

/** Converte entrada da API em Decimal, aceitando vírgula decimal. */
export function parseDecimalInput(raw: DecimalLike, fieldName: string): Prisma.Decimal {
  if (raw instanceof Prisma.Decimal) return raw;

  const text = typeof raw === 'number' ? String(raw) : String(raw ?? '').trim();
  if (!text) {
    throw new BadRequestException(`Informe um valor para ${fieldName}.`);
  }

  // Aceita "1234,56" além de "1234.56", como `float(raw.replace(",", "."))` do
  // legado.
  //
  // ATENÇÃO — o que este código faz, e NÃO o que seria desejável:
  //
  //   "1234,56"  → 1234.56
  //   "1.234,56" → "1.234.56" → REJEITADO pelo regex abaixo
  //   "1.500"    → 1.5        ← ACEITO, interpretado como decimal
  //
  // O último caso é ambíguo: quem digitou provavelmente queria mil e quinhentos.
  // O comentário anterior afirmava que separador de milhar era rejeitado; não é,
  // e nunca foi. Corrigir aqui mudaria o resultado em relação ao Flask, que faz
  // exatamente a mesma coisa — e paridade é premissa da operação paralela.
  //
  // A defesa está na borda de entrada do frontend
  // (`src/domain/decimal-input.ts`), que recusa a forma ambígua antes de enviar.
  // Ver o item 24 da tabela de riscos em docs/MIGRATION_STATUS.md.
  const normalized = text.replace(',', '.');

  if (!/^-?\d+(\.\d+)?$/.test(normalized)) {
    throw new BadRequestException(`${fieldName} deve ser um número válido.`);
  }

  let value: Prisma.Decimal;
  try {
    value = new Prisma.Decimal(normalized);
  } catch {
    throw new BadRequestException(`${fieldName} deve ser um número válido.`);
  }

  if (value.isNegative()) {
    throw new BadRequestException(`${fieldName} não pode ser negativo.`);
  }

  return value;
}

/** Valor canônico para transporte: ponto decimal, 2 casas. Nunca perde precisão. */
export function toCanonicalString(value: DecimalLike, scale = 2): string {
  return new Prisma.Decimal(value as Prisma.Decimal.Value).toFixed(scale);
}

/**
 * Apresentação pt-BR: separador de milhar `.` e decimal `,`.
 * Formata a partir do Decimal exato, sem passar por `number`.
 */
export function formatPtBr(value: DecimalLike, scale = 2): string {
  const fixed = new Prisma.Decimal(value as Prisma.Decimal.Value).toFixed(scale);
  const negative = fixed.startsWith('-');
  const [integerPart, decimalPart] = (negative ? fixed.slice(1) : fixed).split('.');

  const withThousands = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const formatted = decimalPart ? `${withThousands},${decimalPart}` : withThousands;

  return negative ? `-${formatted}` : formatted;
}

/** Apresentação monetária com símbolo, como nas telas e PDFs do legado. */
export function formatBrl(value: DecimalLike): string {
  return `R$ ${formatPtBr(value, 2)}`;
}

/** Soma exata de uma lista de Decimals. */
export function sumDecimals(values: DecimalLike[]): Prisma.Decimal {
  return values.reduce<Prisma.Decimal>(
    (total, value) => total.plus(new Prisma.Decimal(value as Prisma.Decimal.Value)),
    new Prisma.Decimal(0),
  );
}

/**
 * Serialização padrão de um valor monetário/horário na API.
 * Expõe o valor exato e a apresentação, para o frontend não ter de reformatar.
 */
export interface DecimalView {
  /** Valor canônico, ponto decimal. Use este para qualquer cálculo. */
  value: string;
  /** Apresentação pt-BR. Use este apenas para exibir. */
  formatted: string;
}

export function toDecimalView(value: DecimalLike, scale = 2): DecimalView {
  return {
    value: toCanonicalString(value, scale),
    formatted: formatPtBr(value, scale),
  };
}
