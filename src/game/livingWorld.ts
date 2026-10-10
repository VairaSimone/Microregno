import { BUILDINGS } from './definitions';
import type {
  Building, BuildingType, Citizen, CommunityState, Expedition, Faction, FoodPolicy, ForestPolicy,
  GameState, GoodsBag, Profession, ProjectId, RealmAction, RealmEvent, RealmEventChoice, ResearchDefinition,
  MarketState, RegionId, Resource, ResourceBag, RealmPolicies, TaxPolicy, GuardPolicy, TradableGood, WorldState,
} from './types';

export const PROFESSION_LABELS: Record<Profession, string> = {
  farmer: 'Contadino', lumberjack: 'Boscaiolo', miner: 'Minatore', merchant: 'Mercante',
  miller: 'Mugnaio', baker: 'Fornaio', scholar: 'Studioso', scout: 'Esploratore',
  builder: 'Costruttore', guard: 'Guardia', artisan: 'Artigiano',
};
export const PROFESSIONS = Object.keys(PROFESSION_LABELS) as Profession[];

export const RESEARCH: ResearchDefinition[] = [
  { id: 'irrigation', name: 'Irrigazione', path: 'Agricoltura', description: 'Le fattorie producono di più e resistono meglio alle stagioni difficili.', cost: 18, duration: 180 },
  { id: 'tools', name: 'Utensili efficienti', path: 'Artigianato', description: 'Gli edifici produttivi rendono il 12% in più.', cost: 22, duration: 210 },
  { id: 'trade', name: 'Reti commerciali', path: 'Commercio', description: 'Il mercato rende di più e gli accordi esteri generano più monete.', cost: 24, duration: 220 },
  { id: 'education', name: 'Scuola dei maestri', path: 'Conoscenza', description: 'Gli studiosi accelerano le ricerche e le competenze crescono più velocemente.', cost: 20, duration: 190 },
  { id: 'cartography', name: 'Cartografia', path: 'Esplorazione', description: 'Sblocca spedizioni più lontane e permette due spedizioni contemporanee.', cost: 26, duration: 250 },
  { id: 'forestry', name: 'Silvicoltura', path: 'Natura', description: 'La gestione protetta dei boschi sacrifica meno produzione.', cost: 21, duration: 190 },
];

export const REGIONS: Array<{ id: RegionId; name: string; description: string; duration: number; requirement: string | null }> = [
  { id: 'forest', name: 'Bosco antico', description: 'Legname, erbe e tracce di viaggiatori.', duration: 100, requirement: null },
  { id: 'mountains', name: 'Passo delle rocce', description: 'Cave dimenticate, pietra e strumenti abbandonati.', duration: 135, requirement: 'forest' },
  { id: 'lake', name: 'Lago velato', description: 'Pesce, piante medicinali e una rotta per i mercanti.', duration: 120, requirement: 'forest' },
  { id: 'ancient-ruins', name: 'Rovine della Corona', description: 'Resti di una civiltà e conoscenze sepolte.', duration: 180, requirement: 'cartography' },
  { id: 'borderlands', name: 'Terre di confine', description: 'Nuove comunità, merci rare e opportunità diplomatiche.', duration: 210, requirement: 'cartography' },
];

export const PROJECTS: Array<{ id: ProjectId; name: string; description: string; stages: Array<Partial<ResourceBag>> }> = [
  { id: 'aqueduct', name: 'Acquedotto del borgo', description: 'Stabilizza i raccolti e migliora l’efficienza agricola.', stages: [{ wood: 10, stone: 8 }, { wood: 14, stone: 12, coins: 8 }, { stone: 18, coins: 14 }] },
  { id: 'stone-bridge', name: 'Ponte di pietra', description: 'Apre una rotta stabile verso le terre di confine.', stages: [{ wood: 12, stone: 6 }, { wood: 16, stone: 14, coins: 8 }, { stone: 20, coins: 15 }] },
  { id: 'artisan-quarter', name: 'Quartiere artigiano', description: 'Botteghe coordinate e cittadini che imparano più in fretta.', stages: [{ wood: 16, stone: 10 }, { wood: 18, stone: 18, coins: 10 }, { wood: 20, stone: 20, coins: 15 }] },
  { id: 'grand-archive', name: 'Grande archivio', description: 'Una raccolta di mappe e manuali rende lo studio più efficiente.', stages: [{ wood: 12, stone: 14 }, { stone: 16, coins: 12 }, { wood: 8, stone: 22, coins: 18 }] },
];

const NAMES = ['Ada', 'Berto', 'Mira', 'Neri', 'Lina', 'Elio', 'Rina', 'Timo', 'Ivo', 'Sera', 'Dario', 'Nadia', 'Gio', 'Alba', 'Piero', 'Zara', 'Orso', 'Tessa', 'Lupo', 'Marta', 'Enea', 'Bruna', 'Ciro', 'Noemi'];
const TRAITS = ['curioso', 'generoso', 'ambizioso', 'paziente', 'socievole', 'pratico', 'prudente', 'inventivo'];
const INITIAL_JOBS: Profession[] = ['farmer', 'farmer', 'builder', 'merchant', 'scout', 'lumberjack', 'miner', 'artisan', 'baker', 'scholar'];
const DEFAULT_GOODS: GoodsBag = { grain: 12, flour: 4, bread: 6, tools: 2, medicine: 1 };
const MARKET_BASE_PRICES: Record<TradableGood, number> = { grain: 1, flour: 2, bread: 3, tools: 6, medicine: 5 };
const MARKET_GOOD_LABELS: Record<TradableGood, string> = { grain: 'grano', flour: 'farina', bread: 'pane', tools: 'attrezzi', medicine: 'rimedi' };
function createMarketState(gameMinutes = 0): MarketState {
  return { prices: { ...MARKET_BASE_PRICES }, demand: { grain: 1, flour: 1, bread: 1, tools: 1, medicine: 1 }, cycle: 0, nextShiftAt: gameMinutes + 120 };
}
function refreshMarket(seed: number, gameMinutes: number, market: MarketState, goods: GoodsBag): MarketState {
  const cycle = market.cycle + 1;
  const keys = Object.keys(MARKET_BASE_PRICES) as TradableGood[];
  const demand = { ...market.demand };
  const prices = { ...market.prices };
  keys.forEach((good, index) => {
    const score = Math.abs(Math.trunc(seed * 31 + cycle * 137 + index * 227)) % 101;
    let factor = 0.62 + score / 150;
    if (goods[good] > 16) factor *= 0.82;
    if (goods[good] < 3) factor *= 1.12;
    factor = Math.max(0.5, Math.min(1.55, factor));
    demand[good] = Math.round(factor * 100) / 100;
    prices[good] = Math.max(1, Math.round(MARKET_BASE_PRICES[good] * factor));
  });
  return { prices, demand, cycle, nextShiftAt: gameMinutes + 120 };
}
const DEFAULT_POLICIES: RealmPolicies = { tax: 'balanced', food: 'balanced', forest: 'managed', guard: 'none' };

