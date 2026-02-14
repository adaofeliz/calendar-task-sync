'use server';

import { fetchDashboardStats, fetchScheduledTasks, fetchRecentActivity } from '@/lib/dashboard-data';

export async function getDashboardStats() {
  return await fetchDashboardStats();
}

export async function getScheduledTasks(limit: number = 20) {
  return await fetchScheduledTasks(limit);
}

export async function getRecentActivity(limit: number = 10) {
  return await fetchRecentActivity(limit);
}
