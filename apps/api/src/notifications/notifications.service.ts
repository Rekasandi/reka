import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../common/database/database.service';
import { notifications } from '@reka/database';
import { eq } from 'drizzle-orm';

@Injectable()
export class NotificationsService {
  constructor(private readonly database: DatabaseService) {}

  async findByUserId(userId: string) {
    return this.database.db.select().from(notifications).where(eq(notifications.userId, userId));
  }
}
