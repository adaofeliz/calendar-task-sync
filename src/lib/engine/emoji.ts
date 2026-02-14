import type { Emoji } from './types';

const EMOJI_PATTERN = /^(?:📅|⚠️|❌)(?:\s+(?:📅|⚠️|❌))*\s*/;

export function stripEmoji(name: string): string {
  return name.replace(EMOJI_PATTERN, '').trim();
}

export function applyEmoji(cleanName: string, emoji: Emoji): string {
  const stripped = stripEmoji(cleanName);
  return `${emoji} ${stripped}`;
}

export function detectEmoji(name: string): Emoji | null {
  const match = name.match(EMOJI_PATTERN);
  if (!match) return null;
  
  const found = match[0].trim();
  if (found.includes('📅')) return '📅';
  if (found.includes('⚠️')) return '⚠️';
  if (found.includes('❌')) return '❌';
  
  return null;
}

export function hasAnyEmoji(name: string): boolean {
  return EMOJI_PATTERN.test(name);
}

export function normalizeTaskName(name: string): string {
  return stripEmoji(name);
}
