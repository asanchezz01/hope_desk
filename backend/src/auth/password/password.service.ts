import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { checkWerkzeugPassword, isWerkzeugHash } from './werkzeug-hash';

export interface PasswordVerification {
  /** A senha confere. */
  valid: boolean;
  /**
   * O hash está em formato legado e deve ser regravado com o formato preferido.
   * Só é verdadeiro quando `valid` também é.
   */
  needsRehash: boolean;
}

/** Custo do bcrypt. 12 ≈ 250 ms em hardware atual — equilibra segurança e latência. */
export const BCRYPT_ROUNDS = 12;

/**
 * Hashing de senhas com dois formatos:
 *
 * - **preferido**: bcrypt, usado para toda senha nova ou alterada;
 * - **legado**: Werkzeug (scrypt/pbkdf2), aceito em leitura para que os usuários
 *   existentes continuem entrando sem redefinir a senha.
 *
 * No primeiro login com hash legado, `verify` sinaliza `needsRehash` e o
 * AuthService regrava o hash em bcrypt de forma transparente. A senha em claro
 * nunca é persistida nem registrada em log.
 */
@Injectable()
export class PasswordService {
  async hash(plainPassword: string): Promise<string> {
    return bcrypt.hash(plainPassword, BCRYPT_ROUNDS);
  }

  /**
   * Verifica a senha contra qualquer um dos formatos suportados.
   * Nunca lança para hash malformado — devolve `valid: false`.
   */
  async verify(
    plainPassword: string,
    storedHash: string,
  ): Promise<PasswordVerification> {
    if (!plainPassword || !storedHash) {
      return { valid: false, needsRehash: false };
    }

    if (isWerkzeugHash(storedHash)) {
      const valid = checkWerkzeugPassword(plainPassword, storedHash);
      return { valid, needsRehash: valid };
    }

    try {
      const valid = await bcrypt.compare(plainPassword, storedHash);
      return { valid, needsRehash: false };
    } catch {
      // Hash irreconhecível: trata como senha inválida, sem vazar o motivo.
      return { valid: false, needsRehash: false };
    }
  }

  /**
   * Consome tempo de CPU equivalente a uma verificação real.
   *
   * Usado quando o e-mail não existe, para que a latência da resposta não
   * revele a existência da conta (o legado não fazia isso).
   *
   * O hash abaixo tem de ser um bcrypt **válido** com o mesmo custo usado em
   * produção: contra um hash malformado, `bcrypt.compare` retorna false na hora
   * e o trabalho artificial não acontece — mantendo o canal lateral aberto.
   */
  async spendDummyWork(): Promise<void> {
    await bcrypt.compare('senha-inexistente', DUMMY_BCRYPT_HASH);
  }
}

/**
 * bcrypt válido, custo 12, de uma cadeia irrelevante. Não é segredo: existe
 * apenas para dar trabalho equivalente ao de uma verificação real.
 */
const DUMMY_BCRYPT_HASH =
  '$2a$12$LTecAEQxUp9Jj7n1UNJt3e9h6Uzb7m3NYyE6aLznD9Grt5Tagrene';
