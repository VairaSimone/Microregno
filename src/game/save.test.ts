import { afterEach, describe, expect, it, vi } from 'vitest';
import { createInitialState } from './engine';
import { ensureWorldState } from './livingWorld';
import { loadKingdom, resetKingdom, saveKingdom } from './save';
import type { GameState } from './types';

const KINGDOM_KEY = 'microregno:kingdom:v1';

function installStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  const storage = {
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => { values.set(key, value); }),
    removeItem: vi.fn((key: string) => { values.delete(key); }),
  };
  vi.stubGlobal('localStorage', storage);
  return { storage, values };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('save resilience', () => {
  it('loads a save with malformed, duplicate, out-of-bounds and overlapping buildings without crashing', () => {
    const state = createInitialState(222);
    const corrupted = {
      ...state,
      buildings: [
        null,
        state.buildings[0],
        { id: 'duplicate-id', type: 'farm', x: 4, y: 4, level: 1 },
        { id: 'duplicate-id', type: 'house', x: 3, y: 4, level: 1 },
        { id: 'off-map', type: 'market', x: 99, y: 99, level: 1 },
        { id: 'bad-level', type: 'house', x: 2, y: 2, level: 99 },
        { id: 'bad-type', type: 'dragon-lair', x: 1, y: 1, level: 1 },
      ],
    } as unknown as GameState;
    installStorage({ [KINGDOM_KEY]: JSON.stringify(corrupted) });

    const loaded = loadKingdom();

    expect(loaded.buildings.some((building) => building.type === 'townHall')).toBe(true);
    expect(new Set(loaded.buildings.map((building) => building.id)).size).toBe(loaded.buildings.length);
    expect(new Set(loaded.buildings.map((building) => building.x + ',' + building.y)).size).toBe(loaded.buildings.length);
    expect(loaded.buildings.every((building) => building.x >= 0 && building.x < 12 && building.y >= 0 && building.y < 12 && building.level >= 1 && building.level <= 3)).toBe(true);
    expect(loaded.population).toBe(5);
  });

  it('falls back safely when the stored save has no valid town hall', () => {
    const state = createInitialState(333);
    const corrupted = { ...state, buildings: [null, { id: 'bad', type: 'townHall', x: 5, y: 6, level: 0 }] } as unknown as GameState;
    installStorage({ [KINGDOM_KEY]: JSON.stringify(corrupted) });

    const loaded = loadKingdom();

    expect(loaded.buildings).toHaveLength(1);
    expect(loaded.buildings[0]?.type).toBe('townHall');
    expect(loaded.seed).not.toBe(333);
  });

  it('repairs malformed citizen records and releases orphaned explorers', () => {
    const state = createInitialState(444);
    const malformed = {
      ...state.world!,
      citizens: [
        null,
        {
          id: 'citizen-1',
          name: 'Corrotto',
          profession: 'not-a-job',
          traits: null,
          skills: null,
          relationships: null,
          hunger: Number.NaN,
          energy: -100,
          happiness: 101,
          health: 70,
          experience: -4,
          status: 'exploring',
          activity: 'exploring',
          workplaceId: null,
          expeditionId: 'missing-trip',
          lastAction: null,
          homeId: null,
          familyId: '',
          bornAt: 0,
        },
      ],
    } as unknown as NonNullable<GameState['world']>;
    const migrated = ensureWorldState({ ...state, world: malformed });
    const citizens = migrated.world!.citizens;

    expect(citizens).toHaveLength(state.population);
    expect(new Set(citizens.map((citizen) => citizen.id)).size).toBe(citizens.length);
    expect(citizens.every((citizen) => Array.isArray(citizen.traits) && citizen.traits.length > 0)).toBe(true);
    expect(citizens.every((citizen) => [citizen.hunger, citizen.energy, citizen.happiness, citizen.health].every(Number.isFinite))).toBe(true);
    expect(citizens.every((citizen) => citizen.status !== 'exploring' || !!citizen.expeditionId)).toBe(true);
    const repaired = citizens.find((citizen) => citizen.name === 'Corrotto');
    expect(repaired?.status).toBe('resident');
    expect(repaired?.profession).not.toBe('not-a-job');
    expect(repaired?.energy).toBe(0);
    expect(repaired?.happiness).toBe(100);
  });

  it('reports a failed local save instead of throwing when browser storage is blocked', () => {
    const storage = {
      getItem: vi.fn(() => null),
      setItem: vi.fn(() => { throw new Error('QuotaExceededError'); }),
      removeItem: vi.fn(),
    };
    vi.stubGlobal('localStorage', storage);

    expect(saveKingdom(createInitialState())).toBe(false);
    expect(() => resetKingdom()).not.toThrow();
  });
});
