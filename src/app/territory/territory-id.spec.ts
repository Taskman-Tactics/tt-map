import { describe, expect, it } from 'vitest';
import { slugifyTerritoryName, uniqueTerritoryId } from './territory-id';

describe('territory-id', () => {
  it('slugifies names to kebab-case', () => {
    expect(slugifyTerritoryName('Gravewater')).toBe('gravewater');
    expect(slugifyTerritoryName('  Dark  Lake!! ')).toBe('dark-lake');
    expect(slugifyTerritoryName('São Tomé')).toBe('sao-tome');
  });

  it('returns empty for names with no slug characters', () => {
    expect(slugifyTerritoryName('---')).toBe('');
    expect(slugifyTerritoryName('!!!')).toBe('');
  });

  it('uniques colliding ids', () => {
    expect(uniqueTerritoryId('lake', ['lake', 'lake-2'])).toBe('lake-3');
    expect(uniqueTerritoryId('lake', ['river'])).toBe('lake');
  });
});
