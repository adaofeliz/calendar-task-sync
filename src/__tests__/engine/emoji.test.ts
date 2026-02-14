import { describe, it, expect } from 'vitest';
import {
  stripEmoji,
  applyEmoji,
  detectEmoji,
  hasAnyEmoji,
  normalizeTaskName,
} from '@/lib/engine/emoji';

describe('stripEmoji', () => {
  it('should strip scheduled emoji', () => {
    expect(stripEmoji('📅 Task name')).toBe('Task name');
  });

  it('should strip problem emoji', () => {
    expect(stripEmoji('⚠️ Task name')).toBe('Task name');
  });

  it('should strip past due emoji', () => {
    expect(stripEmoji('❌ Task name')).toBe('Task name');
  });

  it('should strip multiple emojis', () => {
    expect(stripEmoji('📅 ⚠️ Task name')).toBe('Task name');
    expect(stripEmoji('⚠️ ❌ 📅 Task name')).toBe('Task name');
  });

  it('should handle names without emoji', () => {
    expect(stripEmoji('Task name')).toBe('Task name');
  });

  it('should normalize whitespace', () => {
    expect(stripEmoji('📅   Task name')).toBe('Task name');
  });
});

describe('applyEmoji', () => {
  it('should apply scheduled emoji', () => {
    expect(applyEmoji('Task name', '📅')).toBe('📅 Task name');
  });

  it('should strip existing emoji before applying', () => {
    expect(applyEmoji('📅 Task name', '⚠️')).toBe('⚠️ Task name');
  });
});

describe('detectEmoji', () => {
  it('should detect scheduled emoji', () => {
    expect(detectEmoji('📅 Task name')).toBe('📅');
  });

  it('should detect problem emoji', () => {
    expect(detectEmoji('⚠️ Task name')).toBe('⚠️');
  });

  it('should detect past due emoji', () => {
    expect(detectEmoji('❌ Task name')).toBe('❌');
  });

  it('should return null for names without emoji', () => {
    expect(detectEmoji('Task name')).toBeNull();
  });

  it('should return first emoji when multiple present', () => {
    expect(detectEmoji('📅 ⚠️ Task name')).toBe('📅');
  });
});

describe('hasAnyEmoji', () => {
  it('should return true for names with emoji', () => {
    expect(hasAnyEmoji('📅 Task')).toBe(true);
    expect(hasAnyEmoji('⚠️ Task')).toBe(true);
    expect(hasAnyEmoji('❌ Task')).toBe(true);
  });

  it('should return false for names without emoji', () => {
    expect(hasAnyEmoji('Task name')).toBe(false);
  });
});

describe('normalizeTaskName', () => {
  it('should strip all emojis and normalize', () => {
    expect(normalizeTaskName('📅 ⚠️ Task name')).toBe('Task name');
  });
});
