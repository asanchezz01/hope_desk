"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var MailerService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MailerService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const nodemailer = __importStar(require("nodemailer"));
const configuration_1 = require("../config/configuration");
let MailerService = MailerService_1 = class MailerService {
    constructor(configService) {
        this.logger = new common_1.Logger(MailerService_1.name);
        this.transporter = null;
        this.capturedMessages = [];
        this.config = configService.getOrThrow(configuration_1.APP_CONFIG_NAMESPACE);
    }
    get enabled() {
        return this.config.mail.enabled;
    }
    async send(message) {
        if (message.recipients.length === 0) {
            return false;
        }
        if (!this.config.mail.enabled) {
            this.logger.log(`Envio de e-mail desativado por MAIL_ENABLED=false. ` +
                `Assunto: "${message.subject}" para ${message.recipients.length} destinatário(s).`);
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
            this.logger.log(`E-mail enviado: "${message.subject}" para ${message.recipients.length} destinatário(s).`);
            return true;
        }
        catch (error) {
            this.logger.error(`Falha ao enviar e-mail para ${message.recipients.join(', ')}: ` +
                `${error.message}`, error.stack);
            return false;
        }
    }
    getTransporter() {
        if (this.transporter)
            return this.transporter;
        const { host, port, user, pass, useTls } = this.config.mail;
        this.transporter = nodemailer.createTransport({
            host,
            port,
            secure: port === 465,
            requireTLS: useTls && port !== 465,
            auth: { user, pass },
            connectionTimeout: 20_000,
            greetingTimeout: 20_000,
            socketTimeout: 20_000,
        });
        return this.transporter;
    }
    clearCaptured() {
        this.capturedMessages.length = 0;
    }
};
exports.MailerService = MailerService;
exports.MailerService = MailerService = MailerService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], MailerService);
//# sourceMappingURL=mailer.service.js.map