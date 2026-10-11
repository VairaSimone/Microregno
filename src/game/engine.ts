import {BOARD_SIZE,BUILDINGS,MAX_BUILDING_LEVEL} from './definitions';
import {advanceCommunityMinute,createCommunityState,getSeason} from './community';
import {advanceRealmMinute,createWorldState,ensureWorldState,realmModifiers,worldBuildingMultiplier} from './livingWorld';
import type {BuildCheck,Building,BuildingType,GameState,Resource,Terrain} from './types';
function random(seed:number):()=>number{let v=seed>>>0;return()=>{v=(v*1664525+1013904223)>>>0;return v/4294967296;};}
export function generateTerrain(seed:number):Terrain[][]{const r=random(seed);const map:Terrain[][]=Array.from({length:BOARD_SIZE},()=>Array.from({length:BOARD_SIZE},()=>{const n=r();return n<.065?'water':n<.21?'forest':n<.275?'rock':'grass';}));for(let y=4;y<=7;y++)for(let x=4;x<=7;x++)map[y]![x]='grass';[[7,2],[8,2],[7,3],[8,3],[7,4]].forEach(([x,y])=>map[y]![x]='water');[[2,5],[2,6],[3,5],[9,7],[10,7],[9,8],[5,2],[5,3],[6,2]].forEach(([x,y])=>map[y]![x]='forest');[[9,2],[10,2],[9,3],[10,3],[8,8],[8,9]].forEach(([x,y])=>map[y]![x]='rock');return map;}
export function createInitialState(seed=2310):GameState{const buildings=[{id:'town-hall-1',type:'townHall' as const,x:5,y:6,level:1}];return{version:1,seed,resources:{wood:42,stone:24,food:42,coins:18},population:5,gameMinutes:0,buildings,lastSavedAt:Date.now(),community:createCommunityState(seed,0),world:createWorldState(seed,5,0)};}
export function housingCapacity(s:GameState):number{return s.buildings.reduce((n,b)=>n+(BUILDINGS[b.type].housing??0)*b.level,0)+(s.community?.housingBonus??0);}
export function resourceTotal(s:GameState):number{return Object.values(s.resources).reduce((a,b)=>a+b,0);}
export const POPULATION_MILESTONES=[{population:8,reward:10},{population:12,reward:15},{population:18,reward:25},{population:24,reward:40}] as const;
export function awardPopulationMilestones(s:GameState):{state:GameState;reward:number;earned:number[]}{
const claimed=Array.isArray(s.milestones)?s.milestones:[],newMilestones=POPULATION_MILESTONES.filter(m=>s.population>=m.population&&!claimed.includes(m.population));
if(newMilestones.length===0)return{state:s,reward:0,earned:[]};
const reward=newMilestones.reduce((total,m)=>total+m.reward,0),earned=newMilestones.map(m=>m.population);
return{state:{...s,resources:{...s.resources,coins:s.resources.coins+reward},milestones:[...claimed,...earned]},reward,earned};}
function near(map:Terrain[][],x:number,y:number,wanted:Terrain,distance=2):boolean{for(let row=Math.max(0,y-distance);row<=Math.min(BOARD_SIZE-1,y+distance);row++)for(let col=Math.max(0,x-distance);col<=Math.min(BOARD_SIZE-1,x+distance);col++)if(Math.abs(col-x)+Math.abs(row-y)<=distance&&map[row]![col]===wanted)return true;return false;}
export function canBuild(s:GameState,map:Terrain[][],x:number,y:number,type:BuildingType):BuildCheck{
if(!Number.isInteger(x)||!Number.isInteger(y)||x<0||y<0||x>=BOARD_SIZE||y>=BOARD_SIZE)return{ok:false,reason:'Questa casella è fuori dal territorio.'};
if(type==='townHall')return{ok:false,reason:'Non puoi costruire un secondo municipio.'};
if(s.buildings.some(b=>b.x===x&&b.y===y))return{ok:false,reason:'C’è già un edificio su questa casella.'};
if(map[y]![x]!=='grass'){const t=map[y]![x]!;return{ok:false,reason:'Qui non si può costruire: '+(t==='water'?'c’è acqua.':t==='forest'?'c’è un bosco.':'c’è roccia.')};}
const def=BUILDINGS[type];if(s.population<def.unlockedAt)return{ok:false,reason:'Servono almeno '+def.unlockedAt+' abitanti per sbloccare '+def.name+'.'};
for(const [r,n] of Object.entries(def.cost) as [Resource,number][])if(s.resources[r]<n)return{ok:false,reason:'Non hai abbastanza '+r+'.'};
if(type==='sawmill'&&!near(map,x,y,'forest',3))return{ok:false,reason:'La segheria deve sorgere vicino a un bosco.'};
if(type==='quarry'&&!near(map,x,y,'rock',3))return{ok:false,reason:'La cava deve sorgere vicino a una zona rocciosa.'};return{ok:true};}
export function buildAt(s:GameState,map:Terrain[][],x:number,y:number,type:BuildingType):{state:GameState;check:BuildCheck}{const check=canBuild(s,map,x,y,type);if(!check.ok)return{state:s,check};const resources={...s.resources};for(const [r,n] of Object.entries(BUILDINGS[type].cost) as [Resource,number][])resources[r]-=n;const b:Building={id:type+'-'+s.gameMinutes+'-'+s.buildings.length+'-'+x+'-'+y,type,x,y,level:1};return{state:{...s,resources,buildings:[...s.buildings,b]},check:{ok:true}};}

