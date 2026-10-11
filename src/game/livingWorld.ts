import { isEpochUnlocked } from './progression';
import { BUILDINGS } from './definitions';
import { getSeason } from './community';
import type {
  Building, BuildingType, Citizen, CommunityState, Expedition, Faction, FoodPolicy, ForestPolicy,
  CitizenIllness, FrontierIncident, FrontierPerkId, FrontierStructure, FrontierStructureType, FrontierTerritory,
  GameState, GoodsBag, MarketResource, Profession, ProjectId, RealmAction, RealmEvent, RealmEventChoice, ResearchDefinition, ResearchId,
  MarketState, RegionId, Resource, ResourceBag, RealmPolicies, TaxPolicy, GuardPolicy, TradableGood, WorldState,
} from './types';

export const PROFESSION_LABELS: Record<Profession, string> = {
  farmer: 'Contadino', lumberjack: 'Boscaiolo', miner: 'Minatore', merchant: 'Mercante',
  miller: 'Mugnaio', baker: 'Fornaio', scholar: 'Studioso', scout: 'Esploratore',
  builder: 'Costruttore', guard: 'Guardia', artisan: 'Artigiano',
};
export const PROFESSIONS = Object.keys(PROFESSION_LABELS) as Profession[];

export const RESEARCH: ResearchDefinition[] = [
  { id: 'irrigation', name: 'Irrigazione', path: 'Agricoltura', description: 'Le fattorie producono di più e resistono meglio alle stagioni difficili.', cost: 18, duration: 180, requiredBuildings: ['farm'], resourceCost: { wood: 2, stone: 2 } },
  { id: 'tools', name: 'Utensili efficienti', path: 'Artigianato', description: 'Gli edifici produttivi rendono il 12% in più.', cost: 22, duration: 210, requiredBuildings: ['workshop'], resourceCost: { wood: 4 } },
  { id: 'trade', name: 'Reti commerciali', path: 'Commercio', description: 'Il mercato rende di più e gli accordi esteri generano più monete.', cost: 24, duration: 220, requiredBuildings: ['market'], requiresResearch: ['tools'], resourceCost: { wood: 3, coins: 3 } },
  { id: 'education', name: 'Scuola dei maestri', path: 'Conoscenza', description: 'Gli studiosi accelerano le ricerche e le competenze crescono più velocemente.', cost: 20, duration: 190, requiredBuildings: ['school'], requiresResearch: ['tools'], requiredProfession: 'scholar', minSkill: 8, resourceCost: { wood: 3, coins: 2 } },
  { id: 'cartography', name: 'Cartografia', path: 'Esplorazione', description: 'Sblocca spedizioni più lontane e permette due spedizioni contemporanee.', cost: 26, duration: 250, requiredBuildings: ['school'], requiresResearch: ['education'], requiredProfession: 'scout', minSkill: 12, resourceCost: { wood: 5, coins: 3 } },
  { id: 'forestry', name: 'Silvicoltura', path: 'Natura', description: 'La gestione protetta dei boschi sacrifica meno produzione.', cost: 21, duration: 190, requiredBuildings: ['sawmill'], requiresResearch: ['irrigation'], resourceCost: { wood: 3 } },
];

export const REGIONS: Array<{ id: RegionId; name: string; description: string; duration: number; requirement: string | null }> = [
  { id: 'forest', name: 'Bosco antico', description: 'Legname, erbe e tracce di viaggiatori.', duration: 100, requirement: null },
  { id: 'mountains', name: 'Passo delle rocce', description: 'Cave dimenticate, pietra e strumenti abbandonati.', duration: 135, requirement: 'forest' },
  { id: 'lake', name: 'Lago velato', description: 'Pesce, piante medicinali e una rotta per i mercanti.', duration: 120, requirement: 'forest' },
  { id: 'ancient-ruins', name: 'Rovine della Corona', description: 'Resti di una civiltà e conoscenze sepolte.', duration: 180, requirement: 'cartography' },
  { id: 'borderlands', name: 'Terre di confine', description: 'Nuove comunità, merci rare e opportunità diplomatiche.', duration: 210, requirement: 'cartography' },
];

export const FRONTIER_GRID_SIZE = 5;
export const FRONTIER_STRUCTURES: Record<FrontierStructureType, {
  name: string; icon: string; description: string; cost: Partial<ResourceBag>;
  allowedRegions: RegionId[]; output: Resource | 'research' | 'stability' | null; amount: number;
}> = {
  outpost: { name: 'Avamposto', icon: '⌂', description: 'Punto sicuro da cui amministrare il territorio.', cost: {}, allowedRegions: REGIONS.map((region) => region.id), output: null, amount: 0 },
  lumberCamp: { name: 'Campo boschivo', icon: '🪵', description: 'Raccoglie legname dalle riserve locali.', cost: { wood: 8, stone: 2 }, allowedRegions: ['forest', 'borderlands'], output: 'wood', amount: 5 },
  quarry: { name: 'Cava di frontiera', icon: '⛏', description: 'Estrae pietra dalle riserve minerarie locali.', cost: { wood: 8, stone: 5 }, allowedRegions: ['mountains', 'ancient-ruins'], output: 'stone', amount: 4 },
  fishery: { name: 'Peschiera', icon: '🐟', description: 'Raccoglie cibo dalle acque e dalle rive.', cost: { wood: 8, food: 4 }, allowedRegions: ['lake'], output: 'food', amount: 6 },
  tradingPost: { name: 'Posto commerciale', icon: '⚖', description: 'Genera monete e consolida gli scambi regionali.', cost: { wood: 10, stone: 6, coins: 4 }, allowedRegions: ['lake', 'borderlands'], output: 'coins', amount: 3 },
  archive: { name: 'Archivio delle rovine', icon: '📜', description: 'Trasforma le scoperte locali in conoscenza per il regno.', cost: { wood: 12, stone: 12, coins: 8 }, allowedRegions: ['ancient-ruins'], output: 'research', amount: 3 },
  watchtower: { name: 'Torre di frontiera', icon: '♜', description: 'Riduce le incursioni e aiuta il territorio a riprendersi.', cost: { wood: 10, stone: 8 }, allowedRegions: REGIONS.map((region) => region.id), output: 'stability', amount: 0.8 },
};

const FRONTIER_PROFILES: Record<RegionId, {
  climate: FrontierTerritory['climate']; risk: number; foundingCost: Partial<ResourceBag>;
  stock: ResourceBag; reserveResource: Resource;
}> = {
  forest: { climate: 'woodland', risk: 15, foundingCost: { wood: 16, stone: 5, coins: 6 }, stock: { wood: 80, stone: 18, food: 35, coins: 8 }, reserveResource: 'wood' },
  mountains: { climate: 'alpine', risk: 26, foundingCost: { wood: 12, stone: 18, coins: 10 }, stock: { wood: 20, stone: 90, food: 14, coins: 8 }, reserveResource: 'stone' },
  lake: { climate: 'wetland', risk: 18, foundingCost: { wood: 12, stone: 8, coins: 5 }, stock: { wood: 28, stone: 18, food: 90, coins: 22 }, reserveResource: 'food' },
  'ancient-ruins': { climate: 'ruins', risk: 24, foundingCost: { wood: 18, stone: 16, coins: 18 }, stock: { wood: 18, stone: 65, food: 12, coins: 25 }, reserveResource: 'stone' },
  borderlands: { climate: 'border', risk: 28, foundingCost: { wood: 20, stone: 16, coins: 22 }, stock: { wood: 50, stone: 45, food: 30, coins: 45 }, reserveResource: 'coins' },
};
const FRONTIER_PERKS: FrontierPerkId[] = ['forest-reserve', 'forest-contract', 'mountain-charter', 'mountain-shelters', 'lake-cooperative', 'lake-tolls', 'border-customs', 'border-watch', 'archive-network'];
const FACTION_TRADE_PROFILES: Record<string, Pick<Faction, 'need' | 'offer' | 'needAmount' | 'offerAmount' | 'treatyBenefit'>> = {
  selvalunga: { need: 'stone', needAmount: 5, offer: 'wood', offerAmount: 9, treatyBenefit: 'legname e recupero forestale' },
  salmastra: { need: 'wood', needAmount: 6, offer: 'food', offerAmount: 10, treatyBenefit: 'provviste e pesca' },
  rocciacupa: { need: 'food', needAmount: 8, offer: 'stone', offerAmount: 7, treatyBenefit: 'pietra e strumenti' },
};
const FRONTIER_INCIDENTS: Record<RegionId, { kind: FrontierIncident['kind']; title: string; loss: Resource }> = {
  forest: { kind: 'wildfire', title: 'Incendio nel bosco', loss: 'wood' },
  mountains: { kind: 'landslide', title: 'Frana al passo', loss: 'stone' },
  lake: { kind: 'flood', title: 'Piena sulle rive', loss: 'food' },
  'ancient-ruins': { kind: 'collapse', title: 'Crollo nelle rovine', loss: 'stone' },
  borderlands: { kind: 'raiders', title: 'Incursione alla frontiera', loss: 'coins' },
};

export function frontierFoundingCost(region: RegionId): Partial<ResourceBag> {
  return { ...FRONTIER_PROFILES[region].foundingCost };
}
export function frontierStructureAllowed(region: RegionId, structure: FrontierStructureType): boolean {
  return structure !== 'outpost' && FRONTIER_STRUCTURES[structure].allowedRegions.includes(region);
}
export function canColonizeRegion(state: GameState, region: RegionId): boolean {
  const world = state.world;
  return !!world && world.discoveredRegions.includes(region) &&
    !world.frontierTerritories.some((territory) => territory.region === region) &&
    isEpochUnlocked(state, 'borough') && REGIONS.some((entry) => entry.id === region);
}
function createFrontierTerritory(region: RegionId, gameMinutes: number): FrontierTerritory {
  const profile = FRONTIER_PROFILES[region];
  return {
    region, name: REGIONS.find((entry) => entry.id === region)?.name ?? region, climate: profile.climate,
    foundedAt: gameMinutes, stock: { ...profile.stock }, stability: region === 'borderlands' ? 58 : region === 'ancient-ruins' ? 62 : region === 'mountains' ? 66 : region === 'lake' ? 80 : 86,
    structures: [{ id: 'outpost-' + region + '-' + gameMinutes, type: 'outpost', x: 2, y: 2, level: 1 }],
    lastIncidentAt: -1, activeIncident: null,
  };
}

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
function refreshMarket(seed: number, gameMinutes: number, market: MarketState, goods: GoodsBag, drought: boolean, activeEventId: string | null): MarketState {
  const cycle = market.cycle + 1;
  const keys = Object.keys(MARKET_BASE_PRICES) as TradableGood[];
  const demand = { ...market.demand };
  const prices = { ...market.prices };
  keys.forEach((good, index) => {
    const score = Math.abs(Math.trunc(seed * 31 + cycle * 137 + index * 227)) % 101;
    let factor = 0.62 + score / 150;
    if (goods[good] > 16) factor *= 0.82;
    if (goods[good] < 3) factor *= 1.12;
    const season = getSeason(gameMinutes).id;
    if (season === 'winter' && ['grain', 'flour', 'bread', 'medicine'].includes(good)) factor *= 1.14;
    if (season === 'autumn' && good === 'grain') factor *= 0.88;
    if (drought && ['grain', 'flour', 'bread'].includes(good)) factor *= 1.2;
    if (activeEventId === 'fair') factor *= good === 'tools' || good === 'bread' ? 1.18 : 1.05;
    if (activeEventId === 'caravan') factor *= good === 'tools' || good === 'medicine' ? 1.12 : 1;
    factor = Math.max(0.5, Math.min(1.7, factor));
    demand[good] = Math.round(factor * 100) / 100;
    prices[good] = Math.max(1, Math.round(MARKET_BASE_PRICES[good] * factor));
  });
  return { prices, demand, cycle, nextShiftAt: gameMinutes + 120 };
}
const DEFAULT_POLICIES: RealmPolicies = { tax: 'balanced', food: 'balanced', forest: 'managed', guard: 'none' };
const EVENT_IDS = ['drought', 'caravan', 'wanderer', 'wolves', 'fair', 'caravan-rescue', 'drought-recovery', 'ruins-found', 'archive-clue', 'forest-expedition', 'mountain-expedition', 'lake-expedition', 'border-expedition'];

function RESOURCE_NAME(resource: Resource): string {
  return resource === 'wood' ? 'legname' : resource === 'stone' ? 'pietra' : resource === 'food' ? 'cibo' : 'monete';
}

function clamp(value: number, low = 0, high = 100): number {
  return Math.max(low, Math.min(high, Math.round(value * 100) / 100));
}

function rememberCitizen(citizen: Citizen, memory: string): string[] {
  return [...(citizen.personalHistory ?? []), memory].slice(-6);
}

function schoolScholarCount(state: GameState, citizens: Citizen[]): number {
  return citizens.filter((citizen) => {
    if (citizen.profession !== 'scholar' || citizen.status !== 'resident' || citizen.age < 14 || !citizen.workplaceId) return false;
    const workplace = state.buildings.find((building) => building.id === citizen.workplaceId && building.construction?.kind !== 'build');
    return workplace?.type === 'school' || workplace?.type === 'university';
  }).length;
}

function validPartialResourceBag(value: unknown): value is Partial<ResourceBag> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const allowed = new Set<Resource>(['wood', 'stone', 'food', 'coins']);
  return Object.entries(value).every(([key, amount]) => allowed.has(key as Resource) && typeof amount === 'number' && Number.isFinite(amount) && amount >= 0);
}

function validPartialGoodsBag(value: unknown): value is Partial<GoodsBag> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const allowed = new Set<keyof GoodsBag>(['grain', 'flour', 'bread', 'tools', 'medicine']);
  return Object.entries(value).every(([key, amount]) => allowed.has(key as keyof GoodsBag) && typeof amount === 'number' && Number.isFinite(amount) && amount >= 0);
}

