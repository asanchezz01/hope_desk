import { Module } from '@nestjs/common';
import { HoursBankController } from './hours-bank.controller';
import { HoursBankService } from './hours-bank.service';

@Module({
  controllers: [HoursBankController],
  providers: [HoursBankService],
  exports: [HoursBankService],
})
export class HoursBankModule {}
