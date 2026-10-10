import { describe, expect, it } from 'vitest';
import { createInitialState, advanceTime, resourceRates } from './engine';
import { advanceRealmMinute, canExploreRegion, createWorldState, performRealmAction, realmModifiers } from './livingWorld';
import type { Building } from './types';

describe('living world simulation', () => {
  it('creates persistent named citizens and safe migration from an old save', () => {
    const state = createInitialState(4102);
    expect(state.world?.citizens).toHaveLength(5);
    expect(new Set(state.world?.citizens.map((citizen) => citizen.id)).size).toBe(5);
    const migrated = { ...state, world: undefined };
    const rebuilt = createWorldState(migrated.seed, migrated.population, migrated.gameMinutes);
    expect(rebuilt.citizens).toHaveLength(5);
    expect(rebuilt.citizens.every((citizen) => citizen.health > 0 && citizen.traits.length > 0)).toBe(true);
  });

  it('lets the player change a citizen profession and persists the journal entry', () => {
    const state = createInitialState();
    const citizen = state.world!.citizens[0]!;
    const result = performRealmAction(state, { type: 'assign', citizenId: citizen.id, value: 'farmer' });
    expect(result.ok).toBe(true);
    expect(result.state.world?.citizens[0]?.profession).toBe('farmer');
    expect(result.state.world?.chronicle[0]).toContain(citizen.name);
    expect(state.world?.citizens[0]?.profession).toBe('farmer');
  });

  it('applies different tax laws to the real coin economy', () => {
    const state = createInitialState();
    const low = performRealmAction(state, { type: 'law', id: 'tax', value: 'low' });
    const high = performRealmAction(state, { type: 'law', id: 'tax', value: 'high' });
    expect(low.ok).toBe(true);
    expect(high.ok).toBe(true);
    expect(realmModifiers(low.state).taxMultiplier).toBeLessThan(realmModifiers(high.state).taxMultiplier);
    expect(resourceRates(high.state, Array.from({ length: 12 }, () => Array.from({ length: 12 }, () => 'grass' as const))).coins)
      .toBeGreaterThan(resourceRates(low.state, Array.from({ length: 12 }, () => Array.from({ length: 12 }, () => 'grass' as const))).coins);
  });

  it('starts a research only when knowledge points are available', () => {
    const state = createInitialState();
    state.world!.researchPoints = 0;
    const denied = performRealmAction(state, { type: 'research', id: 'irrigation' });
    expect(denied.ok).toBe(false);
    state.world!.researchPoints = 40;
    const started = performRealmAction(state, { type: 'research', id: 'irrigation' });
    expect(started.ok).toBe(true);
    expect(started.state.world?.activeResearch).toBe('irrigation');
    expect(started.state.world?.researchPoints).toBe(22);
  });

  it('sends a scout to an available region and resolves a real expedition', () => {
    const state = createInitialState(1234);
    state.resources.food = 120;
    state.world!.goods.tools = 2;
    const started = performRealmAction(state, { type: 'expedition', id: 'forest' });
    expect(started.ok).toBe(true);
    expect(started.state.world?.expeditions[0]?.status).toBe('active');
    expect(started.state.world?.citizens.find((citizen) => citizen.profession === 'scout')?.status).toBe('exploring');
    const returned = advanceTime(started.state, 100);
    expect(returned.world?.expeditions[0]?.status).toBe('success');
    expect(returned.world?.discoveredRegions).toContain('forest');
    expect(returned.world?.citizens.find((citizen) => citizen.profession === 'scout')?.status).toBe('resident');
  });

  it('processes farm-to-mill-to-bakery production with assigned workers', () => {
    const state = createInitialState();
    state.resources.food = 200;
    const buildings: Building[] = [
      ...state.buildings,
      { id: 'farm-chain', type: 'farm', x: 6, y: 4, level: 1 },
      { id: 'mill-chain', type: 'mill', x: 4, y: 4, level: 1 },
      { id: 'bakery-chain', type: 'bakery', x: 4, y: 5, level: 1 },
    ];
    state.buildings = buildings;
    state.world!.goods.grain = 40;
    state.world!.goods.flour = 10;
    state.world!.citizens[2]!.profession = 'miller';
    state.world!.citizens[3]!.profession = 'baker';
    const next = advanceRealmMinute(state);
    expect(next.world!.goods.grain).toBeLessThan(40.2);
    expect(next.world!.goods.bread).toBeGreaterThan(state.world!.goods.bread);
  });

  it('funds a multi-stage public project and activates a permanent benefit', () => {
    const state = createInitialState();
    const first = performRealmAction(state, { type: 'project', id: 'aqueduct' });
    expect(first.ok).toBe(true);
    expect(first.state.world?.projectStages.aqueduct).toBe(1);
    expect(first.state.resources.wood).toBe(32);
    const second = performRealmAction(first.state, { type: 'project', id: 'aqueduct' });
    expect(second.ok).toBe(true);
    expect(second.state.world?.projectStages.aqueduct).toBe(2);
  });

  it('opens a time-driven event and applies the chosen consequence', () => {
    const state = createInitialState(777);
    state.resources.food = 100;
    state.resources.coins = 40;
    const after = advanceTime(state, 240);
    expect(after.world?.activeEvent).not.toBeNull();
    const event = after.world!.activeEvent!;
    const choice = event.choices[0]!;
    const resolved = performRealmAction(after, { type: 'event', id: choice.id });
    expect(resolved.ok).toBe(true);
    expect(resolved.state.world?.activeEvent).toBeNull();
    expect(resolved.state.world?.chronicle[0]).toContain(event.title);
  });

  it('unlocks a permanent diplomatic route only after relations improve', () => {
    const state = createInitialState();
    const faction = state.world!.factions[0]!;
    state.world!.factions[0] = { ...faction, relation: 60 };
    const treaty = performRealmAction(state, { type: 'diplomacy', id: faction.id, value: 'treaty' });
    expect(treaty.ok).toBe(true);
    expect(treaty.state.world?.tradeRoutes).toContain(faction.id);
    expect(realmModifiers(treaty.state).tradeIncome).toBeGreaterThan(0);
  });

  it('requires discoveries or cartography before entering distant regions', () => {
    const state = createInitialState();
    expect(canExploreRegion(state.world!, 'forest')).toBe(true);
    expect(canExploreRegion(state.world!, 'mountains')).toBe(false);
    expect(canExploreRegion(state.world!, 'borderlands')).toBe(false);
    state.world!.researched.push('cartography');
    expect(canExploreRegion(state.world!, 'borderlands')).toBe(true);
  });
});
