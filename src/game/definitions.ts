import type {BuildingDefinition,BuildingType,Resource} from './types';
// Offline progress is capped at six real-world hours.
export const BOARD_SIZE=12,TILE_WIDTH=64,TILE_HEIGHT=36,OFFLINE_CAP_MINUTES=360,MAX_BUILDING_LEVEL=3;
export const RESOURCE_LABELS:Record<Resource,string>={wood:'Legname',stone:'Pietra',food:'Cibo',coins:'Monete'};
export const BUILDINGS:Record<BuildingType,BuildingDefinition>={
townHall:{type:'townHall',name:'Municipio',shortName:'Municipio',description:'Il cuore del villaggio. È il primo passo di ogni grande storia.',icon:'⌂',cost:{},unlockedAt:0,housing:5},
house:{type:'house',name:'Casa di legno',shortName:'Casa',description:'Accoglie nuovi abitanti e aumenta la capacità del villaggio.',icon:'⌂',cost:{wood:12,stone:5},unlockedAt:0,housing:6},
farm:{type:'farm',name:'Fattoria',shortName:'Fattoria',description:'Coltiva i campi e mantiene piene le dispense.',icon:'✳',cost:{wood:10,stone:3},unlockedAt:0,production:{food:1.8}},
sawmill:{type:'sawmill',name:'Segheria',shortName:'Segheria',description:'Trasforma il legname dei boschi in materiali da costruzione.',icon:'♧',cost:{wood:14,stone:5},unlockedAt:6,production:{wood:1.25}},
quarry:{type:'quarry',name:'Cava di pietra',shortName:'Cava',description:'Estrae pietra dalle alture rocciose vicine.',icon:'◆',cost:{wood:11,stone:8},unlockedAt:6,production:{stone:.8}},
market:{type:'market',name:'Mercato del borgo',shortName:'Mercato',description:'Le botteghe e gli scambi portano nuove monete al regno.',icon:'◇',cost:{wood:18,stone:10},unlockedAt:8,production:{coins:.65}}};
export const BUILD_ORDER:BuildingType[]=['house','farm','sawmill','quarry','market'];
export function formatCost(cost:Partial<Record<Resource,number>>):string{const order:Resource[]=['wood','stone','food','coins'];const names:Record<Resource,string>={wood:'legname',stone:'pietra',food:'cibo',coins:'monete'};return order.filter(r=>(cost[r]??0)>0).map(r=>String(cost[r])+' '+names[r]).join(' · ')||'Già disponibile';}