'use client';

import { useState, useEffect, useCallback } from 'react';
import { getDashboardStats, getScheduledTasks, getRecentActivity } from '@/app/actions/dashboard';

type Task = {
  id: number;
  cleanName: string;
  status: string;
  scheduledStart: Date | null;
  updatedAt: Date | null;
  calendarId: string | null;
  projectName?: string;
};

type DashboardData = {
  stats: {
    scheduledToday: number;
    pending: number;
    rescheduled: number;
    completed: number;
  };
  syncState: {
    lastSyncAt: Date | null;
    syncInProgress: boolean;
    syncIntervalMinutes: number;
  } | null;
  scheduledTasks: Task[];
  recentActivity: Task[];
};

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  const fetchData = useCallback(async () => {
    try {
      const [statsData, scheduledData, activityData] = await Promise.all([
        getDashboardStats(),
        getScheduledTasks(20),
        getRecentActivity(10)
      ]);

      setData({
        stats: statsData.stats,
        syncState: statsData.syncState,
        scheduledTasks: scheduledData as Task[],
        recentActivity: activityData as Task[]
      });
      setLastRefreshed(new Date());
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      await fetch('/api/sync/trigger', { method: 'POST' });
      setTimeout(fetchData, 2000);
    } catch (error) {
      console.error('Sync failed:', error);
    } finally {
      setSyncing(false);
    }
  };

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Dashboard</h1>
          <p className="text-gray-500 mt-1">
            Overview of your calendar sync status. Last updated: {lastRefreshed.toLocaleTimeString()}
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => fetchData()}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Refresh
          </button>
          <button
            onClick={handleSync}
            disabled={syncing || data?.syncState?.syncInProgress}
            className={`px-4 py-2 text-sm font-medium text-white rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
              syncing || data?.syncState?.syncInProgress
                ? 'bg-blue-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {syncing || data?.syncState?.syncInProgress ? 'Syncing...' : 'Sync Now'}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h3 className="text-lg font-medium text-gray-900">Connection Status</h3>
            <div className="mt-2 flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-green-500"></span>
                <span className="text-sm text-gray-600">Tududi Connected</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-green-500"></span>
                <span className="text-sm text-gray-600">Google Calendar Connected</span>
              </div>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-500">Last Sync</p>
            <p className="text-lg font-medium text-gray-900">
              {data?.syncState?.lastSyncAt
                ? new Date(data.syncState.lastSyncAt).toLocaleString()
                : 'Never'}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Next scheduled: {data?.syncState?.lastSyncAt 
                ? new Date(new Date(data.syncState.lastSyncAt).getTime() + (data.syncState.syncIntervalMinutes * 60000)).toLocaleTimeString() 
                : 'Unknown'}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Scheduled Today"
          value={data?.stats.scheduledToday || 0}
          color="blue"
        />
        <StatCard
          title="Pending Tasks"
          value={data?.stats.pending || 0}
          color="yellow"
        />
        <StatCard
          title="Rescheduled"
          value={data?.stats.rescheduled || 0}
          color="orange"
        />
        <StatCard
          title="Completed"
          value={data?.stats.completed || 0}
          color="green"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Upcoming Scheduled Tasks</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Task</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Scheduled For</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {data?.scheduledTasks.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-6 py-4 text-center text-sm text-gray-500">
                      No upcoming tasks scheduled
                    </td>
                  </tr>
                ) : (
                  data?.scheduledTasks.map((task) => (
                    <tr key={task.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {task.cleanName}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {task.scheduledStart ? new Date(task.scheduledStart).toLocaleString() : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <StatusBadge status={task.status} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Recent Activity</h3>
          </div>
          <div className="divide-y divide-gray-200 max-h-[600px] overflow-y-auto">
            {data?.recentActivity.length === 0 ? (
              <div className="p-6 text-center text-sm text-gray-500">
                No recent activity
              </div>
            ) : (
              data?.recentActivity.map((task) => (
                <div key={task.id} className="p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex justify-between items-start">
                    <p className="text-sm font-medium text-gray-900 truncate pr-2">
                      {task.cleanName}
                    </p>
                    <span className="text-xs text-gray-500 whitespace-nowrap">
                      {task.updatedAt ? new Date(task.updatedAt).toLocaleTimeString() : ''}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center justify-between">
                    <p className="text-xs text-gray-500">
                      Status updated to <span className="font-medium">{task.status}</span>
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, color }: { title: string; value: number; color: string }) {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-700 border-blue-100',
    yellow: 'bg-yellow-50 text-yellow-700 border-yellow-100',
    orange: 'bg-orange-50 text-orange-700 border-orange-100',
    green: 'bg-green-50 text-green-700 border-green-100',
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
      <p className="text-sm font-medium text-gray-500">{title}</p>
      <p className={`mt-2 text-3xl font-bold ${colorClasses[color as keyof typeof colorClasses].split(' ')[1]}`}>
        {value}
      </p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles = {
    pending: 'bg-yellow-100 text-yellow-800',
    scheduled: 'bg-blue-100 text-blue-800',
    completed: 'bg-green-100 text-green-800',
    rescheduled: 'bg-orange-100 text-orange-800',
    failed: 'bg-red-100 text-red-800',
    cancelled: 'bg-gray-100 text-gray-800',
  };

  const style = styles[status as keyof typeof styles] || 'bg-gray-100 text-gray-800';

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${style}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}