function clamp(value: number, low = 0, high = 100): number {
  return Math.max(low, Math.min(high, Math.round(value * 100) / 100));
}
function makeCitizen(seed: number, index: number, gameMinutes: number): Citizen {
  const allSkills: Record<Profession, number> = {
    farmer: 5, lumberjack: 5, miner: 5, merchant: 5, miller: 5, baker: 5,
    scholar: 5, scout: 5, builder: 5, guard: 5, artisan: 5,
  };
  const profession = INITIAL_JOBS[index % INITIAL_JOBS.length]!;
  allSkills[profession] = 15 + ((seed + index * 7) % 18);
  const a = Math.abs(seed + index * 13);
  return {
    id: 'citizen-' + (index + 1),
    name: NAMES[(a + index) % NAMES.length]!,
    age: 18 + (a % 43),
    profession,
    traits: [TRAITS[a % TRAITS.length]!, TRAITS[(a + 3) % TRAITS.length]!],
    skills: allSkills,
    hunger: 15 + (a % 20),
    energy: 66 + (a % 28),
    happiness: 58 + (a % 26),
    health: 88 + (a % 13),
    experience: 0,
    status: 'resident',
    expeditionId: null,
    lastAction: 'Si gode una mattina tranquilla',
    relationships: {},
    homeId: 'town-hall-1',
    familyId: 'family-' + (Math.floor(index / 2) + 1),
    bornAt: gameMinutes,
  };
}

export function createWorldState(seed: number, population = 5, gameMinutes = 0): WorldState {
  const citizens = Array.from({ length: Math.max(0, population) }, (_, index) => makeCitizen(seed, index, gameMinutes));
  const factionSeed = Math.abs(seed);
  const factions: Faction[] = [
    { id: 'selvalunga', name: 'Selvalunga', specialty: 'Legname e botanica', relation: 28 + factionSeed % 20, lastContact: 0, treaty: false },
    { id: 'salmastra', name: 'Porto Salmastra', specialty: 'Commercio e pesca', relation: 32 + (factionSeed >> 3) % 21, lastContact: 0, treaty: false },
    { id: 'rocciacupa', name: 'Rocciacupa', specialty: 'Pietra e artigiani', relation: 25 + (factionSeed >> 6) % 25, lastContact: 0, treaty: false },
  ];
  return {
    version: 1, nextCitizenId: citizens.length + 1, citizens, goods: { ...DEFAULT_GOODS },
    policies: { ...DEFAULT_POLICIES }, researchPoints: 25, activeResearch: null, researchProgress: 0,
    researched: [], expeditions: [], discoveredRegions: [], chronicle: ['È nato un nuovo Consiglio del Regno. I cittadini ora hanno bisogni, mestieri e ambizioni.'],
    activeEvent: null, nextEventAt: gameMinutes + 240, queuedEvent: null,
    projectStages: { aqueduct: 0, 'stone-bridge': 0, 'artisan-quarter': 0, 'grand-archive': 0 },
    market: createMarketState(gameMinutes), forestHealth: 100,
    completedProjects: [], factions, tradeRoutes: [],
  };
}

export function ensureWorldState(state: GameState): GameState {
  const existing = state.world;
  if (!existing || existing.version !== 1 || !Array.isArray(existing.citizens) || !existing.goods ||
      !existing.policies || !Array.isArray(existing.researched) || !Array.isArray(existing.expeditions) ||
      !Array.isArray(existing.discoveredRegions) || !Array.isArray(existing.chronicle) ||
      !existing.projectStages || !Array.isArray(existing.factions)) {
    return { ...state, world: createWorldState(state.seed, state.population, state.gameMinutes) };
  }
  let citizens = existing.citizens.map((citizen) => ({ ...citizen, skills: { ...citizen.skills }, traits: [...citizen.traits], relationships: { ...citizen.relationships } }));
  let nextCitizenId = Number.isFinite(existing.nextCitizenId) ? existing.nextCitizenId : citizens.length + 1;
  while (citizens.length < state.population) {
    const citizen = makeCitizen(state.seed, nextCitizenId - 1, state.gameMinutes);
    citizen.id = 'citizen-' + nextCitizenId;
    citizens.push(citizen);
    nextCitizenId++;
  }
  if (citizens.length > state.population) {
    const remove = citizens.length - state.population;
    const removable = citizens.filter((citizen) => citizen.status !== 'exploring').slice(-remove).map((citizen) => citizen.id);
    citizens = citizens.filter((citizen) => !removable.includes(citizen.id));
    while (citizens.length > state.population) citizens.pop();
  }
  const homes = state.buildings.filter((building) => (BUILDINGS[building.type]?.housing ?? 0) > 0);
  const occupied = new Map<string, number>();
  citizens = citizens.map((citizen, index) => {
    const oldHome = homes.find((building) => building.id === citizen.homeId);
    const oldCapacity = oldHome ? (BUILDINGS[oldHome.type]?.housing ?? 0) * oldHome.level : 0;
    const oldUsed = oldHome ? occupied.get(oldHome.id) ?? 0 : 0;
    const selected = oldHome && oldUsed < oldCapacity
      ? oldHome
      : homes.find((building) => (occupied.get(building.id) ?? 0) < (BUILDINGS[building.type]?.housing ?? 0) * building.level);
    if (selected) occupied.set(selected.id, (occupied.get(selected.id) ?? 0) + 1);
    return { ...citizen, homeId: selected?.id ?? null, familyId: citizen.familyId || 'family-' + (Math.floor(index / 2) + 1) };
  });
  const world: WorldState = {
    ...existing,
    nextCitizenId,
    citizens,
    goods: { ...DEFAULT_GOODS, ...existing.goods },
    policies: { ...DEFAULT_POLICIES, ...existing.policies },
    researchPoints: Number.isFinite(existing.researchPoints) ? existing.researchPoints : 0,
    researchProgress: Number.isFinite(existing.researchProgress) ? existing.researchProgress : 0,
    activeResearch: existing.activeResearch ?? null,
    expeditions: existing.expeditions.filter((expedition) => expedition && typeof expedition.id === 'string').slice(-8),
    discoveredRegions: [...new Set(existing.discoveredRegions)],
    chronicle: existing.chronicle.slice(0, 12),
    activeEvent: existing.activeEvent ?? null,
    nextEventAt: Number.isFinite(existing.nextEventAt) ? existing.nextEventAt : state.gameMinutes + 240,
    queuedEvent: existing.queuedEvent ?? null,
    projectStages: Object.assign({ aqueduct: 0, 'stone-bridge': 0, 'artisan-quarter': 0, 'grand-archive': 0 }, existing.projectStages),
    market: { ...createMarketState(state.gameMinutes), ...(existing.market ?? {}), prices: { ...MARKET_BASE_PRICES, ...(existing.market?.prices ?? {}) }, demand: Object.assign({ grain: 1, flour: 1, bread: 1, tools: 1, medicine: 1 }, existing.market?.demand), cycle: Number.isFinite(existing.market?.cycle) ? existing.market!.cycle : 0, nextShiftAt: Number.isFinite(existing.market?.nextShiftAt) ? existing.market!.nextShiftAt : state.gameMinutes + 120 },
    forestHealth: Number.isFinite(existing.forestHealth) ? clamp(existing.forestHealth!) : 100,
    completedProjects: [...new Set(existing.completedProjects)],
    factions: existing.factions,
    tradeRoutes: [...new Set(existing.tradeRoutes)],
  };
  return { ...state, world };
}

