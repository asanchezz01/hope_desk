import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

/**
 * Mínimo de 6 caracteres — a mesma regra de `validate_new_password` do legado.
 * Elevar o mínimo invalidaria senhas de usuários existentes, o que é mudança de
 * regra de negócio e não cabe nesta fase.
 */
export const PASSWORD_MIN_LENGTH = 6;
export const PASSWORD_MAX_LENGTH = 128;

const trimAndLower = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

export class LoginDto {
  @ApiProperty({ example: 'cliente@example.com' })
  @Transform(trimAndLower)
  @IsEmail({}, { message: 'Informe um e-mail válido.' })
  @MaxLength(120)
  email!: string;

  @ApiProperty({ example: 'senha-do-usuario' })
  @IsString()
  @IsNotEmpty({ message: 'Informe a senha.' })
  @MaxLength(PASSWORD_MAX_LENGTH)
  password!: string;
}

export class RefreshTokenDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  refreshToken!: string;
}

export class ForgotPasswordDto {
  @ApiProperty({ example: 'cliente@example.com' })
  @Transform(trimAndLower)
  @IsEmail({}, { message: 'Informe um e-mail válido.' })
  @MaxLength(120)
  email!: string;
}

export class ResetPasswordDto {
  @ApiProperty({ description: 'Token recebido por e-mail.' })
  @IsString()
  @IsNotEmpty({ message: 'Token obrigatório.' })
  @MaxLength(200)
  token!: string;

  @ApiProperty({ minLength: PASSWORD_MIN_LENGTH })
  @IsString()
  @MinLength(PASSWORD_MIN_LENGTH, {
    message: `A nova senha deve ter pelo menos ${PASSWORD_MIN_LENGTH} caracteres.`,
  })
  @MaxLength(PASSWORD_MAX_LENGTH)
  password!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  confirmation!: string;
}

export class ChangePasswordDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty({ message: 'Informe a senha atual.' })
  @MaxLength(PASSWORD_MAX_LENGTH)
  currentPassword!: string;

  @ApiProperty({ minLength: PASSWORD_MIN_LENGTH })
  @IsString()
  @MinLength(PASSWORD_MIN_LENGTH, {
    message: `A nova senha deve ter pelo menos ${PASSWORD_MIN_LENGTH} caracteres.`,
  })
  @MaxLength(PASSWORD_MAX_LENGTH)
  password!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  confirmation!: string;
}

// ---------------------------------------------------------------------------
// Respostas
// ---------------------------------------------------------------------------

export class AuthUserResponse {
  @ApiProperty() id!: number;
  @ApiProperty() name!: string;
  @ApiProperty() email!: string;
  @ApiProperty({ enum: ['client', 'technician'] }) role!: string;
  @ApiProperty() isSuperuser!: boolean;
  @ApiProperty() mustChangePassword!: boolean;
}

export class TokenPairResponse {
  @ApiProperty() accessToken!: string;
  @ApiProperty() refreshToken!: string;
  @ApiProperty({ description: 'Validade do access token, em segundos.' })
  expiresIn!: number;
  @ApiProperty() tokenType!: 'Bearer';
}

export class LoginResponse extends TokenPairResponse {
  @ApiProperty({ type: AuthUserResponse }) user!: AuthUserResponse;
}

export class MessageResponse {
  @ApiProperty() message!: string;
}
