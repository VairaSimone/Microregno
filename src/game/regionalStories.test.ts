import { describe, expect, it } from 'vitest';
import { advanceTime, createInitialState } from './engine';
import { performRealmAction } from './livingWorld';

const storyBranches = [
  { source: 'forest-expedition', choice: 'protect-grove', sequel: 'forest-guardian-legacy' },
  { source: 'forest-expedition', choice: 'commercial-grove', sequel: 'forest-timber-charter' },
  { source: 'mountain-expedition', choice: 'secure-pass', sequel: 'mountain-shelter-oath' },
  { source: 'mountain-expedition', choice: 'grant-mining-charter', sequel: 'mountain-deep-vein' },
  { source: 'lake-expedition', choice: 'lake-cooperative', sequel: 'lake-open-water' },
  { source: 'lake-expedition', choice: 'lake-tolls', sequel: 'lake-toll-revolt' },
  { source: 'border-expedition', choice: 'border-customs', sequel: 'border-open-gates' },
  { source: 'border-expedition', choice: 'border-watch', sequel: 'border-safe-roads' },
  { source: 'ruins-found', choice: 'seal-site', sequel: 'ruins-sealed-oath' },
  { source: 'archive-clue', choice: 'fund-map', sequel: 'archive-map-vow' },
  { source: 'archive-clue', choice: 'keep-secret', sequel: 'archive-secret-letters' },
] as const;

function openQueuedStory(state: ReturnType<typeof createInitialState>, eventId: string) {
  state.world!.eventQueue = [eventId];
  state.world!.queuedEvent = eventId;
  state.world!.nextEventAt = state.gameMinutes + 1;
  return advanceTime(state, 1);
}

describe('branching regional stories', () => {
  it.each(storyBranches)('$source → $choice queues the $sequel chapter', ({ source, choice, sequel }) => {
    const state = createInitialState(8100 + source.length + choice.length);
    const opened = openQueuedStory(state, source);

    expect(opened.world?.activeEvent?.id).toBe(source);
    const resolved = performRealmAction(opened, { type: 'event', id: choice });

    expect(resolved.ok).toBe(true);
    expect(resolved.state.world?.eventQueue).toContain(sequel);
    expect(resolved.state.world?.queuedEvent).toBe(sequel);
  });

  it('resolves a regional sequel, applies its resource cost, and records the outcome', () => {
    const state = createInitialState(9127);
    const firstChapter = openQueuedStory(state, 'forest-expedition');
    const firstChoice = performRealmAction(firstChapter, { type: 'event', id: 'protect-grove' });

    expect(firstChoice.ok).toBe(true);
    const secondChapter = advanceTime(firstChoice.state, 75);
    expect(secondChapter.world?.activeEvent?.id).toBe('forest-guardian-legacy');

    const woodBefore = secondChapter.resources.wood;
    const foodBefore = secondChapter.resources.food;
    const researchBefore = secondChapter.world!.researchPoints;
    const resolution = performRealmAction(secondChapter, { type: 'event', id: 'fund-seedbank' });

    expect(resolution.ok).toBe(true);
    expect(resolution.state.resources.wood).toBeLessThan(woodBefore);
    expect(resolution.state.resources.food).toBeLessThan(foodBefore);
    expect(resolution.state.world!.researchPoints).toBe(researchBefore + 5);
    expect(resolution.state.world!.chronicle[0]).toContain('Il vivaio delle cinque radici');
  });
});
