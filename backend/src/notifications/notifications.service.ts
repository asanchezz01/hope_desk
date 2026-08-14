import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RESET_TOKEN_MAX_AGE_HOURS } from '../auth/auth.service';
import {
  ACTIVITY_CREATED,
  ActivityCreatedEvent,
  PASSWORD_RESET_REQUESTED,
  PasswordResetRequestedEvent,
  TICKET_CREATED,
  TICKET_STATUS_CHANGED,
  TicketCreatedEvent,
  TicketStatusChangedEvent,
} from '../common/events/domain-events';
import { DomainEventsService } from '../common/events/domain-events.service';
import { APP_CONFIG_NAMESPACE, AppConfig } from '../config/configuration';
import { PrismaService } from '../prisma/prisma.service';
import { MailerService } from './mailer.service';
import {
  buildResetPasswordUrl,
  buildTicketUrl,
  newActivityEmail,
  newTicketEmail,
  passwordResetEmail,
  statusChangedEmail,
} from './notification-templates';

/**
 * Notificações por e-mail.
 *
 * Registra handlers no barramento de eventos de domínio. Cada handler é
 * disparado **depois** do commit da transação de negócio, e o barramento já
 * garante que exceção de handler não propaga (ver `DomainEventsService`).
 *
 * As regras de destinatários são as do legado (docs/LEGACY_CONTRACTS.md §12):
 *
 * | Evento | Destinatários |
 * |---|---|
 * | novo chamado **com** técnico designado | somente o técnico designado |
 * | novo chamado **sem** técnico | todos os `technician`, **exceto** superusers |
 * | mudança de status | somente o cliente do chamado |
 * | nova atividade | somente o cliente do chamado |
 * | recuperação de senha | somente o próprio usuário |
 */
@Injectable()
export class NotificationsService implements OnModuleInit {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly config: AppConfig;

  constructor(
    private readonly events: DomainEventsService,
    private readonly mailer: MailerService,
    private readonly prisma: PrismaService,
    configService: ConfigService,
  ) {
    this.config = configService.getOrThrow<AppConfig>(APP_CONFIG_NAMESPACE);
  }

  onModuleInit(): void {
    // Os handlers públicos devolvem boolean (útil em teste); o barramento espera
    // void, então descartamos o retorno na assinatura.
    this.events.on(TICKET_CREATED, async (payload) => {
      await this.onTicketCreated(payload);
    });
    this.events.on(TICKET_STATUS_CHANGED, async (payload) => {
      await this.onTicketStatusChanged(payload);
    });
    this.events.on(ACTIVITY_CREATED, async (payload) => {
      await this.onActivityCreated(payload);
    });
    this.events.on(PASSWORD_RESET_REQUESTED, async (payload) => {
      await this.onPasswordResetRequested(payload);
    });

    this.logger.log('Handlers de notificação registrados.');
  }

  // -------------------------------------------------------------------------

  async onTicketCreated(event: TicketCreatedEvent): Promise<boolean> {
    const recipients = await this.resolveNewTicketRecipients(event.technicianId);

    if (recipients.length === 0) {
      // O legado devolve False sem destinatários, sem erro.
      this.logger.log(`Nenhum destinatário para o novo chamado #${event.ticketId}.`);
      return false;
    }

    return this.mailer.send(
      newTicketEmail(
        event,
        recipients,
        buildTicketUrl(this.config.appPublicUrl, event.ticketId),
      ),
    );
  }

  /**
   * `notify_technicians_new_ticket`.
   *
   * Com técnico designado: só ele — e o legado exige que ele **ainda tenha**
   * papel `technician` (`filter_by(id=..., role="technician")`).
   * Sem técnico: todos os técnicos, **excluindo superusers**, sem duplicatas e
   * em ordem alfabética de e-mail.
   */
  private async resolveNewTicketRecipients(
    technicianId: number | null,
  ): Promise<string[]> {
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

    // `sorted({...})` do legado: conjunto ordenado, sem duplicatas.
    return Array.from(
      new Set(technicians.map((item) => item.email).filter(Boolean)),
    ).sort();
  }

  async onTicketStatusChanged(event: TicketStatusChangedEvent): Promise<boolean> {
    if (!event.clientEmail) return false;

    return this.mailer.send(
      statusChangedEmail(
        event,
        buildTicketUrl(this.config.appPublicUrl, event.ticketId),
      ),
    );
  }

  async onActivityCreated(event: ActivityCreatedEvent): Promise<boolean> {
    if (!event.clientEmail) return false;

    return this.mailer.send(
      newActivityEmail(event, buildTicketUrl(this.config.appPublicUrl, event.ticketId)),
    );
  }

  async onPasswordResetRequested(event: PasswordResetRequestedEvent): Promise<boolean> {
    if (!event.email) return false;

    return this.mailer.send(
      passwordResetEmail(
        event,
        buildResetPasswordUrl(this.config.appPublicUrl, event.token),
        RESET_TOKEN_MAX_AGE_HOURS,
      ),
    );
  }
}