const BUILDING_JOB: Partial<Record<BuildingType, Profession>> = {
  farm: 'farmer', sawmill: 'lumberjack', quarry: 'miner', market: 'merchant', mill: 'miller',
  bakery: 'baker', school: 'scholar', watchtower: 'guard', workshop: 'artisan',
};
export function worldBuildingMultiplier(state: GameState, building: Building): number {
  const world = state.world;
  if (!world) return 1;
  const job = BUILDING_JOB[building.type];
  let multiplier = 1;
  if (job) {
    const sameBuildings = Math.max(1, state.buildings.filter((entry) => entry.type === building.type).length);
    const workers = world.citizens.filter((citizen) => citizen.profession === job && citizen.status === 'resident').length / sameBuildings;
    const assigned = world.citizens.filter((citizen) => citizen.profession === job && citizen.status === 'resident');
    const averageSkill = assigned.reduce((total, citizen) => total + citizen.skills[job], 0) / Math.max(1, assigned.length);
    const readiness = assigned.reduce((total, citizen) => total + (citizen.energy + citizen.health + citizen.happiness) / 3, 0) / Math.max(1, assigned.length) / 100;
    multiplier *= Math.min(1.38, 0.44 + workers * 0.29 + averageSkill / 100 * 0.12) * (0.55 + readiness * 0.45);
  }
  if (world.researched.includes('tools') && ['farm', 'sawmill', 'quarry', 'market'].includes(building.type)) multiplier *= 1.12;
  if (building.type !== 'road' && state.buildings.some((entry) => entry.type === 'road' && Math.abs(entry.x - building.x) + Math.abs(entry.y - building.y) <= 1)) multiplier *= 1.08;
  if (world.completedProjects.includes('artisan-quarter')) multiplier *= 1.08;
  if (building.type === 'farm' && world.researched.includes('irrigation')) multiplier *= 1.15;
  if (building.type === 'farm' && world.completedProjects.includes('aqueduct')) multiplier *= 1.12;
  if (building.type === 'market' && world.researched.includes('trade')) multiplier *= 1.25;
  if (building.type === 'sawmill') {
    multiplier *= world.policies.forest === 'protected' ? (world.researched.includes('forestry') ? 0.88 : 0.72)
      : world.policies.forest === 'intensive' ? 1.25 : 1;
    if (world.forestHealth < 35) multiplier *= 0.55 + world.forestHealth / 100 * 0.45;
  }
  return multiplier;
}

export function realmModifiers(state: GameState): { taxMultiplier: number; foodConsumptionMultiplier: number; guardProtection: number; tradeIncome: number } {
  const world = state.world;
  if (!world) return { taxMultiplier: 1, foodConsumptionMultiplier: 1, guardProtection: 0, tradeIncome: 0 };
  const taxMultiplier = world.policies.tax === 'low' ? 0.78 : world.policies.tax === 'high' ? 1.32 : 1;
  const foodConsumptionMultiplier = world.policies.food === 'reserve' ? 0.82 : world.policies.food === 'generous' ? 1.14 : 1;
  const guardProtection = world.policies.guard === 'patrol' || state.buildings.some((building) => building.type === 'watchtower') ? 0.25 : 0;
  const tradeIncome = world.tradeRoutes.length * (world.researched.includes('trade') ? 0.045 : 0.025);
  return { taxMultiplier, foodConsumptionMultiplier, guardProtection, tradeIncome };
}

function addCitizenForState(state: GameState, world: WorldState, profession: Profession = 'farmer'): WorldState {
  const citizen = makeCitizen(state.seed, world.nextCitizenId - 1, state.gameMinutes);
  citizen.id = 'citizen-' + world.nextCitizenId;
  citizen.profession = profession;
  citizen.skills[profession] = 22;
  citizen.lastAction = 'È arrivato da poco e cerca il proprio posto nel borgo';
  return { ...world, nextCitizenId: world.nextCitizenId + 1, citizens: [...world.citizens, citizen] };
}

