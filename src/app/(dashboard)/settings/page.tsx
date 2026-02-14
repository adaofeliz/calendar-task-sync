import { getAllConfig } from '@/lib/config';
import { getDb } from '@/db';
import { calendarMappings, busyCalendars, oauthTokens } from '@/db/schema';
import { SettingsForm } from './settings-form';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const db = await getDb();
  
  const config = await getAllConfig();
  const mappings = await db.query.calendarMappings.findMany();
  const busyCals = await db.query.busyCalendars.findMany();
  const tokens = await db.query.oauthTokens.findFirst({
    columns: {
      id: true,
      provider: true,
      scope: true,
      expiryDate: true,
    }
  });

  const isGoogleConnected = !!tokens;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">Settings</h1>
        <p className="text-gray-500 mt-2">Manage your sync preferences and connections.</p>
      </div>

      <SettingsForm 
        initialConfig={config}
        initialMappings={mappings}
        initialBusyCalendars={busyCals}
        isGoogleConnected={isGoogleConnected}
      />
    </div>
  );
}
