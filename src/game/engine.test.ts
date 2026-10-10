import {describe,expect,it} from 'vitest';
import {advanceTime,buildAt,canBuild,createInitialState,generateTerrain,housingCapacity} from './engine';
import {createDailyChallenge,challengeProgress,isChallengeComplete} from './challenge';

describe('simulazione Microregno',()=>{
  it('genera un terreno deterministico per seed',()=>{
    expect(generateTerrain(1234)).toEqual(generateTerrain(1234));
    expect(generateTerrain(1234)).not.toEqual(generateTerrain(1235));
  });
  it('inizia con municipio e capienza abitativa valida',()=>{
    const s=createInitialState(9);
    expect(s.buildings[0]?.type).toBe('townHall');
    expect(s.population).toBeLessThanOrEqual(housingCapacity(s));
  });
  it('impedisce di costruire su acqua o su un edificio',()=>{
    const s=createInitialState(5),map=generateTerrain(5);
    expect(canBuild(s,map,7,2,'house').ok).toBe(false);
    expect(canBuild(s,map,5,6,'house').ok).toBe(false);
  });
  it('scala i materiali dopo una costruzione valida',()=>{
    const s=createInitialState(),result=buildAt(s,generateTerrain(s.seed),6,6,'house');
    expect(result.check.ok).toBe(true);
    expect(result.state.resources.wood).toBe(30);
    expect(result.state.resources.stone).toBe(19);
  });
  it('produce cibo e non porta le risorse sotto zero',()=>{
    const s=createInitialState(),result=buildAt(s,generateTerrain(s.seed),6,6,'farm'),next=advanceTime(result.state,10);
    expect(next.resources.food).toBeGreaterThan(s.resources.food);
    expect(Object.values(next.resources).every(n=>n>=0)).toBe(true);
  });
  it('limita gli abitanti alla capienza delle case',()=>{
    const s=createInitialState();s.resources.food=200;
    expect(advanceTime(s,360).population).toBeLessThanOrEqual(housingCapacity(advanceTime(s,360)));
  });
  it('genera la stessa sfida per una stessa data',()=>{
    const date=new Date(2026,9,10,12),challenge=createDailyChallenge(date);
    expect(challenge).toEqual(createDailyChallenge(date));
    expect(challengeProgress(createInitialState(challenge.seed),challenge)).toBeGreaterThanOrEqual(0);
    expect(typeof isChallengeComplete(createInitialState(challenge.seed),challenge)).toBe('boolean');
  });
});