function eventTemplate(id: string, gameMinutes: number): RealmEvent {
  const event = (eventId: string, title: string, description: string, choices: RealmEventChoice[]): RealmEvent =>
    ({ id: eventId, title, description, choices, startedAt: gameMinutes });
  if (id === 'caravan-rescue') return event(id, 'La carovana è salva', 'La spedizione ha trovato i carri dispersi. Ora bisogna decidere come usare le merci recuperate.', [
    { id: 'take-cargo', label: 'Accetta il carico', detail: 'Ottieni legname, pietra e monete.', reward: { wood: 6, stone: 4, coins: 10 }, researchDelta: 5, trustDelta: 2 },
    { id: 'share-cargo', label: 'Condividi le provviste', detail: 'Rinunci a una parte del bottino e guadagni fiducia.', cost: { food: 5 }, trustDelta: 8, moodDelta: 6 },
  ]);
  if (id === 'drought-recovery') return event(id, 'La pioggia è tornata', 'Le nuvole si sono aperte. Le riserve d’acqua e il lavoro dei contadini possono salvare la stagione.', [
    { id: 'celebrate-rain', label: 'Festeggia il raccolto', detail: 'Il borgo recupera provviste e morale.', reward: { food: 16 }, moodDelta: 7, trustDelta: 4 },
    { id: 'save-rain', label: 'Conserva le riserve', detail: 'Ricevi meno cibo, ma prepari il magazzino.', reward: { food: 9, wood: 3 }, moodDelta: 2, trustDelta: 2 },
  ]);
  if (id === 'ruins-found') return event(id, 'Le rovine parlano', 'Gli esploratori hanno portato tavolette con simboli antichi. Il Consiglio può finanziare lo studio o sigillare il sito.', [
    { id: 'study-tablets', label: 'Studia le tavolette', detail: 'Spendi materiali per guadagnare conoscenza e monete.', cost: { wood: 6, stone: 5 }, reward: { coins: 12 }, researchDelta: 18, chain: 'archive-clue' },
    { id: 'seal-site', label: 'Proteggi le rovine', detail: 'Nessun costo e una comunità più fiduciosa.', trustDelta: 6, moodDelta: 2 },
  ]);
  if (id === 'archive-clue') return event(id, 'Una mappa dimenticata', 'La ricerca rivela una strada antica verso le terre di confine. Una nuova via commerciale potrebbe cambiare il regno.', [
    { id: 'fund-map', label: 'Finanzia la spedizione', detail: 'Spendi monete per aprire una nuova rotta.', cost: { coins: 10 }, reward: { coins: 4, stone: 4 }, researchDelta: 10, trustDelta: 4 },
    { id: 'keep-secret', label: 'Tieni il segreto', detail: 'Conserva i materiali e migliora la sicurezza.', reward: { wood: 3 }, moodDelta: 1, trustDelta: -1 },
  ]);
  const choiceSets: RealmEvent[] = [
    event('drought', 'Settimane senza pioggia', 'La terra è secca e i contadini temono un raccolto scarso. Il Consiglio deve scegliere fra investire, comprare scorte o razionare.', [
      { id: 'irrigate-fields', label: 'Ripara i canali', detail: 'Spendi materiali e prepari una ripresa futura.', cost: { wood: 8, stone: 6 }, moodDelta: -1, trustDelta: 3, chain: 'drought-recovery' },
      { id: 'buy-stores', label: 'Compra provviste', detail: 'Spendi monete per mettere al sicuro il cibo.', cost: { coins: 9 }, reward: { food: 17 }, moodDelta: 3, trustDelta: 2 },
      { id: 'ration-stores', label: 'Raziona le scorte', detail: 'Conservi risorse, ma gli abitanti sono contrariati.', reward: { food: 5 }, moodDelta: -6, trustDelta: -4 },
    ]),
    event('caravan', 'Una carovana è scomparsa', 'Un mercante non è arrivato alla data prevista. I suoi soci offrono una ricompensa a chi cerca i carri.', [
      { id: 'send-scouts', label: 'Invia esploratori', detail: 'Spendi provviste e avvia una storia che può portare ricompense.', cost: { food: 6 }, moodDelta: 2, trustDelta: 2, chain: 'caravan-rescue' },
      { id: 'salvage-tracks', label: 'Segui le tracce', detail: 'Raccogli materiali lungo la strada, ma non tutti apprezzeranno.', reward: { wood: 5 }, moodDelta: -1, trustDelta: -2 },
      { id: 'leave-caravan', label: 'Non rischiare', detail: 'Nessun costo, ma i mercanti si ricorderanno della scelta.', moodDelta: -3, trustDelta: -4 },
    ]),
    event('wanderer', 'Un viandante cerca rifugio', 'Una persona con esperienza di viaggio chiede ospitalità. Può diventare un esploratore, ma servono cibo o monete.', [
      { id: 'welcome-wanderer', label: 'Accoglilo', detail: 'Spendi cibo e aumenta la popolazione di uno, se c’è posto.', cost: { food: 6 }, populationDelta: 1, moodDelta: 5, trustDelta: 4, profession: 'scout' },
      { id: 'hire-guide', label: 'Assumilo come guida', detail: 'Paga una piccola somma e guadagni conoscenza di viaggio.', cost: { coins: 8 }, reward: { food: 3 }, researchDelta: 8, trustDelta: 2 },
      { id: 'send-away', label: 'Invitalo a proseguire', detail: 'Conservi le risorse, ma perdi un’occasione.', moodDelta: -4, trustDelta: -3 },
    ]),
    event('wolves', 'Ululati vicino ai campi', 'Un branco si avvicina alle stalle. Le guardie chiedono supporto prima che gli animali si spingano verso il villaggio.', [
      { id: 'night-patrol', label: 'Organizza una pattuglia', detail: 'Spendi monete e rendi più sicure le strade.', cost: { coins: 8 }, moodDelta: 3, trustDelta: 3 },
      { id: 'protect-livestock', label: 'Metti al sicuro le scorte', detail: 'Usa legname e cibo per proteggere i magazzini.', cost: { wood: 5, food: 4 }, reward: { food: 2 }, moodDelta: 2, trustDelta: 1 },
      { id: 'ignore-wolves', label: 'Non intervenire', detail: 'Nessuna spesa, ma la paura rimane.', moodDelta: -8, trustDelta: -6 },
    ]),
    event('fair', 'Arriva la fiera itinerante', 'Banchi colorati riempiono la strada. È un’occasione per vendere materiali e investire nelle relazioni commerciali.', [
      { id: 'sponsor-fair', label: 'Finanzia la fiera', detail: 'Investi monete per attirare mercanti e visitatori.', cost: { coins: 8 }, reward: { coins: 15 }, moodDelta: 4, trustDelta: 5 },
      { id: 'sell-timber', label: 'Vendi legname', detail: 'Scambia risorse con i mercanti.', cost: { wood: 7 }, reward: { coins: 12 }, trustDelta: 2 },
      { id: 'skip-fair', label: 'Continua il lavoro', detail: 'Non spendi nulla e non ottieni bonus.', moodDelta: 0, trustDelta: 0 },
    ]),
  ];
  const index = Math.abs(gameMinutes * 13 + id.length * 11) % choiceSets.length;
  const chosen = choiceSets[index]!;
  return { ...chosen, id: id === 'random' ? chosen.id : id };
}

function regionUnlocked(world: WorldState, regionId: RegionId): boolean {
  const region = REGIONS.find((entry) => entry.id === regionId);
  if (!region) return false;
  if (regionId === 'ancient-ruins') return world.researched.includes('cartography') && world.discoveredRegions.includes('mountains');
  if (regionId === 'borderlands') return world.researched.includes('cartography') || world.completedProjects.includes('stone-bridge');
  if (region?.requirement === 'forest' || region?.requirement === 'mountains') return world.discoveredRegions.includes(region.requirement as RegionId);
  return true;
}
export function canExploreRegion(world: WorldState, regionId: RegionId): boolean { return regionUnlocked(world, regionId); }

function goodsCapacity(state: GameState): number {
  return 100 + state.buildings.filter((building) => building.type === 'warehouse').reduce((total, building) => total + 80 * building.level, 0);
}
function hasCost(resources: ResourceBag, cost: Partial<ResourceBag>): boolean {
  return Object.entries(cost).every(([key, value]) => resources[key as Resource] >= (value ?? 0));
}
function pay(resources: ResourceBag, cost: Partial<ResourceBag>): ResourceBag {
  const next = { ...resources };
  for (const [key, amount] of Object.entries(cost) as [Resource, number][]) next[key] -= amount;
  return next;
}
function applyReward(resources: ResourceBag, reward: Partial<ResourceBag> = {}): ResourceBag {
  const next = { ...resources };
  for (const [key, amount] of Object.entries(reward) as [Resource, number][]) next[key] += amount;
  return next;
}
function hasGoods(goods: GoodsBag, cost: Partial<GoodsBag>): boolean {
  return Object.entries(cost).every(([key, value]) => goods[key as keyof GoodsBag] >= (value ?? 0));
}
function payGoods(goods: GoodsBag, cost: Partial<GoodsBag>): GoodsBag {
  const next = { ...goods };
  for (const [key, amount] of Object.entries(cost) as [keyof GoodsBag, number][]) next[key] -= amount;
  return next;
}
function applyGoods(goods: GoodsBag, reward: Partial<GoodsBag> = {}): GoodsBag {
  const next = { ...goods };
  for (const [key, amount] of Object.entries(reward) as [keyof GoodsBag, number][]) next[key] += amount;
  return next;
}
function housing(state: GameState): number {
  return state.buildings.reduce((total, building) => total + (BUILDINGS[building.type].housing ?? 0) * building.level, 0)
    + (state.community?.housingBonus ?? 0);
}

