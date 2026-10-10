import { BUILDINGS } from './definitions';
import type { Building, CommunityState, CitizenRequest, CitizenRequestOption, GameState, Resource, ResourceBag, SeasonInfo } from './types';

export const SEASONS: SeasonInfo[] = [
  { id: 'spring', name: 'Primavera', icon: '🌱', description: 'I campi ripartono: le fattorie producono il 10% in più.', farmMultiplier: 1.1, foodConsumptionMultiplier: 1 },
  { id: 'summer', name: 'Estate', icon: '☀️', description: 'Giornate lunghe e raccolti regolari. La comunità lavora al ritmo normale.', farmMultiplier: 1, foodConsumptionMultiplier: 1 },
  { id: 'autumn', name: 'Autunno', icon: '🍂', description: 'È il tempo del raccolto: le fattorie producono il 35% in più.', farmMultiplier: 1.35, foodConsumptionMultiplier: 1 },
  { id: 'winter', name: 'Inverno', icon: '❄️', description: 'La terra riposa: i campi rallentano e gli abitanti consumano il 50% di cibo in più.', farmMultiplier: 0.55, foodConsumptionMultiplier: 1.5 },
];

export function getSeason(gameMinutes: number): SeasonInfo {
  const index = Math.floor(Math.max(0, gameMinutes) / 360) % SEASONS.length;
  return SEASONS[index]!;
}

