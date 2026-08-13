import { Prisma } from '@prisma/client';
export type DecimalLike = Prisma.Decimal | string | number;
export declare function parseDecimalInput(raw: DecimalLike, fieldName: string): Prisma.Decimal;
export declare function toCanonicalString(value: DecimalLike, scale?: number): string;
export declare function formatPtBr(value: DecimalLike, scale?: number): string;
export declare function formatBrl(value: DecimalLike): string;
export declare function sumDecimals(values: DecimalLike[]): Prisma.Decimal;
export interface DecimalView {
    value: string;
    formatted: string;
}
export declare function toDecimalView(value: DecimalLike, scale?: number): DecimalView;
