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

export const EPOCH_ORDER: EpochId[] = ['settlement', 'village', 'borough', 'city', 'metropolis', 'empire'];

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
  metropolis: {
    id: 'metropolis', name: 'Metropoli', icon: '🌆', reward: 90,
    summary: 'Specializza l’economia, porta gli edifici al livello 4 e coordina regioni, studiosi e cantieri.',
    story: 'Le strade di Brumadoro non finiscono più ai confini della valle. Nuovi quartieri, viandanti e mestieri specializzati fanno della città un centro di scambi e conoscenza.',
  },
  empire: {
    id: 'empire', name: 'Impero', icon: '👑', reward: 120,
    summary: 'Costruisci un’economia matura, completa le grandi opere e prepara la Carta della Corona.',
    story: 'Le regioni riconoscono l’autorità del Consiglio di Brumadoro. Solo un regno capace di sostenere grandi città, scienza e rotte durature potrà firmare la Carta della Corona.',
  }
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
  orchard: 'village',
  fishingHut: 'village',
  herbGarden: 'village',
  inn: 'borough',
  ironworks: 'borough',
  observatory: 'metropolis',
};

const countBuildings = (state: GameState, type: BuildingType): number =>
  state.buildings.filter((building) => building.type === type && building.construction?.kind !== 'build').length;
const levelTwoCount = (state: GameState): number =>
  state.buildings.filter((building) => building.type !== 'road' && building.construction?.kind !== 'build' && building.level >= 2).length;
const levelThreeCount = (state: GameState): number =>
  state.buildings.filter((building) => building.type !== 'road' && building.construction?.kind !== 'build' && building.level >= 3).length;
const levelFourCount = (state: GameState): number =>
  state.buildings.filter((building) => building.type !== 'road' && building.construction?.kind !== 'build' && building.level >= 4).length;
const levelFiveCount = (state: GameState): number =>
  state.buildings.filter((building) => building.type !== 'road' && building.construction?.kind !== 'build' && building.level >= 5).length;
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

  if (target === 'metropolis') {
    const newEconomyBuildings = ['orchard', 'fishingHut', 'herbGarden', 'inn', 'ironworks'] as BuildingType[];
    const newEconomyCount = newEconomyBuildings.reduce((total, type) => total + countBuildings(state, type), 0);
    return [
      criterion('metropolis-population', 'Raggiungi 28 abitanti', pop >= 28, Math.min(pop, 28) + '/28 abitanti'),
      criterion('metropolis-university', 'Apri l’Università Reale', countBuildings(state, 'university') >= 1, countBuildings(state, 'university') + '/1 università'),
      criterion('metropolis-research', 'Completa 4 ricerche', researched >= 4, Math.min(researched, 4) + '/4 ricerche'),
      criterion('metropolis-projects', 'Completa 2 grandi opere', projects >= 2, Math.min(projects, 2) + '/2 progetti'),
      criterion('metropolis-regions', 'Scopri 3 regioni', regions >= 3, Math.min(regions, 3) + '/3 regioni'),
      criterion('metropolis-level-four', 'Porta 2 edifici al livello 4', levelFourCount(state) >= 2, Math.min(levelFourCount(state), 2) + '/2 edifici'),
      criterion('metropolis-special-buildings', 'Costruisci 3 edifici economici specializzati', newEconomyCount >= 3, Math.min(newEconomyCount, 3) + '/3 edifici'),
    ];
  }
  if (target === 'empire') {
    return [
      criterion('empire-population', 'Raggiungi 45 abitanti', pop >= 45, Math.min(pop, 45) + '/45 abitanti'),
      criterion('empire-level-five', 'Porta 4 edifici al livello 5', levelFiveCount(state) >= 4, Math.min(levelFiveCount(state), 4) + '/4 edifici'),
      criterion('empire-projects', 'Completa tutte le 4 grandi opere', projects >= 4, Math.min(projects, 4) + '/4 progetti'),
      criterion('empire-research', 'Completa 5 ricerche', researched >= 5, Math.min(researched, 5) + '/5 ricerche'),
      criterion('empire-regions', 'Scopri 4 regioni', regions >= 4, Math.min(regions, 4) + '/4 regioni'),
      criterion('empire-routes', 'Stringi 3 accordi o rotte commerciali', routeCount(state) >= 3, Math.min(routeCount(state), 3) + '/3 accordi'),
      criterion('empire-observatory', 'Costruisci l’Osservatorio Reale', countBuildings(state, 'observatory') >= 1, countBuildings(state, 'observatory') + '/1 osservatorio'),
      criterion('empire-coins', 'Accumula 350 monete', state.resources.coins >= 350, Math.min(Math.floor(state.resources.coins), 350) + '/350 monete'),
    ];
  }
  return [];
}

export function getCharterRequirements(state: GameState): ProgressionCriterion[] {
  const pop = state.population;
  const projects = projectCount(state);
  const routes = routeCount(state);
  const regions = regionCount(state);
  const university = state.buildings.find((building) => building.type === 'university' && building.construction?.kind !== 'build');
  const observatory = state.buildings.find((building) => building.type === 'observatory' && building.construction?.kind !== 'build');
  return [
    criterion('charter-population', 'Raggiungi 60 abitanti', pop >= 60, Math.min(pop, 60) + '/60 abitanti'),
    criterion('charter-level-five', 'Porta 6 edifici al livello 5', levelFiveCount(state) >= 6, Math.min(levelFiveCount(state), 6) + '/6 edifici'),
    criterion('charter-projects', 'Completa tutte le 4 grandi opere', projects >= 4, Math.min(projects, 4) + '/4 progetti'),
    criterion('charter-routes', 'Stringi 4 accordi o rotte commerciali', routes >= 4, Math.min(routes, 4) + '/4 accordi'),
    criterion('charter-regions', 'Scopri tutte le 5 regioni', regions >= 5, Math.min(regions, 5) + '/5 regioni'),
    criterion('charter-university', 'Porta l’Università Reale al livello 5', (university?.level ?? 0) >= 5, Math.min(university?.level ?? 0, 5) + '/5 livello'),
    criterion('charter-observatory', 'Porta l’Osservatorio al livello 3', (observatory?.level ?? 0) >= 3, Math.min(observatory?.level ?? 0, 3) + '/3 livello'),
    criterion('charter-coins', 'Riserva 500 monete per la Corona', state.resources.coins >= 500, Math.min(Math.floor(state.resources.coins), 500) + '/500 monete'),
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
  let campaignComplete = current?.campaignComplete === true && unlocked.includes('empire');
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
  if (!campaignComplete && unlocked.includes('empire') && getCharterRequirements(state).every((entry) => entry.done)) {
    campaignComplete = true;
    campaignJustCompleted = true;
    reward += 150;
    const finale = '👑 La Carta della Corona è firmata. Brumadoro è diventato un Impero: cinque regioni collegate, grandi opere concluse, Università e Osservatorio ai massimi livelli ne garantiscono il futuro.';
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
