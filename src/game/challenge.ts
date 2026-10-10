import {BUILDINGS} from './definitions';
import {createInitialState,resourceTotal} from './engine';
import type {DailyChallenge,GameState} from './types';
export function localDateKey(date=new Date()):string{return date.getFullYear()+'-'+String(date.getMonth()+1).padStart(2,'0')+'-'+String(date.getDate()).padStart(2,'0');}
export function hashString(s:string):number{let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;}
export function createDailyChallenge(date=new Date()):DailyChallenge{const key=localDateKey(date),seed=hashString('microregno:'+key);const opts:DailyChallenge[]=[
{date:key,seed,title:'Una casa per tutti',description:'Porta la popolazione a 10 abitanti: costruisci case e non lasciare vuote le dispense.',kind:'population',target:10,reward:'Medaglia del costruttore'},
{date:key,seed,title:'Dispense piene',description:'Accumula almeno 150 risorse complessive e dimostra che il tuo villaggio sa prosperare.',kind:'resources',target:150,reward:'Medaglia dell’abbondanza'},
{date:key,seed,title:'Campi dorati',description:'Costruisci due fattorie e crea una produzione di cibo capace di sostenere il villaggio.',kind:'buildings',target:2,buildingType:'farm',reward:'Medaglia del raccolto'},
{date:key,seed,title:'Il borgo si allarga',description:'Costruisci tre abitazioni aggiuntive e prepara spazio per chi arriverà.',kind:'buildings',target:3,buildingType:'house',reward:'Medaglia dell’accoglienza'}];return opts[seed%opts.length]!;}
export function challengeProgress(s:GameState,c:DailyChallenge):number{if(c.kind==='population')return Math.min(s.population,c.target);if(c.kind==='resources')return Math.min(Math.floor(resourceTotal(s)),c.target);return c.buildingType?Math.min(s.buildings.filter(b=>b.type===c.buildingType).length,c.target):0;}
export function isChallengeComplete(s:GameState,c:DailyChallenge):boolean{return challengeProgress(s,c)>=c.target;}
export function createChallengeState(c:DailyChallenge):GameState{const s=createInitialState(c.seed);s.resources={wood:38,stone:22,food:36,coins:15};s.population=5;s.gameMinutes=0;if(c.buildingType==='farm')s.resources={wood:40,stone:24,food:36,coins:15};return s;}
export function challengeScore(s:GameState):number{return Math.max(100,5000-s.gameMinutes*8+Math.floor(resourceTotal(s))*3+s.population*25);}
export function buildingUnlocked(s:GameState,type:keyof typeof BUILDINGS):boolean{return s.population>=BUILDINGS[type].unlockedAt;}