export function upgradeCost(building:Building):Partial<Record<Resource,number>>{
if(building.type==='townHall')return{wood:18*building.level,stone:12*building.level,coins:6*building.level};
const cost:Partial<Record<Resource,number>>={};
for(const [resource,amount] of Object.entries(BUILDINGS[building.type].cost) as [Resource,number][])cost[resource]=Math.ceil(amount*.75*building.level);
cost.coins=3*building.level;
return cost;}
export function upgradeBuilding(s:GameState,id:string):{state:GameState;check:BuildCheck}{
const building=s.buildings.find(b=>b.id===id);
if(!building)return{state:s,check:{ok:false,reason:'Seleziona prima un edificio.'}};
if(building.type==='road')return{state:s,check:{ok:false,reason:'Le strade non si migliorano: costruisci altri tratti per collegare il borgo.'}};
if(building.level>=MAX_BUILDING_LEVEL)return{state:s,check:{ok:false,reason:'Questo edificio è già al livello massimo.'}};
const cost=upgradeCost(building);
for(const [resource,amount] of Object.entries(cost) as [Resource,number][])if(s.resources[resource]<amount)return{state:s,check:{ok:false,reason:'Servono '+amount+' '+(resource==='wood'?'legname':resource==='stone'?'pietra':resource)+' per migliorare questo edificio.'}};
const resources={...s.resources};
for(const [resource,amount] of Object.entries(cost) as [Resource,number][])resources[resource]-=amount;
return{state:{...s,resources,buildings:s.buildings.map(b=>b.id===id?{...b,level:b.level+1}:b)},check:{ok:true}};}
export function productionForBuilding(b:Building,map:Terrain[][],gameMinutes=0,morale=50,workforceMultiplier=1):Partial<Record<Resource,number>>{
const production:Partial<Record<Resource,number>>={},def=BUILDINGS[b.type],season=getSeason(gameMinutes);let multiplier=workforceMultiplier;
if(b.type==='farm')multiplier*=season.farmMultiplier;
if(b.type==='farm'&&near(map,b.x,b.y,'water',3))multiplier*=1.15;
if(b.type==='sawmill'&&near(map,b.x,b.y,'forest',2))multiplier*=1.1;
if(morale>=75)multiplier*=1.05;else if(morale<=25)multiplier*=.9;
for(const [resource,amount] of Object.entries(def.production??{}) as [Resource,number][])production[resource]=amount*b.level*multiplier;
return production;}
export function resourceRates(s:GameState,map:Terrain[][],gameMinutes=s.gameMinutes):Record<Resource,number>{
const season=getSeason(gameMinutes),morale=s.community?.morale??60,trust=s.community?.trust??50,modifiers=realmModifiers(s);
const rates:Record<Resource,number>={wood:0,stone:0,food:-s.population*.035*season.foodConsumptionMultiplier*modifiers.foodConsumptionMultiplier,coins:s.population*.006*(trust>=75?1.2:1)*modifiers.taxMultiplier+modifiers.tradeIncome};
for(const b of s.buildings)for(const [resource,amount] of Object.entries(productionForBuilding(b,map,gameMinutes,morale,worldBuildingMultiplier(s,b))) as [Resource,number][])rates[resource]+=amount;
return rates;}
export function demolish(s:GameState,id:string):GameState{const b=s.buildings.find(v=>v.id===id);if(!b||b.type==='townHall')return s;const resources={...s.resources};(Object.keys(BUILDINGS[b.type].cost) as Resource[]).forEach(r=>resources[r]+=Math.floor((BUILDINGS[b.type].cost[r]??0)*.3));return{...s,resources,buildings:s.buildings.filter(v=>v.id!==id)};}
export function advanceTime(s:GameState,minutes:number,processCommunity=true,processRealm=true):GameState{
const base=processRealm?ensureWorldState(s):s;
let next:GameState={...base,resources:{...base.resources},buildings:base.buildings.map(b=>({...b})),community:processCommunity?(base.community??createCommunityState(base.seed,base.gameMinutes)):base.community};
const duration=Math.max(0,Math.min(360,Math.floor(minutes))),map=generateTerrain(base.seed);
for(let minute=0;minute<duration;minute++){
const morale=next.community?.morale??60,modifiers=realmModifiers(next);
for(const b of next.buildings)for(const [resource,amount] of Object.entries(productionForBuilding(b,map,next.gameMinutes,morale,worldBuildingMultiplier(next,b))) as [Resource,number][])next.resources[resource]+=amount;
const season=getSeason(next.gameMinutes);
next.resources.food=Math.max(0,next.resources.food-next.population*.035*season.foodConsumptionMultiplier*modifiers.foodConsumptionMultiplier);
next.resources.coins+=next.population*.006*((next.community?.trust??50)>=75?1.2:1)*modifiers.taxMultiplier+modifiers.tradeIncome;
next.gameMinutes++;
if(processCommunity)next=advanceCommunityMinute(next);
const populationBeforeRealmStep=next.population;
if(processRealm)next=advanceRealmMinute(next);
if(next.population===populationBeforeRealmStep&&next.gameMinutes%20===0&&next.resources.food>=18&&next.population<housingCapacity(next)&&(next.community?.morale??60)>=20)next=ensureWorldState({...next,population:next.population+1});
(Object.keys(next.resources) as Resource[]).forEach(r=>next.resources[r]=Math.max(0,Math.round(next.resources[r]*100)/100));
}
return next;}
export function formatGameClock(mins:number):string{const t=mins%1440;return'Giorno '+(Math.floor(mins/1440)+1)+' · '+String(Math.floor(t/60)).padStart(2,'0')+':'+String(t%60).padStart(2,'0');}