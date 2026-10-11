import type { BuildingType, EpochId, GameState, KingdomProgression } from './types';

export interface EpochDefinition {
  id: EpochId;
  name: string;
  icon: string;
  reward: number;
  summary: string;
  story: string;
}

export interface ProgressionCriterion {
  id: string;
  label: string;
  done: boolean;
  value: string;
}

export const EPOCH_ORDER: EpochId[] = ['settlement', 'village', 'borough', 'city'];

export const EPOCHS: Record<EpochId, EpochDefinition> = {
  settlement: {
    id: 'settlement', name: 'Insediamento', icon: '🌱', reward: 0,
    summary: 'Prima viene la sopravvivenza: cibo stabile, una casa e spazio per chi arriverà.',
    story: 'A Brumadoro cinque famiglie si raccolgono attorno al vecchio municipio. Le scorte sono limitate e il futuro dipende dalle prime decisioni.',
  },
  village: {
    id: 'village', name: 'Villaggio', icon: '🏘️', reward: 20,
    summary: 'Il borgo esce dalla sussistenza: apri il mercato, crea collegamenti e migliora gli edifici.',
    story: 'Il Consiglio proclama Brumadoro un Villaggio. Arrivano mercanti e artigiani; ora il problema non è soltanto sfamare tutti, ma far circolare materiali e ricchezza.',
  },
  borough: {
    id: 'borough', name: 'Borgo', icon: '🏰', reward: 35,
    summary: 'La comunità cresce: ricerca, diplomazia, spedizioni e grandi opere diventano il nuovo banco di prova.',
    story: 'Le botteghe hanno superato la sussistenza. Brumadoro viene riconosciuto come Borgo e può inviare ambasciatori, finanziare opere pubbliche e investire nella conoscenza.',
  },
  city: {
    id: 'city', name: 'Città', icon: '🏛️', reward: 60,
    summary: 'Le rotte raggiungono terre lontane. Organizza grandi opere e prepara la Carta della Corona.',
    story: 'Le spedizioni hanno aperto nuove rotte e le opere comuni hanno cambiato il territorio. Il Consiglio riconosce Brumadoro come Città e autorizza la costruzione dell’Università Reale.',
  },
};

const BUILDING_EPOCH: Partial<Record<BuildingType, EpochId>> = {
  townHall: 'settlement',
  house: 'settlement',
  farm: 'settlement',
  sawmill: 'village',
  quarry: 'village',
  market: 'village',
  road: 'village',
  mill: 'village',
  warehouse: 'village',
  bakery: 'borough',
  school: 'borough',
  watchtower: 'borough',
  workshop: 'borough',
  university: 'city',
};

const countBuildings = (state: GameState, type: BuildingType): number =>
  state.buildings.filter((building) => building.type === type).length;
const levelTwoCount = (state: GameState): number =>
  state.buildings.filter((building) => building.type !== 'road' && building.level >= 2).length;
const levelThreeCount = (state: GameState): number =>
  state.buildings.filter((building) => building.type !== 'road' && building.level >= 3).length;
const researchCount = (state: GameState): number => state.world?.researched.length ?? 0;
const projectCount = (state: GameState): number => state.world?.completedProjects.length ?? 0;
const regionCount = (state: GameState): number => state.world?.discoveredRegions.length ?? 0;
const routeCount = (state: GameState): number =>
  Math.max(state.world?.tradeRoutes.length ?? 0, state.world?.factions.filter((faction) => faction.treaty).length ?? 0);

function criterion(id: string, label: string, done: boolean, value: string): ProgressionCriterion {
  return { id, label, done, value };
}

export function initialKingdomProgression(): KingdomProgression {
  return {
    unlockedEpochs: ['settlement'],
    campaignComplete: false,
    history: [EPOCHS.settlement.story],
  };
}

export function getCurrentEpochId(state: GameState): EpochId {
  const unlocked = state.progression?.unlockedEpochs ?? ['settlement'];
  for (let index = EPOCH_ORDER.length - 1; index >= 0; index -= 1) {
    const id = EPOCH_ORDER[index]!;
    if (unlocked.includes(id)) return id;
  }
  return 'settlement';
}

export function isEpochUnlocked(state: GameState, epoch: EpochId): boolean {
  return (state.progression?.unlockedEpochs ?? ['settlement']).includes(epoch);
}

export function getBuildingEpoch(type: BuildingType): EpochId {
  return BUILDING_EPOCH[type] ?? 'settlement';
}

export function isBuildingEpochAvailable(state: GameState, type: BuildingType): boolean {
  return isEpochUnlocked(state, getBuildingEpoch(type));
}

