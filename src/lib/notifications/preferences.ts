import type { Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { ROLE_NOTIFICATION_TYPES } from "@/lib/notifications/constants";

export async function getNotificationPreferences(userId: string, role: Role) {
  const allowed = Array.from(ROLE_NOTIFICATION_TYPES[role] ?? []);
  if (allowed.length === 0) {
    return { allowed, disabled: new Set<string>() };
  }

  const prefs = await prisma.notificationPreference.findMany({
    where: { userId, eventType: { in: allowed } },
  });

  const disabled = new Set(
    prefs.filter((pref) => pref.enabled === false).map((pref) => pref.eventType)
  );

  return { allowed, disabled };
}

export async function getPreferenceList(userId: string, role: Role) {
  const allowed = Array.from(ROLE_NOTIFICATION_TYPES[role] ?? []);
  const prefs = await prisma.notificationPreference.findMany({
    where: { userId, eventType: { in: allowed } },
  });
  const map = new Map(prefs.map((pref) => [pref.eventType, pref.enabled]));

  return allowed.map((eventType) => ({
    eventType,
    enabled: map.has(eventType) ? map.get(eventType) === true : true,
  }));
}
