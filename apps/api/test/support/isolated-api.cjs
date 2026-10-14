// Real Nest controllers/guards/validation on loopback; database is the supplied
// temporary PGlite instance. No AppModule/config/Redis/GitHub clients start.
require('reflect-metadata');
const { Test } = require('@nestjs/testing');
const { ValidationPipe } = require('@nestjs/common');
const { APP_GUARD } = require('@nestjs/core');
const cookieParser = require('cookie-parser');
const { DatabaseModule } = require('../../dist/common/database/database.module');
const { DatabaseService } = require('../../dist/common/database/database.service');
const { AuthGuard } = require('../../dist/auth/auth.guard');
const { AllExceptionsFilter } = require('../../dist/common/filters/http-exception.filter');

async function createIsolatedApi(postgres, imports, overrides = []) {
  let testingModule = Test.createTestingModule({
    imports: [DatabaseModule, ...imports],
    providers: [{ provide: APP_GUARD, useClass: AuthGuard }],
  }).overrideProvider(DatabaseService).useValue({ get db() { return postgres.db; } });
  for (const [token, value] of overrides) testingModule = testingModule.overrideProvider(token).useValue(value);
  const module = await testingModule.compile();
  const app = module.createNestApplication({ logger: false, rawBody: true });
  app.setGlobalPrefix('api');
  app.use(cookieParser());
  app.enableCors({ origin: true, credentials: true });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
  app.useGlobalFilters(new AllExceptionsFilter());
  try {
    await app.listen(0, '127.0.0.1');
    return { app, url: `http://127.0.0.1:${app.getHttpServer().address().port}`, close: () => app.close() };
  } catch (error) {
    await app.close();
    throw error;
  }
}
module.exports = { createIsolatedApi };
