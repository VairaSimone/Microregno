import { BOARD_SIZE, BUILDINGS, MAX_BUILDING_LEVEL, OFFLINE_CAP_MINUTES } from './definitions';
import { advanceTime, createInitialState } from './engine';
import { ensureCommunity } from './community';
import { ensureWorldState } from './livingWorld';
import { localDateKey } from './challenge';
import type { Building, ChallengeSave, GameState, Resource } from './types';

const KEY = 'microregno:kingdom:v1';
const CHALLENGE = 'microregno:challenge:';
const MAX_SAVED_POPULATION = 5000;
const BUILDING_TYPES = Object.keys(BUILDINGS) as Array<Building['type']>;
const RESOURCES: Resource[] = ['wood', 'stone', 'food', 'coins'];

function valid(value: unknown): value is GameState {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const state = value as Partial<GameState>;
  const resources = state.resources as Record<string, unknown> | undefined;
  return state.version === 1
    && typeof state.seed === 'number' && Number.isFinite(state.seed)
    && typeof state.population === 'number' && Number.isInteger(state.population)
    && state.population >= 0 && state.population <= MAX_SAVED_POPULATION
    && typeof state.gameMinutes === 'number' && Number.isFinite(state.gameMinutes) && state.gameMinutes >= 0
    && Array.isArray(state.buildings) && state.buildings.length <= BOARD_SIZE * BOARD_SIZE * 2
    && !!resources && RESOURCES.every((key) => typeof resources[key] === 'number' && Number.isFinite(resources[key]) && (resources[key] as number) >= 0);
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

/** Validate map entries before the world migration touches buildings or citizen homes. */
function normalizeStoredState(value: unknown): GameState | null {
  if (!valid(value)) return null;
  const source = value;
  const safeBuildings = (source.buildings as unknown[])
    .filter((raw): raw is Building => {
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return false;
      const building = raw as Partial<Building>;
      return typeof building.id === 'string' && building.id.length > 0 && building.id.length <= 160
        && BUILDING_TYPES.includes(building.type as Building['type'])
        && Number.isInteger(building.x) && Number.isInteger(building.y)
        && (building.x as number) >= 0 && (building.x as number) < BOARD_SIZE
        && (building.y as number) >= 0 && (building.y as number) < BOARD_SIZE
        && Number.isInteger(building.level) && (building.level as number) >= 1 && (building.level as number) <= MAX_BUILDING_LEVEL;
    })
    .slice(0, BOARD_SIZE * BOARD_SIZE);
  const usedPositions = new Set<string>();
  const usedIds = new Set<string>();
  let buildings = safeBuildings.filter((building) => {
    const position = building.x + ',' + building.y;
    if (usedPositions.has(position) || usedIds.has(building.id)) return false;
    usedPositions.add(position);
    usedIds.add(building.id);
    return true;
  });
  if (!buildings.some((building) => building.type === 'townHall')) return null;
  buildings = buildings.filter((building, index, list) =>
    building.type !== 'townHall' || list.findIndex((other) => other.type === 'townHall') === index);

  const state: GameState = {
    ...source,
    seed: Math.trunc(source.seed),
    population: Math.floor(source.population),
    gameMinutes: Math.floor(source.gameMinutes),
    resources: Object.fromEntries(RESOURCES.map((resource) => [resource, source.resources[resource]])) as GameState['resources'],
    buildings,
    lastSavedAt: typeof source.lastSavedAt === 'number' && Number.isFinite(source.lastSavedAt) && source.lastSavedAt >= 0
      ? source.lastSavedAt
      : Date.now(),
  };

  let normalized = ensureWorldState(ensureCommunity(state));
  const hall = normalized.buildings.find((building) => building.type === 'townHall');
  if (hall) {
    const nonHallCapacity = normalized.buildings
      .filter((building) => building.type !== 'townHall')
      .reduce((total, building) => total + (BUILDINGS[building.type].housing ?? 0) * building.level, 0);
    while (
      hall.level < MAX_BUILDING_LEVEL
      && nonHallCapacity + (BUILDINGS.townHall.housing ?? 0) * hall.level + (normalized.community?.housingBonus ?? 0) < normalized.population
    ) hall.level++;
  }
  normalized = ensureWorldState(normalized);
  return normalized;
}

export function loadKingdom(): GameState {
  return normalizeStoredState(read<unknown>(KEY)) ?? createInitialState();
}

export function saveKingdom(state: GameState): boolean {
  return write(KEY, { ...state, lastSavedAt: Date.now() });
}

export function applyOfflineProgress(state: GameState, now = Date.now()): { state: GameState; minutes: number } {
  const normalized = ensureWorldState(ensureCommunity(state));
  const secondsAway = Math.floor(Math.max(0, now - (normalized.lastSavedAt || now)) / 1000);
  const minutes = Math.min(OFFLINE_CAP_MINUTES * 60, secondsAway);
  let copy: GameState = { ...normalized, resources: { ...normalized.resources }, buildings: normalized.buildings.map((building) => ({ ...building })) };
  let remaining = minutes;
  while (remaining > 0) {
    const chunk = Math.min(360, remaining);
    copy = advanceTime(copy, chunk, false);
    remaining -= chunk;
  }

  // Citizen requests pause while the game is closed. Shift their game-time
  // deadlines by the offline interval, so they do not expire immediately on return.
  if (minutes > 0 && copy.community) {
    const community = copy.community;
    copy = {
      ...copy,
      community: {
        ...community,
        activeRequest: community.activeRequest
          ? { ...community.activeRequest, deadline: community.activeRequest.deadline + minutes }
          : null,
        nextRequestAt: community.nextRequestAt + minutes,
      },
    };
  }
  copy.lastSavedAt = now;
  return { state: copy, minutes };
}

export function loadChallengeSave(date = localDateKey()): ChallengeSave | null {
  const value = read<ChallengeSave>(CHALLENGE + date);
  if (!value || value.date !== date || typeof value.completed !== 'boolean' || !Number.isFinite(value.score) || !Number.isFinite(value.bestScore)) return null;
  const state = normalizeStoredState(value.state);
  return state ? { ...value, state } : null;
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
