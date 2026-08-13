import { CreatePaymentDto, ListPaymentsQueryDto, PaginatedPaymentsResponse, PaymentResponse } from './dto/payment.dto';
import { PaymentsService } from './payments.service';
export declare class PaymentsController {
    private readonly paymentsService;
    constructor(paymentsService: PaymentsService);
    list(query: ListPaymentsQueryDto): Promise<PaginatedPaymentsResponse>;
    findOne(id: number): Promise<PaymentResponse>;
    create(dto: CreatePaymentDto): Promise<PaymentResponse>;
    remove(id: number): Promise<void>;
}
