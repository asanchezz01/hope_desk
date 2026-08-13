import { DecimalView } from '../../common/money/decimal.util';
export declare class CreatePaymentDto {
    paidAt: string;
    amount: string;
    paidHours: string;
}
export declare class ListPaymentsQueryDto {
    from?: string;
    to?: string;
    page?: number;
    pageSize?: number;
}
export declare class PaymentResponse {
    id: number;
    paidAt: string;
    amount: DecimalView;
    paidHours: DecimalView;
    createdAt: string;
}
export declare class PaymentTotalsResponse {
    amount: DecimalView;
    paidHours: DecimalView;
}
export declare class PaginatedPaymentsResponse {
    items: PaymentResponse[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
    totals: PaymentTotalsResponse;
}