function validEventChoice(value: unknown): value is RealmEventChoice {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const choice = value as Partial<RealmEventChoice>;
  const finiteOptional = (number: unknown) => number === undefined || (typeof number === 'number' && Number.isFinite(number));
  return typeof choice.id === 'string' && choice.id.length > 0
    && typeof choice.label === 'string' && typeof choice.detail === 'string'
    && (choice.cost === undefined || validPartialResourceBag(choice.cost))
    && (choice.reward === undefined || validPartialResourceBag(choice.reward))
    && (choice.goodsCost === undefined || validPartialGoodsBag(choice.goodsCost))
    && (choice.goodsReward === undefined || validPartialGoodsBag(choice.goodsReward))
    && finiteOptional(choice.moodDelta) && finiteOptional(choice.trustDelta)
    && finiteOptional(choice.researchDelta) && (choice.researchDelta === undefined || choice.researchDelta >= 0)
    && finiteOptional(choice.populationDelta) && (choice.populationDelta === undefined || (Number.isInteger(choice.populationDelta) && Math.abs(choice.populationDelta) <= 100))
    && (choice.chain === undefined || (typeof choice.chain === 'string' && EVENT_IDS.includes(choice.chain)))
    && (choice.profession === undefined || PROFESSIONS.includes(choice.profession))
    && (choice.frontierPerk === undefined || ['forest-reserve', 'forest-contract', 'mountain-charter', 'mountain-shelters', 'lake-cooperative', 'lake-tolls', 'border-customs', 'border-watch', 'archive-network'].includes(choice.frontierPerk));
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
    activity: 'socializing',
    workplaceId: null,
    expeditionId: null,
    lastAction: 'Si gode una mattina tranquilla',
    relationships: {},
    homeId: 'town-hall-1',
    familyId: 'family-' + (Math.floor(index / 2) + 1),
    bornAt: gameMinutes,
    illness: null,
    personalHistory: ['È arrivato nel borgo come ' + PROFESSION_LABELS[profession] + '.'],
    parentIds: [],
  };
}

export function createWorldState(seed: number, population = 5, gameMinutes = 0): WorldState {
  const citizens = Array.from({ length: Math.max(0, population) }, (_, index) => makeCitizen(seed, index, gameMinutes));
  const factionSeed = Math.abs(seed);
  const factions: Faction[] = [
    { id: 'selvalunga', name: 'Selvalunga', specialty: 'Legname, botanica e protezione dei boschi', relation: 28 + factionSeed % 20, lastContact: 0, treaty: false, ...FACTION_TRADE_PROFILES.selvalunga },
    { id: 'salmastra', name: 'Porto Salmastra', specialty: 'Pesca, sale e trasporto via acqua', relation: 32 + (factionSeed >> 3) % 21, lastContact: 0, treaty: false, ...FACTION_TRADE_PROFILES.salmastra },
    { id: 'rocciacupa', name: 'Rocciacupa', specialty: 'Pietra, attrezzi e lavori minerari', relation: 25 + (factionSeed >> 6) % 25, lastContact: 0, treaty: false, ...FACTION_TRADE_PROFILES.rocciacupa },
  ];
  return {
    version: 1, nextCitizenId: citizens.length + 1, citizens, goods: { ...DEFAULT_GOODS },
    policies: { ...DEFAULT_POLICIES }, researchPoints: 25, activeResearch: null, researchProgress: 0,
    researched: [], expeditions: [], discoveredRegions: [], chronicle: ['È nato un nuovo Consiglio del Regno. I cittadini ora hanno bisogni, mestieri e ambizioni.'],
    activeEvent: null, nextEventAt: gameMinutes + 240, queuedEvent: null, eventQueue: [],
    projectStages: { aqueduct: 0, 'stone-bridge': 0, 'artisan-quarter': 0, 'grand-archive': 0 },
    market: createMarketState(gameMinutes), forestHealth: 100, weather: { id: 'clear', endsAt: 0 },
    completedProjects: [], factions, tradeRoutes: [], frontierTerritories: [], frontierPerks: [],
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
  const rawCitizens = (existing.citizens as unknown[]).slice(0, 1200);
  let nextCitizenId = Number.isSafeInteger(existing.nextCitizenId) && existing.nextCitizenId > 0 ? existing.nextCitizenId : rawCitizens.length + 1;
  for (const raw of rawCitizens) {
    if (!raw || typeof raw !== 'object') continue;
    const id = (raw as { id?: unknown }).id;
    if (typeof id === 'string') {
      const match = /^citizen-(\d+)$/.exec(id);
      if (match) nextCitizenId = Math.max(nextCitizenId, Number(match[1]) + 1);
    }
  }
  const usedCitizenIds = new Set<string>();
  let citizens = rawCitizens.map((raw, index): Citizen => {
    const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw as Partial<Citizen> : {};
    const fallback = makeCitizen(state.seed, index, state.gameMinutes);
    let id = typeof source.id === 'string' && source.id.trim() ? source.id.trim() : fallback.id;
    if (usedCitizenIds.has(id)) { do { id = 'citizen-' + nextCitizenId++; } while (usedCitizenIds.has(id)); }
    usedCitizenIds.add(id);
    const profession = PROFESSIONS.includes(source.profession as Profession) ? source.profession as Profession : fallback.profession;
    const status = source.status === 'exploring' ? 'exploring' : 'resident';
    const sourceSkills = source.skills && typeof source.skills === 'object' && !Array.isArray(source.skills) ? source.skills as Partial<Record<Profession, unknown>> : {};
    const skills = { ...fallback.skills } as Record<Profession, number>;
    for (const job of PROFESSIONS) if (Number.isFinite(sourceSkills[job])) skills[job] = clamp(sourceSkills[job] as number);
    const sourceRelationships = source.relationships && typeof source.relationships === 'object' && !Array.isArray(source.relationships) ? source.relationships as Record<string, unknown> : {};
    const relationships = Object.fromEntries(Object.entries(sourceRelationships).filter(([, value]) => Number.isFinite(value)).map(([key, value]) => [key, clamp(value as number, -100, 100)]));
    const traits = Array.isArray(source.traits) ? source.traits.filter((trait): trait is string => typeof trait === 'string').slice(0, 4) : fallback.traits;
    const activityValues = ['working', 'resting', 'socializing', 'commuting', 'eating'];
    const activity = status === 'exploring' ? 'exploring' : activityValues.includes(source.activity as string) ? source.activity as Citizen['activity'] : 'socializing';
    return {
      ...fallback, id,
      name: typeof source.name === 'string' && source.name.trim() ? source.name.trim().slice(0, 80) : fallback.name,
      age: Number.isFinite(source.age) ? Math.max(0, Math.min(120, Math.floor(source.age as number))) : fallback.age,
      profession, traits: traits.length ? traits : fallback.traits, skills,
      hunger: Number.isFinite(source.hunger) ? clamp(source.hunger as number) : fallback.hunger,
      energy: Number.isFinite(source.energy) ? clamp(source.energy as number) : fallback.energy,
      happiness: Number.isFinite(source.happiness) ? clamp(source.happiness as number) : fallback.happiness,
      health: Number.isFinite(source.health) ? clamp(source.health as number) : fallback.health,
      experience: Number.isFinite(source.experience) ? Math.max(0, source.experience as number) : 0,
      status, activity,
      workplaceId: typeof source.workplaceId === 'string' ? source.workplaceId : null,
      expeditionId: status === 'exploring' && typeof source.expeditionId === 'string' ? source.expeditionId : null,
      lastAction: typeof source.lastAction === 'string' ? source.lastAction.slice(0, 240) : fallback.lastAction,
      relationships,
      homeId: typeof source.homeId === 'string' ? source.homeId : null,
      familyId: typeof source.familyId === 'string' && source.familyId ? source.familyId.slice(0, 80) : fallback.familyId,
      bornAt: Number.isFinite(source.bornAt) ? Math.max(0, source.bornAt as number) : state.gameMinutes,
      illness: source.illness && typeof source.illness === 'object'
        && ['cold', 'fever'].includes((source.illness as CitizenIllness).id)
        && Number.isFinite((source.illness as CitizenIllness).since)
        && (source.illness as CitizenIllness).since >= 0
        && (source.illness as CitizenIllness).since <= state.gameMinutes
        ? { id: (source.illness as CitizenIllness).id, severity: (source.illness as CitizenIllness).severity === 2 ? 2 : 1, since: (source.illness as CitizenIllness).since }
        : null,
      personalHistory: Array.isArray(source.personalHistory)
        ? source.personalHistory.filter((entry): entry is string => typeof entry === 'string').slice(-6)
        : fallback.personalHistory,
      parentIds: Array.isArray(source.parentIds)
        ? source.parentIds.filter((parentId): parentId is string => typeof parentId === 'string' && parentId !== id).slice(0, 2)
        : [],
    };
  });
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
  const knownCitizenIds = new Set(citizens.map((citizen) => citizen.id));
  const seenExpeditionIds = new Set<string>();
  const validExpeditions = existing.expeditions
    .filter((trip) => {
      if (!trip || typeof trip.id !== 'string' || seenExpeditionIds.has(trip.id) || !REGIONS.some((region) => region.id === trip.region)
        || typeof trip.scoutId !== 'string' || !knownCitizenIds.has(trip.scoutId)
        || !Number.isFinite(trip.startedAt) || trip.startedAt < 0 || trip.startedAt > state.gameMinutes
        || !Number.isFinite(trip.eta) || trip.eta < trip.startedAt
        || !['active', 'success', 'partial', 'failed'].includes(trip.status)) return false;
      seenExpeditionIds.add(trip.id);
      return true;
    })
    .map((trip) => {
      const crewIds = [...new Set([trip.scoutId, ...(Array.isArray(trip.crewIds) ? trip.crewIds.filter((id): id is string => typeof id === 'string' && knownCitizenIds.has(id)) : [])])].slice(0, 3);
      return { ...trip, crewIds, successChance: Number.isFinite(trip.successChance) ? clamp(trip.successChance) : 45 };
    });
  const assignedActiveCrew = new Set<string>();
  const acceptedActiveTripIds = new Set<string>();
  const activeTripsByCitizen = new Map<string, Expedition>();
  for (const trip of validExpeditions.filter((entry) => entry.status === 'active')) {
    const crewIds = trip.crewIds ?? [trip.scoutId];
    if (crewIds.some((id) => assignedActiveCrew.has(id))) continue;
    acceptedActiveTripIds.add(trip.id);
    for (const id of crewIds) {
      assignedActiveCrew.add(id);
      activeTripsByCitizen.set(id, trip);
    }
  }
  const sanitizedExpeditions = validExpeditions.filter((trip) => trip.status !== 'active' || acceptedActiveTripIds.has(trip.id));
  citizens = citizens.map((citizen) => {
    const activeTrip = activeTripsByCitizen.get(citizen.id);
    if (activeTrip) return { ...citizen, status: 'exploring', activity: 'exploring', expeditionId: activeTrip.id, lastAction: 'Sta esplorando il territorio' };
    if (citizen.status === 'exploring') return { ...citizen, status: 'resident', activity: 'socializing', expeditionId: null, lastAction: 'È tornato alla vita del borgo dopo aver corretto una spedizione incompleta' };
    return { ...citizen, expeditionId: null, activity: citizen.activity === 'exploring' ? 'socializing' : citizen.activity };
  });
  const presentCitizenIds = new Set(citizens.map((citizen) => citizen.id));
  citizens = citizens.map((citizen) => ({
    ...citizen,
    relationships: Object.fromEntries(Object.entries(citizen.relationships).filter(([id]) => id !== citizen.id && presentCitizenIds.has(id))),
  }));
  const homes = state.buildings.filter((building) => (BUILDINGS[building.type]?.housing ?? 0) > 0 && building.construction?.kind !== 'build');
  const occupied = new Map<string, number>();
  citizens = citizens.map((citizen, index) => {
    const oldHome = homes.find((building) => building.id === citizen.homeId);
    const oldCapacity = oldHome ? (BUILDINGS[oldHome.type]?.housing ?? 0) * oldHome.level : 0;
    const oldUsed = oldHome ? occupied.get(oldHome.id) ?? 0 : 0;
    const selected = oldHome && oldUsed < oldCapacity
      ? oldHome
      : homes.find((building) => (occupied.get(building.id) ?? 0) < (BUILDINGS[building.type]?.housing ?? 0) * building.level);
    if (selected) occupied.set(selected.id, (occupied.get(selected.id) ?? 0) + 1);
    const assignedWorkplace = state.buildings.some((building) => building.id === citizen.workplaceId && BUILDING_JOB[building.type] === citizen.profession && building.construction?.kind !== 'build') ? citizen.workplaceId : null;
    return { ...citizen, homeId: selected?.id ?? null, workplaceId: assignedWorkplace, activity: citizen.status === 'exploring' ? 'exploring' : citizen.activity, familyId: citizen.familyId || 'family-' + (Math.floor(index / 2) + 1) };
  });
  const eventQueue = [...new Set([
    ...(typeof existing.queuedEvent === 'string' ? [existing.queuedEvent] : []),
    ...(Array.isArray(existing.eventQueue) ? existing.eventQueue : []),
  ].filter((id): id is string => typeof id === 'string' && EVENT_IDS.includes(id)))].slice(0, 16);
  const world: WorldState = {
    ...existing,
    nextCitizenId,
    citizens,
    goods: clampGoodsToCapacity({
      grain: Number.isFinite(existing.goods.grain) ? Math.max(0, Math.min(100000, existing.goods.grain)) : DEFAULT_GOODS.grain,
      flour: Number.isFinite(existing.goods.flour) ? Math.max(0, Math.min(100000, existing.goods.flour)) : DEFAULT_GOODS.flour,
      bread: Number.isFinite(existing.goods.bread) ? Math.max(0, Math.min(100000, existing.goods.bread)) : DEFAULT_GOODS.bread,
      tools: Number.isFinite(existing.goods.tools) ? Math.max(0, Math.min(100000, existing.goods.tools)) : DEFAULT_GOODS.tools,
      medicine: Number.isFinite(existing.goods.medicine) ? Math.max(0, Math.min(100000, existing.goods.medicine)) : DEFAULT_GOODS.medicine,
    }, goodsStorageCapacity(state)),
    policies: {
      tax: ['low', 'balanced', 'high'].includes(existing.policies.tax) ? existing.policies.tax : DEFAULT_POLICIES.tax,
      food: ['reserve', 'balanced', 'generous'].includes(existing.policies.food) ? existing.policies.food : DEFAULT_POLICIES.food,
      forest: ['protected', 'managed', 'intensive'].includes(existing.policies.forest) ? existing.policies.forest : DEFAULT_POLICIES.forest,
      guard: ['none', 'patrol'].includes(existing.policies.guard) ? existing.policies.guard : DEFAULT_POLICIES.guard,
    },
    researchPoints: Number.isFinite(existing.researchPoints) ? Math.max(0, Math.min(100000, existing.researchPoints)) : 0,
    researchProgress: Number.isFinite(existing.researchProgress) ? Math.max(0, existing.researchProgress) : 0,
    researched: [...new Set(existing.researched.filter((id): id is ResearchId => RESEARCH.some((entry) => entry.id === id)))],
    activeResearch: RESEARCH.some((entry) => entry.id === existing.activeResearch) ? existing.activeResearch : null,
    expeditions: sanitizedExpeditions.slice(-8),
    discoveredRegions: [...new Set(existing.discoveredRegions.filter((id): id is RegionId => REGIONS.some((region) => region.id === id)))],
    chronicle: existing.chronicle.filter((entry): entry is string => typeof entry === 'string').slice(0, 12),
    activeEvent: existing.activeEvent && typeof existing.activeEvent.id === 'string' && EVENT_IDS.includes(existing.activeEvent.id) && typeof existing.activeEvent.title === 'string' && typeof existing.activeEvent.description === 'string' && Number.isFinite(existing.activeEvent.startedAt) && existing.activeEvent.startedAt >= 0 && Array.isArray(existing.activeEvent.choices) && existing.activeEvent.choices.length > 0 && existing.activeEvent.choices.length <= 8 && existing.activeEvent.choices.every(validEventChoice) ? existing.activeEvent : null,
    nextEventAt: Number.isFinite(existing.nextEventAt) ? existing.nextEventAt : state.gameMinutes + 240,
    eventQueue,
    queuedEvent: eventQueue[0] ?? null,
    projectStages: {
      aqueduct: Number.isFinite(existing.projectStages.aqueduct) ? Math.max(0, Math.min(3, Math.floor(existing.projectStages.aqueduct))) : 0,
      'stone-bridge': Number.isFinite(existing.projectStages['stone-bridge']) ? Math.max(0, Math.min(3, Math.floor(existing.projectStages['stone-bridge']))) : 0,
      'artisan-quarter': Number.isFinite(existing.projectStages['artisan-quarter']) ? Math.max(0, Math.min(3, Math.floor(existing.projectStages['artisan-quarter']))) : 0,
      'grand-archive': Number.isFinite(existing.projectStages['grand-archive']) ? Math.max(0, Math.min(3, Math.floor(existing.projectStages['grand-archive']))) : 0,
    },
    market: {
      ...createMarketState(state.gameMinutes), ...(existing.market ?? {}),
      prices: Object.fromEntries((Object.keys(MARKET_BASE_PRICES) as TradableGood[]).map((good) => [good, Number.isFinite(existing.market?.prices?.[good]) ? Math.max(1, Math.min(10000, existing.market!.prices[good])) : MARKET_BASE_PRICES[good]])) as Record<TradableGood, number>,
      demand: Object.fromEntries((Object.keys(MARKET_BASE_PRICES) as TradableGood[]).map((good) => [good, Number.isFinite(existing.market?.demand?.[good]) ? Math.max(0.1, Math.min(10, existing.market!.demand[good])) : 1])) as Record<TradableGood, number>,
      cycle: Number.isSafeInteger(existing.market?.cycle) ? Math.max(0, existing.market!.cycle) : 0,
      nextShiftAt: Number.isFinite(existing.market?.nextShiftAt) ? Math.max(state.gameMinutes, existing.market!.nextShiftAt) : state.gameMinutes + 120,
    },
    forestHealth: Number.isFinite(existing.forestHealth) ? clamp(existing.forestHealth!) : 100,
    weather: existing.weather && ['clear', 'drought'].includes(existing.weather.id) && Number.isFinite(existing.weather.endsAt)
      ? { ...existing.weather } : { id: 'clear', endsAt: 0 },
    completedProjects: [...new Set(existing.completedProjects.filter((id): id is ProjectId => PROJECTS.some((project) => project.id === id)))],
    factions: existing.factions.filter((faction) => faction && typeof faction.id === 'string' && typeof faction.name === 'string' && typeof faction.specialty === 'string' && Number.isFinite(faction.relation)).map((faction) => {
      const fallback = FACTION_TRADE_PROFILES[faction.id] ?? FACTION_TRADE_PROFILES.selvalunga;
      const validResource = (value: unknown): value is Resource => ['wood', 'stone', 'food', 'coins'].includes(value as string);
      return {
        ...fallback, ...faction, relation: clamp(faction.relation),
        lastContact: Number.isFinite(faction.lastContact) ? Math.max(0, faction.lastContact) : 0,
        treaty: faction.treaty === true,
        need: validResource(faction.need) ? faction.need : fallback.need,
        offer: validResource(faction.offer) ? faction.offer : fallback.offer,
        needAmount: Number.isFinite(faction.needAmount) ? Math.max(1, Math.min(100, faction.needAmount!)) : fallback.needAmount,
        offerAmount: Number.isFinite(faction.offerAmount) ? Math.max(1, Math.min(100, faction.offerAmount!)) : fallback.offerAmount,
        treatyBenefit: typeof faction.treatyBenefit === 'string' ? faction.treatyBenefit : fallback.treatyBenefit,
      };
    }),
    tradeRoutes: [...new Set(existing.tradeRoutes.filter((id) => typeof id === 'string' && existing.factions.some((faction) => faction?.id === id)))],
    frontierTerritories: Array.isArray(existing.frontierTerritories) ? existing.frontierTerritories
      .filter((territory) => territory && typeof territory === 'object' && REGIONS.some((region) => region.id === (territory as FrontierTerritory).region))
      .slice(0, REGIONS.length).map((raw): FrontierTerritory => {
        const source = raw as Partial<FrontierTerritory>;
        const region = source.region as RegionId;
        const profile = FRONTIER_PROFILES[region];
        const stock = source.stock && typeof source.stock === 'object' ? source.stock as Partial<ResourceBag> : {};
        const cleanAmount = (key: Resource) => Number.isFinite(stock[key]) ? Math.max(0, Math.min(profile.stock[key], stock[key]!)) : profile.stock[key];
        const structures = Array.isArray(source.structures) ? source.structures.filter((entry) => entry && typeof entry.id === 'string'
          && Object.prototype.hasOwnProperty.call(FRONTIER_STRUCTURES, entry.type)
          && Number.isInteger(entry.x) && entry.x >= 0 && entry.x < FRONTIER_GRID_SIZE
          && Number.isInteger(entry.y) && entry.y >= 0 && entry.y < FRONTIER_GRID_SIZE
          && Number.isFinite(entry.level)).map((entry) => ({ ...entry, level: Math.max(1, Math.min(3, Math.floor(entry.level))) })).slice(0, FRONTIER_GRID_SIZE * FRONTIER_GRID_SIZE) : [];
        const hazard = source.activeIncident && ['wildfire', 'landslide', 'flood', 'collapse', 'raiders'].includes(source.activeIncident.kind)
          && Number.isFinite(source.activeIncident.endsAt) && source.activeIncident.endsAt > state.gameMinutes
          ? { ...source.activeIncident, startedAt: Math.max(0, Number.isFinite(source.activeIncident.startedAt) ? source.activeIncident.startedAt : state.gameMinutes),
              endsAt: Math.max(state.gameMinutes, source.activeIncident.endsAt), outputPenalty: Math.max(0.1, Math.min(1, Number.isFinite(source.activeIncident.outputPenalty) ? source.activeIncident.outputPenalty : 0.5)) }
          : null;
        const result: FrontierTerritory = {
          region, name: typeof source.name === 'string' ? source.name.slice(0, 80) : (REGIONS.find((entry) => entry.id === region)?.name ?? region),
          climate: profile.climate, foundedAt: Number.isFinite(source.foundedAt) ? Math.max(0, source.foundedAt!) : state.gameMinutes,
          stock: { wood: cleanAmount('wood'), stone: cleanAmount('stone'), food: cleanAmount('food'), coins: cleanAmount('coins') },
          stability: Number.isFinite(source.stability) ? clamp(source.stability!) : 70,
          structures: structures.length ? structures : [{ id: 'outpost-' + region + '-' + state.gameMinutes, type: 'outpost', x: 2, y: 2, level: 1 }],
          lastIncidentAt: Number.isFinite(source.lastIncidentAt) ? Math.max(-1, source.lastIncidentAt!) : -1,
          activeIncident: hazard,
        };
        return result;
      }) : [],
    frontierPerks: Array.isArray(existing.frontierPerks) ? [...new Set(existing.frontierPerks.filter((perk): perk is FrontierPerkId => FRONTIER_PERKS.includes(perk)))].slice(0, FRONTIER_PERKS.length) : [],
  };
  return { ...state, world };
}

const BUILDING_JOB: Partial<Record<BuildingType, Profession>> = {
  farm: 'farmer', sawmill: 'lumberjack', quarry: 'miner', market: 'merchant', mill: 'miller',
  bakery: 'baker', school: 'scholar', watchtower: 'guard', workshop: 'artisan', university: 'scholar',
  orchard: 'farmer', fishingHut: 'farmer', herbGarden: 'farmer', inn: 'merchant', ironworks: 'artisan', observatory: 'scholar',
};

export const CITIZEN_ACTIVITY_LABELS: Record<import('./types').CitizenActivity, string> = {
  working: 'Lavora alla propria postazione', resting: 'Si riposa a casa', socializing: 'Incontra i vicini in piazza',
  commuting: 'Si sposta tra casa e lavoro', eating: 'Cerca un pasto', exploring: 'È in spedizione',
};

export function getCitizenWorkplace(state: GameState, citizen: Citizen): Building | null {
  if (citizen.age < 14 || citizen.status !== 'resident') return null;
  const compatible = state.buildings.filter((building) => BUILDING_JOB[building.type] === citizen.profession && building.construction?.kind !== 'build');
  if (!compatible.length) return null;
  const explicit = compatible.find((building) => building.id === citizen.workplaceId);
  if (explicit) return explicit;
  const numericId = Number(citizen.id.slice(citizen.id.lastIndexOf('-') + 1)) || 1;
  return compatible[(Math.max(1, numericId) - 1) % compatible.length] ?? null;
}

/** True only when a building touches a continuous road route reaching the Town Hall or Market. */
export function isRoadConnectedToHub(state: GameState, building: Building): boolean {
  if (building.type === 'road') return false;
  const roads = state.buildings.filter((entry) => entry.type === 'road' && entry.construction?.kind !== 'build');
  if (!roads.length) return false;
  const key = (x: number, y: number) => x + ',' + y;
  const roadByKey = new Map(roads.map((road) => [key(road.x, road.y), road]));
  const adjacent = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y) === 1;
  const hubs = state.buildings.filter((entry) => (entry.type === 'townHall' || entry.type === 'market') && entry.construction?.kind !== 'build');
  const queue = roads.filter((road) => hubs.some((hub) => adjacent(road, hub)));
  const connected = new Set(queue.map((road) => key(road.x, road.y)));
  for (let index = 0; index < queue.length; index++) {
    const road = queue[index]!;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const roadKey = key(road.x + dx!, road.y + dy!);
      const next = roadByKey.get(roadKey);
      if (next && !connected.has(roadKey)) {
        connected.add(roadKey);
        queue.push(next);
      }
    }
  }
  return roads.some((road) => connected.has(key(road.x, road.y)) && adjacent(road, building));
}

