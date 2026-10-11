import type { BuildingDefinition, BuildingType, Resource } from './types';
export const BOARD_SIZE = 12, TILE_WIDTH = 64, TILE_HEIGHT = 36, OFFLINE_CAP_MINUTES = 360, MAX_BUILDING_LEVEL = 5;
export const RESOURCE_LABELS: Record<Resource, string> = { wood: 'Legname', stone: 'Pietra', food: 'Cibo', coins: 'Monete' };
export const BUILDINGS: Record<BuildingType, BuildingDefinition> = {
  townHall: { type: 'townHall', name: 'Municipio', shortName: 'Municipio', description: 'La vecchia sede del Consiglio. Sotto le fondamenta, una campana ha suonato dopo trecento anni; Bricco crede che custodisca il primo indizio del Patto.', icon: '⌂', cost: {}, unlockedAt: 0, housing: 5 },
  house: { type: 'house', name: 'Casa di legno', shortName: 'Casa', description: 'Un tetto è la prima promessa mantenuta. Ogni famiglia che trova posto qui avvicina Brumadoro alla prima delle Cinque Luci.', icon: '⌂', cost: { wood: 12, stone: 5 }, unlockedAt: 0, housing: 6 },
  farm: { type: 'farm', name: 'Fattoria', shortName: 'Fattoria', description: 'I solchi della valle seguono un’antica mappa stellare. Nutri le famiglie: la memoria non serve a chi resta affamato.', icon: '✳', cost: { wood: 10, stone: 3 }, unlockedAt: 0, production: { food: 1.8 } },
  sawmill: { type: 'sawmill', name: 'Segheria', shortName: 'Segheria', description: 'I tronchi del Bosco delle Radici sostenevano un tempo le strade del Patto. Taglia con saggezza: quelle foreste ricordano più di quanto sembri.', icon: '♧', cost: { wood: 14, stone: 5 }, unlockedAt: 6, production: { wood: 1.25 } },
  quarry: { type: 'quarry', name: 'Cava di pietra', shortName: 'Cava', description: 'Nelle vene del Passo si trovano pietre incise con stelle. I minatori dicono che alcune provengano dalla campana sepolta.', icon: '◆', cost: { wood: 11, stone: 8 }, unlockedAt: 6, production: { stone: .8 } },
  market: { type: 'market', name: 'Mercato del borgo', shortName: 'Mercato', description: 'Qui si incontrano le tre comunità vicine. Ogni scambio può diventare un ponte oppure una nuova frattura nel Patto.', icon: '◇', cost: { wood: 18, stone: 10 }, unlockedAt: 8, production: { coins: .65 } },
  road: { type: 'road', name: 'Strada', shortName: 'Strada', description: 'Le vecchie mappe non mostrano confini, ma percorsi tra comunità. Collega ogni tratto al Municipio o al Mercato per riaprire le strade del Patto.', icon: '╱', cost: { wood: 2 }, unlockedAt: 0, production: {} },
  mill: { type: 'mill', name: 'Mulino', shortName: 'Mulino', description: 'Il mulino è il ritmo del villaggio: grano in farina, lavoro in pane. Le cronache raccontano che nessuna comunità del Patto doveva lasciare vuota la tavola di un’altra.', icon: '⚙', cost: { wood: 16, stone: 8 }, unlockedAt: 8, production: {} },
  bakery: { type: 'bakery', name: 'Panificio', shortName: 'Panificio', description: 'Si dice che qui venissero preparate le pagnotte per la Veglia della Campana. Il pane condiviso è la prima forma di alleanza.', icon: '♨', cost: { wood: 18, stone: 10 }, unlockedAt: 10, production: {} },
  warehouse: { type: 'warehouse', name: 'Magazzino', shortName: 'Magazzino', description: 'Un magazzino ben gestito protegge i raccolti dai lunghi inverni e custodisce le provviste destinate alle valli in difficoltà.', icon: '▦', cost: { wood: 16, stone: 8 }, unlockedAt: 8, production: {} },
  school: { type: 'school', name: 'Scuola degli scribi', shortName: 'Scuola', description: 'Gli scribi confrontano i racconti di Selvalunga, Porto Salmastra e Rocciacupa, cercando la parte di verità che ciascuno ha ereditato.', icon: '✎', cost: { wood: 18, stone: 14, coins: 5 }, unlockedAt: 10, production: {} },
  watchtower: { type: 'watchtower', name: 'Torre di guardia', shortName: 'Torre', description: 'Le vecchie torri servivano a segnalare pericoli, non a dominare i passanti. Il loro fuoco ricorda che la sicurezza è una promessa reciproca.', icon: '♜', cost: { wood: 20, stone: 16, coins: 10 }, unlockedAt: 12, production: {} },
  workshop: { type: 'workshop', name: 'Officina', shortName: 'Officina', description: 'Gli artigiani lavorano il bronzo e gli attrezzi necessari alle spedizioni. Ogni reperto restaurato può riportare alla luce un frammento della storia.', icon: '⚒', cost: { wood: 16, stone: 12 }, unlockedAt: 10, production: {} },
  university: { type: 'university', name: 'Università Reale', shortName: 'Università', description: 'Nell’Università Reale gli studiosi traducono le tavolette delle Rovine della Corona. Il sapere rivela perché la campana fu sepolta e il Patto diviso.', icon: '⌘', cost: { wood: 30, stone: 24, coins: 25 }, unlockedAt: 18, production: {} },
  orchard: { type: 'orchard', name: 'Frutteto', shortName: 'Frutteto', description: 'I frutti del frutteto sono destinati anche ai viandanti che percorrono la mappa antica. Vicino all’acqua, i filari ricordano i giardini delle prime cinque comunità.', icon: '♧', cost: { wood: 16, stone: 4 }, unlockedAt: 8, production: { food: 1.25 } },
  fishingHut: { type: 'fishingHut', name: 'Capanno dei pescatori', shortName: 'Peschiera', description: 'I pescatori del Lago degli Specchi conoscono correnti e passaggi sicuri. Costruisci vicino all’acqua per sostenere le famiglie e i viaggiatori.', icon: '⚓', cost: { wood: 14, stone: 4 }, unlockedAt: 8, production: { food: 2.1 } },
  herbGarden: { type: 'herbGarden', name: 'Orto delle erbe', shortName: 'Erbario', description: 'Le erbe del giardino guariscono piccoli mali e ricordano i rimedi custoditi dai vecchi guardiani delle valli.', icon: '❀', cost: { wood: 9, stone: 5 }, unlockedAt: 8, production: { food: .9, coins: .08 } },
  inn: { type: 'inn', name: 'Locanda del Crocevia', shortName: 'Locanda', description: 'Alla Locanda del Crocevia si scambiano notizie e leggende. Ogni viandante potrebbe conoscere una delle cinque stelle scomparse.', icon: '⌂', cost: { wood: 24, stone: 14 }, unlockedAt: 12, production: { coins: .9 } },
  ironworks: { type: 'ironworks', name: 'Forgia del Borgo', shortName: 'Forgia', description: 'La forgia fonde metallo e pietra del Passo per restaurare i sigilli antichi. Cerca una zona rocciosa: la storia del bronzo comincia sotto terra.', icon: '⚒', cost: { wood: 22, stone: 20, coins: 10 }, unlockedAt: 14, production: { stone: .65, coins: .35 } },
  observatory: { type: 'observatory', name: 'Osservatorio Reale', shortName: 'Osservatorio', description: 'Dalla sua cupola, le cinque regioni formano una costellazione. L’Osservatorio può mostrare il disegno del Patto e il luogo in cui la campana attende.', icon: '✦', cost: { wood: 35, stone: 36, coins: 35 }, unlockedAt: 28, production: { coins: .45 } },
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
