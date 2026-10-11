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
  {key:'village-rise',title:'Il richiamo della prima luce',description:'La campana ha chiamato nuovi viandanti. Porta la popolazione a 10 abitanti e prepara un rifugio per chi seguirà il rintocco.',kind:'population',category:'population',target:10,reward:'Medaglia del costruttore',medalId:'builder',condition:'Prima prova del Patto: proteggi le dispense e lascia spazio a chi bussa alla porta.',scenario:'standard',constraint:'none'},
  {key:'winter-welcome',title:'La veglia sotto la neve',description:'Raggiungi 12 abitanti durante la notte più fredda dell’anno: qualcuno ha giurato di aver sentito la campana sotto la neve.',kind:'population',category:'population',target:12,reward:'Medaglia del focolare',medalId:'hearth',condition:'Il gelo mette alla prova la promessa di aiuto reciproco: il raccolto è più debole e il consumo di cibo aumenta.',scenario:'winter',constraint:'food-reserve',startGameMinutes:1080,initialResources:{wood:42,stone:24,food:52,coins:12}},
  {key:'full-pantry',title:'La dispensa del Patto',description:'Elio ha ritrovato un registro delle provviste condivise. Accumula almeno 150 risorse complessive per dimostrare che Brumadoro sa prepararsi senza dimenticare le altre valli.',kind:'resources',category:'resources',target:150,reward:'Medaglia dell’abbondanza',medalId:'abundance',condition:'Nessun vincolo: una valle forte è quella che sa produrre, conservare e condividere.',scenario:'standard',constraint:'none'},
  {key:'scarcity',title:'Il convoglio scomparso',description:'Un convoglio diretto alle Rovine della Corona è scomparso. Raccogli 180 risorse complessive per soccorrere i viaggiatori senza lasciare il borgo senza scorte.',kind:'resources',category:'resources',target:180,reward:'Medaglia della resilienza',medalId:'resilience',condition:'Le scorte sono ridotte. Una carovana potrebbe arrivare, ma la strada non è sicura.',scenario:'shortage',constraint:'none',initialResources:{wood:24,stone:12,food:18,coins:7},eventAt:40,eventId:'caravan',eventTitle:'La carovana del nord',eventDescription:'Dalla nebbia compare un convoglio con provviste e un frammento di mappa inciso con una stella.',eventDelta:{food:16,wood:4}},
  {key:'golden-fields',title:'I semi di Selvalunga',description:'Gli emissari di Selvalunga affidano a Brumadoro semi antichi. Costruisci due fattorie e rafforza la produzione agricola del regno.',kind:'buildings',category:'farms',target:2,buildingType:'farm',reward:'Medaglia del raccolto',medalId:'harvest',condition:'I semi cresceranno soltanto se il borgo saprà custodirli: posiziona le fattorie con attenzione.',scenario:'standard',constraint:'none'},
  {key:'dry-summer',title:'Il silenzio delle nubi',description:'Le stelle sono sbiadite sotto un cielo senza pioggia. Costruisci tre fattorie e resisti alla siccità che minaccia il primo frammento del Patto.',kind:'buildings',category:'farms',target:3,buildingType:'farm',reward:'Medaglia dell’irrigatore',medalId:'irrigator',condition:'La terra si secca: le scorte sono basse e, dopo 35 minuti di gioco, l’ondata di calore consumerà parte del raccolto.',scenario:'drought',constraint:'none',startGameMinutes:360,initialResources:{wood:46,stone:23,food:23,coins:13},eventAt:35,eventId:'drought-wave',eventTitle:'Il respiro rovente del Passo',eventDescription:'Un vento caldo scende dal Passo delle Rocce e brucia una parte delle scorte alimentari.',eventDelta:{food:-9}},
  {key:'new-neighbours',title:'Rifugio per i senza valle',description:'Tre famiglie sono fuggite dalle Terre di Confine portando storie di strade spezzate. Costruisci tre abitazioni per accoglierle.',kind:'buildings',category:'housing',target:3,buildingType:'house',reward:'Medaglia dell’accoglienza',medalId:'welcome',condition:'Ogni tetto è una promessa di protezione. In questa missione non puoi demolire edifici.',scenario:'standard',constraint:'no-demolition'},
  {key:'village-festival',title:'Le cinque lanterne',description:'Gli abitanti vogliono accendere cinque lanterne in memoria delle regioni divise. Costruisci due case e celebra la festa prima che cali la notte.',kind:'buildings',category:'housing',target:2,buildingType:'house',reward:'Medaglia delle lanterne',medalId:'lantern',condition:'La festa si attiva dopo 25 minuti di gioco: completa l’obiettivo e ricevi il dono della comunità.',scenario:'festival',constraint:'none',eventAt:25,eventId:'lantern-festival',eventTitle:'La festa delle lanterne',eventDescription:'Le cinque lanterne si accendono nella piazza. La comunità dona viveri e monete per il viaggio verso le regioni lontane.',eventDelta:{food:6,coins:5}},
  {key:'careful-growth',title:'Pane per la promessa',description:'Raggiungi 9 abitanti e mantieni almeno 25 unità di cibo: la prima clausola del Patto dice che nessun ospite deve essere accolto a dispensa vuota.',kind:'population',category:'population',target:9,reward:'Medaglia del custode',medalId:'keeper',condition:'La promessa vale soltanto se restano almeno 25 unità di cibo in dispensa.',scenario:'standard',constraint:'food-reserve',initialResources:{wood:38,stone:22,food:45,coins:13}},
  {key:'unexpected-harvest',title:'Il dono dei campi antichi',description:'Accumula 125 risorse e attendi il raccolto inatteso: tra le spighe potrebbe nascondersi un segno inciso dai primi custodi.',kind:'resources',category:'resources',target:125,reward:'Medaglia della fortuna',medalId:'fortune',condition:'Dopo 30 minuti di gioco arriverà l’evento speciale; fino ad allora il borgo deve reggere con le proprie forze.',scenario:'windfall',constraint:'none',initialResources:{wood:32,stone:18,food:28,coins:9},eventAt:30,eventId:'windfall',eventTitle:'Il raccolto segnato dalle stelle',eventDescription:'Una raccolta inattesa riempie le dispense e rivela un simbolo a cinque punte fra i covoni.',eventDelta:{food:18,wood:3}},
  {key:'storm-repairs',title:'Tempesta sul sentiero del Passo',description:'Una tempesta ha spezzato la strada verso il Passo. Costruisci due fattorie per mantenere il borgo in vita mentre i messaggeri cercano aiuto.',kind:'buildings',category:'farms',target:2,buildingType:'farm',reward:'Medaglia della tempra',medalId:'steadfast',condition:'La tempesta arriva al minuto 20 di gioco e consuma legname e cibo: prepara le fattorie prima che il cielo cambi.',scenario:'storm',constraint:'none',initialResources:{wood:40,stone:25,food:30,coins:14},eventAt:20,eventId:'storm',eventTitle:'La notte dei rami spezzati',eventDescription:'Il vento porta via legname e cibo: gli abitanti ricordano che nessuna strada si ricostruisce da sola.',eventDelta:{wood:-6,food:-5}},
  {key:'roads-forbidden',title:'Sentieri prima delle strade',description:'Prima che esistessero le strade regie, le cinque valli si aiutavano tramite sentieri. Costruisci due abitazioni senza costruire strade.',kind:'buildings',category:'housing',target:2,buildingType:'house',reward:'Medaglia dell’architetto',medalId:'architect',condition:'Vincolo speciale: questa prova si affronta senza costruire strade.',scenario:'standard',constraint:'no-roads'},
  {key:'no-demolition',title:'Nessuno resta indietro',description:'Raggiungi 11 abitanti senza demolire costruzioni: la nuova Corona non dovrà mai essere edificata sulle rovine delle case degli altri.',kind:'population',category:'population',target:11,reward:'Medaglia della promessa',medalId:'promise',condition:'Vincolo speciale: non puoi demolire edifici durante la missione.',scenario:'standard',constraint:'no-demolition',initialResources:{wood:42,stone:25,food:40,coins:12}},
  {key:'winter-stores',title:'La dispensa della campana',description:'Accumula 175 risorse durante l’inverno. Secondo Bricco, il rintocco sotto la neve segnala che la prima comunità ha bisogno di aiuto.',kind:'resources',category:'resources',target:175,reward:'Medaglia della dispensa',medalId:'granary',condition:'Scenario invernale: il cibo è prezioso e va amministrato con attenzione.',scenario:'winter',constraint:'none',startGameMinutes:1080,initialResources:{wood:45,stone:24,food:46,coins:11}},
  {key:'the-three-fields',title:'Tre campi, tre stelle',description:'Costruisci tre fattorie con scorte limitate e senza strade: ogni campo rappresenta una delle tre comunità che hanno smesso di parlarsi.',kind:'buildings',category:'farms',target:3,buildingType:'farm',reward:'Medaglia del coltivatore',medalId:'cultivator',condition:'Scorte limitate e strade vietate: pianifica ogni casella e non sprecare il legname.',scenario:'shortage',constraint:'no-roads',initialResources:{wood:34,stone:18,food:29,coins:10}},
  {key:'steady-homes',title:'Case per le cinque famiglie',description:'Costruisci quattro abitazioni e conserva almeno 25 unità di cibo. La prima pagina del Patto prometteva rifugio a ogni famiglia in cammino.',kind:'buildings',category:'housing',target:4,buildingType:'house',reward:'Medaglia del quartiere',medalId:'neighbourhood',condition:'Vincolo: servono quattro case completate e almeno 25 unità di cibo.',scenario:'festival',constraint:'food-reserve',initialResources:{wood:52,stone:30,food:48,coins:15}}
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
  return Math.min(s.buildings.filter(b=>b.type===(c.buildingType??type)&&b.construction?.kind!=='build').length,c.target);
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
