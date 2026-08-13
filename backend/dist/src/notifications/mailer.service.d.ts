import { ConfigService } from '@nestjs/config';
export interface OutgoingEmail {
    recipients: string[];
    subject: string;
    body: string;
}
export declare class MailerService {
    private readonly logger;
    private readonly config;
    private transporter;
    readonly capturedMessages: OutgoingEmail[];
    constructor(configService: ConfigService);
    get enabled(): boolean;
    send(message: OutgoingEmail): Promise<boolean>;
    private getTransporter;
    clearCaptured(): void;
}
