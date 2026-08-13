export interface PasswordVerification {
    valid: boolean;
    needsRehash: boolean;
}
export declare const BCRYPT_ROUNDS = 12;
export declare class PasswordService {
    hash(plainPassword: string): Promise<string>;
    verify(plainPassword: string, storedHash: string): Promise<PasswordVerification>;
    spendDummyWork(): Promise<void>;
}