function expeditionReward(region: RegionId): { resources: Partial<ResourceBag>; goods: Partial<GoodsBag>; note: string; research: number } {
  const rewards: Record<RegionId, { resources: Partial<ResourceBag>; goods: Partial<GoodsBag>; note: string; research: number }> = {
    forest: { resources: { wood: 12, food: 5 }, goods: { grain: 4, medicine: 1 }, note: 'La spedizione ha trovato un bosco ricco di legname e piante utili.', research: 2 },
    mountains: { resources: { stone: 12, wood: 2 }, goods: { tools: 1 }, note: 'La squadra torna con pietra e attrezzi recuperati dal passo.', research: 5 },
    lake: { resources: { food: 15, coins: 3 }, goods: { medicine: 2, grain: 3 }, note: 'Il lago offre cibo, erbe e una nuova rotta da ricordare.', research: 4 },
    'ancient-ruins': { resources: { stone: 7, coins: 12 }, goods: { tools: 1 }, note: 'Gli esploratori hanno mappato rovine antiche e riportato documenti.', research: 18 },
    borderlands: { resources: { wood: 5, stone: 5, coins: 16 }, goods: { tools: 1, medicine: 1 }, note: 'La spedizione ha incontrato nuovi commercianti oltre il confine.', research: 10 },
  };
  return rewards[region];
}