export function clampCommunityValue(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function option(
  id: string,
  label: string,
  detail: string,
  cost: Partial<ResourceBag>,
  reward: Partial<ResourceBag>,
  mood: number,
  trust: number,
  populationDelta = 0,
  housingDelta = 0,
): CitizenRequestOption {
  return { id, label, detail, cost, reward, moodDelta: mood, trustDelta: trust, populationDelta, housingDelta };
}

function capacityOf(buildings: Building[]): number {
  return buildings.reduce((total, building) => total + (BUILDINGS[building.type].housing ?? 0) * building.level, 0);
}

function buildRequest(seed: number, number: number, gameMinutes: number, state?: Pick<GameState, 'population' | 'buildings' | 'resources'>): CitizenRequest {
  const season = getSeason(gameMinutes);
  const hasRoom = state ? state.population < capacityOf(state.buildings) : true;
  const food = state?.resources.food ?? 42;
  const wood = state?.resources.wood ?? 42;
  const coins = state?.resources.coins ?? 18;
  const requests: Array<() => CitizenRequest> = [
    () => ({
      id: seed + '-request-' + number,
      citizen: 'Ada',
      role: 'Fornaia',
      title: food < 18 ? 'Le dispense sono quasi vuote' : 'Una mano alla dispensa',
      description: food < 18
        ? 'Ada è preoccupata: se le scorte finiscono, il borgo smetterà di crescere. Puoi aiutarla oppure conservare quel poco che resta.'
        : 'Ada vuole preparare pane per le famiglie che faticano ad arrivare a sera. Le tue scorte sono sufficienti, ma ogni aiuto ha un costo.',
      deadline: gameMinutes + 180,
      options: [
        option('share-food', 'Condividi le scorte', 'Spendi 8 cibo · umore e fiducia aumentano', { food: 8 }, {}, 12, 10),
        option('barter-bread', 'Baratta legna per pane', 'Spendi 5 legname, ricevi 10 cibo', { wood: 5 }, { food: 10 }, 5, 5),
        option('keep-food', 'Tieni tutto per il borgo', 'Non costa nulla, ma qualcuno resterà deluso', {}, {}, -7, -5),
      ],
    }),
    () => ({
      id: seed + '-request-' + number,
      citizen: 'Berto',
      role: 'Falegname',
      title: 'Il tetto della locanda perde',
      description: 'La pioggia ha danneggiato il tetto della locanda. Berto può ripararlo, ma ha bisogno di materiali o di un piccolo compenso.',
      deadline: gameMinutes + 180,
      options: [
        option('roof-wood', 'Dona il legname', 'Spendi 6 legname · la locanda riapre prima', { wood: 6 }, {}, 9, 7),
        option('roof-coins', 'Paga il falegname', 'Spendi 5 monete · lavoro garantito', { coins: 5 }, {}, 5, 8),
        option('roof-later', 'Rimanda la riparazione', 'Conservi le risorse, perdi un po’ di fiducia', {}, {}, -8, -7),
      ],
    }),
    () => ({
      id: seed + '-request-' + number,
      citizen: 'Neri',
      role: 'Mercante itinerante',
      title: 'Un mercante alla porta',
      description: 'Neri offre uno scambio rapido. È un buon modo per rimediare a una carenza, ma non tutte le offerte sono vantaggiose.',
      deadline: gameMinutes + 180,
      options: [
        option('trade-buy-food', 'Compra provviste', 'Spendi 6 monete, ricevi 14 cibo', { coins: 6 }, { food: 14 }, 5, 4),
        option('trade-sell-wood', 'Vendi legname', 'Spendi 7 legname, ricevi 10 monete', { wood: 7 }, { coins: 10 }, 2, 2),
        option('trade-decline', 'Rifiuta l’offerta', 'Nessun costo, nessun guadagno', {}, {}, 0, 0),
      ],
    }),
    () => ({
      id: seed + '-request-' + number,
      citizen: 'Mira',
      role: 'Nuova arrivata',
      title: hasRoom ? 'Una famiglia cerca casa' : 'Una famiglia cerca un posto',
      description: hasRoom
        ? 'Mira e suo fratello hanno raggiunto la valle. Se li accogli, darai una mano a una famiglia e il borgo guadagnerà un nuovo abitante.'
        : 'Mira è arrivata nella valle, ma le case sono al completo. Puoi aiutarla a preparare un alloggio oppure spiegarle che servirà tempo.',
      deadline: gameMinutes + 180,
      options: [
        ...(hasRoom ? [option('newcomer-welcome', 'Accogli la famiglia', 'Spendi 8 cibo e aggiungi un abitante', { food: 8 }, {}, 9, 11, 1)] : []),
        option('newcomer-shelter', 'Prepara un alloggio', 'Spendi 8 legname e 3 pietra · crea 2 posti temporanei', { wood: 8, stone: 3 }, {}, 7, 7, 0, 2),
        option('newcomer-wait', 'Chiedi di aspettare', 'Conservi i materiali, ma la fiducia cala', {}, {}, -4, -5),
      ],
    }),
    () => ({
      id: seed + '-request-' + number,
      citizen: 'Lina',
      role: 'Custode della piazza',
      title: 'Una lite in piazza',
      description: 'Due bottegai discutono per lo spazio del mercato. Una mediazione costa tempo o monete; ignorare la lite è gratuito, ma lascia strascichi.',
      deadline: gameMinutes + 180,
      options: [
        option('mediate-coins', 'Media con una piccola spesa', 'Spendi 4 monete · la piazza si calma', { coins: 4 }, {}, 8, 10),
        option('mediate-wood', 'Costruisci due banchi', 'Spendi 5 legname per separare le botteghe', { wood: 5 }, {}, 6, 6),
        option('mediate-ignore', 'Lascia che si arrangino', 'Nessun costo, la disputa resta aperta', {}, {}, -6, -9),
      ],
    }),
    () => ({
      id: seed + '-request-' + number,
      citizen: 'Elio',
      role: 'Capo delle scorte',
      title: season.id === 'winter' ? 'Prepariamoci al gelo' : 'Il magazzino ha bisogno di scorte',
      description: season.id === 'winter'
        ? 'L’inverno riduce il raccolto e aumenta il consumo di cibo. Elio propone di distribuire provviste ora o razionarle per i giorni più freddi.'
        : 'Elio suggerisce di accumulare una piccola riserva prima che il tempo cambi. Una scorta oggi può evitare problemi domani.',
      deadline: gameMinutes + 180,
      options: [
        option('stock-generous', 'Apri le dispense', 'Spendi 12 cibo · forte aumento di umore e fiducia', { food: 12 }, {}, 12, 8),
        option('stock-ration', 'Distribuisci razioni', 'Spendi 5 cibo · aiuto più contenuto', { food: 5 }, {}, 4, 4),
        option('stock-save', 'Conserva tutto', 'Risparmi ora, ma la comunità se ne ricorderà', {}, {}, -7, -6),
      ],
    }),
  ];
  const seasonOffset = season.id === 'winter' ? 2 : season.id === 'autumn' ? 1 : 0;
  const mixed = Math.imul((seed ^ 0x9e3779b9) + number * 2654435761, 2246822519) >>> 0;
  const index = number === 0 ? 0 : (mixed + seasonOffset) % requests.length;
  return requests[index]!();
}

export function createCommunityState(seed: number, gameMinutes = 0): CommunityState {
  return {
    morale: 60,
    trust: 50,
    fulfilledRequests: 0,
    ignoredRequests: 0,
    requestNumber: 1,
    nextRequestAt: gameMinutes + 180,
    activeRequest: buildRequest(seed, 0, gameMinutes),
    history: [],
    lastOutcome: 'Il borgo è giovane. Le prime scelte del Consiglio daranno forma alla comunità.',
  };
}

export function ensureCommunity(state: GameState): GameState {
  const current = state.community;
  const requestLooksValid = !current?.activeRequest || (
    typeof current.activeRequest.id === 'string'
    && typeof current.activeRequest.citizen === 'string'
    && typeof current.activeRequest.title === 'string'
    && Number.isFinite(current.activeRequest.deadline)
    && Array.isArray(current.activeRequest.options)
    && current.activeRequest.options.every((item) => typeof item.id === 'string' && typeof item.label === 'string')
  );
  if (
    current
    && Number.isFinite(current.morale) && current.morale >= 0 && current.morale <= 100
    && Number.isFinite(current.trust) && current.trust >= 0 && current.trust <= 100
    && Number.isFinite(current.fulfilledRequests) && current.fulfilledRequests >= 0
    && Number.isFinite(current.ignoredRequests) && current.ignoredRequests >= 0
    && Number.isFinite(current.requestNumber) && current.requestNumber >= 1
    && Number.isFinite(current.nextRequestAt)
    && Array.isArray(current.history)
    && requestLooksValid
  ) return state;
  return { ...state, community: createCommunityState(state.seed, state.gameMinutes) };
}

export function advanceCommunityMinute(state: GameState): GameState {
  const current = state.community ?? createCommunityState(state.seed, state.gameMinutes);
  if (current.activeRequest && state.gameMinutes >= current.activeRequest.deadline) {
    const note = current.activeRequest.citizen + ' non ha ricevuto risposta. La fiducia ne risente.';
    return {
      ...state,
      community: {
        ...current,
        morale: clampCommunityValue(current.morale - 8),
        trust: clampCommunityValue(current.trust - 6),
        ignoredRequests: current.ignoredRequests + 1,
        activeRequest: null,
        nextRequestAt: state.gameMinutes + 120,
        lastOutcome: note,
        history: [note, ...current.history].slice(0, 6),
      },
    };
  }
  if (!current.activeRequest && state.gameMinutes >= current.nextRequestAt) {
    const next = buildRequest(state.seed, current.requestNumber, state.gameMinutes, state);
    return {
      ...state,
      community: {
        ...current,
        requestNumber: current.requestNumber + 1,
        activeRequest: next,
        nextRequestAt: state.gameMinutes + 180,
        lastOutcome: 'Una nuova richiesta è arrivata al Consiglio.',
      },
    };
  }
  return state;
}

export function resolveCitizenRequest(
  state: GameState,
  optionId: string,
): { state: GameState; ok: boolean; message: string } {
  const community = state.community;
  const request = community?.activeRequest;
  if (!community || !request) return { state, ok: false, message: 'Al momento non ci sono richieste da decidere.' };
  const selected = request.options.find((entry) => entry.id === optionId);
  if (!selected) return { state, ok: false, message: 'Questa scelta non è più disponibile.' };
  for (const [resource, amount] of Object.entries(selected.cost) as [Resource, number][]) {
    if (state.resources[resource] < amount) {
      const name = resource === 'wood' ? 'legname' : resource === 'stone' ? 'pietra' : resource === 'food' ? 'cibo' : 'monete';
      return { state, ok: false, message: 'Non hai abbastanza ' + name + ' per questa scelta.' };
    }
  }
  if (selected.populationDelta && state.population + selected.populationDelta > capacityOf(state.buildings)) {
    return { state, ok: false, message: 'Non ci sono posti abitativi liberi. Costruisci o migliora una casa prima di accogliere nuovi abitanti.' };
  }

  const resources: ResourceBag = { ...state.resources };
  for (const [resource, amount] of Object.entries(selected.cost) as [Resource, number][]) resources[resource] -= amount;
  for (const [resource, amount] of Object.entries(selected.reward) as [Resource, number][]) resources[resource] += amount;
  const population = Math.max(0, state.population + (selected.populationDelta ?? 0));
  const message = request.citizen + ': ' + selected.label + '. ' + selected.detail;
  const nextCommunity: CommunityState = {
    ...community,
    morale: clampCommunityValue(community.morale + selected.moodDelta),
    trust: clampCommunityValue(community.trust + selected.trustDelta),
    fulfilledRequests: community.fulfilledRequests + 1,
    activeRequest: null,
    nextRequestAt: state.gameMinutes + 180,
    housingBonus: Math.max(0, (community.housingBonus ?? 0) + (selected.housingDelta ?? 0)),
    lastOutcome: message,
    history: [message, ...community.history].slice(0, 6),
  };
  return {
    state: { ...state, population, resources, community: nextCommunity },
    ok: true,
    message: 'Il borgo ricorderà questa scelta. ' + message,
  };
}
