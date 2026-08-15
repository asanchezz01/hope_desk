import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { USER_ROLES, UserRole } from '../../common/domain/legacy-enums';
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '../../auth/dto/auth.dto';

const trimAndLower = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CreateUserDto {
  @ApiProperty({ maxLength: 120 })
  @Transform(trim)
  @IsString()
  @MinLength(2, { message: 'Informe o nome.' })
  @MaxLength(120)
  name!: string;

  @ApiProperty({ maxLength: 120 })
  @Transform(trimAndLower)
  @IsEmail({}, { message: 'Informe um e-mail válido.' })
  @MaxLength(120)
  email!: string;

  @ApiProperty({ minLength: PASSWORD_MIN_LENGTH })
  @IsString()
  @MinLength(PASSWORD_MIN_LENGTH, {
    message: `A senha deve ter pelo menos ${PASSWORD_MIN_LENGTH} caracteres.`,
  })
  @MaxLength(PASSWORD_MAX_LENGTH)
  password!: string;

  @ApiProperty({ enum: USER_ROLES })
  @IsIn(USER_ROLES, { message: 'Perfil deve ser client ou technician.' })
  role!: UserRole;

  @ApiPropertyOptional({
    description: 'Somente superuser pode conceder. Default false.',
  })
  @IsOptional()
  @IsBoolean()
  isSuperuser?: boolean;

  @ApiPropertyOptional({
    description: 'Exige troca de senha no primeiro acesso. Default false.',
  })
  @IsOptional()
  @IsBoolean()
  mustChangePassword?: boolean;
}

export class UpdateUserDto {
  @ApiPropertyOptional({ maxLength: 120 })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional({ maxLength: 120 })
  @IsOptional()
  @Transform(trimAndLower)
  @IsEmail({}, { message: 'Informe um e-mail válido.' })
  @MaxLength(120)
  email?: string;

  @ApiPropertyOptional({ enum: USER_ROLES })
  @IsOptional()
  @IsIn(USER_ROLES, { message: 'Perfil deve ser client ou technician.' })
  role?: UserRole;

  @ApiPropertyOptional({ description: 'Somente superuser pode alterar.' })
  @IsOptional()
  @IsBoolean()
  isSuperuser?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  mustChangePassword?: boolean;

  @ApiPropertyOptional({
    minLength: PASSWORD_MIN_LENGTH,
    description: 'Define uma senha nova para o usuário (ação administrativa).',
  })
  @IsOptional()
  @IsString()
  @MinLength(PASSWORD_MIN_LENGTH)
  @MaxLength(PASSWORD_MAX_LENGTH)
  password?: string;
}

export class ListUsersQueryDto {
  @ApiPropertyOptional({ enum: USER_ROLES })
  @IsOptional()
  @IsIn(USER_ROLES)
  role?: UserRole;

  @ApiPropertyOptional({ description: 'Busca por nome ou e-mail.' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(120)
  search?: string;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 25, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageSize?: number;
}

export class UserResponse {
  @ApiProperty() id!: number;
  @ApiProperty() name!: string;
  @ApiProperty() email!: string;
  @ApiProperty({ enum: USER_ROLES }) role!: string;
  @ApiProperty() isSuperuser!: boolean;
  @ApiProperty() mustChangePassword!: boolean;
}

export class PaginatedUsersResponse {
  @ApiProperty({ type: [UserResponse] }) items!: UserResponse[];
  @ApiProperty() total!: number;
  @ApiProperty() page!: number;
  @ApiProperty() pageSize!: number;
  @ApiProperty() totalPages!: number;
}