export function advanceRealmMinute(input: GameState): GameState {
  const state = ensureWorldState(input);
  const world = state.world!;
  const resources: ResourceBag = { ...state.resources };
  const goods: GoodsBag = { ...world.goods };
  let citizens = world.citizens.map((citizen) => ({ ...citizen, skills: { ...citizen.skills }, traits: [...citizen.traits], relationships: { ...citizen.relationships } }));
  const notes: string[] = [];
  let community = state.community ? { ...state.community } : undefined;
  const activeExpeditions = world.expeditions.filter((expedition) => expedition.status === 'active');
  citizens = citizens.map((citizen) => {
    if (citizen.status === 'exploring') return { ...citizen, energy: clamp(citizen.energy - 0.055), hunger: clamp(citizen.hunger + 0.05) };
    const jobHasBuilding = state.buildings.some((building) => BUILDING_JOB[building.type] === citizen.profession);
    const hunger = clamp(citizen.hunger + (resources.food < 18 ? 0.075 : 0.045));
    const energy = clamp(citizen.energy + (jobHasBuilding && citizen.energy > 32 ? -0.04 : 0.075));
    let happiness = citizen.happiness;
    if (resources.food < 18 || hunger > 80) happiness -= 0.12;
    else if ((state.community?.morale ?? 60) >= 65) happiness += 0.025;
    if (goods.bread > 0 && state.gameMinutes % 10 === 0) happiness += 0.15;
    let health = citizen.health;
    if (hunger > 90) health -= 0.035;
    else if (hunger < 45) health += 0.008;
    const skills = { ...citizen.skills };
    if (jobHasBuilding) skills[citizen.profession] = clamp(skills[citizen.profession] + (world.researched.includes('education') ? 0.018 : 0.01), 0, 100);
    return { ...citizen, hunger, energy, happiness: clamp(happiness), health: clamp(health), skills, experience: citizen.experience + (jobHasBuilding ? 0.002 : 0) };
  });

  const farms = state.buildings.filter((building) => building.type === 'farm').length;
  const farmers = citizens.filter((citizen) => citizen.profession === 'farmer' && citizen.status === 'resident').length;
  goods.grain += Math.min(farms * 0.085, farmers * 0.06);
  const mills = state.buildings.filter((building) => building.type === 'mill').length;
  const millers = citizens.filter((citizen) => citizen.profession === 'miller' && citizen.status === 'resident').length;
  const flourProduced = Math.min(goods.grain, Math.min(mills * 0.14, millers * 0.11));
  goods.grain -= flourProduced; goods.flour += flourProduced;
  const bakeries = state.buildings.filter((building) => building.type === 'bakery').length;
  const bakers = citizens.filter((citizen) => citizen.profession === 'baker' && citizen.status === 'resident').length;
  const breadProduced = Math.min(goods.flour, Math.min(bakeries * 0.14, bakers * 0.11));
  goods.flour -= breadProduced; goods.bread += breadProduced;
  if (goods.bread > 0 && state.gameMinutes > 0 && state.gameMinutes % 18 === 0) goods.bread = Math.max(0, goods.bread - state.population * 0.035);
  const workshops = state.buildings.filter((building) => building.type === 'workshop').length;
  const artisans = citizens.filter((citizen) => citizen.profession === 'artisan' && citizen.status === 'resident').length;
  if (workshops > 0 && artisans > 0 && state.gameMinutes % 45 === 0 && resources.wood >= 2 && resources.stone >= 1) {
    resources.wood -= 2; resources.stone -= 1; goods.tools += 1;
    notes.push('L’officina ha completato un nuovo attrezzo.');
  }
  const cap = goodsCapacity(state);
  (Object.keys(goods) as Array<keyof GoodsBag>).forEach((key) => { goods[key] = clamp(goods[key], 0, cap); });

  if (state.gameMinutes > 0 && state.gameMinutes % 30 === 0 && citizens.length > 1) {
    const nextCitizens = citizens.map((citizen) => ({ ...citizen, relationships: { ...citizen.relationships } }));
    for (let left = 0; left < nextCitizens.length; left++) {
      for (let right = left + 1; right < nextCitizens.length; right++) {
        const a = nextCitizens[left]!;
        const b = nextCitizens[right]!;
        let delta = a.profession === b.profession ? 1 : 0;
        if (a.familyId === b.familyId) delta += 2;
        if (a.traits.includes('socievole') || b.traits.includes('socievole')) delta += 1;
        if (a.traits.includes('ambizioso') && b.traits.includes('ambizioso')) delta -= 1;
        const prior = ((a.relationships[b.id] ?? 0) + (b.relationships[a.id] ?? 0)) / 2;
        const value = Math.max(-100, Math.min(100, prior + delta));
        a.relationships[b.id] = value;
        b.relationships[a.id] = value;
      }
    }
    citizens = nextCitizens.map((citizen) => {
      const ties = Object.values(citizen.relationships);
      const average = ties.reduce((sum, value) => sum + value, 0) / Math.max(1, ties.length);
      return { ...citizen, happiness: clamp(citizen.happiness + (average > 20 ? 0.18 : average < -15 ? -0.18 : 0)) };
    });
  }
  const activeJobs = new Set<Profession>(state.buildings.map((building) => BUILDING_JOB[building.type]).filter((job): job is Profession => !!job));
  citizens = citizens.map((citizen) => {
    if (citizen.status === 'exploring') return citizen;
    if (state.gameMinutes % 20 !== 0) return citizen;
    const action = citizen.hunger > 75 ? 'Cerca cibo e controlla la dispensa'
      : citizen.energy < 30 ? 'Si riposa prima di tornare al lavoro'
      : activeJobs.has(citizen.profession) ? 'Lavora come ' + PROFESSION_LABELS[citizen.profession]
      : 'Incontra vicini e cerca un nuovo impiego';
    return { ...citizen, lastAction: action };
  });
  let nextPopulation = state.population;
  if (state.gameMinutes > 0 && state.gameMinutes % 120 === 0 && state.population > 5) {
    const averageHappiness = citizens.reduce((sum, citizen) => sum + citizen.happiness, 0) / Math.max(1, citizens.length);
    if (averageHappiness < 25) {
      const leaving = [...citizens].filter((citizen) => citizen.status !== 'exploring').sort((a, b) => a.happiness - b.happiness)[0];
      if (leaving) {
        citizens = citizens.filter((citizen) => citizen.id !== leaving.id);
        nextPopulation = Math.max(5, state.population - 1);
        notes.push(leaving.name + ' ha lasciato il borgo perché non si sentiva più a casa.');
        if (community) { community.morale = clamp(community.morale - 4); community.trust = clamp(community.trust - 3); }
      }
    }
  }

  let nextWorld: WorldState = { ...world, citizens, goods, researchPoints: world.researchPoints + 0.025 + (state.buildings.some((building) => building.type === 'school') ? citizens.filter((citizen) => citizen.profession === 'scholar').length * 0.09 : 0) };
  if (state.gameMinutes >= nextWorld.market.nextShiftAt) {
    nextWorld = { ...nextWorld, market: refreshMarket(state.seed, state.gameMinutes, nextWorld.market, goods) };
    notes.push('La domanda del mercato è cambiata: le quotazioni di grano, pane e beni lavorati sono aggiornate.');
  }
  const scholars = state.buildings.some((building) => building.type === 'school')
    ? citizens.filter((citizen) => citizen.profession === 'scholar' && citizen.status === 'resident').length : 0;
  if (nextWorld.activeResearch) {
    const definition = RESEARCH.find((entry) => entry.id === nextWorld.activeResearch);
    if (definition) {
      nextWorld = { ...nextWorld, researchProgress: nextWorld.researchProgress + 0.24 + scholars * 0.43 + (nextWorld.completedProjects.includes('grand-archive') ? 0.12 : 0) };
      if (nextWorld.researchProgress >= definition.duration) {
        nextWorld = { ...nextWorld, researched: [...new Set([...nextWorld.researched, definition.id])], activeResearch: null, researchProgress: 0 };
        notes.push('Ricerca completata: ' + definition.name + '.');
      }
    }
  }
  let expeditions = [...nextWorld.expeditions];
  for (const activeExpedition of activeExpeditions) {
    let expedition = activeExpedition;
    if (expedition.eta > state.gameMinutes) continue;
    const index = expeditions.findIndex((entry) => entry.id === expedition.id);
    if (index < 0) continue;
    const scout = citizens.find((citizen) => citizen.id === expedition.scoutId);
    const roll = Math.abs(state.seed * 11 + (scout?.skills.scout ?? 0) * 7 + expedition.startedAt * 13 + expedition.region.length * 3) % 100;
    const success = roll < expedition.successChance;
    if (scout) citizens = citizens.map((citizen) => citizen.id === scout.id ? { ...citizen, status: 'resident', expeditionId: null, energy: clamp(citizen.energy + 18), lastAction: success ? 'È tornato da una spedizione' : 'È tornato stanco da una spedizione difficile' } : citizen);
    if (success) {
      const reward = expeditionReward(expedition.region);
      Object.assign(resources, applyReward(resources, reward.resources));
      Object.assign(goods, applyGoods(goods, reward.goods));
      nextWorld = { ...nextWorld, discoveredRegions: [...new Set([...nextWorld.discoveredRegions, expedition.region])], researchPoints: nextWorld.researchPoints + reward.research };
      expedition = { ...expedition, status: 'success', outcome: reward.note };
      notes.push(reward.note);
      if (expedition.region === 'ancient-ruins') nextWorld = { ...nextWorld, queuedEvent: 'ruins-found', nextEventAt: state.gameMinutes + 45 };
      if (expedition.region === 'borderlands') {
        const factions = nextWorld.factions.map((faction, factionIndex) => factionIndex === 0 ? { ...faction, relation: clamp(faction.relation + 8) } : faction);
        nextWorld = { ...nextWorld, factions };
      }
    } else {
      expedition = { ...expedition, status: 'partial', outcome: 'La squadra ha trovato poco e deve riposare prima di ripartire.' };
      resources.food += 3;
      notes.push(expedition.outcome);
    }
    expeditions = expeditions.map((entry) => entry.id === expedition.id ? expedition : entry);
  }
  nextWorld = { ...nextWorld, citizens, expeditions: expeditions.slice(-8) };

  if (community && state.gameMinutes > 0 && state.gameMinutes % 30 === 0 && citizens.length > 0) {
    const mood = citizens.reduce((sum, citizen) => sum + citizen.happiness, 0) / citizens.length;
    if (mood >= 72) community.morale = clamp(community.morale + 1);
    else if (mood < 42) community.morale = clamp(community.morale - 1);
  }
  if (state.gameMinutes > 0 && state.gameMinutes % 60 === 0) {
    const sawmillLevels = state.buildings.filter((building) => building.type === 'sawmill').reduce((sum, building) => sum + building.level, 0);
    const forestChange = world.policies.forest === 'protected' ? 0.6 - sawmillLevels * 0.08 : world.policies.forest === 'managed' ? 0.12 - sawmillLevels * 0.42 : -0.35 - sawmillLevels * 1.25;
    const forestHealth = clamp(world.forestHealth + forestChange);
    nextWorld = { ...nextWorld, forestHealth };
    const warehouseLevels = state.buildings.filter((building) => building.type === 'warehouse').reduce((sum, building) => sum + building.level, 0);
    const spoilageMultiplier = warehouseLevels > 0 ? Math.max(0.18, 0.35 - (warehouseLevels - 1) * 0.06) : 1;
    const spoilage: Record<keyof GoodsBag, number> = { grain: 0.025, flour: 0.035, bread: 0.06, tools: 0.004, medicine: 0.015 };
    (Object.keys(spoilage) as Array<keyof GoodsBag>).forEach((good) => {
      goods[good] = Math.round(goods[good] * (1 - spoilage[good] * spoilageMultiplier) * 100) / 100;
    });
    nextWorld = { ...nextWorld, goods: { ...goods } };
    if (warehouseLevels === 0 && world.goods.bread > 12 && goods.bread < world.goods.bread - 1) notes.push('Una parte del pane si è deteriorata: un magazzino può ridurre lo spreco delle scorte.');
    if (world.forestHealth >= 35 && forestHealth < 35) notes.push('I boschi sono esausti: la produzione della segheria cala finché il territorio non si rigenera.');
    if (community && world.policies.tax === 'high') { community.morale = clamp(community.morale - 1); community.trust = clamp(community.trust - 1); }
    else if (community && world.policies.tax === 'low') { community.morale = clamp(community.morale + 1); community.trust = clamp(community.trust + 1); }
    if (community && world.policies.food === 'generous' && goods.bread > 0) community.morale = clamp(community.morale + 1);
    if (world.policies.guard === 'patrol') {
      if (resources.coins >= 2) { resources.coins -= 2; if (community) community.trust = clamp(community.trust + 1); }
      else if (community) { community.trust = clamp(community.trust - 2); community.morale = clamp(community.morale - 1); notes.push('Le guardie non sono state pagate: il Consiglio deve rifinanziare le pattuglie.'); }
    }
  }
  const now = state.gameMinutes;
  if (!nextWorld.activeEvent && now >= nextWorld.nextEventAt) {
    const id = nextWorld.queuedEvent ?? 'random';
    const created = eventTemplate(id, now);
    nextWorld = { ...nextWorld, activeEvent: created, queuedEvent: null, nextEventAt: now + 360 };
    notes.push('Nuovo avvenimento: ' + created.title + '.');
  }
  if (notes.length) {
    nextWorld = { ...nextWorld, chronicle: [...notes.reverse(), ...nextWorld.chronicle].slice(0, 12) };
  }
  return { ...state, population: nextPopulation, resources, community, world: nextWorld };
}

