import { BUILDINGS } from './definitions';
import { ensureWorldState } from './livingWorld';
import type { Building, CommunityState, CitizenRequest, CitizenRequestOption, GameState, Profession, Resource, ResourceBag, SeasonInfo } from './types';

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
  return buildings.reduce((total, building) => total + (building.construction?.kind === 'build' ? 0 : (BUILDINGS[building.type].housing ?? 0) * building.level), 0);
}

const REQUEST_ROLE_LABELS: Record<Profession, string> = {
  farmer: 'Contadino', lumberjack: 'Boscaiolo', miner: 'Minatore', merchant: 'Mercante',
  miller: 'Mugnaio', baker: 'Fornaio', scholar: 'Studioso', scout: 'Esploratore',
  builder: 'Costruttore', guard: 'Guardia', artisan: 'Artigiano',
};

function linkRequestToCitizen(request: CitizenRequest, state?: GameState, preferred: Profession[] = []): CitizenRequest {
  const residents = (state?.world?.citizens ?? []).filter((citizen) => citizen.status === 'resident');
  if (!residents.length) return request;
  const existing = request.citizenId ? residents.find((citizen) => citizen.id === request.citizenId) : undefined;
  let candidates = existing ? [existing] : residents.filter((citizen) => citizen.age >= 14 && preferred.includes(citizen.profession));
  if (!candidates.length) candidates = residents.filter((citizen) => citizen.age >= 14);
  if (!candidates.length) candidates = residents;
  const citizen = existing ?? candidates[Math.abs((state?.seed ?? 0) + request.id.length * 17 + (state?.gameMinutes ?? 0)) % candidates.length]!;
  const role = REQUEST_ROLE_LABELS[citizen.profession];
  const description = request.description.replace(/\b(?:Ada|Berto|Neri|Mira|Lina|Elio)\b/g, citizen.name);
  const rivals = residents.filter((other) => other.id !== citizen.id &&
    (other.profession === citizen.profession || (!!citizen.workplaceId && citizen.workplaceId === other.workplaceId)));
  const rival = request.title === 'Una lite in piazza' && !request.rivalId && rivals.length
    ? rivals[Math.abs((state?.seed ?? 0) + request.id.length * 11) % rivals.length]
    : undefined;
  const rivalExists = request.rivalId && residents.some((other) => other.id === request.rivalId);
  return {
    ...request, citizenId: citizen.id, citizen: citizen.name, role, description,
    ...(rival ? { rivalId: rival.id } : rivalExists ? { rivalId: request.rivalId } : {}),
  };
}

function buildRequest(seed: number, number: number, gameMinutes: number, state?: GameState): CitizenRequest {
  const season = getSeason(gameMinutes);
  const hasRoom = state ? state.population < capacityOf(state.buildings) + (state.community?.housingBonus ?? 0) : true;
  const food = state?.resources.food ?? 42;
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
        option('newcomer-shelter', 'Prepara un alloggio', 'Spendi 8 legname e 3 pietra · crea 2 posti e accogli un abitante', { wood: 8, stone: 3 }, {}, 7, 7, 1, 2),
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
  const preferredByRequest: Profession[][] = [
    ['baker', 'farmer'], ['artisan', 'builder'], ['merchant'], ['farmer', 'builder'], ['merchant', 'artisan'], ['farmer', 'merchant'],
  ];
  return linkRequestToCitizen(requests[index]!(), state, preferredByRequest[index] ?? []);
}

export function createCommunityState(seed: number, gameMinutes = 0, state?: GameState): CommunityState {
  return {
    morale: 60,
    trust: 50,
    fulfilledRequests: 0,
    ignoredRequests: 0,
    requestNumber: 1,
    nextRequestAt: gameMinutes + 180,
    activeRequest: buildRequest(seed, 0, gameMinutes, state),
    history: [],
    lastOutcome: 'Il borgo è giovane. Le prime scelte del Consiglio daranno forma alla comunità.',
  };
}

