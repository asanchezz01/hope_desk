import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { RequiresSuperuser } from '../common/decorators/superuser.decorator';

import { AuditService } from './audit.service';
import { ListAuditQueryDto, PaginatedAuditResponse } from './dto/audit.dto';

/**
 * Consulta da trilha de auditoria (Fase 11).
 *
 * Superuser-only, como as demais áreas administrativas (parâmetros, módulos e
 * pagamentos). A restrição é mais forte aqui do que nelas: a trilha registra
 * quem fez o quê e a partir de qual endereço, então abri-la a todo técnico
 * transformaria o recurso que existe para vigiar o privilégio em mais uma fonte
 * de dado sobre colegas.
 *
 * Não há rota de escrita nem de exclusão, de propósito: trilha que o próprio
 * sistema deixa apagar pela API não serve como trilha.
 */
@ApiTags('audit')
@ApiBearerAuth('access-token')
@RequiresSuperuser()
@Controller('audit')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @ApiOperation({
    summary: 'Consulta a trilha de auditoria (paginado, superuser)',
    description:
      'Ordenada do mais recente para o mais antigo. O período usa início ' +
      'inclusivo e fim exclusivo. O campo metadata já é gravado sem segredos.',
  })
  @ApiOkResponse({ type: PaginatedAuditResponse })
  list(@Query() query: ListAuditQueryDto): Promise<PaginatedAuditResponse> {
    return this.auditService.list(query);
  }
}