function applyCommunityEffects(community: CommunityState | undefined, moodDelta = 0, trustDelta = 0): CommunityState | undefined {
  if (!community) return undefined;
  return {
    ...community,
    morale: clamp(community.morale + moodDelta),
    trust: clamp(community.trust + trustDelta),
  };
}

export function performRealmAction(input: GameState, action: RealmAction): { state: GameState; ok: boolean; message: string } {
  const state = ensureWorldState(input);
  let world = state.world!;
  let resources = { ...state.resources };
  let community = state.community ? { ...state.community } : undefined;
  let population = state.population;
  const fail = (message: string) => ({ state, ok: false, message });
  const finish = (message: string) => ({
    state: { ...state, population, resources, community, world: { ...world, chronicle: [message, ...world.chronicle].slice(0, 12) } },
    ok: true, message,
  });

  if (action.type === 'assign') {
    const citizen = world.citizens.find((entry) => entry.id === action.citizenId);
    if (!citizen) return fail('Questo cittadino non esiste più.');
    if (citizen.status === 'exploring') return fail('Il cittadino è in spedizione e non può cambiare mestiere.');
    if (!PROFESSIONS.includes(action.value)) return fail('Mestiere non valido.');
    world = { ...world, citizens: world.citizens.map((entry) => entry.id === citizen.id ? { ...entry, profession: action.value, lastAction: 'Ha assunto il mestiere: ' + PROFESSION_LABELS[action.value] } : entry) };
    return finish(citizen.name + ' ora lavora come ' + PROFESSION_LABELS[action.value] + '.');
  }
  if (action.type === 'law') {
    const policies = { ...world.policies };
    if (action.id === 'tax' && ['low', 'balanced', 'high'].includes(action.value)) policies.tax = action.value as TaxPolicy;
    else if (action.id === 'food' && ['reserve', 'balanced', 'generous'].includes(action.value)) policies.food = action.value as FoodPolicy;
    else if (action.id === 'forest' && ['protected', 'managed', 'intensive'].includes(action.value)) policies.forest = action.value as ForestPolicy;
    else if (action.id === 'guard' && ['none', 'patrol'].includes(action.value)) policies.guard = action.value as GuardPolicy;
    else return fail('Questa politica non è disponibile.');
    world = { ...world, policies };
    return finish('Il Consiglio ha adottato una nuova politica: ' + action.id + ' → ' + action.value + '.');
  }
  if (action.type === 'research') {
    const research = RESEARCH.find((entry) => entry.id === action.id);
    if (!research) return fail('Ricerca sconosciuta.');
    if (world.researched.includes(research.id)) return fail('Questa conoscenza è già stata acquisita.');
    if (world.activeResearch) return fail('C’è già una ricerca in corso. Completa quella prima di iniziarne un’altra.');
    if (world.researchPoints < research.cost) return fail('Servono ' + research.cost + ' punti conoscenza. Ne hai ' + Math.floor(world.researchPoints) + '. Costruisci una scuola, assegna uno studioso o esplora il territorio.');
    world = { ...world, researchPoints: world.researchPoints - research.cost, activeResearch: research.id, researchProgress: 0 };
    return finish('Il Consiglio ha avviato la ricerca: ' + research.name + '.');
  }
  if (action.type === 'expedition') {
    const region = REGIONS.find((entry) => entry.id === action.id);
    if (!region) return fail('Questa regione non esiste.');
    if (!regionUnlocked(world, region.id)) return fail('La regione è ancora sconosciuta. Esplora le aree vicine o sviluppa la cartografia.');
    const maxExpeditions = world.researched.includes('cartography') ? 2 : 1;
    if (world.expeditions.filter((entry) => entry.status === 'active').length >= maxExpeditions) return fail('Tutte le spedizioni disponibili sono già in viaggio.');
    const scout = world.citizens.find((citizen) => citizen.profession === 'scout' && citizen.status === 'resident');
    if (!scout) return fail('Assegna il mestiere Esploratore a un cittadino disponibile prima di inviare una spedizione.');
    if (resources.food < 8) return fail('Servono almeno 8 unità di cibo per partire.');
    const carriesTools = world.goods.tools > 0;
    resources.food -= 8;
    const goods = { ...world.goods, tools: Math.max(0, world.goods.tools - (carriesTools ? 1 : 0)) };
    const chance = Math.min(98, 45 + scout.skills.scout * 0.45 + (carriesTools ? 16 : 0) + (world.researched.includes('cartography') ? 10 : 0) + realmModifiers(state).guardProtection * 12);
    const id = 'expedition-' + state.gameMinutes + '-' + scout.id + '-' + region.id;
    const expedition: Expedition = { id, region: region.id, scoutId: scout.id, startedAt: state.gameMinutes, eta: state.gameMinutes + region.duration, status: 'active', successChance: chance, outcome: 'La squadra è in viaggio.' };
    world = { ...world, goods, citizens: world.citizens.map((citizen) => citizen.id === scout.id ? { ...citizen, status: 'exploring', expeditionId: id, lastAction: 'Sta esplorando: ' + region.name } : citizen), expeditions: [...world.expeditions, expedition].slice(-8) };
    return finish('Spedizione partita: ' + region.name + '. Il ritorno è previsto tra circa ' + Math.ceil(region.duration / 60) + ' minuti di gioco.');
  }
  if (action.type === 'project') {
    const project = PROJECTS.find((entry) => entry.id === action.id);
    if (!project) return fail('Progetto sconosciuto.');
    const stage = world.projectStages[project.id] ?? 0;
    if (stage >= 3) return fail('Il progetto è già completato.');
    const cost = project.stages[stage]!;
    if (!hasCost(resources, cost)) return fail('Risorse insufficienti per la fase ' + (stage + 1) + ' di ' + project.name + '.');
    resources = pay(resources, cost);
    const nextStage = stage + 1;
    world = { ...world, projectStages: { ...world.projectStages, [project.id]: nextStage }, completedProjects: nextStage === 3 ? [...new Set([...world.completedProjects, project.id])] : world.completedProjects };
    return finish(nextStage === 3 ? project.name + ' completato! Il suo beneficio ora è attivo.' : project.name + ': fase ' + nextStage + '/3 completata.');
  }
  if (action.type === 'event') {
    const event = world.activeEvent;
    if (!event) return fail('Al momento non ci sono avvenimenti da decidere.');
    const choice = event.choices.find((entry) => entry.id === action.id);
    if (!choice) return fail('Questa decisione non è più disponibile.');
    if (!hasCost(resources, choice.cost ?? {})) return fail('Non hai abbastanza risorse per questa scelta.');
    if (!hasGoods(world.goods, choice.goodsCost ?? {})) return fail('Non hai abbastanza beni lavorati per questa scelta.');
    if (choice.populationDelta && state.population + choice.populationDelta > housing(state)) return fail('Non ci sono posti abitativi liberi. Costruisci una casa prima di accogliere nuovi abitanti.');
    resources = pay(resources, choice.cost ?? {});
    resources = applyReward(resources, choice.reward ?? {});
    const goods = applyGoods(payGoods(world.goods, choice.goodsCost ?? {}), choice.goodsReward ?? {});
    let citizens = world.citizens;
    if (choice.populationDelta) population = Math.max(0, population + choice.populationDelta);
    if (choice.populationDelta && choice.populationDelta > 0) {
      const profession = choice.profession ?? 'farmer';
      world = addCitizenForState({ ...state, resources }, world);
      citizens = world.citizens.map((citizen, index) => index === world.citizens.length - 1 ? { ...citizen, profession, skills: { ...citizen.skills, [profession]: 24 }, lastAction: 'È arrivato grazie a un evento del regno' } : citizen);
    }
    if (choice.populationDelta && choice.populationDelta < 0) citizens = citizens.slice(0, Math.max(0, citizens.length + choice.populationDelta));
    world = { ...world, citizens, goods, activeEvent: null, queuedEvent: choice.chain ?? null, nextEventAt: state.gameMinutes + (choice.chain ? 75 : 300), researchPoints: world.researchPoints + (choice.researchDelta ?? 0) };
    community = applyCommunityEffects(community, choice.moodDelta ?? 0, choice.trustDelta ?? 0);
    return finish(event.title + ' — ' + choice.label + '. ' + choice.detail);
  }
  if (action.type === 'tradeGoods') {
    if (!state.buildings.some((building) => building.type === 'market')) return fail('Costruisci un mercato prima di vendere i beni lavorati.');
    if (!world.citizens.some((citizen) => citizen.profession === 'merchant' && citizen.status === 'resident')) return fail('Assegna almeno un cittadino al mestiere Mercante.');
    if (!Object.prototype.hasOwnProperty.call(world.goods, action.good)) return fail('Questo bene non è commerciabile.');
    const amount = Math.floor(action.amount);
    if (!Number.isFinite(amount) || amount < 1 || amount > 50) return fail('Puoi vendere da 1 a 50 unità per volta.');
    if (world.goods[action.good] < amount) return fail('Scorte insufficienti: non hai ' + amount + ' unità di ' + MARKET_GOOD_LABELS[action.good] + '.');
    const price = Math.max(1, world.market.prices[action.good]);
    const revenue = Math.floor(amount * price);
    world = { ...world, goods: { ...world.goods, [action.good]: world.goods[action.good] - amount } };
    resources.coins += revenue;
    return finish('Vendute ' + amount + ' unità di ' + MARKET_GOOD_LABELS[action.good] + ' a ' + price + ' monete ciascuna: +' + revenue + ' monete. Domanda attuale: ' + Math.round(world.market.demand[action.good] * 100) + '%.');
  }
  if (action.type === 'diplomacy') {
    const faction = world.factions.find((entry) => entry.id === action.id);
    if (!faction) return fail('Comunità straniera sconosciuta.');
    if (action.value === 'gift') {
      if (resources.coins < 8) return fail('Un dono diplomatico costa 8 monete.');
      resources.coins -= 8;
      world = { ...world, factions: world.factions.map((entry) => entry.id === faction.id ? { ...entry, relation: clamp(entry.relation + 15), lastContact: state.gameMinutes } : entry) };
      return finish('Hai inviato un dono a ' + faction.name + '. I rapporti migliorano.');
    }
    if (action.value === 'trade') {
      if (resources.wood < 6) return fail('Lo scambio richiede 6 legname.');
      resources.wood -= 6;
      resources.coins += 12;
      world = { ...world, factions: world.factions.map((entry) => entry.id === faction.id ? { ...entry, relation: clamp(entry.relation + 5), lastContact: state.gameMinutes } : entry) };
      return finish('Scambio completato con ' + faction.name + ': 6 legname per 12 monete.');
    }
    if (faction.treaty || world.tradeRoutes.includes(faction.id)) return fail('Esiste già un accordo con questa comunità.');
    if (faction.relation < 55) return fail('I rapporti devono raggiungere 55 prima di firmare un accordo. Puoi inviare un dono o commerciare.');
    if (resources.coins < 10) return fail('Il trattato richiede 10 monete.');
    resources.coins -= 10;
    world = { ...world, factions: world.factions.map((entry) => entry.id === faction.id ? { ...entry, relation: clamp(entry.relation + 12), treaty: true, lastContact: state.gameMinutes } : entry), tradeRoutes: [...world.tradeRoutes, faction.id] };
    return finish('Trattato firmato con ' + faction.name + '! La rotta ora genera monete ogni minuto di gioco.');
  }
  return fail('Azione non riconosciuta.');
}

export function lawLabel(id: string, value: string): string {
  const labels: Record<string, string> = {
    'tax:low': 'Tasse leggere', 'tax:balanced': 'Tasse equilibrate', 'tax:high': 'Tasse alte',
    'food:reserve': 'Razionamento prudente', 'food:balanced': 'Dispense equilibrate', 'food:generous': 'Distribuzione generosa',
    'forest:protected': 'Protezione dei boschi', 'forest:managed': 'Taglio controllato', 'forest:intensive': 'Taglio intensivo',
    'guard:none': 'Nessuna pattuglia', 'guard:patrol': 'Pattuglie attive',
  };
  return labels[id + ':' + value] ?? (id + ': ' + value);
}

export function regionDescription(id: RegionId): string {
  return REGIONS.find((region) => region.id === id)?.description ?? 'Territorio sconosciuto';
}