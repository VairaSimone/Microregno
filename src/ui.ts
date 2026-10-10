import { BUILDINGS, BUILD_ORDER, formatCost, MAX_BUILDING_LEVEL, RESOURCE_LABELS } from './game/definitions';
import { buildingUnlocked } from './game/challenge';
import { getSeason } from './game/community';
import { canExploreRegion, PROFESSION_LABELS, PROFESSIONS, PROJECTS, RESEARCH, REGIONS, worldBuildingMultiplier } from './game/livingWorld';
import type { GoodsBag, Profession } from './game/types';
import { generateTerrain, housingCapacity, POPULATION_MILESTONES, productionForBuilding, resourceRates, upgradeCost } from './game/engine';
import type { BuildingType, GameSnapshot, Resource } from './game/types';

const RESOURCES: Resource[] = ['wood', 'stone', 'food', 'coins'];
const TUTORIAL_SEEN_KEY = 'microregno:tutorial-seen:v1';
let renderedRequestId: string | null | undefined;

const $ = <T extends HTMLElement>(id: string): T => {
  const element = document.getElementById(id);
  if (!element) throw new Error('Elemento UI mancante: #' + id);
  return element as T;
};

const formatNumber = (value: number): string =>
  new Intl.NumberFormat('it-IT', { maximumFractionDigits: 0 }).format(Math.floor(value));
const formatRate = (value: number): string => value.toFixed(Math.abs(value) < 0.1 ? 2 : 1);
const formatDelta = (value: number): string => value > 0 ? '+' + value : String(value);

const dispatch = (name: string, detail?: unknown): void => {
  window.dispatchEvent(new CustomEvent(name, { detail }));
};

let latestSnapshot: GameSnapshot | null = null;

interface TutorialStep {
  key: string;
  title: string;
  description: string;
  rule: string;
  actionType: BuildingType | null;
  actionLabel: string;
  done: boolean;
}

function createTutorialSteps(snapshot: GameSnapshot): TutorialStep[] {
  const state = snapshot.state;
  const has = (type: BuildingType): boolean => state.buildings.some((building) => building.type === type);

  return [
    {
      key: 'farm',
      title: '1 · Metti in sicurezza il cibo',
      description: 'Seleziona la Fattoria e piazzala su una casella d’erba libera. È la priorità del villaggio.',
      rule: 'La fattoria produce cibo ogni minuto di gioco. Gli abitanti ne consumano 0,035 ciascuno al minuto.',
      actionType: 'farm',
      actionLabel: 'Seleziona fattoria',
      done: has('farm'),
    },
    {
      key: 'house',
      title: '2 · Fai spazio al villaggio',
      description: 'Costruisci una Casa: aggiunge 6 posti abitativi. Ti serviranno posti liberi per far arrivare altri abitanti.',
      rule: 'Costo della Casa: 12 legname e 5 pietra. I materiali vengono scalati solo quando la costruzione è valida.',
      actionType: 'house',
      actionLabel: 'Seleziona casa',
      done: has('house'),
    },
    {
      key: 'grow-six',
      title: '3 · Raggiungi 6 abitanti',
      description: 'Lascia lavorare la fattoria e aspetta il prossimo abitante. La Segheria e la Cava si sbloccano a 6 abitanti.',
      rule: 'Ogni 20 minuti di gioco arriva un abitante, se hai almeno 18 cibo e un posto abitativo libero. Il tempo scorre automaticamente.',
      actionType: null,
      actionLabel: 'Attendi il prossimo abitante',
      done: state.population >= 6,
    },
    {
      key: 'sawmill',
      title: '4 · Costruisci una Segheria',
      description: 'Ora che hai 6 abitanti, costruisci la Segheria su erba vicino agli alberi. Il contorno verde indica una casella valida.',
      rule: 'La Segheria costa 14 legname e 5 pietra e deve trovarsi entro 3 caselle da un bosco. Non si costruisce sopra l’albero.',
      actionType: 'sawmill',
      actionLabel: 'Seleziona segheria',
      done: has('sawmill'),
    },
    {
      key: 'population',
      title: '5 · Porta il borgo a 8 abitanti',
      description: 'Il villaggio può crescere da solo. Tieni le dispense rifornite e lascia passare il tempo di gioco.',
      rule: 'A 8 abitanti si sblocca il Mercato. Costruire altre case aumenta la capienza; senza cibo sufficiente, la crescita si ferma.',
      actionType: null,
      actionLabel: 'Lascia crescere il villaggio',
      done: state.population >= 8,
    },
  ];
}

function markTutorialSeen(): void {
  try {
    localStorage.setItem(TUTORIAL_SEEN_KEY, '1');
  } catch {
    // The tutorial remains accessible from the help button when storage is disabled.
  }
}

function renderTutorial(snapshot: GameSnapshot): void {
  const title = $('tutorial-title');
  const copy = $('tutorial-copy');
  const count = $('tutorial-count');
  const stepsHost = $('tutorial-steps');
  const rule = $('tutorial-rule-copy');
  const action = $('tutorial-action') as HTMLButtonElement;

  if (snapshot.mode === 'challenge') {
    title.textContent = 'Una sfida separata';
    copy.textContent = 'La sfida giornaliera usa una partita indipendente. Il tuo regno e la guida non vengono modificati.';
    count.textContent = 'REGNO';
    stepsHost.innerHTML = '';
    rule.textContent = 'Torna a “Il mio regno” per continuare la guida e conservare i progressi della città principale.';
    action.disabled = false;
    action.textContent = 'Torna al mio regno';
    return;
  }

  const steps = createTutorialSteps(snapshot);
  const completedCount = steps.filter((step) => step.done).length;
  const currentIndex = steps.findIndex((step) => !step.done);
  const current = currentIndex < 0 ? null : steps[currentIndex]!;

  count.textContent = completedCount + '/5';
  stepsHost.innerHTML = '';

  steps.forEach((step, index) => {
    const row = document.createElement('div');
    row.className = 'tutorial-step' + (step.done ? ' done' : index === currentIndex ? ' current' : '');

    const marker = document.createElement('span');
    marker.className = 'tutorial-marker';
    marker.textContent = step.done ? '✓' : String(index + 1);

    const text = document.createElement('span');
    text.className = 'tutorial-step-text';
    const heading = document.createElement('strong');
    heading.textContent = step.title;
    const status = document.createElement('small');
    status.textContent = step.done ? 'Completato' : index === currentIndex ? 'Passo attuale' : 'Da fare';
    text.append(heading, status);
    row.append(marker, text);
    stepsHost.append(row);
  });

  if (!current) {
    title.textContent = 'Il tuo primo borgo è nato';
    copy.textContent = 'Ottimo lavoro. Hai capito il ciclo base: produrre cibo, aumentare la capienza, generare materiali e far crescere la popolazione.';
    rule.textContent = 'Da qui puoi espanderti liberamente. Le sfide giornaliere sono facoltative e non toccano il tuo regno.';
    action.textContent = 'Guida completata ✓';
    action.disabled = true;
    action.classList.add('is-complete');
    return;
  }

  title.textContent = current.title;
  copy.textContent = current.description;
  rule.textContent = current.rule;
  action.classList.remove('is-complete');

  const buildAlreadySelected = current.actionType !== null && snapshot.selectedBuildType === current.actionType;
  action.textContent = buildAlreadySelected ? 'Ora clicca una casella libera sulla mappa' : current.actionLabel;
  action.disabled = current.actionType === null || buildAlreadySelected;
}

