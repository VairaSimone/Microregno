import {afterEach,describe,expect,it,vi} from 'vitest';
import {createDailyChallenge} from './challenge';
import {createPlayerProfile,loadPlayerProfile,recordChallengeVictory,savePlayerProfile,applyProfileBonuses,getAchievementProgress} from './profile';
import {createInitialState} from './engine';

afterEach(()=>vi.unstubAllGlobals());
function storage(){
  const values=new Map<string,string>();
  vi.stubGlobal('localStorage',{getItem:(k:string)=>values.get(k)??null,setItem:(k:string,v:string)=>values.set(k,v),removeItem:(k:string)=>values.delete(k)});
  return values;
}
describe('permanent single-player rewards',()=>{
  it('persists medals, achievement unlocks and permanent rewards locally',()=>{
    storage();
    let profile=createPlayerProfile();
    const challenge=createDailyChallenge(new Date(2026,0,1));
    let result=recordChallengeVictory(profile,challenge,4700,30,new Date('2026-01-01T12:00:00Z'));
    profile=result.profile;
    expect(profile.medals).toHaveLength(1);
    expect(profile.medals[0]?.tier).toBe('gold');
    expect(profile.achievements.some(a=>a.id==='first-victory')).toBe(true);
    expect(profile.unlockedRewards).toContain('founder-title');
    expect(savePlayerProfile(profile)).toBe(true);
    expect(loadPlayerProfile()).toEqual(profile);
  });
  it('does not award repeated wins on the same date but can upgrade a medal',()=>{
    let profile=createPlayerProfile();
    const challenge=createDailyChallenge(new Date(2026,2,3));
    const first=recordChallengeVictory(profile,challenge,3200,180,new Date('2026-03-03T10:00:00Z'));
    const replay=recordChallengeVictory(first.profile,challenge,4600,50,new Date('2026-03-03T11:00:00Z'));
    expect(replay.profile.totalCompleted).toBe(1);
    expect(replay.profile.medals).toHaveLength(1);
    expect(replay.profile.medals[0]?.tier).toBe('gold');
    expect(replay.profile.records[0]?.bestScore).toBe(4600);
    expect(replay.firstCompletion).toBe(false);
  });
  it('unlocks a repeatable start bonus only after the achievement threshold',()=>{
    let profile=createPlayerProfile();
    const state=createInitialState(23);
    expect(applyProfileBonuses(state,profile).resources.food).toBe(state.resources.food);
    for(let day=1;day<=3;day++){
      const c=createDailyChallenge(new Date(2026,0,day));
      profile=recordChallengeVictory(profile,{...c,id:'forced-day-'+day,date:c.date},3700,120,new Date(Date.UTC(2026,0,day,12))).profile;
    }
    expect(profile.unlockedRewards).toContain('granary-blessing');
    expect(applyProfileBonuses(state,profile).resources.food).toBe(state.resources.food+11); // Granary blessing (+6) and three-day streak seal (+5).
    expect(getAchievementProgress(profile).find(a=>a.id==='three-trials')?.unlocked).toBe(true);
  });
  it('repairs malformed profile records rather than crashing on old/corrupt storage',()=>{
    storage();
    vi.stubGlobal('localStorage',{getItem:()=>JSON.stringify({version:1,records:[null,{date:'bad'}],medals:'bad',achievements:[],unlockedRewards:['hacked',3],totalCompleted:-8}),setItem:()=>{},removeItem:()=>{}});
    const profile=loadPlayerProfile();
    expect(profile.records).toEqual([]);
    expect(profile.medals).toEqual([]);
    expect(profile.totalCompleted).toBe(0);
    expect(profile.unlockedRewards).toEqual([]);
  });
});
