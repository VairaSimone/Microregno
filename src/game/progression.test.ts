import { describe, expect, it } from 'vitest';
import { createInitialState } from './engine';
import { getCharterRequirements, getCurrentEpochId, getEpochRequirements, synchronizeKingdomProgression } from './progression';
import type { Building } from './types';

function addBuilding(state: ReturnType<typeof createInitialState>, building: Building): void {
  state.buildings.push(building);
}

describe('campagna e progressione per epoche', () => {
  it('sblocca il Villaggio e il Borgo con requisiti specifici e ricompense una tantum', () => {
    const state = createInitialState(777);
    addBuilding(state, { id: 'farm-epoch', type: 'farm', x: 4, y: 4, level: 1 });
    addBuilding(state, { id: 'house-epoch', type: 'house', x: 6, y: 6, level: 1 });
    state.population = 8;
    const village = synchronizeKingdomProgression(state);
    expect(village.state.progression?.unlockedEpochs).toContain('village');
    expect(village.newlyUnlocked).toContain('village');
    expect(village.reward).toBe(20);
    expect(getCurrentEpochId(village.state)).toBe('village');

    village.state.population = 12;
    addBuilding(village.state, { id: 'market-epoch', type: 'market', x: 7, y: 6, level: 2 });
    const borough = synchronizeKingdomProgression(village.state);
    expect(borough.state.progression?.unlockedEpochs).toContain('borough');
    expect(borough.newlyUnlocked).toContain('borough');
    expect(borough.reward).toBe(35);
    expect(getEpochRequirements(borough.state, 'borough').every((item) => item.done)).toBe(true);
    const repeated = synchronizeKingdomProgression(borough.state);
    expect(repeated.reward).toBe(0);
    expect(repeated.newlyUnlocked).toHaveLength(0);
  });

  it('richiede ricerca, grandi opere e regioni prima di entrare nella Città', () => {
    const state = createInitialState(778);
    state.population = 18;
    state.progression!.unlockedEpochs = ['settlement', 'village', 'borough'];
    addBuilding(state, { id: 'farm-epoch', type: 'farm', x: 4, y: 4, level: 3 });
    addBuilding(state, { id: 'house-epoch', type: 'house', x: 6, y: 6, level: 1 });
    addBuilding(state, { id: 'school-epoch', type: 'school', x: 7, y: 6, level: 1 });
    state.world!.researched = ['irrigation', 'forestry'];
    state.world!.completedProjects = ['aqueduct'];
    state.world!.discoveredRegions = ['forest', 'mountains'];
    const update = synchronizeKingdomProgression(state);
    expect(update.state.progression?.unlockedEpochs).toContain('city');
    expect(update.newlyUnlocked).toContain('city');
    expect(getCurrentEpochId(update.state)).toBe('city');
  });

  it('non conclude la campagna finché non sono soddisfatti tutti i requisiti della Carta', () => {
    const state = createInitialState(779);
    state.progression!.unlockedEpochs = ['settlement', 'village', 'borough', 'city'];
    state.population = 24;
    state.resources.coins = 130;
    state.world!.researched = ['irrigation', 'forestry'];
    state.world!.completedProjects = ['aqueduct', 'stone-bridge', 'artisan-quarter'];
    state.world!.tradeRoutes = ['selvalunga', 'salmastra'];
    state.world!.discoveredRegions = ['forest', 'mountains', 'lake'];
    addBuilding(state, { id: 'farm-one', type: 'farm', x: 4, y: 4, level: 3 });
    addBuilding(state, { id: 'house-three', type: 'house', x: 6, y: 6, level: 3 });
    addBuilding(state, { id: 'university-charter', type: 'university', x: 7, y: 6, level: 1 });
    expect(getCharterRequirements(state).every((item) => item.done)).toBe(true);
    const completed = synchronizeKingdomProgression(state);
    expect(completed.state.progression?.campaignComplete).toBe(true);
    expect(completed.campaignJustCompleted).toBe(true);
    expect(completed.reward).toBe(150);
    expect(completed.state.progression?.history[0]).toContain('Carta della Corona');
    expect(synchronizeKingdomProgression(completed.state).reward).toBe(0);
  });

  it('mantiene le epoche già sbloccate anche se la popolazione diminuisce', () => {
    const state = createInitialState(780);
    state.progression!.unlockedEpochs = ['settlement', 'village', 'borough'];
    state.population = 5;
    const updated = synchronizeKingdomProgression(state);
    expect(updated.state.progression?.unlockedEpochs).toEqual(['settlement', 'village', 'borough']);
    expect(getCurrentEpochId(updated.state)).toBe('borough');
  });
});
