import { Global, Module } from '@nestjs/common';

import { AuditController } from './audit.controller';
import { AuditService } from './audit.service';

/**
 * Global porque a auditoria atravessa praticamente todos os domínios —
 * autenticação, usuários, módulos, parâmetros, pagamentos, chamados e
 * atividades. Importar o módulo em cada um deles seria ruído sem ganho.
 */
@Global()
@Module({
  controllers: [AuditController],
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
