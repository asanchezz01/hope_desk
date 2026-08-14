import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { APP_CONFIG_NAMESPACE, AppConfig } from '../config/configuration';

export interface OutgoingEmail {
  recipients: string[];
  subject: string;
  body: string;
}

/**
 * Envio de e-mail, equivalente a `send_email` do legado.
 *
 * Garantias preservadas:
 *   - `MAIL_ENABLED=false` desliga o envio e devolve `false` sem erro;
 *   - SMTP incompleto devolve `false` com aviso em log;
 *   - lista de destinatários vazia devolve `false`;
 *   - **qualquer falha é registrada e engolida** — nunca lança. O legado faz
 *     `except Exception: logger.exception(...); return False`.
 *
 * `sentMessages` guarda o que foi enviado quando o transporte está desligado,
 * para os testes inspecionarem sem precisar de SMTP de verdade.
 */
@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);
  private readonly config: AppConfig;
  private transporter: Transporter | null = null;

  /** Mensagens capturadas quando o envio está desabilitado. Só para teste. */
  readonly capturedMessages: OutgoingEmail[] = [];

  constructor(configService: ConfigService) {
    this.config = configService.getOrThrow<AppConfig>(APP_CONFIG_NAMESPACE);
  }

  get enabled(): boolean {
    return this.config.mail.enabled;
  }

  async send(message: OutgoingEmail): Promise<boolean> {
    if (message.recipients.length === 0) {
      // O legado também devolve False sem destinatários.
      return false;
    }

    if (!this.config.mail.enabled) {
      this.logger.log(
        `Envio de e-mail desativado por MAIL_ENABLED=false. ` +
          `Assunto: "${message.subject}" para ${message.recipients.length} destinatário(s).`,
      );
      this.capturedMessages.push(message);
      return false;
    }

    const { host, user, pass, from } = this.config.mail;
    if (!host || !user || !pass || !from) {
      this.logger.warn('SMTP não configurado. E-mail não enviado.');
      return false;
    }

    try {
      const transporter = this.getTransporter();
      await transporter.sendMail({
        from,
        to: message.recipients.join(', '),
        subject: message.subject,
        text: message.body,
      });
      this.logger.log(
        `E-mail enviado: "${message.subject}" para ${message.recipients.length} destinatário(s).`,
      );
      return true;
    } catch (error) {
      // Falha de SMTP nunca sobe: a transação de negócio já foi confirmada.
      this.logger.error(
        `Falha ao enviar e-mail para ${message.recipients.join(', ')}: ` +
          `${(error as Error).message}`,
        (error as Error).stack,
      );
      return false;
    }
  }

  private getTransporter(): Transporter {
    if (this.transporter) return this.transporter;

    const { host, port, user, pass, useTls } = this.config.mail;

    this.transporter = nodemailer.createTransport({
      host,
      port,
      // 465 é TLS implícito; 587 usa STARTTLS.
      secure: port === 465,
      requireTLS: useTls && port !== 465,
      auth: { user, pass },
      connectionTimeout: 20_000,
      greetingTimeout: 20_000,
      socketTimeout: 20_000,
    });

    return this.transporter;
  }

  /** Limpa as mensagens capturadas. Usado entre testes. */
  clearCaptured(): void {
    this.capturedMessages.length = 0;
  }
}
