import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  AllowPasswordChangePending,
  Public,
} from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PASSWORD_RESET_REQUESTED } from '../common/events/domain-events';
import { DomainEventsService } from '../common/events/domain-events.service';
import { AuthenticatedUser } from './auth.types';
import { AuthService, FORGOT_PASSWORD_MESSAGE } from './auth.service';
import {
  AuthUserResponse,
  ChangePasswordDto,
  ForgotPasswordDto,
  LoginDto,
  LoginResponse,
  MessageResponse,
  RefreshTokenDto,
  ResetPasswordDto,
  TokenPairResponse,
} from './dto/auth.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly authService: AuthService,
    private readonly events: DomainEventsService,
  ) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Autentica e emite o par de tokens' })
  @ApiOkResponse({ type: LoginResponse })
  login(@Body() dto: LoginDto): Promise<LoginResponse> {
    return this.authService.login(dto);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Rotaciona o refresh token',
    description:
      'Emite um par novo e revoga o refresh token apresentado. Reapresentar um ' +
      'token já rotacionado revoga todas as sessões do usuário.',
  })
  @ApiOkResponse({ type: TokenPairResponse })
  refresh(@Body() dto: RefreshTokenDto): Promise<TokenPairResponse> {
    return this.authService.refresh(dto.refreshToken);
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoga o refresh token informado' })
  @ApiOkResponse({ type: MessageResponse })
  async logout(@Body() dto: RefreshTokenDto): Promise<MessageResponse> {
    await this.authService.logout(dto.refreshToken);
    // Idempotente: um token já inválido também resulta em sucesso.
    return { message: 'Sessão encerrada.' };
  }

  @ApiBearerAuth('access-token')
  @AllowPasswordChangePending()
  @Post('logout-all')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoga todas as sessões do usuário atual' })
  @ApiOkResponse({ type: MessageResponse })
  async logoutAll(@CurrentUser() user: AuthenticatedUser): Promise<MessageResponse> {
    const revoked = await this.authService.logoutAll(user.id);
    return { message: `${revoked} sessão(ões) encerrada(s).` };
  }

  @ApiBearerAuth('access-token')
  @AllowPasswordChangePending()
  @Get('me')
  @ApiOperation({ summary: 'Usuário autenticado' })
  @ApiOkResponse({ type: AuthUserResponse })
  me(@CurrentUser() user: AuthenticatedUser): Promise<AuthUserResponse> {
    return this.authService.currentUser(user);
  }

  @ApiBearerAuth('access-token')
  @AllowPasswordChangePending()
  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Troca a senha do usuário autenticado',
    description: 'Encerra todas as outras sessões e limpa a flag de troca obrigatória.',
  })
  @ApiOkResponse({ type: MessageResponse })
  async changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ChangePasswordDto,
  ): Promise<MessageResponse> {
    await this.authService.changePassword(user, dto);
    return { message: 'Senha alterada com sucesso. Faça login novamente.' };
  }

  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Solicita link de troca de senha',
    description:
      'A resposta é idêntica exista ou não o e-mail cadastrado, para não revelar ' +
      'quais contas existem.',
  })
  @ApiOkResponse({ type: MessageResponse })
  async forgotPassword(@Body() dto: ForgotPasswordDto): Promise<MessageResponse> {
    const issued = await this.authService.issueResetToken(dto.email);

    if (issued) {
      // Nunca registramos o token em log — apenas que foi emitido.
      this.logger.log(
        `Token de recuperação emitido para o usuário ${issued.userId} ` +
          `(expira em ${issued.expiresAt.toISOString()}).`,
      );

      // O handler de e-mail (Fase 07) recebe o token em claro pelo evento.
      // Falha de envio não altera a resposta: a mensagem é sempre a mesma.
      await this.events.publish(PASSWORD_RESET_REQUESTED, {
        userId: issued.userId,
        name: issued.name,
        email: issued.email,
        token: issued.token,
        expiresAt: issued.expiresAt,
      });
    }

    return { message: FORGOT_PASSWORD_MESSAGE };
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Redefine a senha com o token recebido por e-mail' })
  @ApiOkResponse({ type: MessageResponse })
  async resetPassword(@Body() dto: ResetPasswordDto): Promise<MessageResponse> {
    await this.authService.resetPassword(dto);
    return { message: 'Senha redefinida com sucesso. Faça login.' };
  }
}
