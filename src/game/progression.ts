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
    summary: 'Cinque famiglie hanno trovato riparo sotto il Municipio. Prima che la campana sepolta si zittisca di nuovo, Brumadoro deve imparare a vivere.',
    story: 'PROLOGO · Tre notti fa, una campana ha suonato sotto le fondamenta del vecchio Municipio. Nessuna torre la custodisce. Io, Bricco, ho trovato fra le pietre una mappa con cinque stelle cancellate e una frase: “Quando le cinque luci torneranno, la Corona non comanderà il popolo: sarà il popolo a custodire la Corona.” Per ora siamo cinque famiglie, poche scorte e un mistero più grande della valle.'
  },
  village: {
    id: 'village', name: 'Villaggio', icon: '🏘️', reward: 20,
    summary: 'La prima luce è il focolare: nessun segreto vale quanto un tetto e un pasto condiviso. La campana tornerà a parlare solo a una comunità capace di prendersi cura di tutti.',
    story: 'CAPITOLO I · LA PRIMA LUCE. Al compimento del Villaggio, un contadino trova nel campo una scheggia di bronzo incisa con una stella. La stessa figura compare sulla mappa di Bricco. I mercanti raccontano che, da generazioni, tre comunità vicine custodiscono canti diversi su una corona scomparsa. Per la prima volta, il suono sotto il Municipio sembra avere una direzione.'
  },
  borough: {
    id: 'borough', name: 'Borgo', icon: '🏰', reward: 35,
    summary: 'Il sentiero verso le altre valli è aperto. Scopri chi ricorda la campana, stringi accordi e investi in opere che nessuna famiglia potrebbe costruire da sola.',
    story: 'CAPITOLO II · LE VOCI OLTRE IL BOSCO. Gli emissari di Selvalunga, Porto Salmastra e Rocciacupa arrivano a Brumadoro con tre racconti incompatibili. Una parla di una regina che salvò le valli; un altro di un sovrano che volle possederle; il terzo di un patto spezzato in cinque parti. Bricco sospetta che ogni regione conservi un frammento della verità. Per trovarlo serviranno fiducia, mappe e mani al lavoro.'
  },
  city: {
    id: 'city', name: 'Città', icon: '🏛️', reward: 60,
    summary: 'Gli antichi segni cominciano a combaciare. Una Scuola e nuove ricerche possono svelare che cosa accadde alla Corona e perché la campana fu sepolta.',
    story: 'CAPITOLO III · L’ARCHIVIO TACIUTO. Nelle Rovine della Corona, gli esploratori trovano una tavola spezzata: non era un decreto di conquista, ma il primo testo di un accordo fra cinque popoli. L’Università Reale ne decifra le righe: la campana non serviva a convocare eserciti, bensì a chiamare aiuto quando una valle era in pericolo. Qualcuno trasformò quel richiamo in un ordine; le altre valli si ribellarono e il Patto fu diviso, perché nessun sovrano potesse usarlo da solo.'
  },
  metropolis: {
    id: 'metropolis', name: 'Metropoli', icon: '🌆', reward: 90,
    summary: 'La mappa non indica una capitale, ma cinque stelle legate da strade, acqua e conoscenza. Costruisci l’Osservatorio e dimostra che le valli possono prosperare senza diventare uguali.',
    story: 'CAPITOLO IV · LE STELLE SULLA PIETRA. Dall’Osservatorio, gli studiosi leggono il cielo come un’antica mappa: Bosco, Passo, Lago, Rovine e Terre di Confine formano una costellazione. Ogni grande opera riaccende un tratto del disegno. Bricco comprende la parte dimenticata della leggenda: la Corona era un patto di mutuo soccorso, non un trono. Le cinque luci si accenderanno soltanto se ogni regione avrà voce e futuro.'
  },
  empire: {
    id: 'empire', name: 'Impero', icon: '👑', reward: 120,
    summary: 'Un Impero degno di quel nome non annette le valli: le unisce senza cancellarle. Completa le grandi opere, proteggi i territori e prepara la Carta che nessuno potrà imporre con la forza.',
    story: 'CAPITOLO V · IL PATTO DELLE CINQUE LUCI. Le cinque regioni hanno inviato i loro sigilli. La vecchia Corona di Brumadoro non sarà rimessa sul capo di un sovrano: verrà incisa sulla Carta come promessa reciproca. Ogni valle conserverà le proprie tradizioni e contribuirà secondo le proprie forze. Se popolo, opere, conoscenza e rotte resteranno in equilibrio, la campana potrà suonare ancora — questa volta non per impartire un ordine, ma per annunciare che nessuna valle è sola.'
  }
};