export function getCitizenActivity(state: GameState, citizen: Citizen): import('./types').CitizenActivity {
  if (citizen.status === 'exploring') return 'exploring';
  if (citizen.hunger > 75 || (state.resources.food < 0.1 && (state.world?.goods.bread ?? 0) < 0.1)) return 'eating';
  if (citizen.illness) return 'resting';
  if (citizen.age < 14) return citizen.energy < 24 ? 'resting' : 'socializing';
  const minuteOfDay = state.gameMinutes % 1440;
  const workplace = getCitizenWorkplace(state, citizen);
  if (citizen.energy < 24 || minuteOfDay >= 21 * 60 || minuteOfDay < 6 * 60) return 'resting';
  if (workplace && minuteOfDay >= 8 * 60 && minuteOfDay < 17 * 60) return 'working';
  if (workplace && ((minuteOfDay >= 6 * 60 && minuteOfDay < 8 * 60) || (minuteOfDay >= 17 * 60 && minuteOfDay < 18 * 60))) return 'commuting';
  if (minuteOfDay >= 17 * 60 && minuteOfDay < 21 * 60) return 'socializing';
  return workplace ? 'commuting' : 'socializing';
}

export function worldBuildingMultiplier(state: GameState, building: Building): number {
  const world = state.world;
  if (!world) return 1;
  const job = BUILDING_JOB[building.type];
  let multiplier = 1;
  if (job) {
    const assigned = world.citizens.filter((citizen) => citizen.profession === job && citizen.status === 'resident' && !citizen.illness && getCitizenWorkplace(state, citizen)?.id === building.id);
    const workers = assigned.length;
    if (workers === 0) return 0;
    const averageSkill = assigned.reduce((total, citizen) => total + citizen.skills[job], 0) / assigned.length;
    const readiness = assigned.reduce((total, citizen) => total + (citizen.energy + citizen.health + citizen.happiness) / 3, 0) / Math.max(1, assigned.length) / 100;
    multiplier *= Math.min(1.38, 0.44 + workers * 0.29 + averageSkill / 100 * 0.12) * (0.55 + readiness * 0.45);
    const traitBonus = assigned.reduce((total, citizen) => total
      + (citizen.traits.includes('pratico') ? 0.035 : 0)
      + (citizen.traits.includes('inventivo') ? 0.045 : 0)
      + (citizen.traits.includes('ambizioso') ? 0.02 : 0), 0) / assigned.length;
    multiplier *= 1 + Math.min(0.08, traitBonus);
    let friendlyPairs = 0;
    let rivalPairs = 0;
    let pairs = 0;
    for (let left = 0; left < assigned.length; left++) {
      for (let right = left + 1; right < assigned.length; right++) {
        pairs++;
        const relationship = ((assigned[left]!.relationships[assigned[right]!.id] ?? 0) + (assigned[right]!.relationships[assigned[left]!.id] ?? 0)) / 2;
        if (relationship >= 25) friendlyPairs++;
        if (relationship <= -15) rivalPairs++;
      }
    }
    if (pairs > 0) multiplier *= Math.max(0.88, Math.min(1.08, 1 + ((friendlyPairs - rivalPairs) / pairs) * 0.08));
  }
  if (world.researched.includes('tools') && ['farm', 'sawmill', 'quarry', 'market'].includes(building.type)) multiplier *= 1.12;
  if (world.goods.tools >= 1 && ['farm', 'sawmill', 'quarry', 'mill', 'bakery', 'workshop'].includes(building.type)) multiplier *= 1.12;
  if (isRoadConnectedToHub(state, building)) multiplier *= 1.12;
  if (world.completedProjects.includes('artisan-quarter')) multiplier *= 1.08;
  if (building.type === 'farm' && world.researched.includes('irrigation')) multiplier *= 1.15;
  if (building.type === 'farm' && world.weather.id === 'drought' && state.gameMinutes < world.weather.endsAt) multiplier *= 0.68;
  if (building.type === 'farm' && world.completedProjects.includes('aqueduct')) multiplier *= 1.12;
  if (building.type === 'market' && world.researched.includes('trade')) multiplier *= 1.25;
  if (building.type === 'sawmill') {
    multiplier *= world.policies.forest === 'protected' ? (world.researched.includes('forestry') ? 0.88 : 0.72)
      : world.policies.forest === 'intensive' ? 1.25 : 1;
    if (world.forestHealth < 35) multiplier *= 0.55 + world.forestHealth / 100 * 0.45;
  }
  return multiplier;
}

