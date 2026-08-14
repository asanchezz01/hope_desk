import { Global, Module } from '@nestjs/common';
import { ParametersController } from './parameters.controller';
import { ParametersService } from './parameters.service';

/**
 * Global porque o banco de horas (Fase 06), os relatórios e os PDFs (Fase 07)
 * leem parâmetros da empresa.
 */
@Global()
@Module({
  controllers: [ParametersController],
  providers: [ParametersService],
  exports: [ParametersService],
})
export class ParametersModule {}
