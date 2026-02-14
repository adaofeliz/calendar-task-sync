'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { saveConfig, saveTududiConnection, saveCalendarMapping, saveBusyCalendars } from '@/app/actions/config';

type Config = Record<string, any>;
type Mapping = {
  id: number;
  projectUid: string;
  projectName: string;
  calendarId: string;
  calendarName: string;
  isDefault: boolean;
};
type BusyCalendar = {
  id: number;
  calendarId: string;
  calendarName: string;
  enabled: boolean;
};

interface SettingsFormProps {
  initialConfig: Config;
  initialMappings: Mapping[];
  initialBusyCalendars: BusyCalendar[];
  isGoogleConnected: boolean;
}

export function SettingsForm({ 
  initialConfig, 
  initialMappings, 
  initialBusyCalendars,
  isGoogleConnected 
}: SettingsFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [config, setConfig] = useState(initialConfig);
  const [mappings, setMappings] = useState(initialMappings);
  const [busyCalendars, setBusyCalendars] = useState(initialBusyCalendars);

  const [tududiUrl, setTududiUrl] = useState(config.tududi_api_url || '');
  const [tududiKey, setTududiKey] = useState(config.tududi_api_key || '');

  const handleSaveTududi = () => {
    startTransition(async () => {
      await saveTududiConnection(tududiUrl, tududiKey);
      router.refresh();
    });
  };

  const handleSaveConfig = (key: string, value: any) => {
    setConfig(prev => ({ ...prev, [key]: value }));
    startTransition(async () => {
      await saveConfig(key, value);
      router.refresh();
    });
  };

  const handleSaveMapping = (projectUid: string, calendarId: string) => {
    startTransition(async () => {
      await saveCalendarMapping(projectUid, calendarId);
      router.refresh();
    });
  };

  const handleSaveBusyCalendars = (ids: string[]) => {
    startTransition(async () => {
      await saveBusyCalendars(ids);
      router.refresh();
    });
  };

  return (
    <div className="space-y-12 pb-20">
      
      <section className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
          Tududi Connection
        </h2>
        <div className="grid gap-4 max-w-xl">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">API URL</label>
            <input
              type="text"
              value={tududiUrl}
              onChange={(e) => setTududiUrl(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              placeholder="https://api.tududi.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">API Key</label>
            <input
              type="password"
              value={tududiKey}
              onChange={(e) => setTududiKey(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              placeholder="••••••••••••••••"
            />
          </div>
          <div className="flex items-center gap-4 mt-2">
            <button
              onClick={handleSaveTududi}
              disabled={isPending}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors font-medium text-sm"
            >
              {isPending ? 'Saving...' : 'Save Connection'}
            </button>
            <button
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors font-medium text-sm"
            >
              Test Connection
            </button>
          </div>
        </div>
      </section>

      <section className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${isGoogleConnected ? 'bg-green-500' : 'bg-red-500'}`}></span>
          Google Calendar
        </h2>
        <div className="flex items-center justify-between max-w-xl p-4 bg-gray-50 rounded-lg border border-gray-200">
          <div>
            <p className="font-medium text-gray-900">
              {isGoogleConnected ? 'Connected' : 'Not Connected'}
            </p>
            <p className="text-sm text-gray-500">
              {isGoogleConnected 
                ? 'Your Google Calendar is linked and ready to sync.' 
                : 'Connect your Google account to enable calendar sync.'}
            </p>
          </div>
          {isGoogleConnected ? (
            <a
              href="/api/auth/google/disconnect"
              className="px-4 py-2 text-red-600 bg-white border border-red-200 rounded-md hover:bg-red-50 transition-colors font-medium text-sm"
            >
              Disconnect
            </a>
          ) : (
            <a
              href="/api/auth/google"
              className="px-4 py-2 bg-white text-gray-900 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors font-medium text-sm flex items-center gap-2"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Connect Google
            </a>
          )}
        </div>
      </section>

      <section className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Calendar Mappings</h2>
        <div className="overflow-hidden border border-gray-200 rounded-lg">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tududi Project</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Google Calendar</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Default</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {mappings.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-6 py-4 text-center text-sm text-gray-500">
                    No projects found. Sync to populate.
                  </td>
                </tr>
              ) : (
                mappings.map((mapping) => (
                  <tr key={mapping.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {mapping.projectName}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <select 
                        className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                        value={mapping.calendarId}
                        onChange={(e) => handleSaveMapping(mapping.projectUid, e.target.value)}
                      >
                        <option value="">Select Calendar</option>
                        <option value={mapping.calendarId}>{mapping.calendarName}</option>
                      </select>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <input
                        type="radio"
                        name="default-calendar"
                        checked={mapping.isDefault}
                        onChange={() => {}}
                        className="focus:ring-blue-500 h-4 w-4 text-blue-600 border-gray-300"
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Busy Calendars</h2>
        <p className="text-sm text-gray-500 mb-4">Select calendars that should block your schedule.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {busyCalendars.map((cal) => (
            <label key={cal.id} className="flex items-center space-x-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors">
              <input
                type="checkbox"
                checked={cal.enabled}
                onChange={(e) => {
                  const newIds = e.target.checked
                    ? [...busyCalendars.filter(c => c.enabled).map(c => c.calendarId), cal.calendarId]
                    : busyCalendars.filter(c => c.enabled && c.calendarId !== cal.calendarId).map(c => c.calendarId);
                  handleSaveBusyCalendars(newIds);
                }}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <span className="text-sm font-medium text-gray-900">{cal.calendarName}</span>
            </label>
          ))}
          {busyCalendars.length === 0 && (
            <p className="text-sm text-gray-500 col-span-full">No calendars found.</p>
          )}
        </div>
      </section>

      <section className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Scheduling Windows</h2>
        <div className="space-y-4">
          {Object.entries(config.scheduling_windows || {}).map(([day, window]: [string, any]) => (
            <div key={day} className="flex items-center gap-4 p-3 border border-gray-100 rounded-lg hover:bg-gray-50 transition-colors">
              <div className="w-32 capitalize font-medium text-gray-900">{day}</div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={window.enabled} 
                  onChange={(e) => {
                    const newWindows = { ...config.scheduling_windows, [day]: { ...window, enabled: e.target.checked } };
                    handleSaveConfig('scheduling_windows', newWindows);
                  }}
                  className="sr-only peer" 
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
              
              <div className={`flex items-center gap-2 transition-opacity ${window.enabled ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
                <input
                  type="number"
                  min="0"
                  max="23"
                  value={window.start}
                  onChange={(e) => {
                    const newWindows = { ...config.scheduling_windows, [day]: { ...window, start: parseInt(e.target.value) } };
                    handleSaveConfig('scheduling_windows', newWindows);
                  }}
                  className="w-16 px-2 py-1 border border-gray-300 rounded text-sm"
                />
                <span className="text-gray-400">:00</span>
                <span className="text-gray-400 mx-2">to</span>
                <input
                  type="number"
                  min="0"
                  max="23"
                  value={window.end}
                  onChange={(e) => {
                    const newWindows = { ...config.scheduling_windows, [day]: { ...window, end: parseInt(e.target.value) } };
                    handleSaveConfig('scheduling_windows', newWindows);
                  }}
                  className="w-16 px-2 py-1 border border-gray-300 rounded text-sm"
                />
                <span className="text-gray-400">:00</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Peak Hours</h2>
        <p className="text-sm text-gray-500 mb-4">Preferred time for high-focus tasks.</p>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700">Start</span>
            <input
              type="number"
              min="0"
              max="23"
              value={config.peak_hours?.start || 9}
              onChange={(e) => handleSaveConfig('peak_hours', { ...config.peak_hours, start: parseInt(e.target.value) })}
              className="w-20 px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700">End</span>
            <input
              type="number"
              min="0"
              max="23"
              value={config.peak_hours?.end || 12}
              onChange={(e) => handleSaveConfig('peak_hours', { ...config.peak_hours, end: parseInt(e.target.value) })}
              className="w-20 px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>
      </section>

      <section className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Duration Matrix (Minutes)</h2>
        <div className="grid grid-cols-4 gap-4">
          <div className="col-span-1"></div>
          <div className="text-center font-medium text-gray-500 text-sm uppercase tracking-wider">High Priority</div>
          <div className="text-center font-medium text-gray-500 text-sm uppercase tracking-wider">Medium Priority</div>
          <div className="text-center font-medium text-gray-500 text-sm uppercase tracking-wider">Low Priority</div>

          <div className="font-medium text-gray-900 flex items-center">Focus Task</div>
          <input
            type="number"
            value={config.duration_matrix?.focus?.high || 120}
            onChange={(e) => handleSaveConfig('duration_matrix', { ...config.duration_matrix, focus: { ...config.duration_matrix.focus, high: parseInt(e.target.value) } })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-center"
          />
          <input
            type="number"
            value={config.duration_matrix?.focus?.medium || 60}
            onChange={(e) => handleSaveConfig('duration_matrix', { ...config.duration_matrix, focus: { ...config.duration_matrix.focus, medium: parseInt(e.target.value) } })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-center"
          />
          <input
            type="number"
            value={config.duration_matrix?.focus?.low || 30}
            onChange={(e) => handleSaveConfig('duration_matrix', { ...config.duration_matrix, focus: { ...config.duration_matrix.focus, low: parseInt(e.target.value) } })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-center"
          />

          <div className="font-medium text-gray-900 flex items-center">Noise Task</div>
          <input
            type="number"
            value={config.duration_matrix?.noise?.high || 45}
            onChange={(e) => handleSaveConfig('duration_matrix', { ...config.duration_matrix, noise: { ...config.duration_matrix.noise, high: parseInt(e.target.value) } })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-center"
          />
          <input
            type="number"
            value={config.duration_matrix?.noise?.medium || 30}
            onChange={(e) => handleSaveConfig('duration_matrix', { ...config.duration_matrix, noise: { ...config.duration_matrix.noise, medium: parseInt(e.target.value) } })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-center"
          />
          <input
            type="number"
            value={config.duration_matrix?.noise?.low || 15}
            onChange={(e) => handleSaveConfig('duration_matrix', { ...config.duration_matrix, noise: { ...config.duration_matrix.noise, low: parseInt(e.target.value) } })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-center"
          />
        </div>
      </section>

      <section className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Break Rules</h2>
        <div className="grid gap-6 max-w-xl">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Short Break Duration (min)</label>
            <input
              type="number"
              value={config.break_rules?.short_duration || 15}
              onChange={(e) => handleSaveConfig('break_rules', { ...config.break_rules, short_duration: parseInt(e.target.value) })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
            <p className="text-xs text-gray-500 mt-1">For tasks under 1 hour</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Long Break Duration (min)</label>
            <input
              type="number"
              value={config.break_rules?.long_duration || 30}
              onChange={(e) => handleSaveConfig('break_rules', { ...config.break_rules, long_duration: parseInt(e.target.value) })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
            <p className="text-xs text-gray-500 mt-1">For tasks over 1 hour</p>
          </div>
        </div>
      </section>

      <section className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Ranking Weights</h2>
        <div className="space-y-4 max-w-xl">
          {Object.entries(config.weights || {}).map(([key, value]: [string, any]) => (
            <div key={key}>
              <div className="flex justify-between mb-1">
                <label className="text-sm font-medium text-gray-700 capitalize">{key}</label>
                <span className="text-sm text-gray-500">{Math.round(value * 100)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={value}
                onChange={(e) => handleSaveConfig('weights', { ...config.weights, [key]: parseFloat(e.target.value) })}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
            </div>
          ))}
        </div>
      </section>

      <section className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">General Settings</h2>
        <div className="grid gap-6 max-w-xl">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Timezone</label>
            <select
              value={config.timezone || 'UTC'}
              onChange={(e) => handleSaveConfig('timezone', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white"
            >
              <option value="UTC">UTC</option>
              <option value="America/New_York">Eastern Time (US & Canada)</option>
              <option value="America/Los_Angeles">Pacific Time (US & Canada)</option>
              <option value="Europe/London">London</option>
              <option value="Europe/Paris">Paris</option>
              <option value="Asia/Tokyo">Tokyo</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Sync Interval (minutes)</label>
            <input
              type="number"
              value={config.sync_interval_minutes || 15}
              onChange={(e) => handleSaveConfig('sync_interval_minutes', parseInt(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Re-schedule Timeout (hours)</label>
            <input
              type="number"
              value={config.reschedule_timeout_hours || 12}
              onChange={(e) => handleSaveConfig('reschedule_timeout_hours', parseInt(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>
        </div>
      </section>
    </div>
  );
}