export function researchRequirement(state: GameState, research: ResearchDefinition): string | null {
  const world = state.world;
  if (!world) return 'La Sala del Regno non è pronta.';
  const missingBuilding = (research.requiredBuildings ?? []).find((type) => !state.buildings.some((building) => building.type === type && building.construction?.kind !== 'build'));
  if (missingBuilding) return 'Costruisci prima: ' + BUILDINGS[missingBuilding].name + '.';
  const missingResearch = (research.requiresResearch ?? []).find((id) => !world.researched.includes(id));
  if (missingResearch) return 'Richiede la ricerca: ' + (RESEARCH.find((entry) => entry.id === missingResearch)?.name ?? missingResearch) + '.';
  if (research.requiredProfession) {
    const qualified = world.citizens.some((citizen) => {
      if (citizen.status !== 'resident' || citizen.profession !== research.requiredProfession
        || citizen.age < 14 || citizen.skills[research.requiredProfession!] < (research.minSkill ?? 0)) return false;
      if (research.requiredProfession !== 'scholar') return true;
      if (!citizen.workplaceId) return false;
      const workplace = state.buildings.find((building) => building.id === citizen.workplaceId && building.construction?.kind !== 'build');
      return workplace?.type === 'school' || workplace?.type === 'university';
    });
    if (!qualified) return research.requiredProfession === 'scholar'
      ? 'Serve uno Studioso qualificato assegnato alla Scuola o all’Università (abilità almeno ' + (research.minSkill ?? 0) + ').'
      : 'Serve un cittadino disponibile come ' + PROFESSION_LABELS[research.requiredProfession] + (research.minSkill ? ' con abilità almeno ' + research.minSkill : '') + '.';
  }
  if (research.resourceCost && !hasCost(state.resources, research.resourceCost)) return 'Materiali richiesti: ' + Object.entries(research.resourceCost).map(([key, value]) => `${value} ${key === 'wood' ? 'legname' : key === 'stone' ? 'pietra' : key === 'food' ? 'cibo' : 'monete'}`).join(', ') + '.';
  return null;
}

export function getInterestGroups(state: GameState): Array<{ id: string; name: string; members: number; support: number; influence: number; concern: string }> {
  const world = state.world; const citizens = world?.citizens ?? [];
  const farmers = citizens.filter((citizen) => citizen.profession === 'farmer').length;
  const artisans = citizens.filter((citizen) => ['artisan', 'builder', 'miller', 'baker'].includes(citizen.profession)).length;
  const merchants = citizens.filter((citizen) => citizen.profession === 'merchant').length;
  const newcomers = citizens.filter((citizen) => citizen.age < 18 || (citizen.bornAt > 0 && state.gameMinutes - citizen.bornAt < 1440 * 7)).length;
  const has = (type: BuildingType) => state.buildings.some((building) => building.type === type && building.construction?.kind !== 'build');
  const influence = (members: number) => clamp(members / Math.max(1, state.population) * 100);
  const farmerSupport = 55 + (world?.policies.food === 'generous' ? 9 : world?.policies.food === 'reserve' ? -5 : 0) + (state.resources.food < 18 ? -28 : 8) + (world?.weather.id === 'drought' ? -12 : 0) + (world?.researched.includes('irrigation') ? 7 : 0);
  const artisanSupport = 48 + (world?.researched.includes('tools') ? 12 : 0) + (world?.completedProjects.includes('artisan-quarter') ? 15 : 0) + (state.resources.wood < 6 || state.resources.stone < 4 ? -10 : 4);
  const merchantSupport = 42 + (world?.tradeRoutes.length ?? 0) * 7 + (world?.researched.includes('trade') ? 15 : 0) + (has('market') ? 10 : -8) + (state.resources.coins < 8 ? -10 : 4);
  const newcomerSupport = 45 + (housing(state) > state.population ? 12 : -18) + (state.resources.food >= 18 ? 10 : -20) + (world?.policies.tax === 'low' ? 8 : world?.policies.tax === 'high' ? -12 : 0) + ((state.community?.morale ?? 60) < 40 ? -10 : 0);
  return [
    { id: 'farmers', name: 'Contadini', members: farmers, support: clamp(farmerSupport), influence: influence(farmers), concern: 'Raccolti, riserve alimentari e accesso alla terra' },
    { id: 'artisans', name: 'Artigiani e costruttori', members: artisans, support: clamp(artisanSupport), influence: influence(artisans), concern: 'Materiali, strumenti, botteghe e grandi opere' },
    { id: 'merchants', name: 'Mercanti', members: merchants, support: clamp(merchantSupport), influence: influence(merchants), concern: 'Commercio, monete e rotte sicure' },
    { id: 'newcomers', name: 'Nuovi arrivati e giovani', members: newcomers, support: clamp(newcomerSupport), influence: influence(newcomers), concern: 'Alloggi, provviste e opportunità' },
  ];
}

export function projectRequirement(state: GameState, projectId: ProjectId): string | null {
  const needs: Record<ProjectId, { building: BuildingType; profession?: Profession }> = {
    aqueduct: { building: 'farm' }, 'stone-bridge': { building: 'sawmill' },
    'artisan-quarter': { building: 'workshop', profession: 'artisan' }, 'grand-archive': { building: 'school', profession: 'scholar' },
  };
  const requirement = needs[projectId];
  if (!state.world?.citizens.some((citizen) => citizen.status === 'resident' && citizen.profession === 'builder')) return 'Serve almeno un Costruttore disponibile per coordinare il cantiere.';
  if (!state.buildings.some((building) => building.type === requirement.building && building.construction?.kind !== 'build')) return 'Costruisci prima: ' + BUILDINGS[requirement.building].name + '.';
  if (requirement.profession && !state.world.citizens.some((citizen) => citizen.status === 'resident' && citizen.profession === requirement.profession)) return 'Serve un cittadino disponibile come ' + PROFESSION_LABELS[requirement.profession] + '.';
  return null;
}

