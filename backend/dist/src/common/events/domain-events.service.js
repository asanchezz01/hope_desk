"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var DomainEventsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.DomainEventsService = void 0;
const common_1 = require("@nestjs/common");
let DomainEventsService = DomainEventsService_1 = class DomainEventsService {
    constructor() {
        this.logger = new common_1.Logger(DomainEventsService_1.name);
        this.handlers = new Map();
    }
    on(event, handler) {
        const existing = this.handlers.get(event) ?? [];
        const stored = handler;
        existing.push(stored);
        this.handlers.set(event, existing);
        return () => {
            const current = this.handlers.get(event);
            if (!current)
                return;
            const index = current.indexOf(stored);
            if (index >= 0) {
                current.splice(index, 1);
            }
            if (current.length === 0) {
                this.handlers.delete(event);
            }
        };
    }
    removeAllHandlers(event) {
        this.handlers.delete(event);
    }
    handlerCount(event) {
        return this.handlers.get(event)?.length ?? 0;
    }
    async publish(event, payload) {
        const handlers = this.handlers.get(event) ?? [];
        if (handlers.length === 0) {
            this.logger.debug(`Evento ${event} publicado sem handlers registrados.`);
            return;
        }
        for (const handler of handlers) {
            try {
                await handler(payload);
            }
            catch (error) {
                this.logger.error(`Handler de ${event} falhou: ${error.message}`, error.stack);
            }
        }
    }
};
exports.DomainEventsService = DomainEventsService;
exports.DomainEventsService = DomainEventsService = DomainEventsService_1 = __decorate([
    (0, common_1.Injectable)()
], DomainEventsService);
//# sourceMappingURL=domain-events.service.js.map