import { deepEqual, equal } from 'node:assert/strict';
import { test } from 'node:test';
import { NotificationsService } from './notifications.service';

function queryParams(condition: any): unknown[] {
  if (!condition) return [];
  if (condition.constructor?.name === 'Param') return [condition.value];
  if (Array.isArray(condition)) return condition.flatMap(queryParams);
  return queryParams(condition.queryChunks);
}

function createMemoryDatabase() {
  const rows: any[] = [];
  let sequence = 0;
  const matches = (row: any, params: unknown[]) => {
    if (params.length === 1) return row.userId === params[0];
    if (row.id === params[0] && row.userId === params[1]) return true;
    return row.userId === params[0] && (params[1] === undefined || row.read === params[1]);
  };

  return {
    rows,
    db: {
      insert: () => ({ values: (value: any) => ({ returning: async () => {
        const row = { id: `notification-${++sequence}`, read: false, metadata: {}, ...value, createdAt: new Date() };
        rows.push(row);
        return [row];
      } }) }),
      select: () => ({ from: () => ({ where: (condition: any) => {
        const params = queryParams(condition);
        const query: any = {
          orderBy: () => query,
          limit: async (limit: number) => rows.filter((row) => matches(row, params)).slice(0, limit),
          then: (resolve: (value: any[]) => unknown, reject: (error: unknown) => unknown) =>
            Promise.resolve(rows.filter((row) => matches(row, params))).then(resolve, reject),
        };
        return query;
      } }) }),
      update: () => ({ set: (values: any) => ({ where: (condition: any) => ({ returning: async () => {
        const params = queryParams(condition);
        const matched = rows.filter((row) => matches(row, params));
        for (const row of matched) Object.assign(row, values);
        return matched;
      } }) }) }),
      delete: () => ({ where: (condition: any) => ({ returning: async () => {
        const params = queryParams(condition);
        const matched = rows.filter((row) => matches(row, params));
        for (const row of matched) rows.splice(rows.indexOf(row), 1);
        return matched;
      } }) }),
    },
  };
}

test('notifications persist, reload for owner only, and retain read/delete state', async () => {
  const memory = createMemoryDatabase();
  const service = new NotificationsService(memory as any);
  await service.createForEvent('user-a', {
    type: 'assignment',
    title: 'Assigned to APP-1',
    body: 'A real task was assigned to you.',
  });

  const reloadedService = new NotificationsService(memory as any);
  const ownItems = await reloadedService.findAll('user-a');
  deepEqual(ownItems.map((item) => item.title), ['Assigned to APP-1']);
  deepEqual(await reloadedService.findAll('user-b'), []);

  await reloadedService.markAsRead(ownItems[0].id, 'user-a');
  equal((await reloadedService.getUnreadCount('user-a')).count, 0);
  await reloadedService.clearRead('user-a');
  deepEqual(await reloadedService.findAll('user-a'), []);
  equal(memory.rows.length, 0);
});
