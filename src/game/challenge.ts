import {BUILDINGS} from './definitions';
import {createInitialState,resourceTotal} from './engine';
import type {ChallengeCategory,DailyChallenge,GameState} from './types';
import {isBuildingEpochAvailable} from './progression';

export function localDateKey(date=new Date()):string{
  return date.getFullYear()+'-'+String(date.getMonth()+1).padStart(2,'0')+'-'+String(date.getDate()).padStart(2,'0');
}
export function hashString(s:string):number{
  let h=2166136261;
  for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}
  return h>>>0;
}

interface ChallengeTemplate extends Omit<DailyChallenge,'date'|'seed'|'id'> { key:string }
const TEMPLATES:ChallengeTemplate[]=[
  {key:'village-rise',title:'Una casa per tutti',description:'Porta la popolazione a 10 abitanti e rendi il villaggio pronto ad accogliere nuove famiglie.',kind:'population',category:'population',target:10,reward:'Medaglia del costruttore',medalId:'builder',condition:'Crescita libera: proteggi le dispense e lascia spazio ai nuovi abitanti.',scenario:'standard',constraint:'none'},
  {key:'winter-welcome',title:'Un tetto contro l’inverno',description:'Raggiungi 12 abitanti mentre Brumadoro attraversa la stagione fredda.',kind:'population',category:'population',target:12,reward:'Medaglia del focolare',medalId:'hearth',condition:'Scenario invernale: il raccolto è più debole e il consumo di cibo aumenta.',scenario:'winter',constraint:'food-reserve',startGameMinutes:1080,initialResources:{wood:42,stone:24,food:52,coins:12}},
  {key:'full-pantry',title:'Dispense piene',description:'Accumula almeno 150 risorse complessive prima che le scorte si esauriscano.',kind:'resources',category:'resources',target:150,reward:'Medaglia dell’abbondanza',medalId:'abundance',condition:'Nessun vincolo: scegli tra produzione rapida e risparmio.',scenario:'standard',constraint:'none'},
  {key:'scarcity',title:'La lunga carestia',description:'Raccogli 180 risorse complessive partendo da scorte ridotte.',kind:'resources',category:'resources',target:180,reward:'Medaglia della resilienza',medalId:'resilience',condition:'Scorte iniziali ridotte; una carovana porterà provviste dopo poco tempo.',scenario:'shortage',constraint:'none',initialResources:{wood:24,stone:12,food:18,coins:7},eventAt:40,eventId:'caravan',eventTitle:'La carovana del nord',eventDescription:'Una carovana arriva con provviste per il villaggio.',eventDelta:{food:16,wood:4}},
  {key:'golden-fields',title:'Campi dorati',description:'Costruisci due fattorie e rafforza la produzione agricola del regno.',kind:'buildings',category:'farms',target:2,buildingType:'farm',reward:'Medaglia del raccolto',medalId:'harvest',condition:'La fattoria è la priorità: posiziona gli edifici dove possono rendere bene.',scenario:'standard',constraint:'none'},
  {key:'dry-summer',title:'Estate senza pioggia',description:'Costruisci tre fattorie e resisti a un’ondata di siccità.',kind:'buildings',category:'farms',target:3,buildingType:'farm',reward:'Medaglia dell’irrigatore',medalId:'irrigator',condition:'Siccità iniziale: le scorte di cibo sono basse. Dopo 35 minuti una parte del raccolto andrà persa.',scenario:'drought',constraint:'none',startGameMinutes:360,initialResources:{wood:46,stone:23,food:23,coins:13},eventAt:35,eventId:'drought-wave',eventTitle:'Vento caldo sui campi',eventDescription:'L’ondata di calore consuma una parte delle scorte alimentari.',eventDelta:{food:-9}},
  {key:'new-neighbours',title:'Il borgo si allarga',description:'Costruisci tre abitazioni per preparare un quartiere a nuove famiglie.',kind:'buildings',category:'housing',target:3,buildingType:'house',reward:'Medaglia dell’accoglienza',medalId:'welcome',condition:'Ogni abitazione conta. Non puoi demolire edifici durante questa missione.',scenario:'standard',constraint:'no-demolition'},
  {key:'village-festival',title:'La festa delle lanterne',description:'Costruisci due case e celebra una festa di comunità prima di chiudere la giornata.',kind:'buildings',category:'housing',target:2,buildingType:'house',reward:'Medaglia delle lanterne',medalId:'lantern',condition:'La festa si attiva dopo 25 minuti: porta a termine l’obiettivo e ricevi il dono della comunità.',scenario:'festival',constraint:'none',eventAt:25,eventId:'lantern-festival',eventTitle:'La festa delle lanterne',eventDescription:'Gli abitanti organizzano una festa: arrivano viveri e piccole offerte.',eventDelta:{food:6,coins:5}},
  {key:'careful-growth',title:'Crescita senza sprechi',description:'Raggiungi 9 abitanti mantenendo almeno 25 unità di cibo al momento del completamento.',kind:'population',category:'population',target:9,reward:'Medaglia del custode',medalId:'keeper',condition:'Vincolo: la sfida si completa solo con almeno 25 cibo in dispensa.',scenario:'standard',constraint:'food-reserve',initialResources:{wood:38,stone:22,food:45,coins:13}},
  {key:'unexpected-harvest',title:'Il raccolto inatteso',description:'Accumula 125 risorse. La sfida non si conclude finché non arriva l’evento speciale.',kind:'resources',category:'resources',target:125,reward:'Medaglia della fortuna',medalId:'fortune',condition:'Evento speciale dopo 30 minuti: la raccolta straordinaria porterà cibo, ma prima devi restare operativo.',scenario:'windfall',constraint:'none',initialResources:{wood:32,stone:18,food:28,coins:9},eventAt:30,eventId:'windfall',eventTitle:'Raccolta straordinaria',eventDescription:'Una raccolta inattesa riempie le dispense del villaggio.',eventDelta:{food:18,wood:3}},
  {key:'storm-repairs',title:'Dopo la tempesta',description:'Costruisci due fattorie per ripristinare la produzione dopo una tempesta.',kind:'buildings',category:'farms',target:2,buildingType:'farm',reward:'Medaglia della tempra',medalId:'steadfast',condition:'La tempesta arriva al minuto 20 e danneggia le scorte: prepara le fattorie.',scenario:'storm',constraint:'none',initialResources:{wood:40,stone:25,food:30,coins:14},eventAt:20,eventId:'storm',eventTitle:'La tempesta di Brumadoro',eventDescription:'Il vento porta via legname e parte del cibo stoccato.',eventDelta:{wood:-6,food:-5}},
  {key:'roads-forbidden',title:'Un quartiere senza strade',description:'Costruisci due abitazioni sfruttando ogni casella, senza costruire strade.',kind:'buildings',category:'housing',target:2,buildingType:'house',reward:'Medaglia dell’architetto',medalId:'architect',condition:'Vincolo speciale: la costruzione di strade è vietata.',scenario:'standard',constraint:'no-roads'},
  {key:'no-demolition',title:'La promessa del Consiglio',description:'Raggiungi 11 abitanti senza demolire nessuna costruzione.',kind:'population',category:'population',target:11,reward:'Medaglia della promessa',medalId:'promise',condition:'Vincolo speciale: le costruzioni non possono essere demolite.',scenario:'standard',constraint:'no-demolition',initialResources:{wood:42,stone:25,food:40,coins:12}},
  {key:'winter-stores',title:'Provviste per la neve',description:'Accumula 175 risorse mentre il villaggio affronta l’inverno.',kind:'resources',category:'resources',target:175,reward:'Medaglia della dispensa',medalId:'granary',condition:'Scenario invernale: il cibo va amministrato con attenzione.',scenario:'winter',constraint:'none',startGameMinutes:1080,initialResources:{wood:45,stone:24,food:46,coins:11}},
  {key:'the-three-fields',title:'Il patto dei tre campi',description:'Costruisci tre fattorie partendo da scorte limitate e senza strade.',kind:'buildings',category:'farms',target:3,buildingType:'farm',reward:'Medaglia del coltivatore',medalId:'cultivator',condition:'Scorte limitate e strade vietate: pianifica ogni casella.',scenario:'shortage',constraint:'no-roads',initialResources:{wood:34,stone:18,food:29,coins:10}},
  {key:'steady-homes',title:'Un tetto, poi un altro',description:'Costruisci quattro abitazioni e conserva almeno 25 unità di cibo.',kind:'buildings',category:'housing',target:4,buildingType:'house',reward:'Medaglia del quartiere',medalId:'neighbourhood',condition:'Vincolo: servono quattro case e una dispensa con almeno 25 cibo.',scenario:'festival',constraint:'food-reserve',initialResources:{wood:52,stone:30,food:48,coins:15}}
];