export function getEpochRequirements(state: GameState, target: EpochId): ProgressionCriterion[] {
  const pop = state.population;
  const farms = countBuildings(state, 'farm');
  const houses = countBuildings(state, 'house');
  const markets = countBuildings(state, 'market');
  const twoPlus = levelTwoCount(state);
  const threePlus = levelThreeCount(state);
  const researched = researchCount(state);
  const projects = projectCount(state);
  const regions = regionCount(state);

  if (target === 'village') {
    return [
      criterion('village-population', 'Raggiungi 8 abitanti', pop >= 8, Math.min(pop, 8) + '/8 abitanti'),
      criterion('village-farm', 'Costruisci una fattoria', farms >= 1, farms + '/1 fattoria'),
      criterion('village-house', 'Costruisci una casa', houses >= 1, houses + '/1 casa'),
    ];
  }
  if (target === 'borough') {
    return [
      criterion('borough-population', 'Raggiungi 12 abitanti', pop >= 12, Math.min(pop, 12) + '/12 abitanti'),
      criterion('borough-market', 'Apri un mercato', markets >= 1, markets + '/1 mercato'),
      criterion('borough-upgrade', 'Migliora un edificio al livello 2', twoPlus >= 1, twoPlus + '/1 edificio al livello 2+'),
    ];
  }
  if (target === 'city') {
    return [
      criterion('city-population', 'Raggiungi 18 abitanti', pop >= 18, Math.min(pop, 18) + '/18 abitanti'),
      criterion('city-school', 'Costruisci una scuola degli scribi', countBuildings(state, 'school') >= 1, countBuildings(state, 'school') + '/1 scuola'),
      criterion('city-research', 'Completa 2 ricerche', researched >= 2, Math.min(researched, 2) + '/2 ricerche'),
      criterion('city-project', 'Completa una grande opera', projects >= 1, Math.min(projects, 1) + '/1 progetto'),
      criterion('city-regions', 'Scopri 2 regioni', regions >= 2, Math.min(regions, 2) + '/2 regioni'),
      criterion('city-level-three', 'Porta un edificio al livello 3', threePlus >= 1, threePlus + '/1 edificio al livello 3'),
    ];
  }
  return [];
}

export function getCharterRequirements(state: GameState): ProgressionCriterion[] {
  const pop = state.population;
  const threePlus = levelThreeCount(state);
  const projects = projectCount(state);
  const routes = routeCount(state);
  const regions = regionCount(state);
  const university = countBuildings(state, 'university');
  return [
    criterion('charter-population', 'Raggiungi 24 abitanti', pop >= 24, Math.min(pop, 24) + '/24 abitanti'),
    criterion('charter-level-three', 'Porta 2 edifici al livello 3', threePlus >= 2, Math.min(threePlus, 2) + '/2 edifici'),
    criterion('charter-projects', 'Completa 3 grandi opere', projects >= 3, Math.min(projects, 3) + '/3 progetti'),
    criterion('charter-routes', 'Stringi 2 accordi diplomatici', routes >= 2, Math.min(routes, 2) + '/2 accordi'),
    criterion('charter-regions', 'Scopri 3 regioni', regions >= 3, Math.min(regions, 3) + '/3 regioni'),
    criterion('charter-university', 'Costruisci l’Università Reale', university >= 1, university + '/1 università'),
    criterion('charter-coins', 'Riserva 100 monete per la Corona', state.resources.coins >= 100, Math.min(Math.floor(state.resources.coins), 100) + '/100 monete'),
  ];
}

export interface ProgressionUpdate {
  state: GameState;
  newlyUnlocked: EpochId[];
  campaignJustCompleted: boolean;
  reward: number;
}

export function synchronizeKingdomProgression(input: GameState): ProgressionUpdate {
  const current = input.progression;
  const valid = new Set<EpochId>(
    (Array.isArray(current?.unlockedEpochs) ? current.unlockedEpochs : ['settlement'])
      .filter((id): id is EpochId => EPOCH_ORDER.includes(id as EpochId)),
  );
  valid.add('settlement');

  let unlocked = EPOCH_ORDER.filter((id) => valid.has(id));
  let history = Array.isArray(current?.history)
    ? current.history.filter((entry): entry is string => typeof entry === 'string').slice(0, 12)
    : [EPOCHS.settlement.story];
  let campaignComplete = current?.campaignComplete === true && unlocked.includes('city');
  let state: GameState = {
    ...input,
    resources: { ...input.resources },
    progression: { unlockedEpochs: [...unlocked], campaignComplete, history },
  };
  const newlyUnlocked: EpochId[] = [];
  let reward = 0;

  for (let index = 1; index < EPOCH_ORDER.length; index += 1) {
    const epoch = EPOCH_ORDER[index]!;
    const previous = EPOCH_ORDER[index - 1]!;
    if (unlocked.includes(epoch)) continue;
    if (!unlocked.includes(previous)) break;
    if (!getEpochRequirements(state, epoch).every((entry) => entry.done)) break;

    unlocked = [...unlocked, epoch];
    newlyUnlocked.push(epoch);
    reward += EPOCHS[epoch].reward;
    const story = EPOCHS[epoch].icon + ' ' + EPOCHS[epoch].name + ': ' + EPOCHS[epoch].story +
      ' Ricompensa del Consiglio: +' + EPOCHS[epoch].reward + ' monete.';
    history = [story, ...history].slice(0, 12);
    state = {
      ...state,
      resources: { ...state.resources, coins: state.resources.coins + EPOCHS[epoch].reward },
      progression: { unlockedEpochs: [...unlocked], campaignComplete, history },
      world: state.world ? { ...state.world, chronicle: [story, ...state.world.chronicle].slice(0, 12) } : state.world,
    };
  }

  let campaignJustCompleted = false;
  if (!campaignComplete && unlocked.includes('city') && getCharterRequirements(state).every((entry) => entry.done)) {
    campaignComplete = true;
    campaignJustCompleted = true;
    reward += 150;
    const finale = '👑 La Carta della Corona è firmata. Brumadoro è una città autonoma: le grandi opere, le rotte diplomatiche e le conoscenze condivise ne garantiscono il futuro.';
    history = [finale, ...history].slice(0, 12);
    state = {
      ...state,
      resources: { ...state.resources, coins: state.resources.coins + 150 },
      progression: { unlockedEpochs: [...unlocked], campaignComplete: true, history },
      world: state.world ? { ...state.world, chronicle: [finale, ...state.world.chronicle].slice(0, 12) } : state.world,
    };
  } else {
    state = {
      ...state,
      progression: { unlockedEpochs: [...unlocked], campaignComplete, history },
    };
  }

  return { state, newlyUnlocked, campaignJustCompleted, reward };
}
