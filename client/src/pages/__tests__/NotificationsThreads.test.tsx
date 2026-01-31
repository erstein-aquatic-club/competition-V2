import assert from "node:assert/strict";
import { test } from "node:test";
import {
  groupNotificationsBySender,
  sortThreadMessages,
  collectThreadMarkReadTargets,
  buildOptimisticNotification,
} from "@/pages/Notifications";
import type { Notification } from "@/lib/api";

const makeNotification = (overrides: Partial<Notification>): Notification => ({
  id: overrides.id ?? 1,
  sender: overrides.sender ?? "Coach",
  sender_id: overrides.sender_id ?? null,
  sender_email: overrides.sender_email ?? null,
  sender_role: overrides.sender_role ?? "coach",
  counterparty_id: overrides.counterparty_id ?? null,
  counterparty_name: overrides.counterparty_name ?? null,
  counterparty_role: overrides.counterparty_role ?? null,
  target_user_id: overrides.target_user_id ?? null,
  target_group_id: overrides.target_group_id ?? null,
  target_group_name: overrides.target_group_name ?? null,
  title: overrides.title ?? "Message",
  message: overrides.message ?? "Hello",
  type: overrides.type ?? "message",
  read: overrides.read ?? false,
  date: overrides.date ?? "2024-05-01T10:00:00.000Z",
  target_id: overrides.target_id,
});

test("groupNotificationsBySender creates one thread per sender", () => {
  const notifications = [
    makeNotification({ id: 1, sender_id: 10, sender: "Coach A" }),
    makeNotification({ id: 2, sender_id: 10, sender: "Coach A", date: "2024-05-02T10:00:00.000Z" }),
    makeNotification({ id: 3, sender_id: 20, sender: "Coach B" }),
  ];

  const threads = groupNotificationsBySender(notifications, 99);
  assert.equal(threads.length, 2);
  const keys = threads.map((thread) => thread.key).sort();
  assert.deepEqual(keys, ["user:10", "user:20"]);
});

test("groupNotificationsBySender groups self-sent messages with target user", () => {
  const notifications = [
    makeNotification({ id: 1, sender_id: 42, sender_role: "athlete", sender: "Vous", target_user_id: 9 }),
    makeNotification({ id: 2, sender_id: 9, sender_role: "coach", sender: "Coach A" }),
  ];

  const threads = groupNotificationsBySender(notifications, 42);
  assert.equal(threads.length, 1);
  assert.equal(threads[0].key, "user:9");
});

test("groupNotificationsBySender groups non-coach senders under target coach", () => {
  const notifications = [
    makeNotification({
      id: 1,
      sender_id: 77,
      sender_role: "athlete",
      sender: "Athlete X",
      target_user_id: 77,
      counterparty_id: 5,
      counterparty_name: "Coach Y",
      counterparty_role: "coach",
    }),
  ];

  const threads = groupNotificationsBySender(notifications, 77);
  assert.equal(threads.length, 1);
  assert.equal(threads[0].key, "user:5");
  assert.equal(threads[0].senderLabel, "Coach Y");
});

test("groupNotificationsBySender groups coach sends by group target", () => {
  const notifications = [
    makeNotification({
      id: 1,
      sender_id: 2,
      sender_role: "coach",
      sender: "Coach A",
      target_group_id: 12,
      target_group_name: "Groupe Sprint",
    }),
  ];

  const threads = groupNotificationsBySender(notifications, 2);
  assert.equal(threads.length, 1);
  assert.equal(threads[0].key, "group:12");
  assert.equal(threads[0].senderLabel, "Groupe Sprint");
});

test("thread helpers sort chronologically and collect unread targets", () => {
  const notifications = [
    makeNotification({ id: 1, date: "2024-05-03T09:00:00.000Z", read: false, target_id: 11 }),
    makeNotification({ id: 2, date: "2024-05-01T09:00:00.000Z", read: true, target_id: 12 }),
    makeNotification({ id: 3, date: "2024-05-02T09:00:00.000Z", read: false, target_id: 13 }),
  ];

  const sorted = sortThreadMessages(notifications);
  assert.equal(sorted[0].id, 2);
  assert.equal(sorted[1].id, 3);
  assert.equal(sorted[2].id, 1);

  const targets = collectThreadMarkReadTargets(notifications);
  assert.deepEqual(targets, [11, 13]);
});

test("buildOptimisticNotification returns a read message payload", () => {
  const notification = buildOptimisticNotification({
    message: "Réponse",
    senderId: 7,
    senderLabel: "Coach Solène",
    targetUserId: 3,
  });

  assert.equal(notification.read, true);
  assert.equal(notification.sender, "Coach Solène");
  assert.equal(notification.sender_id, 7);
  assert.equal(notification.target_user_id, 3);
  assert.equal(notification.message, "Réponse");
});
