'use server';

import { getDb } from '@/db';
import { config, calendarMappings, busyCalendars } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

export async function saveConfig(key: string, value: any) {
  const db = await getDb();
  
  const existing = await db.query.config.findFirst({
    where: eq(config.key, key),
  });

  if (existing) {
    await db
      .update(config)
      .set({ 
        value: JSON.stringify(value),
        updatedAt: new Date(),
      })
      .where(eq(config.key, key));
  } else {
    await db.insert(config).values({
      key,
      value: JSON.stringify(value),
      updatedAt: new Date(),
    });
  }

  revalidatePath('/settings');
  return { success: true };
}

export async function saveTududiConnection(apiUrl: string, apiKey: string) {
  await saveConfig('tududi_api_url', apiUrl);
  await saveConfig('tududi_api_key', apiKey);
  return { success: true };
}

export async function saveCalendarMapping(projectUid: string, calendarId: string) {
  const db = await getDb();
  
  const existing = await db.query.calendarMappings.findFirst({
    where: eq(calendarMappings.projectUid, projectUid),
  });

  if (existing) {
    await db
      .update(calendarMappings)
      .set({ 
        calendarId,
        updatedAt: new Date(),
      })
      .where(eq(calendarMappings.projectUid, projectUid));
  } else {
    await db.insert(calendarMappings).values({
      projectUid,
      projectName: 'Unknown Project',
      calendarId,
      calendarName: 'Unknown Calendar',
      updatedAt: new Date(),
    });
  }

  revalidatePath('/settings');
  return { success: true };
}

export async function saveBusyCalendars(calendarIds: string[]) {
  const db = await getDb();
  
  await db.update(busyCalendars).set({ enabled: false });

  for (const id of calendarIds) {
    const existing = await db.query.busyCalendars.findFirst({
      where: eq(busyCalendars.calendarId, id),
    });

    if (existing) {
      await db
        .update(busyCalendars)
        .set({ enabled: true, updatedAt: new Date() })
        .where(eq(busyCalendars.calendarId, id));
    } else {
      await db.insert(busyCalendars).values({
        calendarId: id,
        calendarName: 'Unknown Calendar',
        enabled: true,
        updatedAt: new Date(),
      });
    }
  }

  revalidatePath('/settings');
  return { success: true };
}