function renderBuildList(snapshot: GameSnapshot): void {
  const host = $('build-list');
  host.innerHTML = '';

  BUILD_ORDER.forEach((type) => {
    const definition = BUILDINGS[type];
    const unlocked = buildingUnlocked(snapshot.state, type);
    const affordable = Object.entries(definition.cost).every(([resource, amount]) =>
      snapshot.state.resources[resource as Resource] >= (amount ?? 0),
    );

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'build-card ' + type
      + (snapshot.selectedBuildType === type ? ' selected' : '')
      + (!unlocked ? ' locked' : '');
    button.disabled = !unlocked || (snapshot.mode === 'challenge' && snapshot.challengeCompleted);
    button.setAttribute('aria-pressed', String(snapshot.selectedBuildType === type));

    const icon = document.createElement('span');
    icon.className = 'build-icon';
    icon.setAttribute('aria-hidden', 'true');
    const sprite = document.createElement('img');
    sprite.src = new URL('assets/' + type + '.svg', document.baseURI).toString();
    sprite.alt = '';
    sprite.draggable = false;
    icon.append(sprite);

    const copy = document.createElement('span');
    copy.className = 'build-copy';

    const title = document.createElement('strong');
    title.textContent = definition.shortName;

    const cost = document.createElement('small');
    cost.textContent = !unlocked
      ? 'Sblocca a ' + definition.unlockedAt + ' abitanti'
      : formatCost(definition.cost);

    copy.append(title, cost);

    const state = document.createElement('span');
    state.className = 'build-state';
    state.textContent = !unlocked ? '⌑' : snapshot.selectedBuildType === type ? '✓' : affordable ? '+' : '·';
    state.setAttribute('aria-hidden', 'true');

    button.append(icon, copy, state);
    button.addEventListener('click', () => dispatch('microregno:build', type));
    host.append(button);
  });

  $('build-description').textContent = snapshot.selectedBuildType
    ? 'Costruzione selezionata. Scegli una casella verde valida sulla mappa; le caselle rosse non vanno bene.'
    : 'Seleziona un edificio, poi clicca una casella d’erba libera sulla mappa.';

  $('map-instruction').textContent = snapshot.selectedBuildType
    ? 'Costruisci: ' + BUILDINGS[snapshot.selectedBuildType].name + ' · scegli una casella d’erba libera.'
    : 'Seleziona una costruzione a destra, poi scegli dove piazzarla.';
}

function renderCitizenPanel(snapshot: GameSnapshot): void {
  const communityHost = $('community-content');
  const challengeHost = $('challenge-content');
  const isChallenge = snapshot.mode === 'challenge';
  communityHost.classList.toggle('hidden', isChallenge);
  challengeHost.classList.toggle('hidden', !isChallenge);
  if (isChallenge) return;

  const state = snapshot.state;
  const community = state.community;
  if (!community) return;
  const season = getSeason(state.gameMinutes);
  const request = community.activeRequest;
  $('community-eyebrow').textContent = 'VOCI DAL BORGO · ' + season.name.toLocaleUpperCase('it-IT');
  $('season-badge').textContent = season.icon;
  $('season-badge').setAttribute('aria-label', season.name);
  $('season-badge').setAttribute('title', season.description);
  $('community-season-note').textContent = season.description;
  $('community-title').textContent = request?.title ?? 'La piazza si prende una pausa';
  $('community-description').textContent = request?.description
    ?? 'Per ora non ci sono richieste urgenti. Il Consiglio ha un momento per prepararsi alla prossima decisione.';
  $('community-person').textContent = request
    ? request.citizen.toLocaleUpperCase('it-IT') + ' · ' + request.role.toLocaleUpperCase('it-IT')
    : 'CONSIGLIO DEL BORGO';
  const wait = request
    ? Math.max(0, request.deadline - state.gameMinutes)
    : Math.max(0, community.nextRequestAt - state.gameMinutes);
  const timerText = String(Math.floor(wait / 60)).padStart(2, '0') + ':' + String(wait % 60).padStart(2, '0');
  $('community-deadline').textContent = request ? 'Scade tra ' + timerText : 'Prossima tra ' + timerText;
  $('community-morale').textContent = String(community.morale);
  $('community-trust').textContent = String(community.trust);
  $('community-fulfilled').textContent = String(community.fulfilledRequests);
  $('community-morale').title = community.morale < 20 ? 'Il morale è troppo basso: la popolazione non cresce.' : community.morale >= 75 ? 'La comunità è entusiasta: produzione +5%.' : community.morale <= 25 ? 'Il morale è basso: produzione −10%.' : 'Il morale influenza la produzione e la crescita.';
  $('community-trust').title = community.trust >= 75 ? 'La comunità si fida: le monete generate dagli abitanti aumentano del 20%.' : 'Con fiducia alta gli abitanti generano più monete.';
  $('community-outcome').textContent = community.lastOutcome;

  const host = $('community-options');
  const requestId = request?.id ?? null;
  if (renderedRequestId !== requestId) {
    host.innerHTML = '';
    renderedRequestId = requestId;
    if (request) {
      request.options.forEach((choice) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'community-option';
        button.dataset.optionId = choice.id;
        const label = document.createElement('strong');
        label.textContent = choice.label;
        const detail = document.createElement('small');
        const peopleEffect = choice.populationDelta ? ' · Abitanti ' + formatDelta(choice.populationDelta) : '';
        const housingEffect = choice.housingDelta ? ' · Posti ' + formatDelta(choice.housingDelta) : '';
        detail.textContent = choice.detail + ' · Umore ' + formatDelta(choice.moodDelta) + ' · Fiducia ' + formatDelta(choice.trustDelta) + peopleEffect + housingEffect;
        button.append(label, detail);
        button.addEventListener('click', () => dispatch('microregno:request-choice', choice.id));
        host.append(button);
      });
    } else {
      const quiet = document.createElement('div');
      quiet.className = 'community-empty';
      quiet.textContent = 'Nessuna scelta richiesta in questo momento.';
      host.append(quiet);
    }
  }

  if (request) {
    Array.from(host.querySelectorAll<HTMLButtonElement>('.community-option')).forEach((button) => {
      const choice = request.options.find((entry) => entry.id === button.dataset.optionId);
      if (!choice) {
        button.disabled = true;
        return;
      }
      const canAfford = Object.entries(choice.cost).every(([resource, amount]) =>
        state.resources[resource as Resource] >= (amount ?? 0),
      );
      const hasHousing = !choice.populationDelta || state.population + choice.populationDelta <= housingCapacity(state) + (choice.housingDelta ?? 0);
      button.disabled = !canAfford || !hasHousing;
      button.title = !canAfford
        ? 'Risorse insufficienti per questa scelta.'
        : !hasHousing
          ? 'Posti abitativi insufficienti.'
          : choice.detail;
    });
  }
}