function validPartialResourceBag(value: unknown): value is Partial<ResourceBag> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const allowed = new Set<Resource>(['wood', 'stone', 'food', 'coins']);
  return Object.entries(value).every(([key, amount]) => allowed.has(key as Resource) && typeof amount === 'number' && Number.isFinite(amount) && amount >= 0);
}

function validRequestOption(value: unknown): value is CitizenRequestOption {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const item = value as Partial<CitizenRequestOption>;
  return typeof item.id === 'string' && item.id.length > 0
    && typeof item.label === 'string' && typeof item.detail === 'string'
    && validPartialResourceBag(item.cost) && validPartialResourceBag(item.reward)
    && typeof item.moodDelta === 'number' && Number.isFinite(item.moodDelta)
    && typeof item.trustDelta === 'number' && Number.isFinite(item.trustDelta)
    && (item.populationDelta === undefined || (Number.isInteger(item.populationDelta) && Math.abs(item.populationDelta) <= 100))
    && (item.housingDelta === undefined || (Number.isInteger(item.housingDelta) && item.housingDelta >= 0 && item.housingDelta <= 200));
}

export function ensureCommunity(state: GameState): GameState {
  const current = state.community;
  const request = current?.activeRequest;
  const requestLooksValid = !request || (
    typeof request.id === 'string' && request.id.length > 0
    && typeof request.citizen === 'string' && typeof request.role === 'string'
    && typeof request.title === 'string' && typeof request.description === 'string'
    && Number.isFinite(request.deadline) && request.deadline >= 0
    && Array.isArray(request.options) && request.options.length > 0 && request.options.length <= 8
    && request.options.every(validRequestOption)
  );
  if (
    current
    && Number.isFinite(current.morale) && current.morale >= 0 && current.morale <= 100
    && Number.isFinite(current.trust) && current.trust >= 0 && current.trust <= 100
    && Number.isSafeInteger(current.fulfilledRequests) && current.fulfilledRequests >= 0
    && Number.isSafeInteger(current.ignoredRequests) && current.ignoredRequests >= 0
    && Number.isSafeInteger(current.requestNumber) && current.requestNumber >= 1
    && Number.isFinite(current.nextRequestAt) && current.nextRequestAt >= 0
    && Array.isArray(current.history) && current.history.every((entry) => typeof entry === 'string')
    && typeof current.lastOutcome === 'string'
    && requestLooksValid
    && (current.housingBonus === undefined || (Number.isFinite(current.housingBonus) && current.housingBonus >= 0))
  ) return state;
  return { ...state, community: createCommunityState(state.seed, state.gameMinutes) };
}

