import type { BuildingDefinition, BuildingType, Resource } from './types';
export const BOARD_SIZE = 12, TILE_WIDTH = 64, TILE_HEIGHT = 36, OFFLINE_CAP_MINUTES = 360, MAX_BUILDING_LEVEL = 5;
export const RESOURCE_LABELS: Record<Resource, string> = { wood: 'Legname', stone: 'Pietra', food: 'Cibo', coins: 'Monete' };
export const BUILDINGS: Record<BuildingType, BuildingDefinition> = {
  townHall: { type: 'townHall', name: 'Municipio', shortName: 'Municipio', description: 'Il cuore del villaggio. È il primo passo di ogni grande storia.', icon: '⌂', cost: {}, unlockedAt: 0, housing: 5 },
  house: { type: 'house', name: 'Casa di legno', shortName: 'Casa', description: 'Accoglie nuovi abitanti e aumenta la capacità del villaggio.', icon: '⌂', cost: { wood: 12, stone: 5 }, unlockedAt: 0, housing: 6 },
  farm: { type: 'farm', name: 'Fattoria', shortName: 'Fattoria', description: 'Coltiva i campi e mantiene piene le dispense.', icon: '✳', cost: { wood: 10, stone: 3 }, unlockedAt: 0, production: { food: 1.8 } },
  sawmill: { type: 'sawmill', name: 'Segheria', shortName: 'Segheria', description: 'Trasforma il legname dei boschi in materiali da costruzione.', icon: '♧', cost: { wood: 14, stone: 5 }, unlockedAt: 6, production: { wood: 1.25 } },
  quarry: { type: 'quarry', name: 'Cava di pietra', shortName: 'Cava', description: 'Estrae pietra dalle alture rocciose vicine.', icon: '◆', cost: { wood: 11, stone: 8 }, unlockedAt: 6, production: { stone: .8 } },
  market: { type: 'market', name: 'Mercato del borgo', shortName: 'Mercato', description: 'Le botteghe e gli scambi portano nuove monete al regno.', icon: '◇', cost: { wood: 18, stone: 10 }, unlockedAt: 8, production: { coins: .65 } },
  road: { type: 'road', name: 'Strada', shortName: 'Strada', description: 'Forma una rete viaria: solo i tratti continui fino al Municipio o al Mercato danno efficienza agli edifici collegati.', icon: '╱', cost: { wood: 2 }, unlockedAt: 0, production: {} },
  mill: { type: 'mill', name: 'Mulino', shortName: 'Mulino', description: 'Trasforma il grano in farina. Un mugnaio competente evita sprechi.', icon: '⚙', cost: { wood: 16, stone: 8 }, unlockedAt: 8, production: {} },
  bakery: { type: 'bakery', name: 'Panificio', shortName: 'Panificio', description: 'Trasforma la farina in pane, una riserva che sostiene il morale.', icon: '♨', cost: { wood: 18, stone: 10 }, unlockedAt: 10, production: {} },
  warehouse: { type: 'warehouse', name: 'Magazzino', shortName: 'Magazzino', description: 'Aumenta la capacità delle scorte alimentari e dei beni lavorati.', icon: '▦', cost: { wood: 16, stone: 8 }, unlockedAt: 8, production: {} },
  school: { type: 'school', name: 'Scuola degli scribi', shortName: 'Scuola', description: 'I cittadini studiano, migliorano le competenze e accelerano la ricerca.', icon: '✎', cost: { wood: 18, stone: 14, coins: 5 }, unlockedAt: 10, production: {} },
  watchtower: { type: 'watchtower', name: 'Torre di guardia', shortName: 'Torre', description: 'Le pattuglie tengono d’occhio le strade e riducono i rischi degli eventi.', icon: '♜', cost: { wood: 20, stone: 16, coins: 10 }, unlockedAt: 12, production: {} },
  workshop: { type: 'workshop', name: 'Officina', shortName: 'Officina', description: 'Gli artigiani riparano strumenti e producono attrezzi per le spedizioni.', icon: '⚒', cost: { wood: 16, stone: 12 }, unlockedAt: 10, production: {} },
  university: { type: 'university', name: 'Università Reale', shortName: 'Università', description: 'Accoglie studiosi e accelera la ricerca del regno. È un simbolo della nuova Città.', icon: '⌘', cost: { wood: 30, stone: 24, coins: 25 }, unlockedAt: 18, production: {} },
  orchard: { type: 'orchard', name: 'Frutteto', shortName: 'Frutteto', description: 'Filari di alberi da frutto aggiungono raccolti alle dispense; vicino all’acqua rendono ancora di più.', icon: '♧', cost: { wood: 16, stone: 4 }, unlockedAt: 8, production: { food: 1.25 } },
  fishingHut: { type: 'fishingHut', name: 'Capanno dei pescatori', shortName: 'Peschiera', description: 'Una piccola pesca sul fiume porta cibo con regolarità. Deve sorgere vicino all’acqua.', icon: '⚓', cost: { wood: 14, stone: 4 }, unlockedAt: 8, production: { food: 2.1 } },
  herbGarden: { type: 'herbGarden', name: 'Orto delle erbe', shortName: 'Erbario', description: 'Erbe, ortaggi e piante utili completano la produzione alimentare del borgo.', icon: '❀', cost: { wood: 9, stone: 5 }, unlockedAt: 8, production: { food: .9, coins: .08 } },
  inn: { type: 'inn', name: 'Locanda del Crocevia', shortName: 'Locanda', description: 'Accoglie viandanti e mercanti: un luogo vivace che porta entrate al regno.', icon: '⌂', cost: { wood: 24, stone: 14 }, unlockedAt: 12, production: { coins: .9 } },
  ironworks: { type: 'ironworks', name: 'Forgia del Borgo', shortName: 'Forgia', description: 'Gli artigiani lavorano le rocce vicine e trasformano la produzione in valore.', icon: '⚒', cost: { wood: 22, stone: 20, coins: 10 }, unlockedAt: 14, production: { stone: .65, coins: .35 } },
  observatory: { type: 'observatory', name: 'Osservatorio Reale', shortName: 'Osservatorio', description: 'Studia stelle e rotte: accelera le ricerche e apre la strada all’ultima epoca.', icon: '✦', cost: { wood: 35, stone: 36, coins: 35 }, unlockedAt: 28, production: { coins: .45 } },
};
export const BUILD_ORDER: BuildingType[] = [
  'farm', 'house', 'sawmill', 'quarry', 'market', 'road', 'mill', 'warehouse',
  'orchard', 'fishingHut', 'herbGarden', 'bakery', 'school', 'workshop',
  'watchtower', 'inn', 'ironworks', 'university', 'observatory',
];
export const BUILD_TIMES: Record<BuildingType, number> = {
  townHall: 0, house: 10, farm: 12, road: 4, sawmill: 18, quarry: 20, market: 22,
  mill: 24, warehouse: 25, orchard: 18, fishingHut: 18, herbGarden: 16, bakery: 28,
  school: 35, workshop: 30, watchtower: 32, inn: 35, ironworks: 45, university: 60, observatory: 75,
};
export function constructionDuration(type: BuildingType, currentLevel = 1, kind: 'build' | 'upgrade' = 'build'): number {
  if (kind === 'build') return BUILD_TIMES[type];
  const base = Math.max(10, BUILD_TIMES[type]);
  return 20 + Math.max(0, currentLevel - 1) * 15 + Math.max(0, Math.ceil((base - 10) * .35));
}
export function formatConstructionTime(seconds: number): string {
  const total = Math.max(0, Math.ceil(seconds));
  if (total < 60) return total === 1 ? '1 secondo' : total + ' secondi';
  const minutes = Math.floor(total / 60), remainder = total % 60;
  return remainder ? minutes + ' min ' + remainder + ' s' : minutes + ' min';
}
export function formatCost(cost: Partial<Record<Resource, number>>): string {
  const order: Resource[] = ['wood', 'stone', 'food', 'coins'];
  const names: Record<Resource, string> = { wood: 'legname', stone: 'pietra', food: 'cibo', coins: 'monete' };
  return order.filter((r) => (cost[r] ?? 0) > 0).map((r) => String(cost[r]) + ' ' + names[r]).join(' · ') || 'Già disponibile';
}