export function createDailyChallenge(date=new Date()):DailyChallenge{
  const key=localDateKey(date),seed=hashString('microregno:'+key),template=TEMPLATES[seed%TEMPLATES.length]!;
  return {...template,date:key,seed,id:key+':'+template.key};
}
export function challengeCategory(c:DailyChallenge):ChallengeCategory{
  if(c.category)return c.category;
  if(c.kind==='population')return 'population';
  if(c.kind==='resources')return 'resources';
  return c.buildingType==='farm'?'farms':'housing';
}
export function challengeProgress(s:GameState,c:DailyChallenge):number{
  const category=challengeCategory(c);
  if(category==='population')return Math.min(s.population,c.target);
  if(category==='resources')return Math.min(Math.floor(resourceTotal(s)),c.target);
  const type=category==='farms'?'farm':'house';
  return Math.min(s.buildings.filter(b=>b.type===(c.buildingType??type)).length,c.target);
}
export function isChallengeComplete(s:GameState,c:DailyChallenge,eventTriggered=false):boolean{
  if(challengeProgress(s,c)<c.target)return false;
  if(c.constraint==='food-reserve'&&s.resources.food<25)return false;
  if(c.eventAt!==undefined&&!eventTriggered)return false;
  return true;
}
export function createChallengeState(c:DailyChallenge):GameState{
  const s=createInitialState(c.seed);
  s.resources={wood:38,stone:22,food:36,coins:15,...c.initialResources};
  s.population=5;
  s.gameMinutes=c.startGameMinutes??0;
  if(c.scenario==='drought'&&s.world){
    s.world={...s.world,weather:{id:'drought',endsAt:s.gameMinutes+(c.eventAt??35)}};
  }
  return s;
}
export function challengeScore(s:GameState,c?:DailyChallenge):number{
  const elapsed=Math.max(0,s.gameMinutes-(c?.startGameMinutes??0));
  return Math.max(100,5000-elapsed*8+Math.floor(resourceTotal(s))*3+s.population*25);
}
export function medalTier(score:number):'bronze'|'silver'|'gold'{return score>=4500?'gold':score>=3500?'silver':'bronze';}
export function buildingUnlocked(s:GameState,type:keyof typeof BUILDINGS):boolean{
  return s.population>=BUILDINGS[type].unlockedAt&&isBuildingEpochAvailable(s,type);
}