export function advanceCommunityMinute(state: GameState): GameState {
  const currentState = state.community ?? createCommunityState(state.seed, state.gameMinutes, state);
  const current = currentState.activeRequest ? { ...currentState, activeRequest: linkRequestToCitizen(currentState.activeRequest, state) } : currentState;
  if (current.activeRequest && state.gameMinutes >= current.activeRequest.deadline) {
    const expiredRequest = current.activeRequest;
    const note = expiredRequest.citizen + ' non ha ricevuto risposta. La fiducia ne risente.';
    const world = state.world ? {
      ...state.world,
      citizens: state.world.citizens.map((citizen) => citizen.id === expiredRequest.citizenId ? {
        ...citizen, happiness: Math.max(0, Math.min(100, citizen.happiness - 5)),
        lastAction: 'La sua richiesta è stata ignorata dal Consiglio',
        personalHistory: [...(citizen.personalHistory ?? []), 'Il Consiglio non ha risposto alla richiesta: la fiducia nelle autorità è diminuita.'].slice(-6),
      } : citizen),
    } : undefined;
    return {
      ...state, ...(world ? { world } : {}),
      community: {
        ...current, morale: clampCommunityValue(current.morale - 8), trust: clampCommunityValue(current.trust - 6),
        ignoredRequests: current.ignoredRequests + 1, activeRequest: null, nextRequestAt: state.gameMinutes + 120,
        lastOutcome: note, history: [note, ...current.history].slice(0, 6),
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
  return current === state.community ? state : { ...state, community: current };
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
  if (selected.populationDelta && state.population + selected.populationDelta > capacityOf(state.buildings) + (community.housingBonus ?? 0) + (selected.housingDelta ?? 0)) {
    return { state, ok: false, message: 'Non ci sono posti abitativi liberi. Costruisci o migliora una casa prima di accogliere nuovi abitanti.' };
  }

  const resources: ResourceBag = { ...state.resources };
  for (const [resource, amount] of Object.entries(selected.cost) as [Resource, number][]) resources[resource] -= amount;
  for (const [resource, amount] of Object.entries(selected.reward) as [Resource, number][]) resources[resource] += amount;
  const population = Math.max(5, state.population + (selected.populationDelta ?? 0));
  const appliedPopulationDelta = population - state.population;
  const signed = (value: number): string => value > 0 ? '+' + value : String(value);
  const consequences = ['Umore ' + signed(selected.moodDelta), 'fiducia ' + signed(selected.trustDelta)];
  if (appliedPopulationDelta) consequences.push('abitanti ' + signed(appliedPopulationDelta));
  if (selected.housingDelta) consequences.push('posti abitativi ' + signed(selected.housingDelta));
  const message = request.citizen + ': ' + selected.label + '. ' + selected.detail + ' (' + consequences.join(', ') + ').';
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
  let world = state.world;
  if (world) {
    const requesterId = request.citizenId ?? world.citizens.find((citizen) => citizen.name === request.citizen)?.id;
    const memory = selected.moodDelta >= 0
      ? 'Il Consiglio ha risposto alla sua richiesta: ' + selected.label + '.'
      : 'La decisione del Consiglio lo ha deluso: ' + selected.label + '.';
    let citizens = world.citizens.map((citizen) => citizen.id === requesterId ? {
      ...citizen,
      happiness: Math.max(0, Math.min(100, Math.round((citizen.happiness + selected.moodDelta * 0.4) * 100) / 100)),
      lastAction: selected.moodDelta >= 0 ? 'Ha ricevuto una risposta dal Consiglio' : 'È rimasto deluso dalla risposta del Consiglio',
      personalHistory: [...(citizen.personalHistory ?? []), memory].slice(-6),
    } : citizen);
    const relationDelta = selected.id === 'mediate-ignore' ? -10 : selected.id.startsWith('mediate-') ? 8 : 0;
    if (request.rivalId && relationDelta !== 0) {
      const first = citizens.find((citizen) => citizen.id === requesterId);
      const second = citizens.find((citizen) => citizen.id === request.rivalId);
      if (first && second) {
        const prior = ((first.relationships[second.id] ?? 0) + (second.relationships[first.id] ?? 0)) / 2;
        const value = Math.max(-100, Math.min(100, prior + relationDelta));
        citizens = citizens.map((citizen) => {
          if (citizen.id === first.id) return { ...citizen, relationships: { ...citizen.relationships, [second.id]: value }, personalHistory: [...(citizen.personalHistory ?? []), relationDelta > 0 ? 'Ha fatto pace con ' + second.name + '.' : 'La lite con ' + second.name + ' è peggiorata.'].slice(-6) };
          if (citizen.id === second.id) return { ...citizen, relationships: { ...citizen.relationships, [first.id]: value }, personalHistory: [...(citizen.personalHistory ?? []), relationDelta > 0 ? 'Ha fatto pace con ' + first.name + '.' : 'La lite con ' + first.name + ' è peggiorata.'].slice(-6) };
          return citizen;
        });
      }
    }
    world = { ...world, citizens };
  }
  const nextState = { ...state, ...(world ? { world } : {}), population, resources, community: nextCommunity };
  return {
    state: appliedPopulationDelta ? ensureWorldState(nextState) : nextState,
    ok: true,
    message: 'Il borgo ricorderà questa scelta. ' + message,
  };
}
