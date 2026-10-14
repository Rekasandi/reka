const { deepEqual } = require('node:assert/strict');
const { test } = require('node:test');
const { NotificationsController } = require('../dist/notifications/notifications.controller');

test('Inbox reads and mutations always use authenticated session user', () => {
  const calls = [];
  const service = Object.fromEntries(
    ['findAll', 'getUnreadCount', 'markAsRead', 'markAllAsRead', 'clearRead', 'delete'].map((method) => [
      method,
      (...args) => calls.push([method, ...args]),
    ]),
  );
  const controller = new NotificationsController(service);
  const request = { userId: 'session-user' };
  if (typeof controller.create !== 'undefined') throw new Error('Client-facing notification creation must not exist.');

  controller.findAll(request);
  controller.getUnreadCount(request);
  controller.markAsRead(request, 'notification-id', {});
  controller.markAllAsRead(request);
  controller.clearRead(request);
  controller.delete(request, 'notification-id');

  deepEqual(calls, [
    ['findAll', 'session-user', { read: undefined, type: undefined, limit: undefined }],
    ['getUnreadCount', 'session-user'],
    ['markAsRead', 'notification-id', 'session-user', true],
    ['markAllAsRead', 'session-user'],
    ['clearRead', 'session-user'],
    ['delete', 'notification-id', 'session-user'],
  ]);
});
