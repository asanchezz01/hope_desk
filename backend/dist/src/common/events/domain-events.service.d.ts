import { DomainEventMap, DomainEventName } from './domain-events';
export type DomainEventHandler<Name extends DomainEventName> = (payload: DomainEventMap[Name]) => void | Promise<void>;
export declare class DomainEventsService {
    private readonly logger;
    private readonly handlers;
    on<Name extends DomainEventName>(event: Name, handler: DomainEventHandler<Name>): () => void;
    removeAllHandlers(event: DomainEventName): void;
    handlerCount(event: DomainEventName): number;
    publish<Name extends DomainEventName>(event: Name, payload: DomainEventMap[Name]): Promise<void>;
}
