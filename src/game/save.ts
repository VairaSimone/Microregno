import {MAX_BUILDING_LEVEL,OFFLINE_CAP_MINUTES} from './definitions';
import {advanceTime,createInitialState} from './engine';
import {localDateKey} from './challenge';
import type {Building,ChallengeSave,GameState} from './types';
const KEY='microregno:kingdom:v1',CHALLENGE='microregno:challenge:';
function valid(v:unknown):v is GameState{
if(!v||typeof v!=='object')return false;
const s=v as Partial<GameState>,r=s.resources as Record<string,unknown>|undefined;
return s.version===1&&typeof s.seed==='number'&&Number.isFinite(s.seed)&&typeof s.population==='number'&&Number.isFinite(s.population)&&s.population>=0&&typeof s.gameMinutes==='number'&&Number.isFinite(s.gameMinutes)&&s.gameMinutes>=0&&Array.isArray(s.buildings)&&!!r&&['wood','stone','food','coins'].every(k=>typeof r[k]==='number'&&Number.isFinite(r[k])&&(r[k] as number)>=0);}
function read<T>(key:string):T|null{try{if(typeof localStorage==='undefined')return null;const v=localStorage.getItem(key);return v?JSON.parse(v) as T:null;}catch{return null;}}
function write(key:string,v:unknown):boolean{try{if(typeof localStorage==='undefined')return false;localStorage.setItem(key,JSON.stringify(v));return true;}catch{return false;}}
export function loadKingdom():GameState{
const v=read<unknown>(KEY);
if(valid(v)){
const types=['townHall','house','farm','sawmill','quarry','market'];
const safe=(v.buildings as Building[]).filter(b=>!!b&&typeof b==='object'&&typeof b.id==='string'&&Number.isInteger(b.x)&&Number.isInteger(b.y)&&b.x>=0&&b.x<12&&b.y>=0&&b.y<12&&types.includes(b.type)&&Number.isInteger(b.level)&&b.level>=1&&b.level<=MAX_BUILDING_LEVEL);
const unique=safe.filter((b,i,list)=>list.findIndex(other=>other.x===b.x&&other.y===b.y)===i);
v.buildings=unique;
if(!v.buildings.some(b=>b.type==='townHall'))return createInitialState();
v.buildings=v.buildings.filter((b,i,list)=>b.type!=='townHall'||list.findIndex(other=>other.type==='townHall')===i);
return v;
}
return createInitialState();}
export function saveKingdom(s:GameState):boolean{s.lastSavedAt=Date.now();return write(KEY,s);}
export function applyOfflineProgress(s:GameState,now=Date.now()):{state:GameState;minutes:number}{
/* Live play advances one in-game minute per real second. Keep offline play identical. */
const minutes=Math.min(OFFLINE_CAP_MINUTES*60,Math.floor(Math.max(0,now-(s.lastSavedAt||now))/1000));
let copy:GameState={...s,resources:{...s.resources},buildings:s.buildings.map(b=>({...b}))};
let remaining=minutes;
while(remaining>0){const chunk=Math.min(360,remaining);copy=advanceTime(copy,chunk);remaining-=chunk;}
copy.lastSavedAt=now;
return{state:copy,minutes};}
export function loadChallengeSave(date=localDateKey()):ChallengeSave|null{const v=read<ChallengeSave>(CHALLENGE+date);return v&&v.date===date&&valid(v.state)?v:null;}
export function saveChallenge(s:ChallengeSave):boolean{return write(CHALLENGE+s.date,s);}
export function resetKingdom():void{try{if(typeof localStorage!=='undefined')localStorage.removeItem(KEY);}catch{/* Browser storage may be disabled. */}}