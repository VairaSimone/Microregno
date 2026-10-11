import { describe, expect, it } from 'vitest';
import { createInitialState, advanceTime, resourceRates } from './engine';
import { advanceRealmMinute, canExploreRegion, createWorldState, getInterestGroups, getResourcePurchasePrice, goodsStorageCapacity, totalStoredGoods, ensureWorldState, performRealmAction, realmModifiers, worldBuildingMultiplier } from './livingWorld';
import { resolveCitizenRequest } from './community';
import type { Building } from './types';

function unlockBorough(state: ReturnType<typeof createInitialState>): void {
  state.progression!.unlockedEpochs = ['settlement', 'village', 'borough'];
}

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

  it('uses medicine to restore the least healthy resident and consumes one remedy', () => {
    const state = createInitialState(450);
    state.gameMinutes = 60;
    state.world!.goods.medicine = 1;
    const patient = state.world!.citizens[0]!;
    patient.health = 50;
    const after = advanceRealmMinute(state);
    expect(after.world!.citizens.find((citizen) => citizen.id === patient.id)!.health).toBeGreaterThan(70);
    expect(after.world!.goods.medicine).toBeLessThan(1);
    expect(after.world!.chronicle.some((entry) => entry.includes('dispensario'))).toBe(true);
  });

  it('uses bread as a daily food supplement and as a fallback when food stocks run out', () => {
    const withBread = createInitialState(451);
    withBread.resources.food = 100;
    withBread.world!.goods.bread = 5;
    const withoutBread = { ...withBread, world: { ...withBread.world!, goods: { ...withBread.world!.goods, bread: 0 }, citizens: withBread.world!.citizens.map((citizen) => ({ ...citizen })) } };
    const fed = advanceRealmMinute(withBread);
    const unfed = advanceRealmMinute(withoutBread);
    expect(fed.world!.goods.bread).toBeLessThan(5);
    expect(fed.world!.citizens[0]!.hunger).toBeLessThan(unfed.world!.citizens[0]!.hunger);
  });

  it('uses stored tools to increase industrial output efficiency', () => {
    const state = createInitialState(452);
    const farm: Building = { id: 'tools-farm', type: 'farm', x: 4, y: 4, level: 1 };
    state.buildings.push(farm);
    state.world!.goods.tools = 0;
    const withoutTools = worldBuildingMultiplier(state, farm);
    state.world!.goods.tools = 1;
    const withTools = worldBuildingMultiplier(state, farm);
    expect(withTools).toBeCloseTo(withoutTools * 1.12);
  });

  it('wears one tool for maintenance when productive workplaces are active', () => {
    const state = createInitialState(453);
    state.gameMinutes = 180;
    state.world!.goods.tools = 1;
    state.buildings.push({ id: 'maintenance-farm', type: 'farm', x: 4, y: 4, level: 1 });
    const after = advanceRealmMinute(state);
    expect(after.world!.goods.tools).toBeLessThan(1);
  });

  it('allows a staffed market to import raw materials at dynamic prices', () => {
    const state = createInitialState(454);
    state.buildings.push({ id: 'raw-market', type: 'market', x: 4, y: 4, level: 1 });
    state.resources.coins = 100;
    state.resources.wood = 5;
    const unitPrice = getResourcePurchasePrice(state, 'wood');
    const bought = performRealmAction(state, { type: 'buyResource', resource: 'wood', amount: 5 });
    expect(bought.ok).toBe(true);
    expect(bought.state.resources.wood).toBe(10);
    expect(bought.state.resources.coins).toBe(100 - unitPrice * 5);
  });

  it('uses one shared capacity for all stored goods and migrates overfull old saves', () => {
    const state = createInitialState(455);
    state.world!.goods = { grain: 80, flour: 80, bread: 80, tools: 80, medicine: 80 };
    const normalized = ensureWorldState(state);
    expect(totalStoredGoods(normalized.world!.goods)).toBeLessThanOrEqual(goodsStorageCapacity(normalized));
    expect(normalized.world!.goods.tools).toBeGreaterThan(0);
    expect(normalized.world!.goods.medicine).toBeGreaterThan(0);
  });

  it('lets the player change a citizen profession and persists the journal entry', () => {
    const state = createInitialState();
    const citizen = state.world!.citizens[0]!;
    const result = performRealmAction(state, { type: 'assign', citizenId: citizen.id, value: 'scout' });
    expect(result.ok).toBe(true);
    expect(result.state.world?.citizens[0]?.profession).toBe('scout');
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
    unlockBorough(state);
    state.world!.researchPoints = 0;
    const denied = performRealmAction(state, { type: 'research', id: 'irrigation' });
    expect(denied.ok).toBe(false);
    state.world!.researchPoints = 40;
    state.buildings.push({ id: 'research-farm', type: 'farm', x: 4, y: 4, level: 1 });
    const started = performRealmAction(state, { type: 'research', id: 'irrigation' });
    expect(started.ok).toBe(true);
    expect(started.state.world?.activeResearch).toBe('irrigation');
    expect(started.state.world?.researchPoints).toBe(22);
  });

  it('keeps research locked until its building prerequisite exists', () => {
    const state = createInitialState(); unlockBorough(state); state.world!.researchPoints = 40;
    const denied = performRealmAction(state, { type: 'research', id: 'irrigation' });
    expect(denied.ok).toBe(false); expect(denied.message).toContain('Fattoria');
  });

  it('lets citizens eat from food reserves instead of becoming hungry forever', () => {
    const state = createInitialState(); state.resources.food = 300;
    state.world!.citizens.forEach((citizen) => { citizen.hunger = 60; });
    const next = advanceRealmMinute(state);
    expect(next.world!.citizens.every((citizen) => citizen.hunger < 60)).toBe(true);
  });

  it('uses bread as a substitute when the main food reserve is empty', () => {
    const state = createInitialState(); state.resources.food = 0; state.world!.goods.bread = 5;
    state.world!.citizens.forEach((citizen) => { citizen.hunger = 60; });
    const next = advanceRealmMinute(state);
    expect(next.world!.goods.bread).toBeLessThan(5);
    expect(next.world!.citizens.every((citizen) => citizen.hunger < 60)).toBe(true);
  });

  it('supports assigning a citizen to a specific workplace', () => {
    const state = createInitialState();
    const first: Building = { id: 'farm-one', type: 'farm', x: 4, y: 4, level: 1 };
    const second: Building = { id: 'farm-two', type: 'farm', x: 6, y: 4, level: 1 };
    state.buildings.push(first, second);
    const citizen = state.world!.citizens.find((person) => person.profession === 'farmer')!;
    const assigned = performRealmAction(state, { type: 'workplace', citizenId: citizen.id, buildingId: second.id });
    expect(assigned.ok).toBe(true);
    expect(assigned.state.world!.citizens.find((person) => person.id === citizen.id)!.workplaceId).toBe(second.id);
    expect(worldBuildingMultiplier(assigned.state, second)).toBeGreaterThan(0);
  });

  it('does not corrupt resources when expedition input contains invalid numbers', () => {
    const state = createInitialState(1234); state.resources.food = 120;
    const invalidFood = performRealmAction(state, { type: 'expedition', id: 'forest', foodSupply: Number.NaN });
    expect(invalidFood.ok).toBe(false);
    expect(Number.isFinite(invalidFood.state.resources.food)).toBe(true);
    expect(invalidFood.state.resources.food).toBe(120);
    const invalidDuration = performRealmAction(state, { type: 'expedition', id: 'forest', foodSupply: 8, durationFactor: Number.POSITIVE_INFINITY });
    expect(invalidDuration.ok).toBe(false);
    expect(Number.isFinite(invalidDuration.state.resources.food)).toBe(true);
    expect(invalidDuration.state.resources.food).toBe(120);
  });

  it('does not produce goods in a workplace that has no assigned worker', () => {
    const state = createInitialState();
    state.gameMinutes = 500;
    const farm: Building = { id: 'farm-unstaffed', type: 'farm', x: 4, y: 4, level: 1 };
    state.buildings.push(farm);
    state.world!.citizens.forEach((citizen) => { citizen.profession = 'builder'; citizen.workplaceId = null; });
    state.world!.goods.grain = 0;
    expect(worldBuildingMultiplier(state, farm)).toBe(0);
    const next = advanceRealmMinute(state);
    expect(next.world!.goods.grain).toBe(0);
  });

  it('configures expedition crew, provisions, equipment and duration', () => {
    const state = createInitialState(1234); unlockBorough(state); state.resources.food = 120; state.world!.goods.tools = 2;
    const started = performRealmAction(state, { type: 'expedition', id: 'forest', scoutId: 'citizen-5', crewIds: ['citizen-5', 'citizen-1'], foodSupply: 14, durationFactor: 1.25, useTools: false });
    expect(started.ok).toBe(true); expect(started.state.world!.expeditions[0]!.eta).toBe(125);
    expect(started.state.resources.food).toBe(106); expect(started.state.world!.expeditions[0]!.crewIds).toEqual(['citizen-5', 'citizen-1']);
    expect(started.state.world!.goods.tools).toBe(2);
  });

  it('computes support for internal interest groups from kingdom conditions', () => {
    const state = createInitialState(); const before = getInterestGroups(state);
    state.world!.policies.food = 'generous'; const after = getInterestGroups(state);
    expect(before.find((group) => group.id === 'farmers')!.support).not.toBe(after.find((group) => group.id === 'farmers')!.support);
    expect(after).toHaveLength(4);
  });

  it('sends a scout to an available region and resolves a real expedition', () => {
    const state = createInitialState(1234);
    unlockBorough(state);
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
    unlockBorough(state);
    state.buildings.push({ id: 'project-farm', type: 'farm', x: 4, y: 4, level: 1 });
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
    state.buildings.push({ id: 'event-test-house', type: 'house', x: 4, y: 4, level: 1 });
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
    unlockBorough(state);
    const faction = state.world!.factions[0]!;
    state.world!.factions[0] = { ...faction, relation: 60 };
    const treaty = performRealmAction(state, { type: 'diplomacy', id: faction.id, value: 'treaty' });
    expect(treaty.ok).toBe(true);
    expect(treaty.state.world?.tradeRoutes).toContain(faction.id);
    expect(realmModifiers(treaty.state).tradeIncome).toBeGreaterThan(0);
  });

  it('adds useful transport value to a productive building beside a road', () => {
    const state = createInitialState();
    const farm: Building = { id: 'farm-road-test', type: 'farm', x: 5, y: 4, level: 1 };
    state.buildings.push(farm);
    const before = worldBuildingMultiplier(state, farm);
    state.buildings.push({ id: 'road-test', type: 'road', x: 5, y: 5, level: 1 });
    const after = worldBuildingMultiplier(state, farm);
    expect(after).toBeCloseTo(before * 1.08);
  });

  it('refreshes market demand on a schedule and makes stock sellable through a staffed market', () => {
    const state = createInitialState(9182);
    const initialPrices = { ...state.world!.market.prices };
    const refreshed = advanceTime(state, 120);
    expect(refreshed.world!.market.cycle).toBe(1);
    expect(refreshed.world!.market.nextShiftAt).toBe(240);
    expect(refreshed.world!.market.demand).not.toEqual({ grain: 1, flour: 1, bread: 1, tools: 1, medicine: 1 });
    expect(refreshed.world!.market.prices).not.toEqual(initialPrices);

    state.world!.goods.grain = 15;
    state.world!.market.prices.grain = 3;
    const denied = performRealmAction(state, { type: 'tradeGoods', good: 'grain', amount: 5 });
    expect(denied.ok).toBe(false);
    state.buildings.push({ id: 'market-test', type: 'market', x: 4, y: 4, level: 1 });
    const sold = performRealmAction(state, { type: 'tradeGoods', good: 'grain', amount: 5 });
    expect(sold.ok).toBe(true);
    expect(sold.state.world!.goods.grain).toBe(10);
    expect(sold.state.resources.coins).toBe(state.resources.coins + 15);
  });

  it('lets warehouses preserve perishable goods over a game day', () => {
    const exposed = createInitialState(123);
    exposed.world!.goods.bread = 100;
    const spoiled = advanceTime(exposed, 60);
    expect(spoiled.world!.goods.bread).toBeLessThan(100);

    const stored = createInitialState(123);
    stored.world!.goods.bread = 100;
    stored.buildings.push({ id: 'warehouse-test', type: 'warehouse', x: 4, y: 4, level: 1 });
    const preserved = advanceTime(stored, 60);
    expect(preserved.world!.goods.bread).toBeGreaterThan(spoiled.world!.goods.bread);
  });

  it('makes droughts temporarily reduce farm efficiency', () => {
    const state = createInitialState();
    const farm: Building = { id: 'farm-weather-test', type: 'farm', x: 5, y: 4, level: 1 };
    state.buildings.push(farm);
    const clearWeather = worldBuildingMultiplier(state, farm);
    state.world!.weather = { id: 'drought', endsAt: 100 };
    const duringDrought = worldBuildingMultiplier(state, farm);
    expect(duringDrought).toBeCloseTo(clearWeather * 0.68);
    state.gameMinutes = 100;
    expect(worldBuildingMultiplier(state, farm)).toBeCloseTo(clearWeather);
  });

  it('varies event families between seed variants instead of repeating one event', () => {
    const titles = new Set<number | string>();
    for (const seed of [101, 205, 777, 1234, 9182, 712, 55, 87]) {
      const state = createInitialState(seed);
      state.resources.food = 100;
      state.resources.coins = 40;
      state.buildings.push({ id: 'event-house-' + seed, type: 'house', x: 4, y: 4, level: 1 });
      const withEvent = advanceTime(state, 240);
      titles.add(withEvent.world!.activeEvent!.title);
    }
    expect(titles.size).toBeGreaterThan(1);
  });

  it('makes intensive forestry deplete the woods while protection regenerates them', () => {
    const intensive = createInitialState(712);
    intensive.world!.policies.forest = 'intensive';
    intensive.buildings.push({ id: 'sawmill-test', type: 'sawmill', x: 4, y: 5, level: 1 });
    const depleted = advanceTime(intensive, 60);
    expect(depleted.world!.forestHealth).toBeLessThan(100);

    const protectedState = createInitialState(712);
    protectedState.world!.policies.forest = 'protected';
    protectedState.buildings.push({ id: 'sawmill-test', type: 'sawmill', x: 4, y: 5, level: 1 });
    const recovered = advanceTime(protectedState, 60);
    expect(recovered.world!.forestHealth).toBe(100);
  });

  it('keeps citizen needs and inventories finite through four seasons', () => {
    let state = createInitialState(8128);
    state.buildings.push({ id: 'long-run-farm', type: 'farm', x: 4, y: 4, level: 1 });
    state.buildings.push({ id: 'long-run-house', type: 'house', x: 4, y: 5, level: 1 });
    for (let season = 0; season < 4; season++) state = advanceTime(state, 360);
    const world = state.world!;
    expect(state.gameMinutes).toBe(1440);
    expect(world.citizens).toHaveLength(state.population);
    expect(Object.values(state.resources).every((value) => Number.isFinite(value) && value >= 0)).toBe(true);
    expect(Object.values(world.goods).every((value) => Number.isFinite(value) && value >= 0 && value <= 100 + state.buildings.filter((building) => building.type === 'warehouse').reduce((sum, building) => sum + 80 * building.level, 0))).toBe(true);
    expect(world.citizens.every((citizen) => [citizen.hunger, citizen.energy, citizen.happiness, citizen.health].every((value) => Number.isFinite(value) && value >= 0 && value <= 100))).toBe(true);
    expect(Number.isFinite(world.forestHealth) && world.forestHealth >= 0 && world.forestHealth <= 100).toBe(true);
    expect(Number.isFinite(world.researchPoints) && world.researchPoints >= 0).toBe(true);
  });

  it('preserves a queued story when the current event has no follow-up', () => {
    const state = createInitialState();
    state.world!.activeEvent = {
      id: 'caravan',
      title: 'Un evento in corso',
      description: 'Una decisione semplice.',
      startedAt: 0,
      choices: [{ id: 'continue', label: 'Continua', detail: 'Nessun costo.' }],
    };
    state.world!.queuedEvent = 'ruins-found';
    state.world!.nextEventAt = 45;

    const result = performRealmAction(state, { type: 'event', id: 'continue' });

    expect(result.ok).toBe(true);
    expect(result.state.world!.queuedEvent).toBe('ruins-found');
    expect(result.state.world!.nextEventAt).toBe(45);
  });

  it('does not let an event reduce the population below the playable minimum', () => {
    const state = createInitialState();
    state.world!.activeEvent = {
      id: 'caravan',
      title: 'Una partenza',
      description: 'Una persona lascia il borgo.',
      startedAt: 0,
      choices: [{ id: 'departure', label: 'Accetta', detail: 'Il borgo perde un abitante.', populationDelta: -1 }],
    };

    const result = performRealmAction(state, { type: 'event', id: 'departure' });

    expect(result.ok).toBe(true);
    expect(result.state.population).toBe(5);
    expect(result.state.world!.citizens).toHaveLength(5);
  });

  it('queues a new event chain behind an already queued story', () => {
    const state = createInitialState();
    state.world!.queuedEvent = 'ruins-found';
    state.world!.activeEvent = {
      id: 'caravan',
      title: 'Un evento in corso',
      description: 'Una decisione semplice.',
      startedAt: 0,
      choices: [{ id: 'continue', label: 'Continua', detail: 'Avvia una seconda storia.', chain: 'drought-recovery' }],
    };

    const result = performRealmAction(state, { type: 'event', id: 'continue' });

    expect(result.ok).toBe(true);
    expect(result.state.world!.eventQueue).toEqual(['ruins-found', 'drought-recovery']);
    expect(result.state.world!.queuedEvent).toBe('ruins-found');
  });

  it('keeps population and citizen count synchronized for multi-person events', () => {
    const state = createInitialState();
    state.buildings.push(
      { id: 'arrival-house-1', type: 'house', x: 4, y: 4, level: 1 },
      { id: 'arrival-house-2', type: 'house', x: 7, y: 7, level: 1 },
    );
    state.world!.activeEvent = {
      id: 'caravan',
      title: 'Nuovi arrivati',
      description: 'Due persone cercano casa.',
      startedAt: 0,
      choices: [{
        id: 'welcome-both',
        label: 'Accoglili',
        detail: 'Entrano due nuovi abitanti.',
        populationDelta: 2,
        profession: 'scout',
      }],
    };

    const result = performRealmAction(state, { type: 'event', id: 'welcome-both' });

    expect(result.ok).toBe(true);
    expect(result.state.population).toBe(7);
    expect(result.state.world!.citizens).toHaveLength(7);
    expect(result.state.world!.citizens.slice(-2).every((citizen) => citizen.profession === 'scout')).toBe(true);
  });

  it('links the initial community request to a real saved resident', () => {
    const state = createInitialState(8765);
    const request = state.community!.activeRequest!;
    const citizen = state.world!.citizens.find((entry) => entry.id === request.citizenId);
    expect(citizen).toBeDefined();
    expect(request.citizen).toBe(citizen!.name);
  });

  it('records community decisions in the requester’s individual story', () => {
    const state = createInitialState(8766);
    const request = state.community!.activeRequest!;
    const result = resolveCitizenRequest(state, request.options[0]!.id);
    const requester = result.state.world!.citizens.find((citizen) => citizen.id === request.citizenId)!;
    expect(result.ok).toBe(true);
    expect(requester.personalHistory?.some((entry) => entry.includes('Consiglio'))).toBe(true);
  });

  it('lets useful traits improve a citizen’s production at work', () => {
    const state = createInitialState(8767);
    const farm: Building = { id: 'trait-farm', type: 'farm', x: 4, y: 4, level: 1 };
    state.buildings.push(farm);
    const worker = state.world!.citizens[0]!;
    worker.profession = 'farmer';
    worker.workplaceId = farm.id;
    worker.traits = [];
    const baseline = worldBuildingMultiplier(state, farm);
    worker.traits = ['inventivo'];
    expect(worldBuildingMultiplier(state, farm)).toBeGreaterThan(baseline);
  });

  it('recovers naturally from illness and clears the saved illness state', () => {
    const state = createInitialState(8768);
    state.gameMinutes = 240;
    state.world!.goods.medicine = 0;
    const patient = state.world!.citizens[0]!;
    patient.health = 70;
    patient.illness = { id: 'cold', severity: 1, since: 0 };
    const after = advanceRealmMinute(state);
    const recovered = after.world!.citizens.find((citizen) => citizen.id === patient.id)!;
    expect(recovered.illness).toBeNull();
    expect(recovered.personalHistory?.some((entry) => entry.includes('guarito'))).toBe(true);
  });

  it('uses remedies to cure a disease, not just restore health', () => {
    const state = createInitialState(8769);
    state.gameMinutes = 60;
    state.world!.goods.medicine = 1;
    const patient = state.world!.citizens[0]!;
    patient.health = 60;
    patient.illness = { id: 'fever', severity: 2, since: 0 };
    const after = advanceRealmMinute(state);
    const cured = after.world!.citizens.find((citizen) => citizen.id === patient.id)!;
    expect(cured.illness).toBeNull();
    expect(cured.health).toBeGreaterThan(80);
  });

  it('does not award research progress for scholars who are not assigned to a school', () => {
    const state = createInitialState(8770);
    state.buildings.push({ id: 'research-school', type: 'school', x: 4, y: 4, level: 1 });
    state.world!.citizens.forEach((citizen) => { citizen.profession = 'farmer'; citizen.workplaceId = null; });
    const scholar = state.world!.citizens[0]!;
    scholar.age = 10;
    scholar.profession = 'scholar';
    const before = state.world!.researchPoints;
    const after = advanceRealmMinute({ ...state, gameMinutes: 10 });
    expect(after.world!.researchPoints - before).toBeCloseTo(0.025);
  });

  it('ages residents and records an elder’s passing in the chronicle', () => {
    const state = createInitialState(8771);
    state.gameMinutes = 1440 * 30;
    state.resources.food = 0;
    const elder = state.world!.citizens[0]!;
    elder.age = 104;
    const comparisonId = state.world!.citizens[1]!.id;
    const oldAge = state.world!.citizens[1]!.age;
    const after = advanceRealmMinute(state);
    expect(after.population).toBe(4);
    expect(after.world!.citizens.some((citizen) => citizen.id === elder.id)).toBe(false);
    expect(after.world!.chronicle.some((entry) => entry.includes(elder.name) && entry.includes('salutato'))).toBe(true);
    expect(after.world!.citizens.find((citizen) => citizen.id === comparisonId)!.age).toBe(oldAge + 1);
  });

  it('links realm events to a real citizen and writes their outcome to personal history', () => {
    const state = createInitialState(8772);
    const opened = advanceRealmMinute({ ...state, gameMinutes: 240, world: { ...state.world!, nextEventAt: 0 } });
    const event = opened.world!.activeEvent!;
    expect(event.citizenId).toBeDefined();
    const choice = event.choices[0]!;
    const resolved = performRealmAction(opened, { type: 'event', id: choice.id });
    expect(resolved.ok).toBe(true);
    expect(resolved.state.world!.citizens.find((citizen) => citizen.id === event.citizenId)?.personalHistory?.some((entry) => entry.includes(event.title))).toBe(true);
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
