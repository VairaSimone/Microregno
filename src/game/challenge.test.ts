import {describe,expect,it} from 'vitest';
import {challengeProgress,challengeScore,createChallengeState,createDailyChallenge,isChallengeComplete,localDateKey,medalTier} from './challenge';
import {createInitialState} from './engine';

describe('daily challenge variety',()=>{
  it('creates the same fully-described challenge for a given local day',()=>{
    const date=new Date(2026,9,11,12);
    const a=createDailyChallenge(date),b=createDailyChallenge(date);
    expect(a).toEqual(b);
    expect(a.date).toBe(localDateKey(date));
    expect(a.id).toContain(a.date);
    expect(a.medalId.length).toBeGreaterThan(0);
    expect(a.condition.length).toBeGreaterThan(0);
  });
  it('covers all four core challenge paths across the cycle of dates',()=>{
    const categories=new Set(Array.from({length:40},(_,i)=>createDailyChallenge(new Date(2026,0,1+i)).category));
    expect([...categories].sort()).toEqual(['farms','housing','population','resources']);
  });
  it('applies specific starting scenario conditions',()=>{
    const challenge=createDailyChallenge(new Date(2026,9,11));
    const state=createChallengeState(challenge);
    expect(state.gameMinutes).toBe(challenge.startGameMinutes??0);
    expect(state.resources.wood).toBe(challenge.initialResources?.wood??38);
    expect(state.population).toBe(5);
  });
  it('requires a scripted event and a food reserve when the challenge says so',()=>{
    const c=createDailyChallenge(new Date(2026,0,2));
    const state=createInitialState(c.seed);
    state.resources={wood:100,stone:100,food:100,coins:100};
    state.population=100;
    const matchingTarget={...c,target:c.kind==='population'?100:c.kind==='resources'?300:1};
    if(matchingTarget.category==='farms')matchingTarget.buildingType='farm';
    if(matchingTarget.category==='housing')matchingTarget.buildingType='house';
    if(matchingTarget.category==='farms'||matchingTarget.category==='housing'){
      const type=matchingTarget.buildingType!;
      state.buildings.push({id:'challenge-target',type,x:1,y:1,level:1});
    }
    const eventRequired={...matchingTarget,eventAt:10,constraint:'none' as const};
    expect(isChallengeComplete(state,eventRequired,false)).toBe(false);
    expect(isChallengeComplete(state,eventRequired,true)).toBe(true);
    const foodRequired={...matchingTarget,eventAt:undefined,constraint:'food-reserve' as const};
    state.resources.food=24;
    expect(isChallengeComplete(state,foodRequired,true)).toBe(false);
    state.resources.food=25;
    expect(isChallengeComplete(state,foodRequired,true)).toBe(true);
  });
  it('scores a quick clear rather than penalizing a winter scenario for its starting clock',()=>{
    const c=createDailyChallenge(new Date(2026,9,11));
    const state=createChallengeState(c);
    state.resources={wood:40,stone:30,food:35,coins:20};
    state.gameMinutes=(c.startGameMinutes??0)+25;
    expect(challengeScore(state,c)).toBeGreaterThan(4500);
  });
  it('assigns increasing medal grades at score thresholds',()=>{
    expect(medalTier(1200)).toBe('bronze');
    expect(medalTier(3500)).toBe('silver');
    expect(medalTier(4500)).toBe('gold');
  });
});
