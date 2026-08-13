"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var NotificationsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationsService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const auth_service_1 = require("../auth/auth.service");
const domain_events_1 = require("../common/events/domain-events");
const domain_events_service_1 = require("../common/events/domain-events.service");
const configuration_1 = require("../config/configuration");
const prisma_service_1 = require("../prisma/prisma.service");
const mailer_service_1 = require("./mailer.service");
const notification_templates_1 = require("./notification-templates");
let NotificationsService = NotificationsService_1 = class NotificationsService {
    constructor(events, mailer, prisma, configService) {
        this.events = events;
        this.mailer = mailer;
        this.prisma = prisma;
        this.logger = new common_1.Logger(NotificationsService_1.name);
        this.config = configService.getOrThrow(configuration_1.APP_CONFIG_NAMESPACE);
    }
    onModuleInit() {
        this.events.on(domain_events_1.TICKET_CREATED, async (payload) => {
            await this.onTicketCreated(payload);
        });
        this.events.on(domain_events_1.TICKET_STATUS_CHANGED, async (payload) => {
            await this.onTicketStatusChanged(payload);
        });
        this.events.on(domain_events_1.ACTIVITY_CREATED, async (payload) => {
            await this.onActivityCreated(payload);
        });
        this.events.on(domain_events_1.PASSWORD_RESET_REQUESTED, async (payload) => {
            await this.onPasswordResetRequested(payload);
        });
        this.logger.log('Handlers de notificação registrados.');
    }
    async onTicketCreated(event) {
        const recipients = await this.resolveNewTicketRecipients(event.technicianId);
        if (recipients.length === 0) {
            this.logger.log(`Nenhum destinatário para o novo chamado #${event.ticketId}.`);
            return false;
        }
        return this.mailer.send((0, notification_templates_1.newTicketEmail)(event, recipients, (0, notification_templates_1.buildTicketUrl)(this.config.appPublicUrl, event.ticketId)));
    }
    async resolveNewTicketRecipients(technicianId) {
        if (technicianId !== null) {
            const assigned = await this.prisma.user.findFirst({
                where: { id: technicianId, role: 'technician' },
                select: { email: true },
            });
            return assigned?.email ? [assigned.email] : [];
        }
        const technicians = await this.prisma.user.findMany({
            where: { role: 'technician', isSuperuser: false },
            select: { email: true },
        });
        return Array.from(new Set(technicians.map((item) => item.email).filter(Boolean))).sort();
    }
    async onTicketStatusChanged(event) {
        if (!event.clientEmail)
            return false;
        return this.mailer.send((0, notification_templates_1.statusChangedEmail)(event, (0, notification_templates_1.buildTicketUrl)(this.config.appPublicUrl, event.ticketId)));
    }
    async onActivityCreated(event) {
        if (!event.clientEmail)
            return false;
        return this.mailer.send((0, notification_templates_1.newActivityEmail)(event, (0, notification_templates_1.buildTicketUrl)(this.config.appPublicUrl, event.ticketId)));
    }
    async onPasswordResetRequested(event) {
        if (!event.email)
            return false;
        return this.mailer.send((0, notification_templates_1.passwordResetEmail)(event, (0, notification_templates_1.buildResetPasswordUrl)(this.config.appPublicUrl, event.token), auth_service_1.RESET_TOKEN_MAX_AGE_HOURS));
    }
};
exports.NotificationsService = NotificationsService;
exports.NotificationsService = NotificationsService = NotificationsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [domain_events_service_1.DomainEventsService,
        mailer_service_1.MailerService,
        prisma_service_1.PrismaService,
        config_1.ConfigService])
], NotificationsService);
//# sourceMappingURL=notifications.service.js.map