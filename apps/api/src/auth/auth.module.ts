import { Module, type MiddlewareConsumer, type NestModule } from '@nestjs/common';
import { DatabaseModule } from '../common/database/database.module';
import { DatabaseService } from '../common/database/database.service';
import type { DbClient } from '@reka/database';
import { MailModule } from '../mail/mail.module';
import { MailService } from '../mail/mail.service';
import { AuthController } from './auth.controller';
import { AUTH, createAuth } from './better-auth';
import { SessionMiddleware } from './session.middleware';

@Module({
  imports: [DatabaseModule, MailModule],
  controllers: [AuthController],
  providers: [
    // A live view of DatabaseService.db: the handle can be replaced (tests restart Postgres), so never capture it.
    { provide: AUTH, inject: [DatabaseService, { token: MailService, optional: true }], useFactory: (database: DatabaseService, mail?: MailService) =>
      createAuth(new Proxy({} as DbClient, { get: (_, property) => { const value = Reflect.get(database.db as object, property); return typeof value === 'function' ? value.bind(database.db) : value; } }), mail) },
    SessionMiddleware,
  ],
  exports: [AUTH],
})
export class AuthModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(SessionMiddleware).forRoutes('{*splat}');
  }
}
