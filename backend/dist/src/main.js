"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("reflect-metadata");
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const core_1 = require("@nestjs/core");
const swagger_1 = require("@nestjs/swagger");
const app_module_1 = require("./app.module");
const configuration_1 = require("./config/configuration");
const prisma_service_1 = require("./prisma/prisma.service");
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule, {
        logger: ['error', 'warn', 'log'],
    });
    const configService = app.get(config_1.ConfigService);
    const config = configService.getOrThrow(configuration_1.APP_CONFIG_NAMESPACE);
    app.setGlobalPrefix(config.apiPrefix);
    app.useGlobalPipes(new common_1.ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: false },
    }));
    app.enableCors({
        origin: config.corsOrigins.length > 0 ? config.corsOrigins : false,
        credentials: true,
    });
    const swaggerConfig = new swagger_1.DocumentBuilder()
        .setTitle('Hope Desk API')
        .setDescription('API REST do Hope Desk. Substitui progressivamente o monólito Flask.')
        .setVersion('0.1.0')
        .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'access-token')
        .build();
    const document = swagger_1.SwaggerModule.createDocument(app, swaggerConfig);
    swagger_1.SwaggerModule.setup(`${config.apiPrefix}/docs`, app, document);
    app.get(prisma_service_1.PrismaService).enableShutdownHooks(app);
    app.enableShutdownHooks();
    await app.listen(config.port);
    new common_1.Logger('Bootstrap').log(`Hope Desk API em http://localhost:${config.port}/${config.apiPrefix} (${config.nodeEnv})`);
}
void bootstrap();
//# sourceMappingURL=main.js.map