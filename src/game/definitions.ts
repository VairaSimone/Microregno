import type { BuildingDefinition, BuildingType, Resource } from './types';
export const BOARD_SIZE = 12, TILE_WIDTH = 64, TILE_HEIGHT = 36, OFFLINE_CAP_MINUTES = 360, MAX_BUILDING_LEVEL = 3;
export const RESOURCE_LABELS: Record<Resource, string> = { wood: 'Legname', stone: 'Pietra', food: 'Cibo', coins: 'Monete' };
export const BUILDINGS: Record<BuildingType, BuildingDefinition> = {
  townHall: { type: 'townHall', name: 'Municipio', shortName: 'Municipio', description: 'Il cuore del villaggio. È il primo passo di ogni grande storia.', icon: '⌂', cost: {}, unlockedAt: 0, housing: 5 },
  house: { type: 'house', name: 'Casa di legno', shortName: 'Casa', description: 'Accoglie nuovi abitanti e aumenta la capacità del villaggio.', icon: '⌂', cost: { wood: 12, stone: 5 }, unlockedAt: 0, housing: 6 },
  farm: { type: 'farm', name: 'Fattoria', shortName: 'Fattoria', description: 'Coltiva i campi e mantiene piene le dispense.', icon: '✳', cost: { wood: 10, stone: 3 }, unlockedAt: 0, production: { food: 1.8 } },
  sawmill: { type: 'sawmill', name: 'Segheria', shortName: 'Segheria', description: 'Trasforma il legname dei boschi in materiali da costruzione.', icon: '♧', cost: { wood: 14, stone: 5 }, unlockedAt: 6, production: { wood: 1.25 } },
  quarry: { type: 'quarry', name: 'Cava di pietra', shortName: 'Cava', description: 'Estrae pietra dalle alture rocciose vicine.', icon: '◆', cost: { wood: 11, stone: 8 }, unlockedAt: 6, production: { stone: .8 } },
  market: { type: 'market', name: 'Mercato del borgo', shortName: 'Mercato', description: 'Le botteghe e gli scambi portano nuove monete al regno.', icon: '◇', cost: { wood: 18, stone: 10 }, unlockedAt: 8, production: { coins: .65 } },
  mill: { type: 'mill', name: 'Mulino', shortName: 'Mulino', description: 'Trasforma il grano in farina. Un mugnaio competente evita sprechi.', icon: '⚙', cost: { wood: 16, stone: 8 }, unlockedAt: 8, production: {} },
  bakery: { type: 'bakery', name: 'Panificio', shortName: 'Panificio', description: 'Trasforma la farina in pane, una riserva che sostiene il morale.', icon: '♨', cost: { wood: 18, stone: 10 }, unlockedAt: 10, production: {} },
  warehouse: { type: 'warehouse', name: 'Magazzino', shortName: 'Magazzino', description: 'Aumenta la capacità delle scorte alimentari e dei beni lavorati.', icon: '▦', cost: { wood: 16, stone: 8 }, unlockedAt: 8, production: {} },
  school: { type: 'school', name: 'Scuola degli scribi', shortName: 'Scuola', description: 'I cittadini studiano, migliorano le competenze e accelerano la ricerca.', icon: '✎', cost: { wood: 18, stone: 14, coins: 5 }, unlockedAt: 10, production: {} },
  watchtower: { type: 'watchtower', name: 'Torre di guardia', shortName: 'Torre', description: 'Le pattuglie tengono d’occhio le strade e riducono i rischi degli eventi.', icon: '♜', cost: { wood: 20, stone: 16, coins: 10 }, unlockedAt: 12, production: {} },
  workshop: { type: 'workshop', name: 'Officina', shortName: 'Officina', description: 'Gli artigiani riparano strumenti e producono attrezzi per le spedizioni.', icon: '⚒', cost: { wood: 16, stone: 12 }, unlockedAt: 10, production: {} },
};
export const BUILD_ORDER: BuildingType[] = ['house', 'farm', 'sawmill', 'quarry', 'market', 'mill', 'bakery', 'warehouse', 'school', 'workshop', 'watchtower'];
export function formatCost(cost: Partial<Record<Resource, number>>): string {
  const order: Resource[] = ['wood', 'stone', 'food', 'coins'];
  const names: Record<Resource, string> = { wood: 'legname', stone: 'pietra', food: 'cibo', coins: 'monete' };
  return order.filter((r) => (cost[r] ?? 0) > 0).map((r) => String(cost[r]) + ' ' + names[r]).join(' · ') || 'Già disponibile';
}