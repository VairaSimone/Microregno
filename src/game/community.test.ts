import { afterEach, describe, expect, it, vi } from 'vitest';
import { createInitialState, generateTerrain, startBuildAt } from './engine';
import { ensureCommunity, resolveCitizenRequest } from './community';

describe('community save recovery', () => {
  afterEach(() => vi.unstubAllGlobals());


  it('does not count a house under construction as available housing for citizen requests', () => {
    const state = createInitialState(993);
    const started = startBuildAt(state, generateTerrain(state.seed), 6, 6, 'house', 1_000);
    expect(started.check.ok).toBe(true);
    const request = started.state.community!.activeRequest!;
    const option = { ...request.options[0]!, cost: {}, reward: {}, populationDelta: 1, housingDelta: 0 };
    const pending = {
      ...started.state,
      community: { ...started.state.community!, activeRequest: { ...request, options: [option] } },
    };
    const result = resolveCitizenRequest(pending, option.id);
    expect(result.ok).toBe(false);
    expect(result.state.population).toBe(5);
    expect(result.message).toContain('posti abitativi');
  });

  it('rebuilds an active request whose saved resource costs are malformed', () => {
    const state = createInitialState(991);
    const corrupted = structuredClone(state);
    const option = corrupted.community!.activeRequest!.options[0]!;
    option.cost.food = Number.NaN;

    const repaired = ensureCommunity(corrupted);
    const request = repaired.community!.activeRequest!;

    expect(request).not.toBeNull();
    expect(request.options.length).toBeGreaterThan(0);
    expect(request.options.every((entry) =>
      Object.values(entry.cost).every((value) => Number.isFinite(value) && value >= 0)
      && Object.values(entry.reward).every((value) => Number.isFinite(value) && value >= 0),
    )).toBe(true);
  });

  it('resets malformed community history instead of exposing non-string entries to the UI', () => {
    const state = createInitialState(992);
    const corrupted = {
      ...state,
      community: { ...state.community!, history: ['ok', null, { text: 'bad' }] },
    } as unknown as typeof state;

    const repaired = ensureCommunity(corrupted);

    expect(repaired.community!.history.every((entry) => typeof entry === 'string')).toBe(true);
    expect(repaired.community!.morale).toBeGreaterThanOrEqual(0);
    expect(repaired.community!.morale).toBeLessThanOrEqual(100);
  });
});
