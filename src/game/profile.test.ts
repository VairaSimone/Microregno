import {afterEach,describe,expect,it,vi} from 'vitest';
import {createDailyChallenge} from './challenge';
import {createPlayerProfile,loadPlayerProfile,recordChallengeVictory,savePlayerProfile,applyProfileBonuses,getAchievementProgress,getChallengeArchive,normalizePlayerProfile,activeChallengeStreak} from './profile';
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
  it('keeps lifetime victories when the visible archive reaches its 500-record cap',()=>{
    const oldRecords=Array.from({length:500},(_,index)=>({
      date:new Date(Date.UTC(2024,0,1+index)).toISOString().slice(0,10),
      challengeId:'historic-'+index,
      title:'Sfida archiviata',
      category:'population' as const,
      score:1000,
      bestScore:1000,
      completedAt:'2025-01-01T12:00:00.000Z',
      medalId:'builder',
      tier:'bronze' as const,
      achievedInMinutes:10,
    }));
    let profile=normalizePlayerProfile({...createPlayerProfile(),records:oldRecords,totalCompleted:730});
    expect(profile.records).toHaveLength(500);
    expect(profile.totalCompleted).toBe(730);

    const challenge=createDailyChallenge(new Date(2026,9,11));
    profile=recordChallengeVictory(profile,{...challenge,id:'lifetime-new-win',date:'2026-10-11'},2000,20,new Date('2026-10-11T12:00:00.000Z')).profile;

    expect(profile.records).toHaveLength(500);
    expect(profile.totalCompleted).toBe(731);
    expect(normalizePlayerProfile(profile).totalCompleted).toBe(731);
  });
  it('expires the visible streak after a missed daily challenge',()=>{
    const profile={...createPlayerProfile(),currentStreak:4,lastCompletedDate:'2026-10-08'};
    expect(activeChallengeStreak(profile,'2026-10-09')).toBe(4);
    expect(activeChallengeStreak(profile,'2026-10-10')).toBe(0);
    expect(activeChallengeStreak(createPlayerProfile(),'2026-10-10')).toBe(0);
  });
  it('exposes the newest completed challenges as a local archive without mutating saved order',()=>{
    let profile=createPlayerProfile();
    for(let day=1;day<=3;day++){
      const c=createDailyChallenge(new Date(2026,0,day));
      profile=recordChallengeVictory(profile,{...c,id:'archive-day-'+day},1000+day*500,180-day*20,new Date(Date.UTC(2026,0,day,12))).profile;
    }
    const before=profile.records.map(record=>record.date);
    const archive=getChallengeArchive(profile,2);
    expect(archive.map(record=>record.date)).toEqual(['2026-01-03','2026-01-02']);
    expect(archive.map(record=>record.bestScore)).toEqual([2500,2000]);
    expect(profile.records.map(record=>record.date)).toEqual(before);
    expect(getChallengeArchive(profile,0)).toEqual([]);
  });

  it('updates archived challenge and achievement text to the Five Lights narrative without changing IDs or rewards', () => {
    const challenge = createDailyChallenge(new Date('2026-10-11T12:00:00'));
    const migrated = normalizePlayerProfile({
      ...createPlayerProfile(),
      records: [{
        date: challenge.date,
        challengeId: challenge.id,
        title: 'Una casa per tutti',
        category: challenge.category,
        score: 2800,
        bestScore: 3200,
        completedAt: '2026-10-11T12:00:00.000Z',
        medalId: challenge.medalId,
        tier: 'silver',
        achievedInMinutes: 18,
      }],
      medals: [{
        id: challenge.id,
        name: challenge.reward,
        description: 'Completata',
        icon: '⌂',
        tier: 'silver',
        date: challenge.date,
        challengeTitle: 'Una casa per tutti',
        earnedAt: '2026-10-11T12:00:00.000Z',
      }],
      achievements: [{
        id: 'first-victory',
        name: 'La prima impresa',
        description: 'Completa la tua prima sfida giornaliera.',
        rewardId: 'founder-title',
        rewardName: 'Titolo: Pioniere di Brumadoro',
        unlockedAt: '2026-10-11T12:00:00.000Z',
      }],
    });
    expect(migrated.records[0]?.challengeId).toBe(challenge.id);
    expect(migrated.records[0]?.title).toBe(challenge.title);
    expect(migrated.medals[0]?.id).toBe(challenge.id);
    expect(migrated.medals[0]?.challengeTitle).toBe(challenge.title);
    expect(migrated.achievements[0]?.id).toBe('first-victory');
    expect(migrated.achievements[0]?.name).toBe('Il primo rintocco');
    expect(migrated.achievements[0]?.rewardId).toBe('founder-title');
    expect(migrated.achievements[0]?.rewardName).toBe('Titolo: Custode della Prima Luce');
  });
});
