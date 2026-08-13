import { OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ActivityCreatedEvent, PasswordResetRequestedEvent, TicketCreatedEvent, TicketStatusChangedEvent } from '../common/events/domain-events';
import { DomainEventsService } from '../common/events/domain-events.service';
import { PrismaService } from '../prisma/prisma.service';
import { MailerService } from './mailer.service';
export declare class NotificationsService implements OnModuleInit {
    private readonly events;
    private readonly mailer;
    private readonly prisma;
    private readonly logger;
    private readonly config;
    constructor(events: DomainEventsService, mailer: MailerService, prisma: PrismaService, configService: ConfigService);
    onModuleInit(): void;
    onTicketCreated(event: TicketCreatedEvent): Promise<boolean>;
    private resolveNewTicketRecipients;
    onTicketStatusChanged(event: TicketStatusChangedEvent): Promise<boolean>;
    onActivityCreated(event: ActivityCreatedEvent): Promise<boolean>;
    onPasswordResetRequested(event: PasswordResetRequestedEvent): Promise<boolean>;
}
