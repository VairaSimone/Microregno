import {describe,expect,it} from 'vitest';
import {advanceTime,awardPopulationMilestones,buildAt,canBuild,createInitialState,generateTerrain,housingCapacity,productionForBuilding,resourceRates,upgradeBuilding} from './engine';
import {createDailyChallenge,challengeProgress,isChallengeComplete} from './challenge';
import {applyOfflineProgress} from './save';
import {getSeason,resolveCitizenRequest} from './community';

describe('simulazione Microregno',()=>{
  it('genera un terreno deterministico per seed',()=>{
    expect(generateTerrain(1234)).toEqual(generateTerrain(1234));
    expect(generateTerrain(1234)).not.toEqual(generateTerrain(1235));
  });
  it('inizia con capienza per i 5 abitanti e richiede una scelta per far crescere il borgo',()=>{
    const s=createInitialState(9);
    expect(s.buildings[0]?.type).toBe('townHall');
    expect(housingCapacity(s)).toBe(5);
    expect(s.population).toBeLessThanOrEqual(housingCapacity(s));
    s.resources.food=200;
    expect(advanceTime(s,20).population).toBe(5);
    const house=buildAt(s,generateTerrain(s.seed),6,6,'house');
    expect(house.check.ok).toBe(true);
    expect(advanceTime(house.state,20).population).toBe(6);
  });
  it('impedisce di costruire su acqua o su un edificio',()=>{
    const s=createInitialState(5),map=generateTerrain(5);
    expect(canBuild(s,map,7,2,'house').ok).toBe(false);
    expect(canBuild(s,map,5,6,'house').ok).toBe(false);
  });
  it('blocca le produzioni fino a 6 abitanti e il mercato fino a 8',()=>{
    const s=createInitialState(),map=generateTerrain(s.seed);
    expect(canBuild(s,map,4,4,'sawmill').reason).toContain('6 abitanti');
    expect(canBuild(s,map,6,5,'market').reason).toContain('8 abitanti');
    s.population=6;
    expect(canBuild(s,map,4,4,'sawmill').ok).toBe(true);
    s.population=8;
    expect(canBuild(s,map,6,5,'market').ok).toBe(true);
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
  it('mostra produzione con bonus ambientali e livelli effettivi',()=>{
    const s=createInitialState(),map=generateTerrain(s.seed),farm=buildAt(s,map,6,4,'farm');
    expect(farm.check.ok).toBe(true);
    expect(productionForBuilding(farm.state.buildings[1]!,map,360,60).food).toBeCloseTo(2.07);
    expect(resourceRates(farm.state,map,360).food).toBeCloseTo(1.895);
  });
  it('permette di migliorare un edificio fino al livello 3',()=>{
    const s=createInitialState(),map=generateTerrain(s.seed),farm=buildAt(s,map,6,4,'farm'),id=farm.state.buildings[1]!.id;
    const upgraded=upgradeBuilding(farm.state,id);
    expect(upgraded.check.ok).toBe(true);
    expect(upgraded.state.buildings[1]!.level).toBe(2);
    expect(upgraded.state.resources.wood).toBe(24);
    expect(upgraded.state.resources.coins).toBe(15);
    expect(productionForBuilding(upgraded.state.buildings[1]!,map,360,60).food).toBeCloseTo(4.14);
    const levelThree=upgradeBuilding(upgraded.state,id);
    expect(levelThree.state.buildings[1]!.level).toBe(3);
    expect(upgradeBuilding(levelThree.state,id).check.ok).toBe(false);
  });
  it('premia i traguardi di popolazione una sola volta',()=>{
    const s=createInitialState();s.population=8;
    const first=awardPopulationMilestones(s);
    expect(first.reward).toBe(10);
    expect(first.state.resources.coins).toBe(28);
    expect(awardPopulationMilestones(first.state).reward).toBe(0);
    first.state.population=12;
    expect(awardPopulationMilestones(first.state).reward).toBe(15);
  });
  it('usa regole identiche online e offline',()=>{
    const s=createInitialState(),farm=buildAt(s,generateTerrain(s.seed),6,4,'farm'),savedAt=farm.state.lastSavedAt;
    const online=advanceTime(farm.state,20),offline=applyOfflineProgress(farm.state,savedAt+20_000);
    expect(offline.minutes).toBe(20);
    expect(offline.state.gameMinutes).toBe(online.gameMinutes);
    expect(offline.state.population).toBe(online.population);
    expect(offline.state.resources).toEqual(online.resources);
  });
  it('cambia stagione e applica il consumo invernale',()=>{
    const s=createInitialState(),map=generateTerrain(s.seed);
    expect(getSeason(0).id).toBe('spring');
    expect(getSeason(360).id).toBe('summer');
    expect(getSeason(720).id).toBe('autumn');
    expect(getSeason(1080).id).toBe('winter');
    expect(resourceRates(s,map,1080).food).toBeCloseTo(-0.2625);
  });
  it('risolve una richiesta e salva conseguenze misurabili',()=>{
    const s=createInitialState(),result=resolveCitizenRequest(s,'share-food');
    expect(result.ok).toBe(true);
    expect(result.state.resources.food).toBe(34);
    expect(result.state.community?.morale).toBe(72);
    expect(result.state.community?.trust).toBe(60);
    expect(result.state.community?.fulfilledRequests).toBe(1);
    expect(result.state.community?.activeRequest).toBeNull();
  });
  it('non permette scelte senza risorse sufficienti',()=>{
    const s=createInitialState();
    s.resources.food=0;
    const result=resolveCitizenRequest(s,'share-food');
    expect(result.ok).toBe(false);
    expect(result.state.resources.food).toBe(0);
    expect(result.state.community?.activeRequest?.id).toContain('request-0');
  });
  it('penalizza una richiesta ignorata e genera una nuova richiesta più tardi',()=>{
    const s=createInitialState(),ignored=advanceTime(s,180);
    expect(ignored.community?.activeRequest).toBeNull();
    expect(ignored.community?.ignoredRequests).toBe(1);
    expect(ignored.community?.morale).toBe(52);
    const later=advanceTime(ignored,120);
    expect(later.community?.activeRequest).not.toBeNull();
    expect(later.community?.requestNumber).toBe(2);
  });
  it('genera la stessa sfida per una stessa data',()=>{
    const date=new Date(2026,9,10,12),challenge=createDailyChallenge(date);
    expect(challenge).toEqual(createDailyChallenge(date));
    expect(challengeProgress(createInitialState(challenge.seed),challenge)).toBeGreaterThanOrEqual(0);
    expect(typeof isChallengeComplete(createInitialState(challenge.seed),challenge)).toBe('boolean');
  });
});