export function realmModifiers(state: GameState): { taxMultiplier: number; foodConsumptionMultiplier: number; guardProtection: number; tradeIncome: number } {
  const world = state.world;
  if (!world) return { taxMultiplier: 1, foodConsumptionMultiplier: 1, guardProtection: 0, tradeIncome: 0 };
  const taxMultiplier = world.policies.tax === 'low' ? 0.78 : world.policies.tax === 'high' ? 1.32 : 1;
  const foodConsumptionMultiplier = world.policies.food === 'reserve' ? 0.82 : world.policies.food === 'generous' ? 1.14 : 1;
  const guardProtection = world.policies.guard === 'patrol' || state.buildings.some((building) => building.type === 'watchtower' && building.construction?.kind !== 'build') ? 0.25 : 0;
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

function eventTemplate(id: string, gameMinutes: number, seed = 2310, actor?: Citizen): RealmEvent {
  const event = (eventId: string, title: string, description: string, choices: RealmEventChoice[]): RealmEvent => ({
    id: eventId,
    title,
    description: actor ? description + ' ' + actor.name + ' (' + PROFESSION_LABELS[actor.profession] + ') è coinvolto direttamente e ricorderà la risposta del Consiglio.' : description,
    choices, startedAt: gameMinutes, ...(actor ? { citizenId: actor.id } : {}),
  });
  if (id === 'caravan-rescue') return event(id, 'La carovana è salva', 'La spedizione ha trovato i carri dispersi. Ora bisogna decidere come usare le merci recuperate.', [
    { id: 'take-cargo', label: 'Accetta il carico', detail: 'Ottieni legname, pietra e monete.', reward: { wood: 6, stone: 4, coins: 10 }, researchDelta: 5, trustDelta: 2 },
    { id: 'share-cargo', label: 'Condividi le provviste', detail: 'Rinunci a una parte del bottino e guadagni fiducia.', cost: { food: 5 }, trustDelta: 8, moodDelta: 6 },
  ]);
  if (id === 'drought-recovery') return event(id, 'La pioggia è tornata', 'Le nuvole si sono aperte. Le riserve d’acqua e il lavoro dei contadini possono salvare la stagione.', [
    { id: 'celebrate-rain', label: 'Festeggia il raccolto', detail: 'Il borgo recupera provviste e morale.', reward: { food: 16 }, moodDelta: 7, trustDelta: 4 },
    { id: 'save-rain', label: 'Conserva le riserve', detail: 'Ricevi meno cibo, ma prepari il magazzino.', reward: { food: 9, wood: 3 }, moodDelta: 2, trustDelta: 2 },
  ]);
  if (id === 'ruins-found') return event(id, 'Le rovine parlano', 'Gli esploratori hanno portato tavolette con simboli antichi. Il Consiglio può finanziare lo studio o sigillare il sito.', [
    { id: 'study-tablets', label: 'Studia le tavolette', detail: 'Spendi materiali per guadagnare conoscenza e monete. I testi resteranno consultabili nel territorio.', cost: { wood: 6, stone: 5 }, reward: { coins: 12 }, researchDelta: 18, chain: 'archive-clue', frontierPerk: 'archive-network' },
    { id: 'seal-site', label: 'Proteggi le rovine', detail: 'Nessun costo e una comunità più fiduciosa.', trustDelta: 6, moodDelta: 2 },
  ]);
  if (id === 'archive-clue') return event(id, 'Una mappa dimenticata', 'La ricerca rivela una strada antica verso le terre di confine. Una nuova via commerciale potrebbe cambiare il regno.', [
    { id: 'fund-map', label: 'Finanzia la spedizione', detail: 'Spendi monete per aprire una nuova rotta.', cost: { coins: 10 }, reward: { coins: 4, stone: 4 }, researchDelta: 10, trustDelta: 4 },
    { id: 'keep-secret', label: 'Tieni il segreto', detail: 'Conserva i materiali e migliora la sicurezza.', reward: { wood: 3 }, moodDelta: 1, trustDelta: -1 },
  ]);
  if (id === 'forest-expedition') return event(id, 'Il patto della radura', 'La squadra ha trovato un bosco antico. I taglialegna locali chiedono se il regno proteggerà la radura o firmerà un contratto di raccolta intensiva.', [
    { id: 'protect-grove', label: 'Proteggi la radura', detail: 'Le riserve forestali cresceranno più lentamente, ma la colonia sarà meno esposta agli incendi.', moodDelta: 4, trustDelta: 5, frontierPerk: 'forest-reserve' },
    { id: 'commercial-grove', label: 'Firma il contratto forestale', detail: 'I campi boschivi produrranno più legname, a costo di un rischio ambientale maggiore.', reward: { wood: 8 }, moodDelta: -2, trustDelta: -2, frontierPerk: 'forest-contract' },
  ]);
  if (id === 'mountain-expedition') return event(id, 'I diritti del passo', 'I minatori hanno trovato un valico sicuro e una vena di pietra. Il Consiglio può privilegiare sicurezza o estrazione.', [
    { id: 'secure-pass', label: 'Metti in sicurezza il passo', detail: 'Una rete di ripari ridurrà gli effetti delle frane.', moodDelta: 3, trustDelta: 5, frontierPerk: 'mountain-shelters' },
    { id: 'grant-mining-charter', label: 'Concedi la licenza mineraria', detail: 'Le cave di frontiera estrarranno più pietra dalle riserve conosciute.', reward: { stone: 8 }, moodDelta: -1, trustDelta: 1, frontierPerk: 'mountain-charter' },
  ]);
  if (id === 'lake-expedition') return event(id, 'Gli abitanti del lago', 'I pescatori del Lago velato conoscono i canali, ma non si fidano ancora del Consiglio. Puoi condividere i vantaggi o imporre dazi al traghetto.', [
    { id: 'lake-cooperative', label: 'Accordo con i pescatori', detail: 'Le peschiere renderanno di più e il territorio recupererà più rapidamente.', moodDelta: 5, trustDelta: 5, frontierPerk: 'lake-cooperative' },
    { id: 'lake-tolls', label: 'Imponi un dazio al traghetto', detail: 'I posti commerciali al lago guadagneranno più monete, ma la cooperazione sarà fragile.', reward: { coins: 7 }, moodDelta: -2, trustDelta: -3, frontierPerk: 'lake-tolls' },
  ]);
  if (id === 'border-expedition') return event(id, 'Una frontiera senza legge', 'Oltre il confine si incontrano mercanti, famiglie in transito e predoni. Il Consiglio deve scegliere tra commerciare apertamente o fortificare la strada.', [
    { id: 'border-customs', label: 'Apri una dogana', detail: 'I posti commerciali produrranno più monete e renderanno stabile lo scambio con Porto Salmastra.', moodDelta: 3, trustDelta: 4, frontierPerk: 'border-customs' },
    { id: 'border-watch', label: 'Fortifica il confine', detail: 'Le torri ridurranno il rischio delle incursioni e aumenteranno la stabilità locale.', cost: { wood: 5, stone: 4 }, moodDelta: 2, trustDelta: 3, frontierPerk: 'border-watch' },
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
  const mixed = Math.imul(seed ^ Math.imul(gameMinutes + 1, 2654435761), 2246822519) >>> 0;
  const chosen = choiceSets.find((entry) => entry.id === id) ?? choiceSets[mixed % choiceSets.length]!;
  return chosen;
}

function chooseDynamicEvent(state: GameState): string {
  const world = state.world;
  const weights = ([
    ['drought', state.resources.food < 18 ? 5 : world?.weather.id === 'drought' ? 0 : 1],
    ['caravan', state.buildings.some((building) => building.type === 'market' && building.construction?.kind !== 'build') || (world?.tradeRoutes.length ?? 0) > 0 ? 4 : 2],
    ['wanderer', housing(state) > state.population ? 4 : 1],
    ['wolves', world?.policies.guard === 'none' ? 3 : 1 + ((world?.forestHealth ?? 100) < 35 ? 2 : 0)],
    ['fair', state.buildings.some((building) => building.type === 'market' && building.construction?.kind !== 'build') ? 4 : 1],
  ] as Array<[string, number]>).filter((entry) => entry[1] > 0);
  const total = weights.reduce((sum, item) => sum + item[1], 0);
  const mixed = Math.imul(state.seed ^ Math.imul(state.gameMinutes + 1, 2654435761), 2246822519) >>> 0;
  let roll = mixed % Math.max(1, total);
  for (const [id, weight] of weights) { if (roll < weight) return id; roll -= weight; }
  return 'wanderer';
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

export function goodsStorageCapacity(state: GameState): number {
  return 100 + state.buildings.filter((building) => building.type === 'warehouse' && building.construction?.kind !== 'build').reduce((total, building) => total + 80 * building.level, 0);
}

export function totalStoredGoods(goods: GoodsBag): number {
  return (Object.keys(goods) as Array<keyof GoodsBag>).reduce((total, good) => total + Math.max(0, Number.isFinite(goods[good]) ? goods[good] : 0), 0);
}

function clampGoodsToCapacity(input: GoodsBag, capacity: number): GoodsBag {
  const goods: GoodsBag = {
    grain: Math.max(0, Number.isFinite(input.grain) ? input.grain : 0),
    flour: Math.max(0, Number.isFinite(input.flour) ? input.flour : 0),
    bread: Math.max(0, Number.isFinite(input.bread) ? input.bread : 0),
    tools: Math.max(0, Number.isFinite(input.tools) ? input.tools : 0),
    medicine: Math.max(0, Number.isFinite(input.medicine) ? input.medicine : 0),
  };
  let excess = Math.max(0, totalStoredGoods(goods) - Math.max(0, capacity));
  const reductionOrder: Array<keyof GoodsBag> = ['bread', 'flour', 'grain', 'medicine', 'tools'];
  for (const good of reductionOrder) {
    if (excess <= 0) break;
    const removed = Math.min(goods[good], excess);
    goods[good] -= removed;
    excess -= removed;
  }
  return goods;
}

const RAW_RESOURCE_BASE_PRICES: Record<MarketResource, number> = { wood: 2, stone: 3, food: 2 };
export function getResourcePurchasePrice(state: GameState, resource: MarketResource): number {
  const quantity = state.resources[resource];
  const scarcity = quantity < 12 ? 1.45 : quantity < 30 ? 1.2 : quantity > 80 ? 0.8 : 1;
  const relatedGood: TradableGood = resource === 'food' ? 'grain' : 'tools';
  const demand = state.world?.market.demand[relatedGood] ?? 1;
  const demandFactor = 0.85 + demand * 0.2;
  return Math.max(1, Math.round(RAW_RESOURCE_BASE_PRICES[resource] * scarcity * demandFactor));
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
  return state.buildings.reduce((total, building) => total + (building.construction?.kind === 'build' ? 0 : (BUILDINGS[building.type].housing ?? 0) * building.level), 0)
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
  let frontierTerritories = world.frontierTerritories.map((territory) => ({
    ...territory, stock: { ...territory.stock }, structures: territory.structures.map((structure) => ({ ...structure })),
    activeIncident: territory.activeIncident ? { ...territory.activeIncident } : null,
  }));
  let frontierResearch = 0;
  const activeExpeditions = world.expeditions.filter((expedition) => expedition.status === 'active');
  const hasFoodRation = resources.food > 0.1;
  const rationDemand = Math.max(0.01, state.population * 0.008);
  // Bread complements the basic food reserve; when it runs out, bread becomes the fallback ration.
  const breadRation = Math.min(goods.bread, rationDemand * (hasFoodRation ? 0.12 : 1));
  goods.bread = Math.max(0, Math.round((goods.bread - breadRation) * 1000) / 1000);
  const rationCoverage = hasFoodRation ? 1 : Math.min(1, breadRation / rationDemand);
  citizens = citizens.map((citizen) => {
    if (citizen.status === 'exploring') return { ...citizen, activity: 'exploring', energy: clamp(citizen.energy - 0.055), hunger: clamp(citizen.hunger + 0.05) };
    const workplace = getCitizenWorkplace(state, citizen);
    const breadMealBonus = breadRation > 0 && hasFoodRation ? 0.035 : 0;
    const hungerDelta = (rationCoverage >= 1 ? -0.18 : 0.16 - 0.34 * rationCoverage) - breadMealBonus;
    const hunger = clamp(citizen.hunger + hungerDelta);
    const activity = getCitizenActivity({ ...state, resources, world: { ...world, goods } }, { ...citizen, hunger });
    const atWork = activity === 'working' && !!workplace;
    const energy = clamp(citizen.energy + (activity === 'resting' ? 0.16 : atWork ? (citizen.traits.includes('ambizioso') ? -0.075 : -0.06) : 0.025) - (citizen.illness ? 0.025 : 0));
    let happiness = citizen.happiness;
    if ((rationCoverage === 0 && resources.food < 0.1) || hunger > 80) happiness -= citizen.traits.includes('generoso') ? 0.09 : 0.12;
    else if (hunger < 45 && (state.community?.morale ?? 60) >= 60) happiness += 0.025;
    if (breadRation > 0 && state.gameMinutes % 10 === 0) happiness += 0.06;
    if (citizen.traits.includes('ambizioso') && atWork) happiness += 0.018;
    if (citizen.traits.includes('generoso') && (state.community?.morale ?? 60) >= 60) happiness += 0.012;
    let health = citizen.health;
    if (hunger > 90) health -= 0.035;
    else if (hunger < 45) health += citizen.traits.includes('paziente') ? 0.012 : 0.008;
    if (citizen.illness) {
      health -= citizen.illness.severity === 2 ? 0.05 : 0.025;
      happiness -= citizen.illness.severity === 2 ? 0.035 : 0.015;
    }
    if (citizen.age >= 70 && state.gameMinutes % 1440 === 0) health -= 0.08;
    const skills = { ...citizen.skills };
    if (atWork) {
      const traitMultiplier = (citizen.traits.includes('pratico') ? 1.25 : 1)
        * (citizen.traits.includes('ambizioso') ? 1.35 : 1)
        * (citizen.traits.includes('curioso') && workplace && ['school', 'university'].includes(workplace.type) ? 1.3 : 1);
      skills[citizen.profession] = clamp(skills[citizen.profession] + (world.researched.includes('education') ? 0.018 : 0.01) * traitMultiplier, 0, 100);
    }
    let illness = citizen.illness ?? null;
    let lastAction = citizen.lastAction;
    let personalHistory = citizen.personalHistory ?? [];
    if (illness && state.gameMinutes - illness.since >= (citizen.traits.includes('paziente') ? 180 : 240) && health > 25) {
      illness = null;
      health = clamp(health + 8);
      happiness = clamp(happiness + 2);
      lastAction = 'Si è ripreso da una malattia';
      personalHistory = rememberCitizen(citizen, 'È guarito dopo alcuni giorni di riposo.');
      notes.push(citizen.name + ' è guarito dalla malattia senza cure straordinarie.');
    }
    return { ...citizen, illness, personalHistory, lastAction, activity, hunger, energy, happiness: clamp(happiness), health: clamp(health), skills, experience: citizen.experience + (atWork ? 0.002 : 0) };
  });

  if (state.gameMinutes > 0 && state.gameMinutes % 60 === 0 && goods.medicine >= 1) {
    const patient = citizens.filter((citizen) => citizen.status === 'resident' && (citizen.illness || citizen.health < 92))
      .sort((a, b) => Number(!!b.illness) - Number(!!a.illness) || a.health - b.health)[0];
    if (patient) {
      goods.medicine -= 1;
      const curedIllness = !!patient.illness;
      citizens = citizens.map((citizen) => citizen.id === patient.id ? {
        ...citizen, illness: null, health: clamp(citizen.health + 22),
        lastAction: curedIllness ? 'È guarito grazie a un rimedio del dispensario' : 'Ha ricevuto un rimedio dal dispensario',
        personalHistory: rememberCitizen(citizen, curedIllness ? 'Il dispensario lo ha curato dalla malattia.' : 'Il dispensario lo ha aiutato a recuperare le forze.'),
      } : citizen);
      notes.push('Il dispensario ha usato 1 rimedio per aiutare ' + patient.name + (curedIllness ? ' a guarire e recuperare 22 punti salute.' : ' a recuperare 22 punti salute.'));
    }
  }

  if (state.gameMinutes > 0 && state.gameMinutes % 360 === 0) {
    const candidates = citizens.filter((citizen) => citizen.status === 'resident' && !citizen.illness);
    const candidate = [...candidates].sort((a, b) => (a.health - a.hunger * 0.2) - (b.health - b.hunger * 0.2))[0];
    if (candidate) {
      const seasonalRisk = getSeason(state.gameMinutes).id === 'winter' ? 8 : 0;
      const risk = Math.max(5, Math.min(70,
        (100 - candidate.health) * 0.55 + candidate.hunger * 0.2 + (candidate.age >= 65 ? 8 : 0)
        + seasonalRisk - (candidate.traits.includes('prudente') ? 10 : 0) - (candidate.traits.includes('paziente') ? 3 : 0)));
      const idHash = candidate.id.split('').reduce((sum, character) => sum + character.charCodeAt(0), 0);
      const roll = Math.abs(state.seed * 17 + state.gameMinutes * 13 + idHash * 7) % 100;
      if (roll < risk) {
        const severity = roll < risk * 0.28 ? 2 : 1;
        const illness: CitizenIllness = { id: severity === 2 ? 'fever' : 'cold', severity, since: state.gameMinutes };
        citizens = citizens.map((citizen) => citizen.id === candidate.id ? {
          ...citizen, illness, health: clamp(citizen.health - (severity === 2 ? 3 : 1)),
          happiness: clamp(citizen.happiness - 2),
          lastAction: severity === 2 ? 'È a letto con la febbre' : 'Sta riposando per un raffreddore',
          personalHistory: rememberCitizen(citizen, severity === 2 ? 'Si è ammalato di febbre; il recupero richiederà riposo o cure.' : 'Ha preso un raffreddore e ha bisogno di riposo.'),
        } : citizen);
        notes.push(candidate.name + (severity === 2 ? ' ha la febbre: la malattia riduce energia e salute finché non guarisce.' : ' ha preso un raffreddore e dovrà riposare per riprendersi.'));
      }
    }
  }

  const labourState: GameState = { ...state, world: { ...world, citizens } };
  const farms = state.buildings.filter((building) => building.type === 'farm' && building.construction?.kind !== 'build');
  const farmSeason = getSeason(state.gameMinutes);
  for (const farm of farms) {
    const workers = citizens.filter((citizen) => citizen.profession === 'farmer' && citizen.status === 'resident' && getCitizenWorkplace(labourState, citizen)?.id === farm.id).length;
    if (!workers) continue;
    const produced = Math.min(0.085 * farm.level * worldBuildingMultiplier(labourState, farm), workers * 0.06) * farmSeason.farmMultiplier;
    goods.grain += Math.max(0, produced);
  }
  const mills = state.buildings.filter((building) => building.type === 'mill' && building.construction?.kind !== 'build');
  for (const mill of mills) {
    const workers = citizens.filter((citizen) => citizen.profession === 'miller' && citizen.status === 'resident' && getCitizenWorkplace(labourState, citizen)?.id === mill.id).length;
    if (!workers || goods.grain <= 0) continue;
    const produced = Math.min(goods.grain, Math.min(0.14 * mill.level * worldBuildingMultiplier(labourState, mill), workers * 0.11));
    goods.grain -= produced; goods.flour += produced;
  }
  const bakeries = state.buildings.filter((building) => building.type === 'bakery' && building.construction?.kind !== 'build');
  for (const bakery of bakeries) {
    const workers = citizens.filter((citizen) => citizen.profession === 'baker' && citizen.status === 'resident' && getCitizenWorkplace(labourState, citizen)?.id === bakery.id).length;
    if (!workers || goods.flour <= 0) continue;
    const produced = Math.min(goods.flour, Math.min(0.14 * bakery.level * worldBuildingMultiplier(labourState, bakery), workers * 0.11));
    goods.flour -= produced; goods.bread += produced;
  }
  const workshops = state.buildings.filter((building) => building.type === 'workshop' && building.construction?.kind !== 'build');
  const staffedWorkshops = workshops.filter((workshop) => citizens.some((citizen) => citizen.profession === 'artisan' && citizen.status === 'resident' && getCitizenWorkplace(labourState, citizen)?.id === workshop.id)).length;
  const toolBatch = Math.min(staffedWorkshops, Math.floor(resources.wood / 2), Math.floor(resources.stone));
  if (toolBatch > 0 && state.gameMinutes % 45 === 0) {
    resources.wood -= 2 * toolBatch; resources.stone -= toolBatch; goods.tools += toolBatch;
    notes.push(toolBatch === 1 ? 'L’officina ha completato un nuovo attrezzo.' : 'Le officine hanno completato ' + toolBatch + ' nuovi attrezzi.');
  }
  Object.assign(goods, clampGoodsToCapacity(goods, goodsStorageCapacity(state)));
  if (state.gameMinutes > 0 && state.gameMinutes % 180 === 0 && goods.tools >= 1) {
    const activeProduction = state.buildings.some((building) => ['farm', 'sawmill', 'quarry', 'mill', 'bakery', 'workshop'].includes(building.type)
      && building.construction?.kind !== 'build'
      && citizens.some((citizen) => citizen.status === 'resident' && getCitizenWorkplace(labourState, citizen)?.id === building.id));
    if (activeProduction) {
      goods.tools -= 1;
      notes.push('Un attrezzo è stato consumato per la manutenzione delle botteghe e delle macchine.');
    }
  }

  if (state.gameMinutes > 0 && state.gameMinutes % 30 === 0 && citizens.length > 1) {
    const nextCitizens = citizens.map((citizen) => ({ ...citizen, relationships: { ...citizen.relationships } }));
    for (let left = 0; left < nextCitizens.length; left++) {
      for (let right = left + 1; right < nextCitizens.length; right++) {
        const a = nextCitizens[left]!;
        const b = nextCitizens[right]!;
        const sameWorkplace = !!getCitizenWorkplace(state, a)?.id && getCitizenWorkplace(state, a)?.id === getCitizenWorkplace(state, b)?.id;
        let delta = a.profession === b.profession ? 1 : 0;
        if (sameWorkplace) delta += 1;
        if (a.familyId === b.familyId) delta += 2;
        if (a.traits.includes('socievole') || b.traits.includes('socievole')) delta += 2;
        if ((a.traits.includes('generoso') || b.traits.includes('generoso')) && resources.food >= 18) delta += 1;
        if ((a.traits.includes('curioso') && b.profession === 'scholar') || (b.traits.includes('curioso') && a.profession === 'scholar')) delta += 1;
        if (a.traits.includes('ambizioso') && b.traits.includes('ambizioso')) delta -= sameWorkplace ? 3 : 1;
        else if (sameWorkplace && ((a.traits.includes('ambizioso') && b.traits.includes('paziente')) || (b.traits.includes('ambizioso') && a.traits.includes('paziente')))) delta -= 1;
        const prior = ((a.relationships[b.id] ?? 0) + (b.relationships[a.id] ?? 0)) / 2;
        const value = Math.max(-100, Math.min(100, prior + delta));
        a.relationships[b.id] = value;
        b.relationships[a.id] = value;
        if (prior < 25 && value >= 25) {
          a.personalHistory = rememberCitizen(a, 'È diventato amico di ' + b.name + '.');
          b.personalHistory = rememberCitizen(b, 'È diventato amico di ' + a.name + '.');
          notes.push(a.name + ' e ' + b.name + ' sono diventati amici.');
        } else if (prior > -15 && value <= -15) {
          a.personalHistory = rememberCitizen(a, 'È nata una rivalità con ' + b.name + '.');
          b.personalHistory = rememberCitizen(b, 'È nata una rivalità con ' + a.name + '.');
          notes.push(a.name + ' e ' + b.name + ' sono entrati in contrasto.');
        }
      }
    }
    citizens = nextCitizens.map((citizen) => {
      const ties = Object.values(citizen.relationships);
      const average = ties.reduce((sum, value) => sum + value, 0) / Math.max(1, ties.length);
      const nearest = ties.length ? Math.max(...ties) : 0;
      const isolationPenalty = ties.length > 0 && nearest < -15 ? -0.22 : 0;
      return { ...citizen, happiness: clamp(citizen.happiness + (average > 20 ? 0.18 : average < -15 ? -0.18 : 0) + (citizen.traits.includes('socievole') && nearest >= 25 ? 0.08 : 0) + isolationPenalty) };
    });
  }
  const routineState: GameState = { ...state, resources, world: { ...world, citizens, goods } };
  citizens = citizens.map((citizen) => {
    if (citizen.status === 'exploring') return { ...citizen, activity: 'exploring', lastAction: 'È in spedizione' };
    const activity = getCitizenActivity(routineState, citizen);
    return { ...citizen, activity, lastAction: state.gameMinutes % 20 === 0 ? CITIZEN_ACTIVITY_LABELS[activity] : citizen.lastAction };
  });
  let nextPopulation = state.population;
  let nextCitizenId = world.nextCitizenId;
  if (state.gameMinutes > 0 && state.gameMinutes % (1440 * 7) === 0) {
    const availableJobs = [...new Set(state.buildings.map((building) => BUILDING_JOB[building.type]).filter((job): job is Profession => !!job))];
    const jobNeed = (job: Profession): number => {
      const workers = citizens.filter((person) => person.profession === job && person.age >= 14 && person.status === 'resident').length;
      const shortage = job === 'farmer' ? (resources.food < 18 ? 100 : resources.food < 40 ? 55 : goods.grain < 4 ? 22 : 5)
        : job === 'lumberjack' ? (resources.wood < 8 ? 80 : resources.wood < 20 ? 36 : 5)
        : job === 'miner' ? (resources.stone < 6 ? 70 : resources.stone < 16 ? 30 : 4)
        : job === 'merchant' ? (resources.coins < 10 ? 45 : 8)
        : job === 'baker' ? (goods.flour > 5 ? 38 : 3)
        : job === 'miller' ? (goods.grain > 8 ? 32 : 2)
        : job === 'scholar' ? (world.activeResearch ? 28 : 8)
        : job === 'scout' ? (world.discoveredRegions.length < REGIONS.length ? 18 : 4)
        : job === 'artisan' ? (state.buildings.some((building) => building.type === 'workshop' && building.construction?.kind !== 'build') ? 18 : 2)
        : 8;
      return shortage - workers * 3;
    };
    citizens = citizens.map((citizen) => {
      if (citizen.age < 14 || citizen.status !== 'resident' || citizen.workplaceId
        || !citizen.traits.some((trait) => ['pratico', 'ambizioso', 'curioso', 'inventivo'].includes(trait))) return citizen;
      const target = [...availableJobs].sort((a, b) => jobNeed(b) - jobNeed(a)
        || citizens.filter((person) => person.profession === a).length - citizens.filter((person) => person.profession === b).length)[0];
      if (!target || target === citizen.profession) return citizen;
      const currentProfessionHasWorkplace = availableJobs.includes(citizen.profession);
      if (currentProfessionHasWorkplace && jobNeed(target) < jobNeed(citizen.profession) + 18) return citizen;
      return {
        ...citizen, profession: target, workplaceId: null,
        lastAction: 'Ha cambiato mestiere per rispondere ai bisogni del borgo: ' + PROFESSION_LABELS[target],
        personalHistory: rememberCitizen(citizen, 'Ha imparato il mestiere di ' + PROFESSION_LABELS[target] + ' per aiutare il borgo.'),
      };
    });
  }
  if (state.gameMinutes > 0 && state.gameMinutes % (1440 * 30) === 0) {
    citizens = citizens.map((citizen) => ({ ...citizen, age: citizen.age + 1 }));
    const elderly = citizens.filter((citizen) => citizen.status === 'resident' && citizen.age >= 95 && (citizen.age >= 105 || citizen.health <= 20));
    const deceased = elderly.slice(0, Math.max(0, citizens.filter((citizen) => citizen.status === 'resident').length - 1));
    if (deceased.length) {
      const deceasedIds = new Set(deceased.map((citizen) => citizen.id));
      for (const elder of deceased) notes.push('Il borgo ha salutato ' + elder.name + ', dopo una lunga vita di ' + elder.age + ' anni. La sua storia resta nella cronaca.');
      citizens = citizens.filter((citizen) => !deceasedIds.has(citizen.id)).map((citizen) => {
        const lostFamily = deceased.find((elder) => elder.familyId === citizen.familyId);
        const relationships = Object.fromEntries(Object.entries(citizen.relationships).filter(([id]) => !deceasedIds.has(id)));
        return lostFamily ? {
          ...citizen, relationships, happiness: clamp(citizen.happiness - 8),
          lastAction: 'Sta elaborando il lutto per un familiare',
          personalHistory: rememberCitizen(citizen, 'Ha perso un familiare: ' + lostFamily.name + '.'),
        } : { ...citizen, relationships };
      });
      nextPopulation = Math.max(1, nextPopulation - deceased.length);
      if (community) { community.morale = clamp(community.morale - Math.min(8, deceased.length * 3)); community.trust = clamp(community.trust - Math.min(4, deceased.length)); }
    }
    const averageHappiness = citizens.reduce((sum, citizen) => sum + citizen.happiness, 0) / Math.max(1, citizens.length);
    const families = new Map<string, Citizen[]>();
    citizens.filter((citizen) => citizen.age >= 18 && citizen.age <= 45 && citizen.status === 'resident').forEach((citizen) => families.set(citizen.familyId, [...(families.get(citizen.familyId) ?? []), citizen]));
    const family = [...families.values()].find((members) => members.length >= 2);
    if (family && nextPopulation < housing(state) && resources.food >= 18 && averageHappiness >= 72) {
      const child = makeCitizen(state.seed, nextCitizenId - 1, state.gameMinutes);
      child.id = 'citizen-' + nextCitizenId; child.age = 0; child.profession = 'farmer'; child.skills.farmer = 3;
      child.traits = [family[0]!.traits[0]!, family[1]!.traits[0]!]; child.familyId = family[0]!.familyId; child.homeId = family[0]!.homeId;
      child.parentIds = [family[0]!.id, family[1]!.id];
      child.personalHistory = ['È nato nel borgo, figlio di ' + family[0]!.name + ' e ' + family[1]!.name + '.'];
      child.lastAction = 'È nato in una famiglia del borgo';
      citizens = citizens.map((citizen) => family.some((parent) => parent.id === citizen.id)
        ? { ...citizen, lastAction: 'Ha accolto una nuova nascita in famiglia', personalHistory: rememberCitizen(citizen, 'È diventato genitore di una nuova generazione nel borgo.') }
        : citizen);
      citizens.push(child); nextPopulation++; nextCitizenId++;
      notes.push('È nato un bambino nella famiglia ' + child.familyId + ': ' + family[0]!.name + ' e ' + family[1]!.name + ' diventano genitori.');
    }
  }
  if (state.gameMinutes > 0 && state.gameMinutes % 120 === 0 && state.population > 5 && nextPopulation === state.population) {
    const averageHappiness = citizens.reduce((sum, citizen) => sum + citizen.happiness, 0) / Math.max(1, citizens.length);
    if (averageHappiness < 25) {
      const leaving = [...citizens].filter((citizen) => citizen.status !== 'exploring').sort((a, b) => a.happiness - b.happiness)[0];
      if (leaving) {
        citizens = citizens.filter((citizen) => citizen.id !== leaving.id);
        nextPopulation = Math.max(5, nextPopulation - 1);
        notes.push(leaving.name + ' ha lasciato il borgo perché non si sentiva più a casa.');
        if (community) { community.morale = clamp(community.morale - 4); community.trust = clamp(community.trust - 3); }
      }
    }
  }

  frontierTerritories = frontierTerritories.map((territory) => territory.activeIncident && territory.activeIncident.endsAt <= state.gameMinutes
    ? { ...territory, activeIncident: null }
    : territory);

  if (state.gameMinutes > 0 && state.gameMinutes % 60 === 0 && frontierTerritories.length) {
    frontierTerritories = frontierTerritories.map((territory) => {
      const profile = FRONTIER_PROFILES[territory.region];
      const stock = { ...territory.stock };
      const towers = territory.structures.filter((structure) => structure.type === 'watchtower').reduce((sum, structure) => sum + structure.level, 0);
      let stability = clamp(territory.stability + 0.25 + towers * 0.7 + (territory.region === 'lake' && world.frontierPerks.includes('lake-cooperative') ? 0.3 : 0));
      const incidentPenalty = territory.activeIncident && territory.activeIncident.endsAt > state.gameMinutes ? territory.activeIncident.outputPenalty : 1;
      const factor = Math.max(0.35, Math.min(1, 0.45 + stability / 180)) * incidentPenalty;
      for (const structure of territory.structures) {
        const definition = FRONTIER_STRUCTURES[structure.type];
        if (structure.type === 'watchtower') continue;
        let output = definition.amount * structure.level;
        if (structure.type === 'outpost') {
          const localResource = profile.reserveResource;
          const harvested = Math.min(stock[localResource], Math.max(1, Math.floor(factor)));
          stock[localResource] -= harvested;
          resources[localResource] += harvested;
          continue;
        }
        if (structure.type === 'lumberCamp' && world.frontierPerks.includes('forest-contract')) output *= 1.3;
        if (structure.type === 'quarry' && world.frontierPerks.includes('mountain-charter')) output *= 1.25;
        if (structure.type === 'fishery' && world.frontierPerks.includes('lake-cooperative')) output *= 1.25;
        if (structure.type === 'tradingPost' && world.frontierPerks.includes('lake-tolls') && territory.region === 'lake') output += 2;
        if (structure.type === 'tradingPost' && world.frontierPerks.includes('border-customs') && territory.region === 'borderlands') output += 3;
        if (structure.type === 'archive' && world.frontierPerks.includes('archive-network')) output += 2;
        const amount = Math.max(1, Math.floor(output * factor));
        if (definition.output === 'research') {
          frontierResearch += amount;
        } else if (definition.output === 'coins') {
          resources.coins += amount;
        } else if (definition.output && definition.output !== 'stability') {
          const key = definition.output;
          const harvested = Math.min(stock[key], amount);
          stock[key] -= harvested;
          resources[key] += harvested;
        }
      }
      return { ...territory, stock, stability };
    });
  }

  if (state.gameMinutes > 0 && state.gameMinutes % 360 === 0) {
    frontierTerritories = frontierTerritories.map((territory) => {
      const profile = FRONTIER_PROFILES[territory.region];
      const stock = { ...territory.stock };
      if (territory.region === 'forest' && world.frontierPerks.includes('forest-reserve')) {
        stock.wood = Math.min(profile.stock.wood, stock.wood + 6);
      }
      const active = territory.activeIncident && territory.activeIncident.endsAt > state.gameMinutes;
      if (active || state.gameMinutes - territory.lastIncidentAt < 360) return { ...territory, stock };
      const towers = territory.structures.filter((structure) => structure.type === 'watchtower').reduce((sum, structure) => sum + structure.level, 0);
      let risk = profile.risk + (100 - territory.stability) * 0.22 - towers * 11 - (world.policies.guard === 'patrol' ? 6 : 0);
      if (territory.region === 'forest' && world.frontierPerks.includes('forest-reserve')) risk -= 6;
      if (territory.region === 'forest' && world.frontierPerks.includes('forest-contract')) risk += 5;
      if (territory.region === 'mountains' && world.frontierPerks.includes('mountain-shelters')) risk -= 8;
      if (territory.region === 'borderlands' && world.frontierPerks.includes('border-watch')) risk -= 12;
      risk = Math.max(3, Math.min(55, risk));
      const regionHash = territory.region.split('').reduce((sum, character) => sum + character.charCodeAt(0), 0);
      const roll = Math.abs(state.seed * 19 + state.gameMinutes * 7 + regionHash * 13) % 100;
      if (roll >= risk) return { ...territory, stock };
      const incidentProfile = FRONTIER_INCIDENTS[territory.region];
      const lossResource = incidentProfile.loss;
      const lost = Math.min(stock[lossResource], Math.ceil(stock[lossResource] * (territory.region === 'borderlands' ? 0.18 : 0.12)));
      stock[lossResource] -= lost;
      const incident: FrontierIncident = {
        kind: incidentProfile.kind, title: incidentProfile.title, startedAt: state.gameMinutes,
        endsAt: state.gameMinutes + 180, outputPenalty: 0.5,
      };
      notes.push(incident.title + ' a ' + territory.name + ': la stabilità cala e la produzione sarà dimezzata per tre ore di gioco.');
      return { ...territory, stock, stability: clamp(territory.stability - 10), activeIncident: incident, lastIncidentAt: state.gameMinutes };
    });
  }

  if (state.gameMinutes > 0 && state.gameMinutes % 60 === 0) {
    for (const factionId of world.tradeRoutes) {
      if (factionId === 'selvalunga') resources.wood += 2;
      else if (factionId === 'salmastra') { resources.food += 3; resources.coins += 0.75; }
      else if (factionId === 'rocciacupa') { resources.stone += 2; resources.coins += 0.5; }
    }
    if (world.tradeRoutes.length && state.gameMinutes % 360 === 0) {
      notes.push('Le rotte diplomatiche hanno consegnato merci secondo gli accordi: legname da Selvalunga, provviste da Salmastra e pietra da Rocciacupa.');
    }
  }

  const assignedScholars = schoolScholarCount(state, citizens);
  let nextWorld: WorldState = {
    ...world, nextCitizenId, citizens, goods, frontierTerritories,
    researchPoints: world.researchPoints + 0.025 + assignedScholars * 0.09 + frontierResearch,
  };
  if (state.gameMinutes >= nextWorld.market.nextShiftAt) {
    nextWorld = { ...nextWorld, market: refreshMarket(state.seed, state.gameMinutes, nextWorld.market, goods, nextWorld.weather.id === 'drought' && state.gameMinutes < nextWorld.weather.endsAt, nextWorld.activeEvent?.id ?? null) };
    notes.push('La domanda del mercato è cambiata: le quotazioni di grano, pane e beni lavorati sono aggiornate.');
  }
  const scholars = assignedScholars;
  if (nextWorld.activeResearch) {
    const definition = RESEARCH.find((entry) => entry.id === nextWorld.activeResearch);
    if (definition) {
      nextWorld = { ...nextWorld, researchProgress: nextWorld.researchProgress + 0.24 + scholars * 0.43 + (nextWorld.completedProjects.includes('grand-archive') ? 0.12 : 0) + (state.buildings.some((building) => building.type === 'university' && building.construction?.kind !== 'build') ? 0.45 : 0) + state.buildings.filter((building) => building.type === 'observatory' && building.construction?.kind !== 'build').reduce((sum, building) => sum + 0.18 * building.level, 0) };
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
    const crewIds = expedition.crewIds?.length ? expedition.crewIds : [expedition.scoutId];
    const crewSkill = citizens.filter((citizen) => crewIds.includes(citizen.id)).reduce((sum, citizen) => sum + citizen.skills.scout, 0) / Math.max(1, crewIds.length);
    const roll = Math.abs(state.seed * 11 + crewSkill * 7 + expedition.startedAt * 13 + expedition.region.length * 3) % 100;
    const success = roll < expedition.successChance;
    citizens = citizens.map((citizen) => crewIds.includes(citizen.id) ? { ...citizen, status: 'resident', activity: 'resting', expeditionId: null, energy: clamp(citizen.energy + 18), lastAction: success ? 'È tornato da una spedizione' : 'È tornato stanco da una spedizione difficile' } : citizen);
    if (success) {
      const reward = expeditionReward(expedition.region);
      const firstDiscovery = !nextWorld.discoveredRegions.includes(expedition.region);
      Object.assign(resources, applyReward(resources, reward.resources));
      Object.assign(goods, applyGoods(goods, reward.goods));
      nextWorld = { ...nextWorld, discoveredRegions: [...new Set([...nextWorld.discoveredRegions, expedition.region])], researchPoints: nextWorld.researchPoints + reward.research };
      expedition = { ...expedition, status: 'success', outcome: reward.note };
      notes.push(reward.note);
      if (firstDiscovery) {
        const storyForRegion: Record<RegionId, string> = {
          forest: 'forest-expedition', mountains: 'mountain-expedition', lake: 'lake-expedition',
          'ancient-ruins': 'ruins-found', borderlands: 'border-expedition',
        };
        const storyId = storyForRegion[expedition.region];
        const eventQueue = [...(nextWorld.eventQueue ?? (nextWorld.queuedEvent ? [nextWorld.queuedEvent] : []))];
        if (nextWorld.activeEvent?.id !== storyId && !eventQueue.includes(storyId)) eventQueue.push(storyId);
        const queued = eventQueue.slice(0, 16);
        nextWorld = { ...nextWorld, eventQueue: queued, queuedEvent: queued[0] ?? null, nextEventAt: Math.min(nextWorld.nextEventAt, state.gameMinutes + 45) };
        if (expedition.region === 'borderlands') {
          nextWorld = { ...nextWorld, factions: nextWorld.factions.map((faction) => faction.id === 'salmastra' ? { ...faction, relation: clamp(faction.relation + 8) } : faction) };
        }
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
    const sawmillLevels = state.buildings.filter((building) => building.type === 'sawmill' && building.construction?.kind !== 'build').reduce((sum, building) => sum + building.level, 0);
    const forestChange = world.policies.forest === 'protected' ? 0.6 - sawmillLevels * 0.08 : world.policies.forest === 'managed' ? 0.12 - sawmillLevels * 0.42 : -0.35 - sawmillLevels * 1.25;
    const forestHealth = clamp(world.forestHealth + forestChange);
    nextWorld = { ...nextWorld, forestHealth };
    const workshopsForMedicine = state.buildings.filter((building) => building.type === 'workshop' && building.construction?.kind !== 'build');
    const schoolsForMedicine = state.buildings.filter((building) => building.type === 'school' && building.construction?.kind !== 'build');
    const medicineLabState: GameState = { ...state, world: { ...world, citizens } };
    const artisansForMedicine = workshopsForMedicine.some((workshop) => citizens.some((citizen) => citizen.profession === 'artisan' && citizen.status === 'resident' && getCitizenWorkplace(medicineLabState, citizen)?.id === workshop.id));
    const scholarsForMedicine = schoolsForMedicine.some((school) => citizens.some((citizen) => citizen.profession === 'scholar' && citizen.status === 'resident' && getCitizenWorkplace(medicineLabState, citizen)?.id === school.id));
    if (workshopsForMedicine.length > 0 && schoolsForMedicine.length > 0 && artisansForMedicine && scholarsForMedicine && goods.grain >= 1 && goods.medicine < 20) {
      goods.grain -= 1; goods.medicine += 1;
      notes.push('Artigiani e studiosi hanno preparato un rimedio usando le scorte botaniche.');
    }
    const warehouseLevels = state.buildings.filter((building) => building.type === 'warehouse' && building.construction?.kind !== 'build').reduce((sum, building) => sum + building.level, 0);
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
  Object.assign(goods, clampGoodsToCapacity(goods, goodsStorageCapacity(state)));
  nextWorld = { ...nextWorld, goods: { ...goods } };
  const now = state.gameMinutes;
  if (nextWorld.weather.id === 'drought' && now >= nextWorld.weather.endsAt) {
    nextWorld = { ...nextWorld, weather: { id: 'clear', endsAt: 0 } };
    notes.push('La siccità è terminata: i raccolti possono riprendersi.');
  }
  if (!nextWorld.activeEvent && now >= nextWorld.nextEventAt) {
    const queue = nextWorld.eventQueue ?? (nextWorld.queuedEvent ? [nextWorld.queuedEvent] : []);
    const queuedId = queue[0];
    const id = queuedId ?? nextWorld.queuedEvent ?? chooseDynamicEvent({ ...state, resources, world: nextWorld });
    const possibleActors = nextWorld.citizens.filter((citizen) => citizen.status === 'resident');
    const actor = possibleActors.length
      ? possibleActors[Math.abs(Math.trunc(state.seed * 7 + now * 13)) % possibleActors.length]
      : undefined;
    const created = eventTemplate(id, now, state.seed, actor);
    const remainingQueue = queuedId ? queue.slice(1) : queue;
    nextWorld = { ...nextWorld, activeEvent: created, eventQueue: remainingQueue, queuedEvent: remainingQueue[0] ?? null, nextEventAt: now + 360 };
    if (created.id === 'drought') nextWorld = { ...nextWorld, weather: { id: 'drought', endsAt: now + 180 } };
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

  if ((action.type === 'research' || action.type === 'expedition' || action.type === 'project' || action.type === 'diplomacy' || action.type === 'colonize' || action.type === 'frontierBuild')
    && !isEpochUnlocked(state, 'borough')) {
    return fail('Queste decisioni si aprono nell’epoca del Borgo. Raggiungi 12 abitanti, apri un mercato e migliora un edificio.');
  }

  if (action.type === 'colonize') {
    if (!canColonizeRegion(state, action.id)) {
      if (!world.discoveredRegions.includes(action.id)) return fail('Prima devi esplorare con successo questo territorio. Le mappe non bastano: serve una spedizione di rientro.');
      if (world.frontierTerritories.some((territory) => territory.region === action.id)) return fail('In questo territorio esiste già un avamposto.');
      return fail('Fondare un avamposto richiede l’epoca del Borgo e una regione libera.');
    }
    const cost = frontierFoundingCost(action.id);
    if (!hasCost(resources, cost)) return fail('Materiali insufficienti per fondare l’avamposto: ' + Object.entries(cost).map(([key, amount]) => amount + ' ' + (key === 'wood' ? 'legname' : key === 'stone' ? 'pietra' : key === 'food' ? 'cibo' : 'monete')).join(', ') + '.');
    resources = pay(resources, cost);
    const territory = createFrontierTerritory(action.id, state.gameMinutes);
    world = { ...world, frontierTerritories: [...world.frontierTerritories, territory] };
    return finish('Avamposto fondato nel territorio: ' + territory.name + '. Ora puoi costruire sul suo terreno 5×5 e amministrarne le riserve locali.');
  }
  if (action.type === 'frontierBuild') {
    const territory = world.frontierTerritories.find((entry) => entry.region === action.region);
    if (!territory) return fail('Prima fonda un avamposto nel territorio.');
    if (!Number.isInteger(action.x) || !Number.isInteger(action.y) || action.x < 0 || action.y < 0 || action.x >= FRONTIER_GRID_SIZE || action.y >= FRONTIER_GRID_SIZE) return fail('Casella di frontiera non valida.');
    if (territory.structures.some((entry) => entry.x === action.x && entry.y === action.y)) return fail('La casella è già occupata da una struttura.');
    if (!FRONTIER_STRUCTURES[action.structure] || !frontierStructureAllowed(action.region, action.structure)) return fail('Questa struttura non è adatta al territorio scelto.');
    const definition = FRONTIER_STRUCTURES[action.structure];
    if (!hasCost(resources, definition.cost)) return fail('Materiali insufficienti per costruire ' + definition.name + '.');
    resources = pay(resources, definition.cost);
    const structure: FrontierStructure = {
      id: 'frontier-' + action.region + '-' + action.structure + '-' + state.gameMinutes + '-' + action.x + '-' + action.y,
      type: action.structure, x: action.x, y: action.y, level: 1,
    };
    world = { ...world, frontierTerritories: world.frontierTerritories.map((entry) => entry.region === action.region ? { ...entry, structures: [...entry.structures, structure] } : entry) };
    return finish(definition.name + ' costruito in ' + territory.name + '. La produzione dipende dalle riserve e dalla stabilità locale.');
  }
  if (action.type === 'assign') {
    const citizen = world.citizens.find((entry) => entry.id === action.citizenId);
    if (!citizen) return fail('Questo cittadino non esiste più.');
    if (citizen.status === 'exploring') return fail('Il cittadino è in spedizione e non può cambiare mestiere.');
    if (citizen.age < 14) return fail('I cittadini sotto i 14 anni non vengono assegnati a un mestiere.');
    if (!PROFESSIONS.includes(action.value)) return fail('Mestiere non valido.');
    world = { ...world, citizens: world.citizens.map((entry) => entry.id === citizen.id ? { ...entry, profession: action.value, workplaceId: null, lastAction: 'Ha assunto il mestiere: ' + PROFESSION_LABELS[action.value] } : entry) };
    return finish(citizen.name + ' ora lavora come ' + PROFESSION_LABELS[action.value] + '.');
  }
  if (action.type === 'workplace') {
    const citizen = world.citizens.find((entry) => entry.id === action.citizenId);
    if (!citizen) return fail('Questo cittadino non esiste più.');
    if (citizen.status === 'exploring') return fail('Il cittadino è in spedizione e non può cambiare postazione.');
    if (action.buildingId === null) {
      world = { ...world, citizens: world.citizens.map((entry) => entry.id === citizen.id ? { ...entry, workplaceId: null } : entry) };
      return finish(citizen.name + ' seguirà di nuovo l’assegnazione automatica della postazione.');
    }
    const building = state.buildings.find((entry) => entry.id === action.buildingId && entry.construction?.kind !== 'build');
    if (!building || BUILDING_JOB[building.type] !== citizen.profession) return fail('La postazione deve essere un edificio compatibile con il mestiere del cittadino.');
    world = { ...world, citizens: world.citizens.map((entry) => entry.id === citizen.id ? { ...entry, workplaceId: building.id } : entry) };
    return finish(citizen.name + ' è stato assegnato a ' + BUILDINGS[building.type].shortName + '.');
  }
  if (action.type === 'law') {
    const policies = { ...world.policies };
    if (action.id === 'tax' && ['low', 'balanced', 'high'].includes(action.value)) policies.tax = action.value as TaxPolicy;
    else if (action.id === 'food' && ['reserve', 'balanced', 'generous'].includes(action.value)) policies.food = action.value as FoodPolicy;
    else if (action.id === 'forest' && ['protected', 'managed', 'intensive'].includes(action.value)) policies.forest = action.value as ForestPolicy;
    else if (action.id === 'guard' && ['none', 'patrol'].includes(action.value)) policies.guard = action.value as GuardPolicy;
    else return fail('Questa politica non è disponibile.');
    world = { ...world, policies };
    const opposition = getInterestGroups({ ...state, world }).filter((group) => group.support < 32 && group.influence >= 15).length;
    community = applyCommunityEffects(community, -Math.min(3, opposition), -Math.min(4, opposition));
    return finish('Il Consiglio ha adottato una nuova politica: ' + action.id + ' → ' + action.value + '. I gruppi d’interesse reagiscono in base alle proprie condizioni.');
  }
  if (action.type === 'research') {
    const research = RESEARCH.find((entry) => entry.id === action.id);
    if (!research) return fail('Ricerca sconosciuta.');
    if (world.researched.includes(research.id)) return fail('Questa conoscenza è già stata acquisita.');
    if (world.activeResearch) return fail('C’è già una ricerca in corso. Completa quella prima di iniziarne un’altra.');
    const unmetRequirement = researchRequirement(state, research);
    if (unmetRequirement) return fail(unmetRequirement);
    if (world.researchPoints < research.cost) return fail('Servono ' + research.cost + ' punti conoscenza. Ne hai ' + Math.floor(world.researchPoints) + '. Costruisci una scuola, assegna uno studioso o esplora il territorio.');
    resources = pay(resources, research.resourceCost ?? {});
    world = { ...world, researchPoints: world.researchPoints - research.cost, activeResearch: research.id, researchProgress: 0 };
    return finish('Il Consiglio ha avviato la ricerca: ' + research.name + '.');
  }
  if (action.type === 'expedition') {
    const region = REGIONS.find((entry) => entry.id === action.id);
    if (!region) return fail('Questa regione non esiste.');
    if (!regionUnlocked(world, region.id)) return fail('La regione è ancora sconosciuta. Esplora le aree vicine o sviluppa la cartografia.');
    const maxExpeditions = world.researched.includes('cartography') ? 2 : 1;
    if (world.expeditions.filter((entry) => entry.status === 'active').length >= maxExpeditions) return fail('Tutte le spedizioni disponibili sono già in viaggio.');
    const scout = world.citizens.find((citizen) => citizen.id === action.scoutId && citizen.profession === 'scout' && citizen.status === 'resident')
      ?? (action.scoutId ? undefined : world.citizens.find((citizen) => citizen.profession === 'scout' && citizen.status === 'resident'));
    if (!scout) return fail('Scegli un Esploratore disponibile come guida della spedizione.');
    const requestedCrew = [...new Set([scout.id, ...(action.crewIds ?? [])])];
    if (requestedCrew.length > 3) return fail('Una spedizione può partire con una guida e al massimo due compagni.');
    const crew = requestedCrew.map((id) => world.citizens.find((citizen) => citizen.id === id));
    if (crew.some((citizen) => !citizen || citizen.status !== 'resident')) return fail('Tutti i membri dell’equipaggio devono essere cittadini disponibili.');
    const crewMembers = crew.filter((citizen): citizen is Citizen => !!citizen);
    const minimumFood = 8 + Math.max(0, crewMembers.length - 1) * 3;
    const requestedFood = action.foodSupply ?? minimumFood;
    if (!Number.isFinite(requestedFood)) return fail('La quantità di provviste deve essere un numero valido.');
    const foodSupply = Math.floor(requestedFood);
    if (foodSupply < minimumFood || foodSupply > 50) return fail('Servono almeno ' + minimumFood + ' unità di cibo per questo equipaggio (massimo 50).');
    if (resources.food < foodSupply) return fail('La dispensa non contiene ' + foodSupply + ' unità di cibo per la spedizione.');
    const carriesTools = action.useTools === false ? false : world.goods.tools > 0;
    const requestedDuration = action.durationFactor ?? 1;
    if (!Number.isFinite(requestedDuration)) return fail('Il ritmo di viaggio non è valido.');
    const durationFactor = Math.max(0.75, Math.min(1.5, requestedDuration));
    resources.food -= foodSupply;
    const goods = { ...world.goods, tools: Math.max(0, world.goods.tools - (carriesTools ? 1 : 0)) };
    const averageSkill = crewMembers.reduce((sum, citizen) => sum + citizen.skills.scout, 0) / crewMembers.length;
    const durationBonus = durationFactor >= 1.25 ? 8 : durationFactor <= 0.75 ? -8 : 0;
    const chance = Math.min(98, Math.max(12, 45 + averageSkill * 0.45 + (crewMembers.length - 1) * 5 + (carriesTools ? 16 : 0) + (world.researched.includes('cartography') ? 10 : 0) + realmModifiers(state).guardProtection * 12 + durationBonus));
    const id = 'expedition-' + state.gameMinutes + '-' + scout.id + '-' + region.id;
    const tripDuration = Math.max(1, Math.ceil(region.duration * durationFactor));
    const expedition: Expedition = { id, region: region.id, scoutId: scout.id, crewIds: requestedCrew, foodSupply, usedTools: carriesTools, durationFactor, startedAt: state.gameMinutes, eta: state.gameMinutes + tripDuration, status: 'active', successChance: chance, outcome: 'La squadra è in viaggio.' };
    world = { ...world, goods, citizens: world.citizens.map((citizen) => requestedCrew.includes(citizen.id) ? { ...citizen, status: 'exploring', activity: 'exploring', expeditionId: id, lastAction: 'Esplora: ' + region.name } : citizen), expeditions: [...world.expeditions, expedition].slice(-8) };
    return finish('Spedizione partita: ' + region.name + ' con ' + crewMembers.length + ' persone. Rientro previsto tra circa ' + Math.ceil(tripDuration / 60) + ' minuti di gioco.');
  }
  if (action.type === 'project') {
    const project = PROJECTS.find((entry) => entry.id === action.id);
    if (!project) return fail('Progetto sconosciuto.');
    const stage = world.projectStages[project.id] ?? 0;
    if (stage >= 3) return fail('Il progetto è già completato.');
    const requirement = projectRequirement(state, project.id);
    if (requirement) return fail(requirement);
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
    const populationBeforeChoice = population;
    population = Math.max(5, population + (choice.populationDelta ?? 0));
    const appliedPopulationDelta = population - populationBeforeChoice;
    if (appliedPopulationDelta > 0) {
      const profession = choice.profession ?? 'farmer';
      const firstNewCitizenIndex = world.citizens.length;
      for (let index = 0; index < appliedPopulationDelta; index++) {
        world = addCitizenForState({ ...state, resources }, world, profession);
      }
      citizens = world.citizens.map((citizen, index) => index >= firstNewCitizenIndex
        ? { ...citizen, skills: { ...citizen.skills, [profession]: 24 }, lastAction: 'È arrivato grazie a un evento del regno' }
        : citizen);
    }
    if (appliedPopulationDelta < 0) citizens = citizens.slice(0, Math.max(0, citizens.length + appliedPopulationDelta));
    const participant = event.citizenId ? citizens.find((citizen) => citizen.id === event.citizenId) : undefined;
    if (participant) {
      const personalNote = 'Ha vissuto l’avvenimento «' + event.title + '»: il Consiglio ha scelto «' + choice.label + '».';
      citizens = citizens.map((citizen) => citizen.id === participant.id ? {
        ...citizen,
        happiness: clamp(citizen.happiness + (choice.moodDelta ?? 0) * 0.45),
        lastAction: 'Ha vissuto l’avvenimento: ' + event.title,
        personalHistory: rememberCitizen(citizen, personalNote),
      } : citizen);
    }
    const eventQueue = [...(world.eventQueue ?? (world.queuedEvent ? [world.queuedEvent] : []))];
    const alreadyQueued = eventQueue.length > 0;
    if (choice.chain && !eventQueue.includes(choice.chain)) eventQueue.push(choice.chain);
    const queued = eventQueue.slice(0, 16);
    const queuedEvent = queued[0] ?? null;
    const nextEventAt = alreadyQueued
      ? Math.min(world.nextEventAt, state.gameMinutes + 75)
      : choice.chain
        ? state.gameMinutes + 75
        : state.gameMinutes + 300;
    world = {
      ...world, citizens, goods, activeEvent: null, eventQueue: queued, queuedEvent, nextEventAt,
      researchPoints: world.researchPoints + (choice.researchDelta ?? 0),
      frontierPerks: choice.frontierPerk ? [...new Set([...world.frontierPerks, choice.frontierPerk])] : world.frontierPerks,
      weather: event.id === 'drought-recovery' ? { id: 'clear', endsAt: 0 } : world.weather,
    };
    community = applyCommunityEffects(community, choice.moodDelta ?? 0, choice.trustDelta ?? 0);
    return finish(event.title + ' — ' + choice.label + '. ' + choice.detail);
  }
  if (action.type === 'buyResource') {
    if (!state.buildings.some((building) => building.type === 'market' && building.construction?.kind !== 'build')) return fail('Costruisci un mercato prima di acquistare materie prime.');
    if (!world.citizens.some((citizen) => citizen.profession === 'merchant' && citizen.status === 'resident')) return fail('Assegna almeno un cittadino al mestiere Mercante per acquistare al mercato.');
    if (!['wood', 'stone', 'food'].includes(action.resource)) return fail('Questa materia prima non è acquistabile.');
    const amount = Math.floor(action.amount);
    if (!Number.isSafeInteger(action.amount) || amount < 1 || amount > 25) return fail('Puoi acquistare da 1 a 25 unità per volta.');
    const unitPrice = getResourcePurchasePrice(state, action.resource);
    const cost = unitPrice * amount;
    if (resources.coins < cost) return fail('Servono ' + cost + ' monete per acquistare ' + amount + ' unità di ' + action.resource + '.');
    resources.coins -= cost;
    resources[action.resource] += amount;
    return finish('Acquistate ' + amount + ' unità di ' + (action.resource === 'wood' ? 'legname' : action.resource === 'stone' ? 'pietra' : 'cibo') + ' a ' + unitPrice + ' monete ciascuna: -' + cost + ' monete.');
  }
  if (action.type === 'tradeGoods') {
    if (!state.buildings.some((building) => building.type === 'market' && building.construction?.kind !== 'build')) return fail('Costruisci un mercato prima di vendere i beni lavorati.');
    if (!world.citizens.some((citizen) => citizen.profession === 'merchant' && citizen.status === 'resident')) return fail('Assegna almeno un cittadino al mestiere Mercante.');
    if (!Object.prototype.hasOwnProperty.call(world.goods, action.good)) return fail('Questo bene non è commerciabile.');
    const amount = Math.floor(action.amount);
    if (!Number.isSafeInteger(action.amount) || amount < 1 || amount > 50) return fail('Puoi vendere da 1 a 50 unità per volta.');
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
      const profile = FACTION_TRADE_PROFILES[faction.id] ?? FACTION_TRADE_PROFILES.selvalunga;
      const need = faction.need ?? profile.need!;
      const offer = faction.offer ?? profile.offer!;
      const needAmount = faction.needAmount ?? profile.needAmount!;
      const offerAmount = faction.offerAmount ?? profile.offerAmount!;
      if (resources[need] < needAmount) return fail(faction.name + ' richiede ' + needAmount + ' ' + RESOURCE_NAME(need) + ' per lo scambio, ma le tue scorte non bastano.');
      resources[need] -= needAmount;
      resources[offer] += offerAmount;
      world = { ...world, factions: world.factions.map((entry) => entry.id === faction.id ? { ...entry, relation: clamp(entry.relation + 7), lastContact: state.gameMinutes } : entry) };
      return finish('Scambio con ' + faction.name + ': ' + needAmount + ' ' + RESOURCE_NAME(need) + ' in cambio di ' + offerAmount + ' ' + RESOURCE_NAME(offer) + '. I rapporti migliorano.');
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