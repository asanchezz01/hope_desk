"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const legacy_enums_1 = require("../src/common/domain/legacy-enums");
const password_service_1 = require("../src/auth/password/password.service");
const PRODUCTION_HOST_MARKERS = ['farmacosprecodecusto.com.br', '10.1.4.82'];
const DEV_DEFAULT_PASSWORD = 'Hope@2026';
function assertDisposableDatabase() {
    const url = process.env.DATABASE_URL ?? '';
    if (!url) {
        throw new Error('DATABASE_URL não definida.');
    }
    for (const marker of PRODUCTION_HOST_MARKERS) {
        if (url.includes(marker)) {
            throw new Error(`Recusando semear: DATABASE_URL aponta para host de produção (${marker}).`);
        }
    }
}
function resolveSeedPassword() {
    const provided = (process.env.SEED_PASSWORD ?? '').trim();
    if (provided)
        return provided;
    if ((process.env.NODE_ENV ?? 'development') !== 'development') {
        throw new Error('SEED_PASSWORD é obrigatória quando NODE_ENV não é development.');
    }
    return DEV_DEFAULT_PASSWORD;
}
async function main() {
    assertDisposableDatabase();
    const password = resolveSeedPassword();
    const prisma = new client_1.PrismaClient();
    const passwords = new password_service_1.PasswordService();
    try {
        for (const [key, value] of Object.entries(legacy_enums_1.SYSTEM_PARAMETER_DEFAULTS)) {
            await prisma.systemParameter.upsert({
                where: { key },
                update: {},
                create: { key, value },
            });
        }
        for (const name of ['Financeiro', 'Estoque', 'Fiscal']) {
            await prisma.systemModule.upsert({
                where: { name },
                update: {},
                create: { name },
            });
        }
        const passwordHash = await passwords.hash(password);
        const devUsers = [
            {
                email: 'superuser@hope.com',
                name: 'Super User',
                role: 'technician',
                isSuperuser: true,
            },
            {
                email: 'tecnico@hope.com',
                name: 'Técnico Demo',
                role: 'technician',
                isSuperuser: false,
            },
            {
                email: 'cliente@hope.com',
                name: 'Cliente Demo',
                role: 'client',
                isSuperuser: false,
            },
        ];
        for (const user of devUsers) {
            await prisma.user.upsert({
                where: { email: user.email },
                update: { name: user.name, role: user.role, isSuperuser: user.isSuperuser },
                create: { ...user, passwordHash, mustChangePassword: false },
            });
        }
        const [parameters, modules, users] = await Promise.all([
            prisma.systemParameter.count(),
            prisma.systemModule.count(),
            prisma.user.count(),
        ]);
        console.log(`Seed concluído: ${parameters} parâmetros, ${modules} módulos, ${users} usuários.`);
        if (!process.env.SEED_PASSWORD) {
            console.log(`Senha de desenvolvimento dos usuários criados: ${DEV_DEFAULT_PASSWORD}`);
        }
    }
    finally {
        await prisma.$disconnect();
    }
}
void main().catch((error) => {
    console.error(error);
    process.exit(1);
});
//# sourceMappingURL=seed.js.map