import { BUILDINGS, BOARD_SIZE, MAX_BUILDING_LEVEL, OFFLINE_CAP_MINUTES } from './definitions';
import { advanceTime, createInitialState } from './engine';
import { ensureCommunity } from './community';
import { ensureWorldState } from './livingWorld';
import { localDateKey } from './challenge';
import type { Building, BuildingType, ChallengeSave, GameState } from './types';

const KEY = 'microregno:kingdom:v1';
const CHALLENGE = 'microregno:challenge:';
const BUILDING_TYPES = new Set(Object.keys(BUILDINGS));

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function valid(value: unknown): value is GameState {
  if (!isRecord(value)) return false;
  const state = value as Partial<GameState>;
  const resources = state.resources as Record<string, unknown> | undefined;
  return state.version === 1
    && typeof state.seed === 'number' && Number.isFinite(state.seed)
    && typeof state.population === 'number' && Number.isFinite(state.population) && state.population >= 0
    && typeof state.gameMinutes === 'number' && Number.isFinite(state.gameMinutes) && state.gameMinutes >= 0
    && Array.isArray(state.buildings)
    && !!resources
    && ['wood', 'stone', 'food', 'coins'].every((key) => typeof resources[key] === 'number' && Number.isFinite(resources[key]) && (resources[key] as number) >= 0);
}

function sanitizeBuildings(value: unknown): Building[] {
  if (!Array.isArray(value)) return [];
  const ids = new Set<string>();
  const tiles = new Set<string>();
  const buildings: Building[] = [];
  let hasTownHall = false;

  for (const raw of value.slice(0, BOARD_SIZE * BOARD_SIZE)) {
    if (!isRecord(raw)) continue;
    const { id, type, x, y, level } = raw;
    if (typeof id !== 'string' || !id.trim() || typeof type !== 'string' || !BUILDING_TYPES.has(type)) continue;
    if (!Number.isInteger(x) || !Number.isInteger(y) || (x as number) < 0 || (y as number) < 0 || (x as number) >= BOARD_SIZE || (y as number) >= BOARD_SIZE) continue;
    if (!Number.isInteger(level) || (level as number) < 1 || (level as number) > MAX_BUILDING_LEVEL) continue;
    if (ids.has(id) || tiles.has(x + ',' + y)) continue;
    if (type === 'townHall' && hasTownHall) continue;

    ids.add(id);
    tiles.add(x + ',' + y);
    if (type === 'townHall') hasTownHall = true;
    buildings.push({ id, type: type as BuildingType, x: x as number, y: y as number, level: level as number });
  }
  return buildings;
}

function normalizeSavedState(raw: GameState): GameState | null {
  const buildings = sanitizeBuildings(raw.buildings);
  if (!buildings.some((building) => building.type === 'townHall')) return null;

  let state: GameState = {
    ...raw,
    population: Math.min(1000, Math.max(0, Math.floor(raw.population))),
    gameMinutes: Math.max(0, Math.floor(raw.gameMinutes)),
    lastSavedAt: Number.isFinite(raw.lastSavedAt) ? raw.lastSavedAt : Date.now(),
    buildings,
    resources: {
      wood: raw.resources.wood,
      stone: raw.resources.stone,
      food: raw.resources.food,
      coins: raw.resources.coins,
    },
  };
  state = ensureCommunity(state);

  // Preserve existing residents when an older save has more people than its starting hall can house.
  const hall = state.buildings.find((building) => building.type === 'townHall');
  if (hall) {
    const nonHallCapacity = state.buildings
      .filter((building) => building.type !== 'townHall')
      .reduce((total, building) => total + (BUILDINGS[building.type].housing ?? 0) * building.level, 0);
    while (hall.level < MAX_BUILDING_LEVEL
      && nonHallCapacity + (BUILDINGS.townHall.housing ?? 0) * hall.level + (state.community?.housingBonus ?? 0) < state.population) {
      hall.level++;
    }
  }
  return ensureWorldState(state);
}

function read<T>(key: string): T | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) as T : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown): boolean {
  try {
    if (typeof localStorage === 'undefined') return false;
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function loadKingdom(): GameState {
  const stored = read<unknown>(KEY);
  if (valid(stored)) {
    const normalized = normalizeSavedState(stored);
    if (normalized) return normalized;
  }
  return createInitialState();
}

export function saveKingdom(state: GameState): boolean {
  state.lastSavedAt = Date.now();
  return write(KEY, state);
}

export function applyOfflineProgress(state: GameState, now = Date.now()): { state: GameState; minutes: number } {
  // Live play advances one in-game minute per real second. Keep offline play identical.
  const normalized = ensureCommunity(state);
  const elapsedSeconds = Math.floor(Math.max(0, now - (normalized.lastSavedAt || now)) / 1000);
  const minutes = Math.min(OFFLINE_CAP_MINUTES * 60, elapsedSeconds);
  let copy: GameState = { ...normalized, resources: { ...normalized.resources }, buildings: normalized.buildings.map((building) => ({ ...building })) };
  let remaining = minutes;
  while (remaining > 0) {
    const chunk = Math.min(360, remaining);
    copy = advanceTime(copy, chunk, true, true);
    remaining -= chunk;
  }
  copy.lastSavedAt = now;
  return { state: copy, minutes };
}

export function loadChallengeSave(date = localDateKey()): ChallengeSave | null {
  const saved = read<ChallengeSave>(CHALLENGE + date);
  if (!saved || saved.date !== date || !valid(saved.state)
    || typeof saved.completed !== 'boolean' || !Number.isFinite(saved.score) || !Number.isFinite(saved.bestScore)) return null;
  const state = normalizeSavedState(saved.state);
  if (!state) return null;
  return { ...saved, state };
}

export function saveChallenge(state: ChallengeSave): boolean {
  return write(CHALLENGE + state.date, state);
}

export function resetKingdom(): void {
  try {
    if (typeof localStorage !== 'undefined') localStorage.removeItem(KEY);
  } catch {
    // Browser storage may be disabled.
  }
}