function renderObjectives(snapshot: GameSnapshot): void {
  const host = $('objectives-list');
  host.innerHTML = '';

  const state = snapshot.state;
  const farms = state.buildings.filter((building) => building.type === 'farm').length;
  const markets = state.buildings.filter((building) => building.type === 'market').length;
  const levelTwo = state.buildings.filter((building) => building.level >= 2).length;
  const levelThree = state.buildings.filter((building) => building.level >= 3).length;
  let objectives: { label: string; done: boolean; value: string }[];

  if (snapshot.mode === 'challenge') {
    objectives = [
      {
        label: 'Completa la missione',
        done: snapshot.challengeCompleted,
        value: snapshot.challengeProgress + '/' + snapshot.challenge.target,
      },
      {
        label: 'Migliora un edificio',
        done: levelTwo > 0,
        value: levelTwo > 0 ? levelTwo + ' livello 2+' : 'Da migliorare',
      },
      {
        label: 'Costruisci 3 edifici',
        done: state.buildings.filter((building) => building.type !== 'townHall').length >= 3,
        value: state.buildings.filter((building) => building.type !== 'townHall').length + '/3',
      },
    ];
  } else if (state.population < 8) {
    objectives = [
      {
        label: 'Raggiungi 8 abitanti',
        done: state.population >= 8,
        value: Math.min(8, state.population) + '/8',
      },
      {
        label: 'Costruisci una fattoria',
        done: farms > 0,
        value: farms > 0 ? farms + (farms === 1 ? ' costruita' : ' costruite') : 'Da costruire',
      },
      {
        label: 'Tieni almeno 18 cibo',
        done: state.resources.food >= 18,
        value: formatNumber(state.resources.food) + ' cibo',
      },
    ];
  } else if (state.population < 12) {
    objectives = [
      {
        label: 'Costruisci un mercato',
        done: markets > 0,
        value: markets > 0 ? markets + ' costruito' : 'Sbloccato a 8',
      },
      {
        label: 'Migliora un edificio',
        done: levelTwo > 0,
        value: levelTwo > 0 ? levelTwo + ' livello 2+' : 'Da migliorare',
      },
      {
        label: 'Raggiungi 12 abitanti',
        done: state.population >= 12,
        value: Math.min(12, state.population) + '/12',
      },
    ];
  } else if (state.population < 18) {
    objectives = [
      {
        label: 'Raggiungi 18 abitanti',
        done: state.population >= 18,
        value: Math.min(18, state.population) + '/18',
      },
      {
        label: 'Migliora 3 edifici',
        done: levelTwo >= 3,
        value: levelTwo + '/3 al livello 2+',
      },
      {
        label: 'Risparmia 50 monete',
        done: state.resources.coins >= 50,
        value: formatNumber(state.resources.coins) + '/50',
      },
    ];
  } else {
    objectives = [
      {
        label: 'Raggiungi 24 abitanti',
        done: state.population >= 24,
        value: Math.min(24, state.population) + '/24',
      },
      {
        label: 'Porta 2 edifici al livello 3',
        done: levelThree >= 2,
        value: levelThree + '/2 al livello 3',
      },
      {
        label: 'Accumula 100 monete',
        done: state.resources.coins >= 100,
        value: formatNumber(state.resources.coins) + '/100',
      },
    ];
  }

  let completed = 0;
  objectives.forEach((objective) => {
    if (objective.done) completed += 1;
    const row = document.createElement('div');
    row.className = 'objective' + (objective.done ? ' done' : '');

    const marker = document.createElement('span');
    marker.className = 'objective-marker';
    marker.textContent = objective.done ? '✓' : '·';

    const label = document.createElement('span');
    label.textContent = objective.label;

    const value = document.createElement('small');
    value.textContent = objective.value;

    row.append(marker, label, value);
    host.append(row);
  });

  $('objective-count').textContent = completed + '/3';
  const capacity = housingCapacity(state);
  const nextMilestone = POPULATION_MILESTONES.find((milestone) => !(state.milestones ?? []).includes(milestone.population));
  const capacityNote = state.population >= capacity
    ? 'Capienza piena: costruisci una casa o migliora il municipio.'
    : 'Posti liberi: ' + (capacity - state.population);
  const rewardNote = nextMilestone
    ? 'Premio +' + nextMilestone.reward + ' monete a ' + nextMilestone.population
    : 'Tutti i premi di crescita ottenuti';
  $('world-population-note').textContent = snapshot.mode === 'kingdom' ? capacityNote + ' · ' + rewardNote : capacityNote;
}

function renderInspector(snapshot: GameSnapshot): void {
  const selected = snapshot.selectedBuilding;
  const stats = $('inspector-stats');
  stats.innerHTML = '';

  if (selected) {
    const definition = BUILDINGS[selected.type];
    $('inspector-title').textContent = definition.name;
    $('inspector-copy').textContent = definition.description;

    addStat(stats, 'Livello', selected.level + ' / ' + MAX_BUILDING_LEVEL);
    if (definition.housing) addStat(stats, 'Capienza abitativa', '+' + definition.housing * selected.level);

    const output = productionForBuilding(selected, generateTerrain(snapshot.state.seed), snapshot.state.gameMinutes, snapshot.state.community?.morale ?? 60, worldBuildingMultiplier(snapshot.state, selected));
    Object.entries(output).forEach(([resource, amount]) => {
      addStat(stats, RESOURCE_LABELS[resource as Resource] + ' / min', '+' + Number(amount).toLocaleString('it-IT', { maximumFractionDigits: 2 }));
    });
    if (selected.type === 'road') addStat(stats, 'Funzione', 'Trasporto · +8% agli edifici produttivi adiacenti');
    else if (!definition.housing && Object.keys(output).length === 0) addStat(stats, 'Funzione', 'Edificio di servizio');

    const upgrade = $('upgrade-button') as HTMLButtonElement;
    const canUpgrade = selected.type !== 'road' && selected.level < MAX_BUILDING_LEVEL && !snapshot.challengeCompleted;
    upgrade.classList.toggle('hidden', !canUpgrade);
    if (canUpgrade) {
      const cost = upgradeCost(selected);
      const affordable = Object.entries(cost).every(([resource, amount]) => snapshot.state.resources[resource as Resource] >= (amount ?? 0));
      upgrade.textContent = 'Migliora · livello ' + (selected.level + 1) + ' · ' + formatCost(cost);
      upgrade.disabled = !affordable;
    }

    $('demolish-button').classList.toggle('hidden', selected.type === 'townHall' || snapshot.challengeCompleted);
    $('cancel-build').classList.add('hidden');
  } else if (snapshot.selectedBuildType) {
    const definition = BUILDINGS[snapshot.selectedBuildType];
    $('inspector-title').textContent = 'Posiziona ' + definition.shortName;
    $('inspector-copy').textContent = definition.description + ' Costo: ' + formatCost(definition.cost) + '.';
    $('upgrade-button').classList.add('hidden');
    $('demolish-button').classList.add('hidden');
    $('cancel-build').classList.remove('hidden');
  } else {
    $('upgrade-button').classList.add('hidden');
    $('inspector-title').textContent = 'Il territorio';
    $('inspector-copy').textContent = snapshot.mode === 'challenge'
      ? 'Completa l’obiettivo del giorno. I progressi della sfida sono separati dalla città principale.'
      : 'Clicca un edificio sulla mappa per selezionarlo e consultarne produzione o capienza.';
    $('upgrade-button').classList.add('hidden');
    $('demolish-button').classList.add('hidden');
    $('cancel-build').classList.add('hidden');
  }
}