const FINAL_CHRONICLE_ENTRY = "🔔 LA CAMPANA DELL’ALBA · La Carta della Corona è firmata. Le cinque luci rispondono l’una all’altra, non per ordine di un sovrano ma per scelta dei popoli. La campana suona, e il suo rintocco viaggia dal Bosco al Passo, dal Lago alle Rovine, fino alle Terre di Confine. Brumadoro è diventato un Impero fondato sul Patto: nessuna valle è proprietà di un’altra, nessuna voce viene lasciata al buio. Bricco chiude il vecchio archivio, non perché la storia sia finita, ma perché da questo giorno appartiene a tutti.";

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
      criterion('village-population', 'Accogli 8 abitanti sotto la prima luce', pop >= 8, Math.min(pop, 8) + '/8 abitanti'),
      criterion('village-farm', 'Accendi i campi: costruisci una fattoria', farms >= 1, farms + '/1 fattoria'),
      criterion('village-house', 'Dai riparo alle famiglie: costruisci una casa', houses >= 1, houses + '/1 casa'),
    ];
  }
  if (target === 'borough') {
    return [
      criterion('borough-population', 'Raduna 12 abitanti attorno al Patto', pop >= 12, Math.min(pop, 12) + '/12 abitanti'),
      criterion('borough-market', 'Apri una piazza di scambi: costruisci un mercato', markets >= 1, markets + '/1 mercato'),
      criterion('borough-upgrade', 'Dimostra che Brumadoro sa crescere: porta un edificio al livello 2', twoPlus >= 1, twoPlus + '/1 edificio al livello 2+'),
    ];
  }
  if (target === 'city') {
    return [
      criterion('city-population', 'Riunisci 18 abitanti nella città delle valli', pop >= 18, Math.min(pop, 18) + '/18 abitanti'),
      criterion('city-school', 'Salva la memoria: costruisci la Scuola degli scribi', countBuildings(state, 'school') >= 1, countBuildings(state, 'school') + '/1 scuola'),
      criterion('city-research', 'Decifra due righe del Patto: completa 2 ricerche', researched >= 2, Math.min(researched, 2) + '/2 ricerche'),
      criterion('city-project', 'Lascia un segno che duri: completa una grande opera', projects >= 1, Math.min(projects, 1) + '/1 progetto'),
      criterion('city-regions', 'Ritrova due stelle sulla mappa: scopri 2 regioni', regions >= 2, Math.min(regions, 2) + '/2 regioni'),
      criterion('city-level-three', 'Costruisci per il futuro: porta un edificio al livello 3', threePlus >= 1, threePlus + '/1 edificio al livello 3'),
    ];
  }

  if (target === 'metropolis') {
    const newEconomyBuildings = ['orchard', 'fishingHut', 'herbGarden', 'inn', 'ironworks'] as BuildingType[];
    const newEconomyCount = newEconomyBuildings.reduce((total, type) => total + countBuildings(state, type), 0);
    return [
      criterion('metropolis-population', 'Dai voce a 28 abitanti', pop >= 28, Math.min(pop, 28) + '/28 abitanti'),
      criterion('metropolis-university', 'Apri l’Università Reale', countBuildings(state, 'university') >= 1, countBuildings(state, 'university') + '/1 università'),
      criterion('metropolis-research', 'Collega quattro frammenti del sapere: completa 4 ricerche', researched >= 4, Math.min(researched, 4) + '/4 ricerche'),
      criterion('metropolis-projects', 'Ricongiungi due tratti della mappa: completa 2 grandi opere', projects >= 2, Math.min(projects, 2) + '/2 progetti'),
      criterion('metropolis-regions', 'Accendi tre luci: scopri 3 regioni', regions >= 3, Math.min(regions, 3) + '/3 regioni'),
      criterion('metropolis-level-four', 'Porta 2 edifici al livello 4', levelFourCount(state) >= 2, Math.min(levelFourCount(state), 2) + '/2 edifici'),
      criterion('metropolis-special-buildings', 'Costruisci 3 edifici economici specializzati', newEconomyCount >= 3, Math.min(newEconomyCount, 3) + '/3 edifici'),
    ];
  }
  if (target === 'empire') {
    return [
      criterion('empire-population', 'Fai prosperare 45 abitanti', pop >= 45, Math.min(pop, 45) + '/45 abitanti'),
      criterion('empire-level-five', 'Porta 4 edifici al livello 5', levelFiveCount(state) >= 4, Math.min(levelFiveCount(state), 4) + '/4 edifici'),
      criterion('empire-projects', 'Ricostruisci i quattro pilastri del Patto', projects >= 4, Math.min(projects, 4) + '/4 progetti'),
      criterion('empire-research', 'Ricomponi cinque testimonianze: completa 5 ricerche', researched >= 5, Math.min(researched, 5) + '/5 ricerche'),
      criterion('empire-regions', 'Porta quattro regioni nella costellazione', regions >= 4, Math.min(regions, 4) + '/4 regioni'),
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
    criterion('charter-population', 'Dai una voce a 60 abitanti', pop >= 60, Math.min(pop, 60) + '/60 abitanti'),
    criterion('charter-level-five', 'Lascia sei opere all’altezza delle generazioni future', levelFiveCount(state) >= 6, Math.min(levelFiveCount(state), 6) + '/6 edifici'),
    criterion('charter-projects', 'Completa i quattro pilastri che tengono unite le valli', projects >= 4, Math.min(projects, 4) + '/4 progetti'),
    criterion('charter-routes', 'Stringi quattro patti o rotte tra comunità', routes >= 4, Math.min(routes, 4) + '/4 accordi'),
    criterion('charter-regions', 'Riaccendi tutte le cinque stelle regionali', regions >= 5, Math.min(regions, 5) + '/5 regioni'),
    criterion('charter-university', 'Porta l’Università Reale al livello 5 e custodisci la memoria', (university?.level ?? 0) >= 5, Math.min(university?.level ?? 0, 5) + '/5 livello'),
    criterion('charter-observatory', 'Porta l’Osservatorio al livello 3 e leggi la costellazione', (observatory?.level ?? 0) >= 3, Math.min(observatory?.level ?? 0, 3) + '/3 livello'),
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

  // Only accept a contiguous sequence of unlocked eras. Corrupt or hand-edited saves
  // must not unlock later-era buildings while skipping a prerequisite era.
  let unlocked: EpochId[] = ['settlement'];
  for (let index = 1; index < EPOCH_ORDER.length; index += 1) {
    const epoch = EPOCH_ORDER[index]!;
    const previous = EPOCH_ORDER[index - 1]!;
    if (!valid.has(epoch) || !unlocked.includes(previous)) break;
    unlocked.push(epoch);
  }
  const migrateStoryEntry = (entry: string): string => {
    if (entry.startsWith('A Brumadoro cinque famiglie')) return EPOCHS.settlement.story;
    if (entry.startsWith('È nato un nuovo Consiglio del Regno.')) {
      return 'Tre notti dopo il rintocco sotto il Municipio, nasce il Consiglio di Brumadoro. Bricco custodisce una mappa con cinque stelle mancanti e apre la cronaca delle Cinque Luci: gli abitanti saranno i primi a decidere se il Patto merita di rinascere.';
    }
    if (entry.startsWith('👑 La Carta della Corona è firmata.') || entry.startsWith('🔔 LA CAMPANA DELL’ALBA')) return FINAL_CHRONICLE_ENTRY;
    const epoch = EPOCH_ORDER.map((id) => EPOCHS[id]).find((candidate) => entry.startsWith(candidate.icon + ' ' + candidate.name + ':'));
    if (epoch) return epoch.icon + ' ' + epoch.name + ': ' + epoch.story + ' Ricompensa del Consiglio: +' + epoch.reward + ' monete.';
    return entry;
  };
  let history = (Array.isArray(current?.history)
    ? current.history.filter((entry): entry is string => typeof entry === 'string')
    : [EPOCHS.settlement.story]).map(migrateStoryEntry).slice(0, 12);
  let campaignComplete = current?.campaignComplete === true && unlocked.includes('empire');
  const migratedWorld = input.world ? {
    ...input.world,
    chronicle: input.world.chronicle.map(migrateStoryEntry).slice(0, 12),
  } : input.world;
  let state: GameState = {
    ...input,
    world: migratedWorld,
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
    const finale = FINAL_CHRONICLE_ENTRY;
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
