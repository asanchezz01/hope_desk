import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { PasswordService } from './password/password.service';
import { TokenService } from './token.service';

/**
 * Global porque `JwtAuthGuard` (registrado globalmente em AppModule) depende de
 * `TokenService`, e os demais módulos de domínio dependem de `PasswordService`.
 */
@Global()
@Module({
  imports: [
    // Segredos e validade vêm por chamada, a partir da configuração validada.
    JwtModule.register({}),
  ],
  controllers: [AuthController],
  providers: [AuthService, PasswordService, TokenService, JwtAuthGuard],
  exports: [AuthService, PasswordService, TokenService],
})
export class AuthModule {}