function addStat(host: HTMLElement, labelText: string, valueText: string): void {
  const row = document.createElement('div');
  row.className = 'stat';
  const label = document.createElement('span');
  label.textContent = labelText;
  const value = document.createElement('strong');
  value.textContent = valueText;
  row.append(label, value);
  host.append(row);
}


type RealmTab = 'citizens' | 'laws' | 'exploration' | 'research' | 'projects';
let realmTab: RealmTab = 'citizens';

function escapeRealmHtml(value: unknown): string {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function realmMeter(label: string, value: number): string {
  const safe = Math.max(0, Math.min(100, value));
  return '<div class="realm-meter"><div><span>' + escapeRealmHtml(label) + '</span><b>' + Math.round(value) + '</b></div><span class="realm-meter-track"><i style="width:' + safe + '%"></i></span></div>';
}
function realmActionButton(label: string, action: string, id: string, value = '', disabled = false, extra = ''): string {
  return '<button type="button" class="realm-action-button ' + extra + '" data-action="' + escapeRealmHtml(action) + '" data-id="' + escapeRealmHtml(id) + '"' +
    (value ? ' data-value="' + escapeRealmHtml(value) + '"' : '') + (disabled ? ' disabled' : '') + '>' + escapeRealmHtml(label) + '</button>';
}
function hasResourceCost(resources: GameSnapshot['state']['resources'], cost: Partial<Record<Resource, number>>): boolean {
  return Object.entries(cost).every(([key, amount]) => resources[key as Resource] >= (amount ?? 0));
}
function hasGoodsCost(goods: GoodsBag, cost: Partial<GoodsBag>): boolean {
  return Object.entries(cost).every(([key, amount]) => goods[key as keyof typeof goods] >= (amount ?? 0));
}
function renderRealmDashboard(snapshot: GameSnapshot): void {
  const root = $('realm-content');
  const tabs = $('realm-tabs');
  tabs.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach((button) => {
    button.classList.toggle('active', button.dataset.tab === realmTab);
    button.setAttribute('aria-selected', String(button.dataset.tab === realmTab));
  });
  if (snapshot.mode !== 'kingdom') {
    root.innerHTML = '<div class="realm-empty"><strong>Sala del Regno in pausa</strong><p>Queste meccaniche appartengono alla partita principale. Torna a “Il mio regno” per gestire cittadini, spedizioni e leggi.</p></div>';
    return;
  }
  const state = snapshot.state;
  const world = state.world;
  if (!world) {
    root.innerHTML = '<p>Il sistema della comunità non è ancora pronto. Ricarica la partita per migrare il salvataggio.</p>';
    return;
  }
  const activeScouts = world.citizens.filter((citizen) => citizen.profession === 'scout' && citizen.status === 'resident').length;
  const goods = world.goods;
  const goodsStrip = '<div class="realm-goods-grid">' +
    [['Grano', goods.grain], ['Farina', goods.flour], ['Pane', goods.bread], ['Attrezzi', goods.tools], ['Rimedi', goods.medicine]]
      .map((entry) => '<div class="realm-good"><small>' + entry[0] + '</small><b>' + formatNumber(entry[1] as number) + '</b></div>').join('') +
    '</div>';

  if (realmTab === 'citizens') {
    const citizens = world.citizens.map((citizen) => {
      const home = state.buildings.find((building) => building.id === citizen.homeId);
      const nearestTie = Object.entries(citizen.relationships).sort((a, b) => b[1] - a[1])[0];
      const tieCitizen = nearestTie ? world.citizens.find((other) => other.id === nearestTie[0]) : undefined;
      const relationshipNote = tieCitizen && nearestTie ? (nearestTie[1] >= 25 ? 'Amico di ' : nearestTie[1] <= -15 ? 'In contrasto con ' : 'Conosce ') + tieCitizen.name : '';
      const options = PROFESSIONS.map((profession) =>
        '<option value="' + profession + '"' + (citizen.profession === profession ? ' selected' : '') + '>' + escapeRealmHtml(PROFESSION_LABELS[profession]) + '</option>',
      ).join('');
      return '<article class="realm-citizen-card"><div class="realm-citizen-head"><div><strong>' + escapeRealmHtml(citizen.name) + '</strong><small>' + citizen.age + ' anni · ' + escapeRealmHtml(citizen.traits.join(' · ')) + ' · Casa: ' + escapeRealmHtml(home ? BUILDINGS[home.type].shortName : 'da assegnare') + ' · ' + escapeRealmHtml(citizen.familyId) + (relationshipNote ? ' · ' + escapeRealmHtml(relationshipNote) : '') + (citizen.status === 'exploring' ? ' · IN SPEDIZIONE' : '') + '</small></div>' +
        '<label>Mestiere<select data-citizen="' + escapeRealmHtml(citizen.id) + '"' + (citizen.status === 'exploring' ? ' disabled' : '') + '>' + options + '</select></label></div>' +
        '<div class="realm-needs">' + realmMeter('Fame', citizen.hunger) + realmMeter('Energia', citizen.energy) + realmMeter('Felicità', citizen.happiness) + realmMeter('Salute', citizen.health) + '</div>' +
        '<div class="realm-citizen-footer"><span>' + escapeRealmHtml(citizen.lastAction) + '</span><b>Abilità: ' + Math.round(citizen.skills[citizen.profession]) + '/100</b></div></article>';
    }).join('');
    const hasMarket = state.buildings.some((building) => building.type === 'market');
    const hasMerchant = world.citizens.some((citizen) => citizen.profession === 'merchant' && citizen.status === 'resident');
    const marketPanel = '<div class="realm-market-grid">' + ([
      { id: 'grain' as const, name: 'Grano' },
      { id: 'flour' as const, name: 'Farina' },
      { id: 'bread' as const, name: 'Pane' },
      { id: 'tools' as const, name: 'Attrezzi' },
      { id: 'medicine' as const, name: 'Rimedi' },
    ]).map((item) => {
      const amount = Math.min(5, Math.floor(goods[item.id]));
      const demand = world.market.demand[item.id];
      const demandLabel = demand >= 1.2 ? 'Domanda alta' : demand <= 0.8 ? 'Domanda bassa' : 'Domanda regolare';
      return '<div class="realm-market-good"><div><strong>' + item.name + '</strong><small>' + demandLabel + ' · ' + Math.round(demand * 100) + '%</small></div>' +
        '<b>' + world.market.prices[item.id] + ' <small>monete/u.</small></b>' +
        realmActionButton(amount > 0 ? 'Vendi ' + amount + ' · +' + (amount * world.market.prices[item.id]) : 'Nessuna scorta', 'tradeGoods', item.id, String(amount), !hasMarket || !hasMerchant || amount < 1) +
        '</div>';
    }).join('') + '</div><p class="realm-market-note">' +
      (!hasMarket ? 'Costruisci un mercato per aprire le vendite.' : !hasMerchant ? 'Assegna un cittadino al mestiere Mercante per vendere le scorte.' : 'Le quotazioni cambiano ogni 120 minuti di gioco. Accumularne troppi riduce il prezzo; i beni rari possono valere di più.') +
      '</p>';
    const employment = '<div class="realm-card"><div class="realm-card-title"><h3>Filiere produttive</h3><span>BENI LAVORATI</span></div>' + goodsStrip + marketPanel +
      '<p>Le fattorie generano grano; mugnai e fornai lo trasformano in farina e pane. L’officina consuma legname e pietra per produrre attrezzi. Magazzini aggiuntivi aumentano la capienza e riducono il deterioramento di pane, farina, grano e rimedi. La capienza dei beni è ' +
      (100 + state.buildings.filter((building) => building.type === 'warehouse').reduce((sum, building) => sum + 80 * building.level, 0)) + ' unità.</p>' +
      '<div class="realm-chain">' + ['farm', 'mill', 'bakery', 'workshop'].map((type) => {
        const count = state.buildings.filter((building) => building.type === type).length;
        const labels: Record<string, string> = { farm: 'Fattorie', mill: 'Mulini', bakery: 'Panifici', workshop: 'Officine' };
        return '<span><b>' + (labels[type] ?? type) + '</b>' + count + '</span>';
      }).join('') + '</div></div>';
    root.innerHTML = '<div class="realm-summary-grid"><div><small>ABITANTI</small><strong>' + world.citizens.length + '</strong></div><div><small>IN SPEDIZIONE</small><strong>' + world.citizens.filter((citizen) => citizen.status === 'exploring').length + '</strong></div><div><small>PUNTI CONOSCENZA</small><strong>' + formatNumber(world.researchPoints) + '</strong></div></div>' +
      '<p class="realm-intro">Ogni cittadino ha un mestiere, competenze e bisogni persistenti. Assegna persone agli edifici giusti: gli edifici senza personale funzionano solo in parte.</p>' +
      '<div class="realm-citizen-list">' + citizens + '</div>' + employment;
    return;
  }

  if (realmTab === 'laws') {
    const policyCard = (title: string, description: string, id: string, current: string, choices: Array<{ value: string; label: string; note: string }>) =>
      '<article class="realm-card"><div class="realm-card-title"><h3>' + escapeRealmHtml(title) + '</h3><span>LEGGE ATTUALE</span></div><p>' + escapeRealmHtml(description) + '</p><div class="realm-policy-options">' +
      choices.map((choice) => '<button type="button" class="realm-policy-choice' + (current === choice.value ? ' active' : '') + '" data-action="law" data-id="' + id + '" data-value="' + choice.value + '">' +
        '<strong>' + escapeRealmHtml(choice.label) + '</strong><small>' + escapeRealmHtml(choice.note) + '</small>' + (current === choice.value ? '<em>In vigore</em>' : '') + '</button>').join('') +
      '</div></article>';
    root.innerHTML = '<div class="realm-summary-grid"><div><small>FIDUCIA</small><strong>' + (state.community?.trust ?? 50) + '/100</strong></div><div><small>UMORE</small><strong>' + (state.community?.morale ?? 60) + '/100</strong></div><div><small>ROTTE ATTIVE</small><strong>' + world.tradeRoutes.length + '</strong></div></div>' +
      '<p class="realm-intro">Le leggi modificano davvero entrate, consumi, produzione forestale e sicurezza. Nessuna scelta è gratuita: ogni vantaggio ha un costo.</p>' +
      policyCard('Tasse e contributi', 'Le tasse alte aumentano le monete ma mettono pressione sulla comunità.', 'tax', world.policies.tax, [
        { value: 'low', label: 'Tasse leggere', note: 'Entrate −22%, clima sociale migliore' },
        { value: 'balanced', label: 'Equilibrate', note: 'Entrate e umore senza modificatori' },
        { value: 'high', label: 'Tasse alte', note: 'Entrate +32%, rischio di malcontento' },
      ]) +
      policyCard('Gestione delle dispense', 'Il Consiglio può ridurre i consumi o investire nella generosità verso i cittadini.', 'food', world.policies.food, [
        { value: 'reserve', label: 'Razionamento prudente', note: 'Consumo di cibo −18%' },
        { value: 'balanced', label: 'Dispense equilibrate', note: 'Consumo regolare' },
        { value: 'generous', label: 'Distribuzione generosa', note: 'Consumo di cibo +14%, benessere favorito' },
      ]) +
      policyCard('Gestione dei boschi', 'Lo sfruttamento intensivo produce di più; la protezione conserva il territorio.', 'forest', world.policies.forest, [
        { value: 'protected', label: 'Protezione', note: 'Meno legname, foreste conservate' },
        { value: 'managed', label: 'Taglio controllato', note: 'Produzione standard' },
        { value: 'intensive', label: 'Taglio intensivo', note: 'Legname +25%, maggiore pressione ambientale' },
      ]) +
      '<div class="realm-card"><div class="realm-card-title"><h3>Salute dei boschi</h3><span>RIGENERAZIONE NATURALE</span></div>' + realmMeter('Integrità forestale', world.forestHealth) + '<p>Il taglio intensivo aumenta subito la resa, ma impoverisce i boschi. La protezione favorisce la rigenerazione; sotto il 35% le segherie perdono efficienza.</p></div>' +
      policyCard('Guardie e pattuglie', 'Le pattuglie riducono alcuni rischi degli eventi. La torre di guardia offre protezione aggiuntiva.', 'guard', world.policies.guard, [
        { value: 'none', label: 'Nessuna pattuglia', note: 'Nessun costo ricorrente' },
        { value: 'patrol', label: 'Pattuglie attive', note: 'Più sicurezza e fiducia' },
      ]);
    return;
  }

  if (realmTab === 'exploration') {
    const activeTrips = world.expeditions.filter((trip) => trip.status === 'active');
    const regions = REGIONS.map((region) => {
      const unlocked = canExploreRegion(world, region.id);
      const discovered = world.discoveredRegions.includes(region.id);
      const trip = activeTrips.find((entry) => entry.region === region.id);
      const completed = world.expeditions.find((entry) => entry.region === region.id && entry.status !== 'active');
      const status = trip ? 'IN VIAGGIO' : discovered ? 'ESPLORATA' : unlocked ? 'SCOPERTA POSSIBILE' : 'BLOCCATA';
      const tripText = trip ? 'Rientro previsto tra ' + Math.max(0, Math.ceil((trip.eta - state.gameMinutes) / 60)) + ' minuti di gioco.' :
        completed?.outcome ?? region.description;
      return '<article class="realm-region-card"><div><div class="realm-card-title"><h3>' + escapeRealmHtml(region.name) + '</h3><span>' + status + '</span></div><p>' + escapeRealmHtml(tripText) + '</p><small>Durata stimata: ' + Math.ceil(region.duration / 60) + ' minuti · Partenza: 8 cibo' + (goods.tools > 0 ? ' · 1 attrezzo migliora il successo' : '') + '</small></div>' +
        realmActionButton(trip ? 'Spedizione in corso' : discovered ? 'Esplora di nuovo' : 'Invia esploratore', 'expedition', region.id, '', !unlocked || !activeScouts || state.resources.food < 8 || activeTrips.length >= (world.researched.includes('cartography') ? 2 : 1) || !!trip) + '</article>';
    }).join('');
    const trips = world.expeditions.slice(-5).reverse().map((trip) => {
      const regionName = REGIONS.find((region) => region.id === trip.region)?.name ?? trip.region;
      return '<div class="realm-history-row"><span class="realm-status-dot ' + trip.status + '"></span><div><b>' + escapeRealmHtml(regionName) + '</b><small>' + escapeRealmHtml(trip.outcome) + '</small></div><strong>' + (trip.status === 'active' ? Math.ceil((trip.eta - state.gameMinutes) / 60) + ' min' : trip.status === 'success' ? 'Riuscita' : 'Parziale') + '</strong></div>';
    }).join('');
    const diplomacy = world.factions.map((faction) => '<article class="realm-faction-card"><div><h3>' + escapeRealmHtml(faction.name) + '</h3><p>' + escapeRealmHtml(faction.specialty) + '</p><div class="realm-meter"><div><span>Relazioni</span><b>' + faction.relation + '/100</b></div><span class="realm-meter-track"><i style="width:' + faction.relation + '%"></i></span></div>' +
      '<small>' + (faction.treaty ? 'Trattato attivo · rotta commerciale' : faction.relation >= 55 ? 'Pronta per un accordo commerciale' : 'Servono rapporti a 55 per un trattato') + '</small></div><div class="realm-button-row">' +
      realmActionButton('Dono · 8 monete', 'diplomacy', faction.id, 'gift', state.resources.coins < 8) +
      realmActionButton('Scambio · 6 legna', 'diplomacy', faction.id, 'trade', state.resources.wood < 6) +
      realmActionButton(faction.treaty ? 'Trattato firmato' : 'Firma trattato · 10 monete', 'diplomacy', faction.id, 'treaty', faction.treaty || faction.relation < 55 || state.resources.coins < 10) +
      '</div></article>').join('');
    root.innerHTML = '<div class="realm-summary-grid"><div><small>REGIONI NOTE</small><strong>' + world.discoveredRegions.length + '/' + REGIONS.length + '</strong></div><div><small>SPEDIZIONI ATTIVE</small><strong>' + activeTrips.length + '/' + (world.researched.includes('cartography') ? 2 : 1) + '</strong></div><div><small>ESPLORATORI DISPONIBILI</small><strong>' + activeScouts + '</strong></div></div>' +
      '<p class="realm-intro">Le spedizioni consumano cibo, richiedono un cittadino assegnato a Esploratore e possono riportare risorse, attrezzi, conoscenze e incontri diplomatici. Alcune regioni richiedono la cartografia.</p>' +
      '<h3 class="realm-section-title">Frontiera e spedizioni</h3><div class="realm-region-list">' + regions + '</div>' +
      '<div class="realm-card"><div class="realm-card-title"><h3>Diario delle spedizioni</h3><span>ULTIME CINQUE</span></div>' + (trips || '<p>Non è ancora partita nessuna squadra.</p>') + '</div>' +
      '<h3 class="realm-section-title">Diplomazia e rotte commerciali</h3><p class="realm-intro">Invia doni e commercia per migliorare i rapporti. Con relazione almeno 55 puoi firmare un trattato: la rotta aumenta le entrate ogni minuto di gioco.</p>' +
      '<div class="realm-faction-list">' + diplomacy + '</div>';
    return;
  }

  if (realmTab === 'research') {
    const active = world.activeResearch;
    const researches = RESEARCH.map((research) => {
      const done = world.researched.includes(research.id);
      const isActive = active === research.id;
      const disabled = done || !!active || world.researchPoints < research.cost;
      const progress = isActive ? Math.min(100, world.researchProgress / research.duration * 100) : 0;
      return '<article class="realm-research-card ' + (done ? 'completed' : isActive ? 'in-progress' : '') + '"><div class="realm-card-title"><h3>' + escapeRealmHtml(research.name) + '</h3><span>' + escapeRealmHtml(research.path) + '</span></div><p>' + escapeRealmHtml(research.description) + '</p>' +
        (isActive ? '<div class="realm-progress-track"><i style="width:' + progress + '%"></i></div><small>Ricerca in corso · ' + Math.floor(progress) + '%</small>' :
          done ? '<small class="realm-complete-label">Conoscenza acquisita</small>' : '<small>Costo ' + research.cost + ' punti · durata base ' + Math.ceil(research.duration / 60) + ' min di gioco</small>') +
        realmActionButton(done ? 'Completata' : isActive ? 'In corso' : 'Avvia ricerca', 'research', research.id, '', disabled) + '</article>';
    }).join('');
    root.innerHTML = '<div class="realm-summary-grid"><div><small>PUNTI CONOSCENZA</small><strong>' + formatNumber(world.researchPoints) + '</strong></div><div><small>RICERCHE ACQUISITE</small><strong>' + world.researched.length + '/' + RESEARCH.length + '</strong></div><div><small>STUDIOSI</small><strong>' + world.citizens.filter((citizen) => citizen.profession === 'scholar').length + '</strong></div></div>' +
      '<p class="realm-intro">La conoscenza cresce nel tempo e con gli studiosi. Costruisci una scuola e assegna il mestiere Studioso per accelerare il progresso. Avvia una ricerca alla volta: una volta completata, il bonus resta attivo.</p>' +
      '<div class="realm-research-list">' + researches + '</div>';
    return;
  }

  const projects = PROJECTS.map((project) => {
    const stage = world.projectStages[project.id] ?? 0;
    const completed = world.completedProjects.includes(project.id);
    const cost = project.stages[Math.min(stage, project.stages.length - 1)] ?? {};
    return '<article class="realm-project-card ' + (completed ? 'completed' : '') + '"><div class="realm-card-title"><h3>' + escapeRealmHtml(project.name) + '</h3><span>' + (completed ? 'COMPLETATO' : 'FASE ' + (stage + 1) + '/3') + '</span></div><p>' + escapeRealmHtml(project.description) + '</p>' +
      '<div class="realm-project-stages">' + [0, 1, 2].map((step) => '<i class="' + (step < stage ? 'done' : '') + '"></i>').join('') + '</div>' +
      (completed ? '<small class="realm-complete-label">Beneficio permanente attivo</small>' : '<small>Prossima fase: ' + escapeRealmHtml(formatCost(cost)) + '</small>') +
      realmActionButton(completed ? 'Completato' : 'Finanzia la fase', 'project', project.id, '', completed || !hasResourceCost(state.resources, cost)) + '</article>';
  }).join('');
  const event = world.activeEvent;
  const eventPanel = event ? '<article class="realm-event-card"><div class="realm-card-title"><h3>' + escapeRealmHtml(event.title) + '</h3><span>DECISIONE DEL CONSIGLIO</span></div><p>' + escapeRealmHtml(event.description) + '</p><div class="realm-event-choices">' +
    event.choices.map((choice) => '<div class="realm-event-choice"><div><strong>' + escapeRealmHtml(choice.label) + '</strong><small>' + escapeRealmHtml(choice.detail) + '</small><em>' +
      (choice.cost && Object.keys(choice.cost).length ? 'Costo: ' + escapeRealmHtml(formatCost(choice.cost)) : 'Nessun costo materiale') +
      (choice.reward && Object.keys(choice.reward).length ? ' · Ricompensa: ' + escapeRealmHtml(formatCost(choice.reward)) : '') + '</em></div>' +
      realmActionButton('Scegli', 'event', choice.id, '', !hasResourceCost(state.resources, choice.cost ?? {}) || !hasGoodsCost(goods, choice.goodsCost ?? {})) + '</div>').join('') + '</div></article>'
    : '<div class="realm-empty"><strong>Il Consiglio attende</strong><p>Nessun evento urgente. Gli imprevisti emergono in base al tempo e alle scoperte, e possono aprire storie concatenate.</p></div>';
  root.innerHTML = '<div class="realm-summary-grid"><div><small>PROGETTI COMPLETATI</small><strong>' + world.completedProjects.length + '/4</strong></div><div><small>EVENTI IN CORSO</small><strong>' + (event ? '1' : '0') + '</strong></div><div><small>CRONACA</small><strong>' + world.chronicle.length + ' voci</strong></div></div>' +
    '<h3 class="realm-section-title">Avvenimenti e storie concatenate</h3>' + eventPanel +
    '<h3 class="realm-section-title">Grandi opere collettive</h3><p class="realm-intro">Ogni opera ha tre fasi finanziabili. I benefici diventano permanenti quando il progetto è completato.</p><div class="realm-project-list">' + projects + '</div>' +
    '<div class="realm-card"><div class="realm-card-title"><h3>Cronaca del regno</h3><span>MEMORIA PERSISTENTE</span></div><div class="realm-world-chronicle">' +
    (world.chronicle.length ? world.chronicle.map((entry) => '<p>' + escapeRealmHtml(entry) + '</p>').join('') : '<p>Le prime storie del regno devono ancora essere scritte.</p>') + '</div></div>';
}


export function setupUI(): void {
  const realmDialog = $('realm-dialog') as HTMLDialogElement;
  const realmContent = $('realm-content');
  $('realm-dashboard-button').addEventListener('click', () => {
    if (latestSnapshot) renderRealmDashboard(latestSnapshot);
    if (!realmDialog.open) realmDialog.showModal();
  });
  $('close-realm-dialog').addEventListener('click', () => realmDialog.close());
  $('close-realm-dialog-footer').addEventListener('click', () => realmDialog.close());
  $('realm-tabs').addEventListener('click', (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-tab]');
    if (!button) return;
    realmTab = button.dataset.tab as RealmTab;
    if (latestSnapshot) renderRealmDashboard(latestSnapshot);
  });
  realmContent.addEventListener('click', (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-action]');
    if (!button || button.disabled) return;
    const action = button.dataset.action ?? '';
    const id = button.dataset.id ?? '';
    const value = button.dataset.value ?? '';
    if (action === 'law') dispatch('microregno:realm-action', { type: 'law', id, value });
    else if (action === 'research') dispatch('microregno:realm-action', { type: 'research', id });
    else if (action === 'expedition') dispatch('microregno:realm-action', { type: 'expedition', id });
    else if (action === 'project') dispatch('microregno:realm-action', { type: 'project', id });
    else if (action === 'event') dispatch('microregno:realm-action', { type: 'event', id });
    else if (action === 'diplomacy') dispatch('microregno:realm-action', { type: 'diplomacy', id, value });
    else if (action === 'tradeGoods') dispatch('microregno:realm-action', { type: 'tradeGoods', good: id as keyof GoodsBag, amount: Number(value) });
  });
  realmContent.addEventListener('change', (event) => {
    const select = (event.target as HTMLElement).closest<HTMLSelectElement>('select[data-citizen]');
    if (!select) return;
    dispatch('microregno:realm-action', { type: 'assign', citizenId: select.dataset.citizen, value: select.value as Profession });
    select.blur();
    if (latestSnapshot) renderRealmDashboard(latestSnapshot);
  });

  const dialog = $('help-dialog') as HTMLDialogElement;
  const historyDialog = $('community-history-dialog') as HTMLDialogElement;

  $('community-history-button').addEventListener('click', () => {
    if (!latestSnapshot) return;
    const community = latestSnapshot.state.community;
    const list = $('community-history-list');
    list.innerHTML = '';
    if (community) {
      $('community-history-summary').textContent = 'Umore ' + community.morale + '/100 · Fiducia ' + community.trust + '/100 · richieste accolte ' + community.fulfilledRequests + ' · ignorate ' + community.ignoredRequests + '. Le soglie della comunità influenzano produzione, crescita e monete.';
      const entries = community.history;
      if (entries.length === 0) {
        const empty = document.createElement('p');
        empty.className = 'community-history-empty';
        empty.textContent = 'La cronaca è ancora vuota. Rispondi alla prima richiesta per lasciare un segno nella storia del borgo.';
        list.append(empty);
      } else {
        entries.forEach((entry, index) => {
          const row = document.createElement('div');
          row.className = 'community-history-entry';
          const marker = document.createElement('b');
          marker.textContent = String(entries.length - index).padStart(2, '0');
          const text = document.createElement('span');
          text.textContent = entry;
          row.append(marker, text);
          list.append(row);
        });
      }
    }
    if (!historyDialog.open) historyDialog.showModal();
  });
  $('close-community-history').addEventListener('click', () => historyDialog.close());
  $('close-community-history-footer').addEventListener('click', () => historyDialog.close());

  const openGuide = (): void => {
    if (!dialog.open) dialog.showModal();
  };

  $('help-button').addEventListener('click', openGuide);
  $('close-help').addEventListener('click', () => dialog.close());
  $('start-playing').addEventListener('click', () => dialog.close());
  $('skip-tutorial').addEventListener('click', () => dialog.close());

  dialog.addEventListener('close', markTutorialSeen);

  try {
    if (localStorage.getItem(TUTORIAL_SEEN_KEY) !== '1') dialog.showModal();
  } catch {
    // If storage is unavailable, the tutorial remains reachable from the help button.
  }

  $('kingdom-mode').addEventListener('click', () => dispatch('microregno:mode', 'kingdom'));
  $('challenge-mode').addEventListener('click', () => dispatch('microregno:mode', 'challenge'));
  $('center-map').addEventListener('click', () => dispatch('microregno:center'));
  $('cancel-build').addEventListener('click', () => dispatch('microregno:build', null));

  $('tutorial-action').addEventListener('click', () => {
    if (!latestSnapshot) return;
    if (latestSnapshot.mode === 'challenge') {
      dispatch('microregno:mode', 'kingdom');
      return;
    }
    const current = createTutorialSteps(latestSnapshot).find((step) => !step.done);
    if (current?.actionType) dispatch('microregno:build', current.actionType);
    else openGuide();
  });

  $('upgrade-button').addEventListener('click', () => dispatch('microregno:upgrade'));

  $('demolish-button').addEventListener('click', () => {
    if (window.confirm('Demolire questo edificio? Recupererai una parte dei materiali.')) {
      dispatch('microregno:demolish');
    }
  });

  $('reset-game').addEventListener('click', () => {
    if (window.confirm('Vuoi davvero ricominciare il regno? Il salvataggio principale verrà eliminato.')) {
      dispatch('microregno:reset');
    }
  });

  window.addEventListener('microregno:state', ((event: CustomEvent<GameSnapshot>) => {
    const snapshot = event.detail;
    latestSnapshot = snapshot;
    const state = snapshot.state;

    RESOURCES.forEach((resource) => {
      $('resource-' + resource).textContent = formatNumber(state.resources[resource]);
    });
    $('population-count').textContent = formatNumber(state.population) + ' / ' + housingCapacity(state);

    const rates = resourceRates(state, generateTerrain(state.seed));
    const foodRate = rates.food;
    $('rate-food').textContent = (foodRate >= 0 ? '+' : '') + formatRate(foodRate) + '/min';

    (['wood', 'stone', 'coins'] as Resource[]).forEach((resource) => {
      const rate = rates[resource];
      $('rate-' + resource).textContent = Math.abs(rate) > 0.0001 ? (rate > 0 ? '+' : '') + formatRate(rate) + '/min' : '—';
    });

    $('population-rate').textContent = state.resources.food < 18 ? 'serve cibo' : state.population < housingCapacity(state) ? 'può crescere' : 'case piene';
    $('world-title').textContent = snapshot.mode === 'challenge' ? snapshot.challenge.title : 'Valle di Brumadoro';
    $('world-subtitle').textContent = snapshot.mode === 'challenge'
      ? 'Una mappa uguale per tutti. La tua strategia fa la differenza.'
      : 'Un piccolo inizio. Infinite possibilità.';
    $('world-eyebrow').textContent = snapshot.mode === 'challenge' ? 'SFIDA A TEMPO' : 'IL TUO TERRITORIO';
    $('world-status').textContent = snapshot.mode === 'challenge' ? 'Sfida quotidiana in corso' : 'Il tuo regno è in pace';
    $('kingdom-mode').classList.toggle('active', snapshot.mode === 'kingdom');
    $('challenge-mode').classList.toggle('active', snapshot.mode === 'challenge');

    $('challenge-title').textContent = snapshot.challenge.title;
    $('challenge-description').textContent = snapshot.challenge.description;
    $('challenge-date').textContent = snapshot.challenge.date;
    $('challenge-progress-label').textContent = snapshot.challengeProgress + ' / ' + snapshot.challenge.target;
    $('challenge-progress-fill').style.width =
      Math.min(100, snapshot.challengeProgress / snapshot.challenge.target * 100) + '%';
    $('challenge-progress-fill').classList.toggle('complete', snapshot.challengeCompleted);
    $('challenge-best').textContent = snapshot.challengeCompleted
      ? 'Completata · ' + snapshot.bestScore + ' pt'
      : 'Record: ' + (snapshot.bestScore ? snapshot.bestScore + ' pt' : '—');

    $('save-status').textContent = snapshot.mode === 'kingdom'
      ? 'Salvataggio locale attivo'
      : 'Progressi della sfida salvati oggi';
    $('local-save-label').textContent = snapshot.mode === 'kingdom'
      ? 'Dati salvati su questo dispositivo'
      : 'Sfida del giorno · ' + snapshot.challenge.date;

    $('tip-text').textContent = snapshot.mode === 'challenge'
      ? snapshot.challenge.reward + ' attende chi completa la missione.'
      : state.resources.food < 18
        ? 'Le dispense scendono sotto 18: la crescita si ferma finché non produci altro cibo.'
        : state.population >= 8
          ? 'Hai superato il primo traguardo. Completa gli obiettivi a destra, migliora gli edifici e usa le monete con criterio.'
          : 'Costruisci prima una fattoria. Con cibo sufficiente e posti liberi, arriveranno nuovi abitanti.';

    renderCitizenPanel(snapshot);
    renderTutorial(snapshot);
    renderBuildList(snapshot);
    renderObjectives(snapshot);
    renderInspector(snapshot);
    const realmDialog = $('realm-dialog') as HTMLDialogElement;
    const realmContent = $('realm-content');
    if (realmDialog.open && !(document.activeElement instanceof HTMLSelectElement && realmContent.contains(document.activeElement))) renderRealmDashboard(snapshot);
  }) as EventListener);

  window.addEventListener('microregno:clock', ((event: CustomEvent<string>) => {
    $('game-clock').textContent = event.detail;
  }) as EventListener);

  window.addEventListener('microregno:notice', ((event: CustomEvent<string>) => showToast(event.detail)) as EventListener);
  window.addEventListener('microregno:save-status', ((event: CustomEvent<string>) => {
    $('save-status').textContent = event.detail;
  }) as EventListener);
}

let toastTimer: number | undefined;
function showToast(message: string): void {
  const region = $('toast-region');
  region.textContent = message;
  region.classList.add('visible');
  if (toastTimer) window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => region.classList.remove('visible'), 3100);
}