import { PrismaService } from '../prisma/prisma.service';
import { CreatePaymentDto, ListPaymentsQueryDto, PaginatedPaymentsResponse, PaymentResponse } from './dto/payment.dto';
export declare class PaymentsService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    list(query: ListPaymentsQueryDto): Promise<PaginatedPaymentsResponse>;
    findOne(id: number): Promise<PaymentResponse>;
    create(dto: CreatePaymentDto): Promise<PaymentResponse>;
    remove(id: number): Promise<void>;
}
export declare function parseIsoDate(raw: string, fieldName: string): Date;
export declare function formatIsoDate(date: Date): string;
