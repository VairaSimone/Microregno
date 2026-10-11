import type {ChallengeCategory,ChallengeMedal,ChallengeRecord,DailyChallenge,GameState,PlayerAchievement,PlayerProfile} from './types';
import {challengeCategory,medalTier} from './challenge';

const PROFILE_KEY='microregno:player-profile:v1';
const BONUS:Record<string,Partial<GameState['resources']>>={
  'granary-blessing':{food:6},
  'forester-mark':{wood:6},
  'stonekeeper-mark':{stone:6},
  'royal-favor':{coins:4},
  'golden-banner':{coins:3},
  'crown-signet':{food:5}
};
interface AchievementDefinition {
  id:string;
  name:string;
  description:string;
  rewardId:string;
  rewardName:string;
  target:number;
  progress:(profile:PlayerProfile)=>number;
}
const categoryCount=(profile:PlayerProfile):number=>new Set(profile.records.map(record=>record.category)).size;
export const ACHIEVEMENTS:AchievementDefinition[]=[
  {id:'first-victory',name:'La prima impresa',description:'Completa la tua prima sfida giornaliera.',rewardId:'founder-title',rewardName:'Titolo: Pioniere di Brumadoro',target:1,progress:p=>Math.min(1,p.totalCompleted)},
  {id:'three-trials',name:'Una buona abitudine',description:'Completa 3 sfide in giorni diversi.',rewardId:'granary-blessing',rewardName:'Benedizione della dispensa: +6 cibo iniziale',target:3,progress:p=>Math.min(3,p.totalCompleted)},
  {id:'five-trials',name:'Custode instancabile',description:'Completa 5 sfide in giorni diversi.',rewardId:'forester-mark',rewardName:'Sigillo del boscaiolo: +6 legname iniziale',target:5,progress:p=>Math.min(5,p.totalCompleted)},
  {id:'ten-trials',name:'Leggenda di Brumadoro',description:'Completa 10 sfide in giorni diversi.',rewardId:'stonekeeper-mark',rewardName:'Sigillo della cava: +6 pietra iniziale',target:10,progress:p=>Math.min(10,p.totalCompleted)},
  {id:'four-paths',name:'Maestro dei quattro sentieri',description:'Vinci una sfida di popolazione, risorse, fattorie e abitazioni.',rewardId:'royal-favor',rewardName:'Favore reale: +4 monete iniziali',target:4,progress:p=>Math.min(4,categoryCount(p))},
  {id:'first-gold',name:'Medaglia d’oro',description:'Ottieni una medaglia d’oro con almeno 4.500 punti.',rewardId:'golden-banner',rewardName:'Stendardo dorato: +3 monete iniziali',target:4500,progress:p=>Math.min(4500,Math.max(0,...p.records.map(r=>r.bestScore)))},
  {id:'three-day-streak',name:'Tre albe consecutive',description:'Completa una sfida per tre giorni consecutivi.',rewardId:'crown-signet',rewardName:'Sigillo della Corona: +5 cibo iniziale',target:3,progress:p=>Math.min(3,p.bestStreak)}
];

