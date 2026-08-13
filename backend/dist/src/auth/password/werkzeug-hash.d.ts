export type WerkzeugAlgorithm = 'scrypt' | 'pbkdf2';
export interface ParsedWerkzeugHash {
    algorithm: WerkzeugAlgorithm;
    scrypt?: {
        N: number;
        r: number;
        p: number;
    };
    pbkdf2?: {
        digest: string;
        iterations: number;
    };
    salt: string;
    expectedHex: string;
}
export declare function parseWerkzeugHash(stored: string): ParsedWerkzeugHash | null;
export declare function checkWerkzeugPassword(password: string, stored: string): boolean;
export declare function isWerkzeugHash(stored: string): boolean;
