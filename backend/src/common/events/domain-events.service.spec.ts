import { Logger } from '@nestjs/common';
import { TICKET_CREATED, TicketCreatedEvent } from './domain-events';
import { DomainEventsService } from './domain-events.service';

const PAYLOAD: TicketCreatedEvent = {
  ticketId: 1,
  title: 'Chamado',
  description: 'Descrição',
  clientId: 10,
  clientName: 'Cliente',
  clientEmail: 'cliente@example.com',
  technicianId: null,
};

describe('DomainEventsService', () => {
  let service: DomainEventsService;

  beforeEach(() => {
    service = new DomainEventsService();
    // Silencia o logger: os testes de falha registram erro de propósito.
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('entrega o payload ao handler registrado', async () => {
    const handler = jest.fn();
    service.on(TICKET_CREATED, handler);

    await service.publish(TICKET_CREATED, PAYLOAD);

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(PAYLOAD);
  });

  it('entrega a todos os handlers, na ordem de registro', async () => {
    const calls: string[] = [];
    service.on(TICKET_CREATED, () => void calls.push('primeiro'));
    service.on(TICKET_CREATED, () => void calls.push('segundo'));

    await service.publish(TICKET_CREATED, PAYLOAD);

    expect(calls).toEqual(['primeiro', 'segundo']);
  });

  it('não falha ao publicar evento sem handlers', async () => {
    await expect(service.publish(TICKET_CREATED, PAYLOAD)).resolves.toBeUndefined();
  });

  it('aguarda handler assíncrono', async () => {
    let finished = false;
    service.on(TICKET_CREATED, async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      finished = true;
    });

    await service.publish(TICKET_CREATED, PAYLOAD);

    expect(finished).toBe(true);
  });

  describe('isolamento de falhas', () => {
    it('não propaga exceção de handler', async () => {
      service.on(TICKET_CREATED, () => {
        throw new Error('SMTP indisponível');
      });

      await expect(service.publish(TICKET_CREATED, PAYLOAD)).resolves.toBeUndefined();
    });

    it('não propaga rejeição de handler assíncrono', async () => {
      service.on(TICKET_CREATED, async () => {
        throw new Error('timeout');
      });

      await expect(service.publish(TICKET_CREATED, PAYLOAD)).resolves.toBeUndefined();
    });

    it('um handler que falha não impede os seguintes', async () => {
      const later = jest.fn();
      service.on(TICKET_CREATED, () => {
        throw new Error('falhou');
      });
      service.on(TICKET_CREATED, later);

      await service.publish(TICKET_CREATED, PAYLOAD);

      expect(later).toHaveBeenCalledTimes(1);
    });

    it('registra a falha em log', async () => {
      const errorSpy = jest.spyOn(Logger.prototype, 'error');
      service.on(TICKET_CREATED, () => {
        throw new Error('SMTP indisponível');
      });

      await service.publish(TICKET_CREATED, PAYLOAD);

      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('SMTP indisponível'),
        expect.anything(),
      );
    });
  });

  describe('gestão de handlers', () => {
    it('conta os handlers registrados', () => {
      expect(service.handlerCount(TICKET_CREATED)).toBe(0);
      service.on(TICKET_CREATED, jest.fn());
      service.on(TICKET_CREATED, jest.fn());
      expect(service.handlerCount(TICKET_CREATED)).toBe(2);
    });

    it('removeAllHandlers remove todos os handlers do evento', async () => {
      const handler = jest.fn();
      service.on(TICKET_CREATED, handler);
      service.removeAllHandlers(TICKET_CREATED);

      await service.publish(TICKET_CREATED, PAYLOAD);

      expect(handler).not.toHaveBeenCalled();
      expect(service.handlerCount(TICKET_CREATED)).toBe(0);
    });

    describe('cancelamento por assinatura', () => {
      /**
       * `on` devolve a função de cancelamento porque `removeAllHandlers` é um
       * pé de ouvido: um teste que "limpa" o evento derruba também os handlers
       * registrados no boot pela aplicação. Aconteceu de verdade na Fase 05 —
       * a notificação de nova atividade parou de sair silenciosamente.
       */
      it('cancela apenas a própria assinatura', async () => {
        const permanent = jest.fn();
        const temporary = jest.fn();

        service.on(TICKET_CREATED, permanent);
        const unsubscribe = service.on(TICKET_CREATED, temporary);

        unsubscribe();
        await service.publish(TICKET_CREATED, PAYLOAD);

        expect(temporary).not.toHaveBeenCalled();
        // O handler "de produção" continua ativo.
        expect(permanent).toHaveBeenCalledTimes(1);
        expect(service.handlerCount(TICKET_CREATED)).toBe(1);
      });

      it('cancelar duas vezes é inofensivo', () => {
        const unsubscribe = service.on(TICKET_CREATED, jest.fn());
        unsubscribe();
        expect(() => unsubscribe()).not.toThrow();
        expect(service.handlerCount(TICKET_CREATED)).toBe(0);
      });

      it('cancela o handler certo quando o mesmo é registrado duas vezes', async () => {
        const handler = jest.fn();
        service.on(TICKET_CREATED, handler);
        const unsubscribe = service.on(TICKET_CREATED, handler);

        unsubscribe();
        await service.publish(TICKET_CREATED, PAYLOAD);

        // Restou uma assinatura, então o handler roda uma vez.
        expect(handler).toHaveBeenCalledTimes(1);
      });
    });
  });
});