export function createPlayerProfile():PlayerProfile{
  return {version:1,medals:[],achievements:[],unlockedRewards:[],records:[],totalCompleted:0,currentStreak:0,bestStreak:0,lastCompletedDate:null,allTimeBestScore:0};
}
function isObject(value:unknown):value is Record<string,unknown>{return !!value&&typeof value==='object'&&!Array.isArray(value);}
export function normalizePlayerProfile(value:unknown):PlayerProfile{
  if(!isObject(value))return createPlayerProfile();
  const raw=value as Partial<PlayerProfile>;
  const records:ChallengeRecord[]=Array.isArray(raw.records)?raw.records.filter((r):r is ChallengeRecord=>isObject(r)
    &&typeof r.date==='string'&&typeof r.challengeId==='string'&&typeof r.title==='string'
    &&(['population','resources','farms','housing'] as string[]).includes(String(r.category))
    &&Number.isFinite(r.score)&&Number.isFinite(r.bestScore)&&typeof r.completedAt==='string'
    &&typeof r.medalId==='string'&&(['bronze','silver','gold'] as string[]).includes(String(r.tier))
    &&Number.isFinite(r.achievedInMinutes)).slice(-500):[];
  const medals:ChallengeMedal[]=Array.isArray(raw.medals)?raw.medals.filter((m):m is ChallengeMedal=>isObject(m)
    &&typeof m.id==='string'&&typeof m.name==='string'&&typeof m.description==='string'&&typeof m.icon==='string'
    &&(['bronze','silver','gold'] as string[]).includes(String(m.tier))&&typeof m.date==='string'
    &&typeof m.challengeTitle==='string'&&typeof m.earnedAt==='string').slice(-500):[];
  const achievements:PlayerAchievement[]=Array.isArray(raw.achievements)?raw.achievements.filter((a):a is PlayerAchievement=>isObject(a)
    &&typeof a.id==='string'&&typeof a.name==='string'&&typeof a.description==='string'
    &&typeof a.rewardId==='string'&&typeof a.rewardName==='string'&&typeof a.unlockedAt==='string'): [];
  const unlockedRewards=Array.isArray(raw.unlockedRewards)?raw.unlockedRewards.filter((id):id is string=>typeof id==='string'&&Object.hasOwn(BONUS,id)||id==='founder-title'):[];
  const lastCompletedDate=typeof raw.lastCompletedDate==='string'?raw.lastCompletedDate:null;
  return {
    version:1,records,medals,achievements,unlockedRewards:[...new Set(unlockedRewards)],
    totalCompleted:records.length,
    currentStreak:Number.isFinite(raw.currentStreak)?Math.max(0,Math.min(500,Math.floor(raw.currentStreak!))):0,
    bestStreak:Number.isFinite(raw.bestStreak)?Math.max(0,Math.min(500,Math.floor(raw.bestStreak!))):0,
    lastCompletedDate,
    allTimeBestScore:Math.max(0,...records.map(r=>r.bestScore),Number.isFinite(raw.allTimeBestScore)?raw.allTimeBestScore!:0)
  };
}
function readProfile():unknown{
  try{if(typeof localStorage==='undefined')return null;const value=localStorage.getItem(PROFILE_KEY);return value?JSON.parse(value) as unknown:null;}catch{return null;}
}
export function loadPlayerProfile():PlayerProfile{return normalizePlayerProfile(readProfile());}
export function savePlayerProfile(profile:PlayerProfile):boolean{
  try{if(typeof localStorage==='undefined')return false;localStorage.setItem(PROFILE_KEY,JSON.stringify(normalizePlayerProfile(profile)));return true;}catch{return false;}
}
function dateDistance(a:string,b:string):number{
  const [ay,am,ad]=a.split('-').map(Number),[by,bm,bd]=b.split('-').map(Number);
  if(!ay||!am||!ad||!by||!bm||!bd)return Number.POSITIVE_INFINITY;
  return Math.round((Date.UTC(by!,bm!-1,bd!)-Date.UTC(ay!,am!-1,ad!))/86400000);
}
function categoryIcon(category:ChallengeCategory):string{
  return category==='population'?'♟':category==='resources'?'◆':category==='farms'?'♧':'⌂';
}
function awardAchievements(profile:PlayerProfile,now:string):string[]{
  const newlyUnlocked:string[]=[];
  for(const def of ACHIEVEMENTS){
    if(profile.achievements.some(a=>a.id===def.id)||def.progress(profile)<def.target)continue;
    const item:PlayerAchievement={id:def.id,name:def.name,description:def.description,rewardId:def.rewardId,rewardName:def.rewardName,unlockedAt:now};
    profile.achievements.push(item);
    if(!profile.unlockedRewards.includes(def.rewardId))profile.unlockedRewards.push(def.rewardId);
    newlyUnlocked.push(def.id);
  }
  return newlyUnlocked;
}
export interface ChallengeVictoryResult {profile:PlayerProfile;medal:ChallengeMedal;newAchievements:string[];newRewards:string[];firstCompletion:boolean}
export function recordChallengeVictory(original:PlayerProfile,challenge:DailyChallenge,score:number,gameMinutes:number,now=new Date()):ChallengeVictoryResult{
  const profile=normalizePlayerProfile(original),timestamp=now.toISOString(),day=challenge.date;
  const previous=profile.records.find(r=>r.challengeId===challenge.id);
  const previousRewards=new Set(profile.unlockedRewards),oldAchievementIds=new Set(profile.achievements.map(a=>a.id));
  const bestScore=Math.max(previous?.bestScore??0,Math.floor(score));
  const tier=medalTier(bestScore);
  const category=challengeCategory(challenge);
  if(previous){
    previous.score=Math.floor(score);
    previous.bestScore=bestScore;
    previous.tier=tier;
    previous.achievedInMinutes=Math.min(previous.achievedInMinutes,Math.max(0,gameMinutes-(challenge.startGameMinutes??0)));
  }else{
    const gap=profile.lastCompletedDate?dateDistance(profile.lastCompletedDate,day):Number.POSITIVE_INFINITY;
    profile.currentStreak=gap===0?profile.currentStreak:gap===1?profile.currentStreak+1:1;
    profile.bestStreak=Math.max(profile.bestStreak,profile.currentStreak);
    profile.lastCompletedDate=day;
    profile.records.push({date:day,challengeId:challenge.id,title:challenge.title,category,score:Math.floor(score),bestScore,completedAt:timestamp,medalId:challenge.medalId,tier,achievedInMinutes:Math.max(0,gameMinutes-(challenge.startGameMinutes??0))});
    profile.records.sort((a,b)=>a.date.localeCompare(b.date));
    if(profile.records.length>500)profile.records=profile.records.slice(-500);
  }
  profile.totalCompleted=profile.records.length;
  profile.allTimeBestScore=Math.max(profile.allTimeBestScore,bestScore);
  let medal=profile.medals.find(m=>m.id===challenge.id);
  if(medal){
    medal.tier=tier;
    medal.description='Completata il '+day+' · '+bestScore+' punti. Rigioca per migliorare il grado.';
  }else{
    medal={id:challenge.id,name:challenge.reward,description:'Completata il '+day+' · '+bestScore+' punti.',icon:categoryIcon(category),tier,date:day,challengeTitle:challenge.title,earnedAt:timestamp};
    profile.medals.push(medal);
  }
  const newlyUnlocked=awardAchievements(profile,timestamp);
  return {profile,medal,newAchievements:newlyUnlocked,newRewards:profile.unlockedRewards.filter(id=>!previousRewards.has(id)),firstCompletion:!previous||!oldAchievementIds.has('first-victory')};
}
export function applyProfileBonuses(state:GameState,profile:PlayerProfile):GameState{
  const resources={...state.resources};
  for(const id of profile.unlockedRewards)for(const [key,amount] of Object.entries(BONUS[id]??{})){
    const resource=key as keyof typeof resources;
    resources[resource]+=amount??0;
  }
  return {...state,resources};
}
export function getAchievementProgress(profile:PlayerProfile):Array<{id:string;name:string;description:string;rewardName:string;progress:number;target:number;unlocked:boolean}>{
  return ACHIEVEMENTS.map(def=>({id:def.id,name:def.name,description:def.description,rewardName:def.rewardName,progress:Math.min(def.target,Math.max(0,def.progress(profile))),target:def.target,unlocked:profile.achievements.some(a=>a.id===def.id)}));
}
