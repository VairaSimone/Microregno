import { BUILDINGS, BUILD_ORDER, formatCost, MAX_BUILDING_LEVEL, RESOURCE_LABELS } from './game/definitions';
import { buildingUnlocked } from './game/challenge';
import { generateTerrain, housingCapacity, POPULATION_MILESTONES, productionForBuilding, resourceRates, upgradeCost } from './game/engine';
import type { BuildingType, GameSnapshot, Resource } from './game/types';

const RESOURCES: Resource[] = ['wood', 'stone', 'food', 'coins'];
const TUTORIAL_SEEN_KEY = 'microregno:tutorial-seen:v1';

const $ = <T extends HTMLElement>(id: string): T => {
  const element = document.getElementById(id);
  if (!element) throw new Error('Elemento UI mancante: #' + id);
  return element as T;
};

const formatNumber = (value: number): string =>
  new Intl.NumberFormat('it-IT', { maximumFractionDigits: 0 }).format(Math.floor(value));
const formatRate = (value: number): string => value.toFixed(Math.abs(value) < 0.1 ? 2 : 1);

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
        label: snapshot.challenge.title,
        done: snapshot.challengeCompleted,
        value: snapshot.challengeProgress + '/' + snapshot.challenge.target,
      },
      {
        label: 'Risorse totali',
        done: Object.values(state.resources).reduce((sum, amount) => sum + amount, 0) >= 100,
        value: formatNumber(Object.values(state.resources).reduce((sum, amount) => sum + amount, 0)),
      },
      {
        label: 'Edifici costruiti',
        done: state.buildings.length >= 3,
        value: String(state.buildings.length),
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
  } else if (state.population < 12 || markets === 0 || levelTwo === 0) {
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

    const output = productionForBuilding(selected, generateTerrain(snapshot.state.seed));
    Object.entries(output).forEach(([resource, amount]) => {
      addStat(stats, RESOURCE_LABELS[resource as Resource] + ' / min', '+' + Number(amount).toLocaleString('it-IT', { maximumFractionDigits: 2 }));
    });
    if (!definition.housing && Object.keys(output).length === 0) addStat(stats, 'Funzione', 'Centro del regno');

    const upgrade = $('upgrade-button') as HTMLButtonElement;
    const canUpgrade = selected.level < MAX_BUILDING_LEVEL && !snapshot.challengeCompleted;
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

export function setupUI(): void {
  const dialog = $('help-dialog') as HTMLDialogElement;

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

    renderTutorial(snapshot);
    renderBuildList(snapshot);
    renderObjectives(snapshot);
    renderInspector(snapshot);
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