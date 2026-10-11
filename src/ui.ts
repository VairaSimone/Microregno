import { BUILDINGS, BUILD_ORDER, constructionDuration, formatConstructionTime, formatCost, MAX_BUILDING_LEVEL, RESOURCE_LABELS } from './game/definitions';
import { buildingUnlocked } from './game/challenge';
import { activeChallengeStreak, getAchievementProgress, getChallengeArchive } from './game/profile';
import { EPOCHS,EPOCH_ORDER,getBuildingEpoch,getCharterRequirements,getCurrentEpochId,getEpochRequirements,isEpochUnlocked } from './game/progression';
import { getSeason } from './game/community';
import { getResourcePurchasePrice, goodsStorageCapacity, totalStoredGoods } from './game/livingWorld';
import { canColonizeRegion, canExploreRegion, frontierFoundingCost, frontierStructureAllowed, FRONTIER_GRID_SIZE, FRONTIER_STRUCTURES, CITIZEN_ACTIVITY_LABELS, getCitizenActivity, getCitizenWorkplace, getInterestGroups, projectRequirement, PROFESSION_LABELS, PROFESSIONS, PROJECTS, researchRequirement, RESEARCH, REGIONS, worldBuildingMultiplier } from './game/livingWorld';
import type { GoodsBag, MarketResource, WorldState } from './game/types';
import { generateTerrain, housingCapacity, POPULATION_MILESTONES, productionForBuilding, resourceRates, upgradeCost } from './game/engine';
import type { BuildingType, FrontierStructureType, GameSnapshot, Profession, RegionId, Resource } from './game/types';

const WORKPLACE_PROFESSION: Partial<Record<BuildingType, Profession>> = {
  farm: 'farmer', sawmill: 'lumberjack', quarry: 'miner', market: 'merchant', mill: 'miller', bakery: 'baker', school: 'scholar', watchtower: 'guard', workshop: 'artisan', university: 'scholar',
  orchard: 'farmer', fishingHut: 'farmer', herbGarden: 'farmer', inn: 'merchant', ironworks: 'artisan', observatory: 'scholar',
};

const RESOURCES: Resource[] = ['wood', 'stone', 'food', 'coins'];
const CHALLENGE_REWARDS = [
  { id: 'founder-title', name: 'Pioniere di Brumadoro', detail: 'Titolo storico permanente del profilo locale.', icon: '✦', status: 'TITOLO' },
  { id: 'granary-blessing', name: 'Benedizione della dispensa', detail: '+6 cibo all’inizio di ogni nuova sfida.', icon: '♧', status: 'ATTIVA' },
  { id: 'forester-mark', name: 'Sigillo del boscaiolo', detail: '+6 legname all’inizio di ogni nuova sfida.', icon: '♢', status: 'ATTIVA' },
  { id: 'stonekeeper-mark', name: 'Sigillo della cava', detail: '+6 pietra all’inizio di ogni nuova sfida.', icon: '◆', status: 'ATTIVA' },
  { id: 'royal-favor', name: 'Favore reale', detail: '+4 monete all’inizio di ogni nuova sfida.', icon: '♛', status: 'ATTIVA' },
  { id: 'golden-banner', name: 'Stendardo dorato', detail: '+3 monete all’inizio di ogni nuova sfida.', icon: '⚑', status: 'ATTIVA' },
  { id: 'crown-signet', name: 'Sigillo della Corona', detail: '+5 cibo all’inizio di ogni nuova sfida.', icon: '♕', status: 'ATTIVA' },
] as const;
const TUTORIAL_SEEN_KEY = 'microregno:tutorial-seen:v2';
let renderedRequestId: string | null | undefined;
let showAllBuildOptions = false;
let kingdomSaveStatus = 'Salvataggio locale attivo';
let challengeSaveStatus = 'Sfida pronta, salvataggio in attesa';

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

function publicAssetUrl(file: string): string {
  // GitHub Pages may be opened with or without a trailing slash. Treat extensionless
  // final path segments as directories so assets still resolve under /Microregno/.
  const page = new URL(window.location.href);
  const finalSegment = page.pathname.split('/').pop() ?? '';
  if (!page.pathname.endsWith('/') && !finalSegment.includes('.')) page.pathname += '/';
  return new URL('assets/' + file.replace(/^\/+/, ''), page).toString();
}

let latestSnapshot: GameSnapshot | null = null;

type TutorialAction = 'build' | 'upgrade' | 'community' | 'research' | 'exploration' | 'projects' | 'objectives' | 'challenge' | 'hint';
interface TutorialStep {
  key: string;
  title: string;
  description: string;
  rule: string;
  actionType: BuildingType | null;
  action: TutorialAction;
  actionLabel: string;
  done: boolean;
}

let tutorialExplainMore = false;
let lastTutorialMessageKey = '';

function createTutorialSteps(snapshot: GameSnapshot): TutorialStep[] {
  const state = snapshot.state;
  const has = (type: BuildingType): boolean => state.buildings.some((building) => building.type === type && building.construction?.kind !== 'build');
  const hasEpoch = (id: 'village' | 'borough' | 'city' | 'metropolis' | 'empire'): boolean => state.progression?.unlockedEpochs.includes(id) ?? false;
  const world = state.world;
  const researched = world?.researched.length ?? 0;
  const regions = world?.discoveredRegions.length ?? 0;
  const projects = world?.completedProjects.length ?? 0;

  return [
    {
      key: 'farm', title: '1 · Metti al sicuro il cibo',
      description: 'Ciao, custode! Sono Bricco. Prima di tutto, costruiamo una Fattoria: senza cibo nessun borgo può crescere.',
      rule: 'Scegli Fattoria nel pannello Costruisci, poi clicca una casella d’erba libera. Costa 10 legname e 3 pietra; il cantiere dura 12 secondi, poi inizierà a produrre cibo con lavoratori.',
      actionType: 'farm', action: 'build', actionLabel: 'Scegli la Fattoria', done: has('farm'),
    },
    {
      key: 'house', title: '2 · Diamo un tetto ai vicini',
      description: 'Bene! Adesso prepara una Casa. Il Municipio ha già spazio per cinque abitanti, ma per crescere ci servono altri posti.',
      rule: 'La Casa costa 12 legname e 5 pietra, il cantiere dura 10 secondi e aggiunge 6 posti solo quando è terminata. Per attirare nuovi abitanti tieni almeno 18 cibo e un posto libero.',
      actionType: 'house', action: 'build', actionLabel: 'Scegli una Casa', done: has('house'),
    },
    {
      key: 'village', title: '3 · Facciamo nascere il Villaggio',
      description: 'Ora osserva le risorse: il tempo scorre da solo. Lascia lavorare la Fattoria e conserva abbastanza cibo per le famiglie.',
      rule: 'Il Villaggio si sblocca con 8 abitanti, una Fattoria e una Casa. Le stagioni cambiano raccolti e consumi; in inverno il cibo serve ancora di più.',
      actionType: null, action: 'hint', actionLabel: 'Come faccio crescere la popolazione?', done: hasEpoch('village'),
    },
    {
      key: 'industry', title: '4 · Apriamo una bottega produttiva',
      description: 'Il Villaggio è nato! Ora possiamo produrre materiali invece di consumare soltanto le scorte iniziali. Cominciamo dalla Segheria.',
      rule: 'La Segheria produce legname e rende meglio vicino al bosco; la Cava produce pietra vicino alla roccia. Servono lavoratori compatibili e posti di lavoro disponibili.',
      actionType: 'sawmill', action: 'build', actionLabel: 'Scegli la Segheria', done: has('sawmill') || has('quarry'),
    },
    {
      key: 'market', title: '5 · Apriamo il Mercato',
      description: 'Legname e pietra sostengono le costruzioni, ma le monete pagano miglioramenti e decisioni importanti. Il Mercato aiuta l’economia.',
      rule: 'Il Mercato si sblocca nel Villaggio e costa 18 legname e 10 pietra. Prima controlla la disponibilità delle risorse e scegli una casella libera.',
      actionType: 'market', action: 'build', actionLabel: 'Scegli il Mercato', done: has('market'),
    },
    {
      key: 'community', title: '6 · Ascoltiamo i cittadini',
      description: 'Un regno non è fatto soltanto di edifici: le persone chiedono aiuto, propongono scambi e reagiscono alle decisioni del Consiglio.',
      rule: 'Leggi le richieste nel pannello della comunità e valuta costi e conseguenze. Le richieste ignorate abbassano umore e fiducia; questi valori influenzano crescita, produzione e monete.',
      actionType: null, action: 'community', actionLabel: 'Mostrami le richieste in piazza',
      done: (state.community?.fulfilledRequests ?? 0) > 0 || (state.community?.ignoredRequests ?? 0) > 0,
    },
    {
      key: 'upgrade', title: '7 · Miglioriamo un edificio',
      description: 'Non devi costruire all’infinito: puoi rendere più efficaci gli edifici che hai già. Selezionane uno sulla mappa e guarda il pannello Dettagli.',
      rule: 'Seleziona un edificio, poi usa Migliora. I livelli aumentano l’efficacia, ma costano risorse e monete. Un edificio al livello 2 è necessario per fondare il Borgo.',
      actionType: null, action: 'upgrade', actionLabel: 'Aiutami a migliorare un edificio', done: state.buildings.some((building) => building.level >= 2),
    },
    {
      key: 'borough', title: '7 · Fondiamo il Borgo',
      description: 'Sei vicino a un nuovo capitolo. Porta la popolazione a 12, costruisci il Mercato e migliora almeno un edificio al livello 2.',
      rule: 'Apri “Campagna e obiettivi” per controllare ogni requisito. Quando nasce il Borgo si aprono la ricerca, la diplomazia, le spedizioni e le grandi opere.',
      actionType: null, action: 'objectives', actionLabel: 'Mostrami gli obiettivi del Borgo', done: hasEpoch('borough'),
    },
    {
      key: 'research', title: '8 · Scopri una nuova conoscenza',
      description: 'La Sala del Regno contiene decisioni che non si vedono sulla mappa: ricerca, mestieri, leggi ed eventi. Apriamo la scheda Ricerca.',
      rule: 'Scegli una ricerca, controllane requisiti e costo e lascia che il progresso avanzi. La Città richiederà due ricerche completate.',
      actionType: null, action: 'research', actionLabel: 'Apri la Sala del Regno · Ricerca', done: researched >= 1,
    },
    {
      key: 'exploration', title: '9 · Spingiamoci oltre la frontiera',
      description: 'Una città non cresce solo con gli edifici. Le spedizioni portano risorse, conoscenza e accesso a nuovi territori.',
      rule: 'Nella Sala del Regno apri Esplorazione. Scegli guida, equipaggio e scorte: inviare cittadini in spedizione li rende temporaneamente indisponibili per il lavoro.',
      actionType: null, action: 'exploration', actionLabel: 'Apri Esplorazione', done: regions >= 1,
    },
    {
      key: 'project', title: '10 · Completiamo una grande opera',
      description: 'Le grandi opere sono investimenti a più fasi. Non basta iniziarle: bisogna finanziare tutti gli stadi per ottenere i benefici permanenti.',
      rule: 'Apri la scheda Progetti nella Sala del Regno. Prima di investire controlla costo, materiali e risorse che ti serviranno per mantenere il borgo.',
      actionType: null, action: 'projects', actionLabel: 'Apri i Progetti', done: projects >= 1,
    },
    {
      key: 'city', title: '11 · Prepariamo la Città',
      description: 'Il passaggio alla Città è una prova completa di gestione: popolazione, istruzione, ricerca, grandi opere e rotte devono crescere insieme.',
      rule: 'Servono 18 abitanti, una Scuola, 2 ricerche, una grande opera, 2 regioni scoperte e un edificio al livello 3. Ogni potenziamento richiede un cantiere: pianifica prima i materiali.',
      actionType: null, action: 'objectives', actionLabel: 'Controlla i requisiti della Città', done: hasEpoch('city'),
    },
    {
      key: 'university', title: '12 · Costruiamo l’Università Reale',
      description: 'La Città apre la strada all’Università Reale: il centro della conoscenza e il simbolo della tua nuova epoca.',
      rule: 'L’Università si sblocca nella Città e costa 30 legname, 24 pietra e 25 monete. Pianifica le scorte prima di piazzarla.',
      actionType: 'university', action: 'build', actionLabel: 'Scegli l’Università Reale', done: has('university'),
    },
    {
      key: 'metropolis', title: '13 · Facciamo crescere la Metropoli',
      description: 'Una grande città vive di specializzazioni. Frutteti, peschiere, erbe, locande e fucine danno nuove strade alla tua economia.',
      rule: 'La Metropoli richiede 28 abitanti, l’Università, quattro ricerche, due opere, tre regioni, due edifici al livello 4 e tre edifici specializzati.',
      actionType: null, action: 'objectives', actionLabel: 'Controlla i requisiti della Metropoli', done: hasEpoch('metropolis'),
    },
    {
      key: 'empire', title: '14 · Fondiamo un Impero',
      description: 'Ora non basta più crescere: devi coordinare regioni, alleanze, grandi opere ed edifici che hanno raggiunto la loro maturità.',
      rule: 'L’Impero richiede 45 abitanti, quattro edifici al livello 5, tutte le grandi opere, cinque ricerche, quattro regioni, tre accordi o rotte, Osservatorio e 350 monete.',
      actionType: null, action: 'objectives', actionLabel: 'Controlla i requisiti dell’Impero', done: hasEpoch('empire'),
    },
    {
      key: 'charter', title: '15 · La Carta della Corona',
      description: 'L’ultimo traguardo mette alla prova tutto ciò che hai imparato. La Corona richiede una città prospera, alleanze e opere durature.',
      rule: 'La Carta richiede un vero Impero: 60 abitanti, sei edifici al livello 5, quattro grandi opere, quattro accordi o rotte, tutte le cinque regioni, Università al livello 5, Osservatorio al livello 3 e 500 monete.',
      actionType: null, action: 'objectives', actionLabel: 'Controlla la Carta della Corona', done: state.progression?.campaignComplete === true,
    },
    {
      key: 'challenge', title: '16 · Metti alla prova il regno',
      description: 'Quando vuoi una sfida breve, prova la missione giornaliera. Cambia obiettivo e condizioni e ti permette di migliorare medaglie e record.',
      rule: 'La sfida del giorno usa una partita indipendente: non consuma risorse e non cambia gli edifici del tuo regno principale. Medaglie e traguardi sono salvati nel profilo locale.',
      actionType: null, action: 'challenge', actionLabel: 'Scopri la sfida del giorno', done: snapshot.playerProfile.records.length > 0,
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
  const ruleTitle = $('tutorial-rule-title');
  const rulePanel = $('tutorial-rule');
  const action = $('tutorial-action') as HTMLButtonElement;
  const explain = $('tutorial-explain') as HTMLButtonElement;
  const voice = $('tutorial-voice-label');
  const progressNote = $('tutorial-progress-note');

  if (snapshot.mode === 'challenge') {
    if (lastTutorialMessageKey !== 'challenge') tutorialExplainMore = false;
    lastTutorialMessageKey = 'challenge';
    title.textContent = 'Una missione alla volta';
    count.textContent = 'SFIDA';
    voice.textContent = 'Bricco · stratega delle missioni';
    progressNote.textContent = 'La tua città principale è al sicuro';
    copy.textContent = tutorialExplainMore
      ? snapshot.challenge.condition + ' Ricompensa dichiarata: ' + snapshot.challenge.reward + '. Il punteggio migliore e le medaglie restano nel profilo locale.'
      : 'Questa è la sfida di oggi: ' + snapshot.challenge.title + '. ' + snapshot.challenge.description + ' Io ti aiuto a leggere il vincolo e scegliere una strategia.';
    stepsHost.innerHTML = '';
    rulePanel.classList.add('hidden');
    rule.textContent = snapshot.challenge.condition;
    action.disabled = false;
    action.classList.remove('is-complete');
    action.textContent = 'Torna al mio regno';
    explain.textContent = tutorialExplainMore ? 'Torna al consiglio iniziale' : 'Spiegami la regola della sfida';
    return;
  }

  const steps = createTutorialSteps(snapshot);
  const completedCount = steps.filter((step) => step.done).length;
  const currentIndex = steps.findIndex((step) => !step.done);
  const current = currentIndex < 0 ? null : steps[currentIndex]!;
  const messageKey = current?.key ?? 'complete';
  if (lastTutorialMessageKey !== messageKey) tutorialExplainMore = false;
  lastTutorialMessageKey = messageKey;
  count.textContent = completedCount + '/' + steps.length;
  progressNote.textContent = current
    ? 'Passo ' + (currentIndex + 1) + ' di ' + steps.length + ' · ' + completedCount + ' tappe completate'
    : 'La guida base è completata · ora puoi esplorare liberamente';
  stepsHost.innerHTML = '';

  const visibleStart = current
    ? Math.max(0, Math.min(currentIndex - 1, steps.length - 3))
    : Math.max(0, steps.length - 3);
  const visibleSteps = steps.slice(visibleStart, Math.min(steps.length, visibleStart + 3));
  visibleSteps.forEach((step, offset) => {
    const index = visibleStart + offset;
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
    status.textContent = step.done ? 'Completato' : index === currentIndex ? 'Adesso' : 'Prossimo';
    text.append(heading, status);
    row.append(marker, text);
    stepsHost.append(row);
  });

  if (!current) {
    title.textContent = 'Brumadoro è nelle tue mani';
    voice.textContent = 'Bricco · un custode soddisfatto';
    copy.textContent = tutorialExplainMore
      ? 'Puoi continuare la campagna, esplorare territori, perfezionare le produzioni o affrontare la sfida del giorno. Io resto qui: apri “?” se vuoi rileggere le basi.'
      : 'Ce l’hai fatta! Hai attraversato le tappe principali. Non devi seguire una ricetta: sperimenta, osserva le conseguenze e costruisci il regno che vuoi.';
    ruleTitle.textContent = 'Il mio ultimo consiglio';
    rule.textContent = 'Prima di una spesa importante guarda produzione e consumi, richieste dei cittadini e obiettivi della campagna. Le scorte crescono nel tempo, ma anche i bisogni.';
    rulePanel.classList.toggle('hidden', tutorialExplainMore);
    action.textContent = 'Guida completata ✓';
    action.disabled = true;
    action.classList.add('is-complete');
    explain.textContent = tutorialExplainMore ? 'Nascondi il consiglio' : 'Un ultimo consiglio';
    return;
  }

  title.textContent = current.title;
  voice.textContent = tutorialExplainMore ? 'Bricco · te lo spiego meglio' : 'Bricco · al tuo fianco';
  copy.textContent = tutorialExplainMore ? current.rule : current.description;
  ruleTitle.textContent = 'Da ricordare';
  rule.textContent = current.rule;
  rulePanel.classList.toggle('hidden', tutorialExplainMore);
  action.classList.remove('is-complete');

  const buildAlreadySelected = current.actionType !== null && snapshot.selectedBuildType === current.actionType;
  action.textContent = buildAlreadySelected ? 'Ora scegli una casella verde' : current.actionLabel;
  if (current.action === 'upgrade' && snapshot.selectedBuilding) action.textContent = 'Migliora l’edificio selezionato';
  action.disabled = false;
  explain.textContent = tutorialExplainMore ? 'Torna al consiglio iniziale' : 'Perché è importante?';
}

function renderBuildList(snapshot: GameSnapshot): void {
  const host = $('build-list');
  host.innerHTML = '';

  const population = snapshot.state.population;
  const coreTypes = new Set<BuildingType>([
    'farm',
    'house',
    ...(population >= 8 ? ['sawmill', 'quarry', 'market', 'road', 'mill', 'warehouse', 'orchard', 'fishingHut', 'herbGarden'] as BuildingType[] : []),
    ...(population >= 12 ? ['bakery', 'school', 'workshop', 'watchtower', 'inn', 'ironworks'] as BuildingType[] : []),
    ...(isEpochUnlocked(snapshot.state, 'city') ? ['university'] as BuildingType[] : []),
    ...(isEpochUnlocked(snapshot.state, 'metropolis') ? ['observatory'] as BuildingType[] : []),
  ]);
  // Keep the first screen focused on the next sensible choices. The complete sandbox
  // catalogue remains available on demand; locked items are not the first thing a new
  // player has to parse.
  const visibleTypes = BUILD_ORDER.filter((type) =>
    showAllBuildOptions || (coreTypes.has(type) && buildingUnlocked(snapshot.state, type)),
  );

  visibleTypes.forEach((type) => {
    const definition = BUILDINGS[type];
    const unlocked = buildingUnlocked(snapshot.state, type);
    const forbiddenByChallenge = snapshot.mode === 'challenge' && snapshot.challenge.constraint === 'no-roads' && type === 'road';
    const affordable = Object.entries(definition.cost).every(([resource, amount]) =>
      snapshot.state.resources[resource as Resource] >= (amount ?? 0),
    );

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'build-card ' + type
      + (snapshot.selectedBuildType === type ? ' selected' : '')
      + (!unlocked ? ' locked' : '');
    button.disabled = !unlocked || forbiddenByChallenge || (snapshot.mode === 'challenge' && snapshot.challengeCompleted);
    button.setAttribute('aria-pressed', String(snapshot.selectedBuildType === type));

    const icon = document.createElement('span');
    icon.className = 'build-icon';
    icon.setAttribute('aria-hidden', 'true');
    const sprite = document.createElement('img');
    const spriteName = type === 'townHall' ? 'town-hall' : type;
    sprite.src = publicAssetUrl(spriteName + '.svg');
    sprite.alt = '';
    sprite.draggable = false;
    sprite.addEventListener('error', () => {
      // A missing asset should never leave a dead/empty icon in the build menu.
      sprite.remove();
      icon.classList.add('build-icon-fallback');
      icon.textContent = definition.icon;
    }, { once: true });
    icon.append(sprite);

    const copy = document.createElement('span');
    copy.className = 'build-copy';

    const title = document.createElement('strong');
    title.textContent = definition.shortName;

    const cost = document.createElement('small');
    const requiredEpoch = getBuildingEpoch(type);
    const lockDetails = [
      ...(population < definition.unlockedAt ? [definition.unlockedAt + ' abitanti'] : []),
      ...(!isEpochUnlocked(snapshot.state, requiredEpoch) ? ['epoca ' + EPOCHS[requiredEpoch].name] : []),
    ];
    cost.textContent = forbiddenByChallenge ? 'Vietata in questa sfida' : !unlocked ? 'Richiede ' + lockDetails.join(' · ') : formatCost(definition.cost) + ' · ⏱ ' + formatConstructionTime(constructionDuration(type));

    copy.append(title, cost);

    const state = document.createElement('span');
    state.className = 'build-state';
    state.textContent = !unlocked ? '⌑' : snapshot.selectedBuildType === type ? '✓' : affordable ? '+' : '·';
    state.setAttribute('aria-hidden', 'true');

    button.append(icon, copy, state);
    button.addEventListener('click', () => dispatch('microregno:build', type));
    host.append(button);
  });

  const catalogToggle = document.createElement('button');
  catalogToggle.type = 'button';
  catalogToggle.className = 'catalog-toggle';
  catalogToggle.setAttribute('aria-expanded', String(showAllBuildOptions));
  catalogToggle.textContent = showAllBuildOptions
    ? 'Mostra solo gli edifici consigliati'
    : 'Catalogo completo · tutti gli edifici';
  catalogToggle.addEventListener('click', () => {
    showAllBuildOptions = !showAllBuildOptions;
    if (latestSnapshot) renderBuildList(latestSnapshot);
  });
  host.append(catalogToggle);

  $('build-description').textContent = snapshot.selectedBuildType
    ? 'Costruzione selezionata. Clicca una casella verde libera sulla mappa; le caselle rosse non sono valide.'
    : showAllBuildOptions
      ? 'Catalogo completo: gli edifici bloccati indicano quanti abitanti servono per sbloccarli.'
      : population < 6
        ? 'Per iniziare bastano Fattoria e Casa: prima assicura il cibo, poi aumenta i posti abitativi.'
        : !isEpochUnlocked(snapshot.state, 'village')
          ? 'Raggiungi 8 abitanti, con una Fattoria e una Casa, per fondare il Villaggio e sbloccare le prime botteghe.'
          : !isEpochUnlocked(snapshot.state, 'borough')
            ? 'Il Villaggio è nato: prepara il Borgo con 12 abitanti, un Mercato e un edificio al livello 2.'
            : !isEpochUnlocked(snapshot.state, 'city')
              ? 'Il Borgo apre ricerca, diplomazia e spedizioni: completa le prove per fondare la Città.'
              : 'Prepara la Carta della Corona: grandi opere, alleanze, regioni e Università Reale.';

  $('map-instruction').textContent = snapshot.selectedBuildType
    ? 'Costruisci: ' + BUILDINGS[snapshot.selectedBuildType].name + ' · scegli una casella d’erba libera.'
    : population < 6 && !showAllBuildOptions
      ? 'Primo obiettivo: Fattoria → Casa → almeno 18 unità di cibo.'
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

function renderEpochPanel(snapshot: GameSnapshot): void {
  const track = $('epoch-track');
  const checklist = $('epoch-checklist');
  track.innerHTML = '';
  checklist.innerHTML = '';

  if (snapshot.mode === 'challenge') {
    $('epoch-title').textContent = 'Partita separata';
    $('epoch-count').textContent = 'SFIDA';
    $('epoch-summary').textContent = 'La sfida del giorno non modifica la campagna del regno. Torna a “Il mio regno” per continuare le epoche.';
    $('epoch-story').textContent = 'La storia di Brumadoro resta nel salvataggio principale.';
    $('epoch-progress').classList.add('challenge-epoch');
    return;
  }
  $('epoch-progress').classList.remove('challenge-epoch');

  const state = snapshot.state;
  const current = getCurrentEpochId(state);
  const currentIndex = EPOCH_ORDER.indexOf(current);
  const complete = state.progression?.campaignComplete === true;
  EPOCH_ORDER.forEach((id) => {
    const step = document.createElement('div');
    step.className = 'epoch-step' + (isEpochUnlocked(state, id) ? ' done' : '') + (id === current ? ' active' : '');
    const icon = document.createElement('span');
    icon.textContent = EPOCHS[id].icon;
    const label = document.createElement('small');
    label.textContent = EPOCHS[id].name;
    step.append(icon, label);
    track.append(step);
  });

  $('epoch-title').textContent = complete ? 'Carta della Corona' : EPOCHS[current].name;
  $('epoch-count').textContent = complete ? 'CAMPAGNA CONCLUSA' : (currentIndex + 1) + '/6 EPOCHE';
  $('epoch-summary').textContent = complete
    ? 'Brumadoro è diventato un Impero. Hai completato la Carta della Corona: il regno può continuare a prosperare in modalità libera.'
    : current === 'empire'
      ? 'L’ultima impresa è la Carta della Corona: dimostra che il tuo Impero sa sostenere popolazione, opere pubbliche, rotte e conoscenza.'
      : current === 'metropolis'
        ? 'La Metropoli ha bisogno di quartieri specializzati, edifici al livello 4 e una rete di ricerca più matura.'
        : current === 'city'
          ? 'La Città ha aperto nuove possibilità. Rafforza l’economia, completa le ricerche e prepara la Metropoli.'
          : EPOCHS[current].summary;

  // Detailed requirements are shown once in the objective list below.

  const story = state.progression?.history[0] ?? EPOCHS.settlement.story;
  $('epoch-story').textContent = complete
    ? (state.progression?.history[0] ?? 'La Carta della Corona è stata firmata.')
    : story;
}

function renderChallengeRewards(snapshot: GameSnapshot): void {
  const profile = snapshot.playerProfile;
  $('challenge-profile-summary').textContent = profile.totalCompleted + ' vittorie · serie ' + activeChallengeStreak(profile) + ' · record ' + profile.allTimeBestScore + ' pt';
  $('challenge-medal-count').textContent = String(profile.medals.length);
  const medalsHost = $('challenge-medals');
  medalsHost.innerHTML = '';
  const medals = [...profile.medals].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
  if (!medals.length) {
    const empty = document.createElement('p');
    empty.className = 'challenge-collection-empty';
    empty.textContent = 'La tua prima medaglia ti aspetta. Completa la sfida del giorno per iniziare la raccolta.';
    medalsHost.append(empty);
  } else {
    medals.forEach(medal => {
      const row = document.createElement('div');
      row.className = 'challenge-medal-row ' + medal.tier;
      const icon = document.createElement('span');
      icon.className = 'challenge-medal-icon';
      icon.textContent = medal.icon;
      const copy = document.createElement('span');
      copy.className = 'challenge-medal-copy';
      const title = document.createElement('strong');
      title.textContent = medal.name;
      const detail = document.createElement('small');
      const record = profile.records.find(item => item.challengeId === medal.id);
      detail.textContent = medal.date + ' · ' + medal.tier + (record ? ' · ' + record.bestScore + ' pt' : '');
      copy.append(title, detail);
      row.append(icon, copy);
      medalsHost.append(row);
    });
  }

  const rewardHost = $('challenge-rewards');
  rewardHost.innerHTML = '';
  const earnedRewards = CHALLENGE_REWARDS.filter(reward => profile.unlockedRewards.includes(reward.id));
  $('challenge-reward-count').textContent = earnedRewards.length + ' / ' + CHALLENGE_REWARDS.length + ' sbloccate';
  if (!earnedRewards.length) {
    const empty = document.createElement('p');
    empty.className = 'challenge-collection-empty';
    empty.textContent = 'Completa le sfide e i traguardi: i bonus sbloccati resteranno nel tuo profilo locale.';
    rewardHost.append(empty);
  } else {
    earnedRewards.forEach(reward => {
      const card = document.createElement('article');
      card.className = 'challenge-reward-card' + (reward.id === 'founder-title' ? ' title' : '');
      const icon = document.createElement('span');
      icon.className = 'challenge-reward-icon';
      icon.textContent = reward.icon;
      icon.setAttribute('aria-hidden', 'true');
      const copy = document.createElement('span');
      copy.className = 'challenge-reward-copy';
      const title = document.createElement('strong');
      title.textContent = reward.name;
      const detail = document.createElement('small');
      detail.textContent = reward.detail;
      copy.append(title, detail);
      const status = document.createElement('span');
      status.className = 'challenge-reward-status';
      status.textContent = reward.status;
      card.append(icon, copy, status);
      rewardHost.append(card);
    });
  }

  const achievementsHost = $('challenge-achievements');
  achievementsHost.innerHTML = '';
  getAchievementProgress(profile).forEach(achievement => {
    const row = document.createElement('div');
    row.className = 'challenge-achievement-row' + (achievement.unlocked ? ' unlocked' : '');
    const header = document.createElement('div');
    header.className = 'challenge-achievement-header';
    const title = document.createElement('strong');
    title.textContent = achievement.name;
    const progress = document.createElement('small');
    progress.textContent = achievement.unlocked ? 'Sbloccato ✓' : achievement.progress.toLocaleString('it-IT') + ' / ' + achievement.target.toLocaleString('it-IT');
    header.append(title, progress);
    const detail = document.createElement('p');
    detail.textContent = achievement.description;
    const reward = document.createElement('small');
    reward.className = 'challenge-achievement-reward';
    reward.textContent = (achievement.unlocked ? 'Ricompensa ottenuta: ' : 'Ricompensa: ') + achievement.rewardName;
    const track = document.createElement('span');
    track.className = 'challenge-achievement-track';
    const fill = document.createElement('i');
    fill.style.width = Math.min(100, achievement.progress / achievement.target * 100) + '%';
    track.append(fill);
    row.append(header, detail, reward, track);
    achievementsHost.append(row);
  });

  const archiveHost = $('challenge-records');
  archiveHost.innerHTML = '';
  const archive = getChallengeArchive(profile, 8);
  $('challenge-record-count').textContent = profile.records.length + (profile.records.length === 1 ? ' risultato' : ' risultati');
  if (!archive.length) {
    const empty = document.createElement('p');
    empty.className = 'challenge-collection-empty';
    empty.textContent = 'Qui troverai i migliori risultati delle sfide completate. Ogni record conserva il punteggio migliore raggiunto in quella giornata.';
    archiveHost.append(empty);
  } else {
    const categoryNames = { population: 'Popolazione', resources: 'Risorse', farms: 'Fattorie', housing: 'Abitazioni' } as const;
    const tierNames = { bronze: 'Bronzo', silver: 'Argento', gold: 'Oro' } as const;
    archive.forEach(record => {
      const row = document.createElement('article');
      row.className = 'challenge-record-row ' + record.tier;
      const copy = document.createElement('div');
      copy.className = 'challenge-record-copy';
      const title = document.createElement('strong');
      title.textContent = record.title;
      const elapsed = Math.max(0, Math.floor(record.achievedInMinutes));
      const duration = elapsed >= 60 ? Math.floor(elapsed / 60) + ' h ' + String(elapsed % 60).padStart(2, '0') + ' min' : elapsed + ' min';
      const detail = document.createElement('small');
      detail.textContent = record.date + ' · ' + categoryNames[record.category] + ' · ' + duration;
      copy.append(title, detail);
      const result = document.createElement('div');
      result.className = 'challenge-record-score';
      const score = document.createElement('strong');
      score.textContent = record.bestScore.toLocaleString('it-IT') + ' pt';
      const tier = document.createElement('small');
      tier.textContent = 'Medaglia ' + tierNames[record.tier];
      result.append(score, tier);
      row.append(copy, result);
      archiveHost.append(row);
    });
  }
}

function renderObjectives(snapshot: GameSnapshot): void {
  const host = $('objectives-list');
  host.innerHTML = '';

  const state = snapshot.state;
  let objectives: { label: string; done: boolean; value: string }[];

  if (snapshot.mode === 'challenge') {
    const levelTwo = state.buildings.filter((building) => building.level >= 2).length;
    const buildingCount = state.buildings.filter((building) => building.type !== 'townHall').length;
    objectives = [
      { label: 'Completa la missione', done: snapshot.challengeCompleted, value: snapshot.challengeProgress + '/' + snapshot.challenge.target },
      { label: 'Migliora un edificio', done: levelTwo > 0, value: levelTwo > 0 ? levelTwo + ' livello 2+' : 'Da migliorare' },
      { label: 'Costruisci 3 edifici', done: buildingCount >= 3, value: buildingCount + '/3' },
    ];
  } else {
    const current = getCurrentEpochId(state);
    const nextIndex = EPOCH_ORDER.indexOf(current) + 1;
    const criteria = current === 'empire' || state.progression?.campaignComplete
      ? getCharterRequirements(state)
      : getEpochRequirements(state, EPOCH_ORDER[nextIndex] ?? 'empire');
    objectives = criteria.map((entry) => ({ label: entry.label, done: entry.done, value: entry.value }));
    if (state.progression?.campaignComplete) {
      objectives = [{ label: 'Carta della Corona firmata', done: true, value: 'Campagna completata' }, ...objectives];
    }
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

  $('objective-count').textContent = completed + '/' + objectives.length;
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
    if (selected.construction) {
      addStat(stats, 'Stato', selected.construction.kind === 'build' ? 'Cantiere in corso' : 'Miglioramento in corso');
      addStat(stats, 'Tempo restante', formatConstructionTime(Math.max(0, Math.ceil((selected.construction.completesAt - Date.now()) / 1000))));
      if (selected.construction.kind === 'upgrade') addStat(stats, 'Prossimo livello', String(selected.construction.targetLevel));
    }
    if (definition.housing) addStat(stats, 'Capienza abitativa', (selected.construction?.kind === 'build' ? 'al termine: +' : '+') + definition.housing * selected.level);

    const output = productionForBuilding(selected, generateTerrain(snapshot.state.seed), snapshot.state.gameMinutes, snapshot.state.community?.morale ?? 60, worldBuildingMultiplier(snapshot.state, selected));
    Object.entries(output).forEach(([resource, amount]) => {
      addStat(stats, RESOURCE_LABELS[resource as Resource] + ' / min', '+' + Number(amount).toLocaleString('it-IT', { maximumFractionDigits: 2 }));
    });
    if (selected.type === 'road') addStat(stats, 'Funzione', 'Trasporto · +8% agli edifici produttivi adiacenti');
    else if (!definition.housing && Object.keys(output).length === 0) addStat(stats, 'Funzione', 'Edificio di servizio');

    const upgrade = $('upgrade-button') as HTMLButtonElement;
    const canUpgrade = selected.type !== 'road' && selected.level < MAX_BUILDING_LEVEL && !selected.construction && !snapshot.challengeCompleted;
    upgrade.classList.toggle('hidden', !canUpgrade);
    if (canUpgrade) {
      const cost = upgradeCost(selected);
      const affordable = Object.entries(cost).every(([resource, amount]) => snapshot.state.resources[resource as Resource] >= (amount ?? 0));
      upgrade.textContent = 'Migliora · livello ' + (selected.level + 1) + ' · ' + formatCost(cost) + ' · ⏱ ' + formatConstructionTime(constructionDuration(selected.type, selected.level, 'upgrade'));
      upgrade.disabled = !affordable;
    }

    $('demolish-button').classList.toggle('hidden', selected.type === 'townHall' || snapshot.challengeCompleted);
    $('cancel-build').classList.add('hidden');
  } else if (snapshot.selectedBuildType) {
    const definition = BUILDINGS[snapshot.selectedBuildType];
    $('inspector-title').textContent = 'Posiziona ' + definition.shortName;
    $('inspector-copy').textContent = definition.description + ' Costo: ' + formatCost(definition.cost) + '. Tempo di costruzione: ' + formatConstructionTime(constructionDuration(snapshot.selectedBuildType)) + '.';
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
function renderFrontierMap(world: WorldState): string {
  const nodes: Array<{ id: 'forest' | 'mountains' | 'lake' | 'ancient-ruins' | 'borderlands'; x: number; y: number; icon: string; name: string }> = [
    { id: 'forest', x: 98, y: 93, icon: '🌲', name: 'Bosco antico' },
    { id: 'mountains', x: 104, y: 223, icon: '⛰', name: 'Passo delle rocce' },
    { id: 'lake', x: 250, y: 52, icon: '◉', name: 'Lago velato' },
    { id: 'ancient-ruins', x: 392, y: 93, icon: '⌂', name: 'Rovine della Corona' },
    { id: 'borderlands', x: 394, y: 224, icon: '⚑', name: 'Terre di confine' },
  ];
  const links: Array<{ from: [number, number]; to: [number, number]; open: boolean }> = [
    { from: [247, 153], to: [98, 93], open: true },
    { from: [98, 93], to: [104, 223], open: world.discoveredRegions.includes('forest') },
    { from: [98, 93], to: [250, 52], open: world.discoveredRegions.includes('forest') },
    { from: [104, 223], to: [392, 93], open: world.discoveredRegions.includes('mountains') && world.researched.includes('cartography') },
    { from: [392, 93], to: [394, 224], open: world.researched.includes('cartography') || world.completedProjects.includes('stone-bridge') },
  ];
  const paths = links.map((link) => '<path d="M' + link.from[0] + ' ' + link.from[1] + ' L' + link.to[0] + ' ' + link.to[1] + '" fill="none" stroke="' +
    (link.open ? '#7b9c73' : '#adb5a3') + '" stroke-width="' + (link.open ? 3 : 2) + '"' + (link.open ? '' : ' stroke-dasharray="5 7"') + ' stroke-linecap="round"/>').join('');
  const markers = nodes.map((node) => {
    const discovered = world.discoveredRegions.includes(node.id);
    const unlocked = canExploreRegion(world, node.id);
    const fill = discovered ? '#d6ead0' : unlocked ? '#eee3bd' : '#e0e3da';
    const stroke = discovered ? '#5d9160' : unlocked ? '#c5a65a' : '#aab1a2';
    const icon = discovered ? node.icon : unlocked ? '?' : '×';
    const label = discovered ? node.name : unlocked ? 'Da scoprire' : 'Nebbia';
    return '<g><circle cx="' + node.x + '" cy="' + node.y + '" r="20" fill="' + fill + '" stroke="' + stroke + '" stroke-width="2"/>' +
      '<text x="' + node.x + '" y="' + (node.y + 6) + '" text-anchor="middle" font-size="19" fill="#3d5940">' + icon + '</text>' +
      '<text x="' + node.x + '" y="' + (node.y + 35) + '" text-anchor="middle" font-size="10" font-weight="700" fill="#52634f">' + escapeRealmHtml(label) + '</text></g>';
  }).join('');
  return '<div class="realm-frontier-map"><svg viewBox="0 0 500 285" role="img" aria-label="Mappa delle regioni conosciute e ancora avvolte dalla nebbia">' +
    '<defs><pattern id="frontier-dots" width="18" height="18" patternUnits="userSpaceOnUse"><circle cx="3" cy="3" r="1" fill="#b4c1a7" opacity=".6"/></pattern></defs>' +
    '<rect x="1" y="1" width="498" height="283" rx="16" fill="#e9eddf" stroke="#d0dac7"/><rect x="2" y="2" width="496" height="281" rx="16" fill="url(#frontier-dots)"/>' +
    '<path d="M28 168 Q83 139 123 154 T220 159 T322 152 T474 168" fill="none" stroke="#b5d1c3" stroke-width="11" stroke-linecap="round"/>' +
    '<path d="M28 168 Q83 139 123 154 T220 159 T322 152 T474 168" fill="none" stroke="#d0e4d8" stroke-width="4" stroke-linecap="round"/>' +
    paths + '<g><circle cx="247" cy="153" r="24" fill="#d0e4c9" stroke="#5d9160" stroke-width="2"/><text x="247" y="159" font-size="21" text-anchor="middle">⌂</text><text x="247" y="190" text-anchor="middle" font-size="11" font-weight="800" fill="#355b3d">Valle di Brumadoro</text></g>' +
    markers + '</svg><div class="realm-map-legend"><span><i class="known"></i>Territorio scoperto</span><span><i class="open"></i>Spedizione possibile</span><span><i class="fog"></i>Ancora nella nebbia</span></div></div>';
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
      const options = PROFESSIONS.map((profession) => '<option value="' + profession + '"' + (citizen.profession === profession ? ' selected' : '') + '>' + escapeRealmHtml(PROFESSION_LABELS[profession]) + '</option>').join('');
      const compatibleBuildings = state.buildings.filter((building) => WORKPLACE_PROFESSION[building.type] === citizen.profession && building.construction?.kind !== 'build');
      const actualWorkplace = getCitizenWorkplace(state, citizen);
      const workplaceOptions = '<option value="auto"' + (!citizen.workplaceId ? ' selected' : '') + '>Automatica' + (actualWorkplace ? ' · ' + escapeRealmHtml(BUILDINGS[actualWorkplace.type].shortName) : '') + '</option>' + compatibleBuildings.map((building) => '<option value="' + escapeRealmHtml(building.id) + '"' + (citizen.workplaceId === building.id ? ' selected' : '') + '>' + escapeRealmHtml(BUILDINGS[building.type].shortName) + ' · livello ' + building.level + '</option>').join('');
      const routine = CITIZEN_ACTIVITY_LABELS[getCitizenActivity(state, citizen)];
      const lifeStage = citizen.age < 14 ? 'Infanzia' : citizen.age >= 75 ? 'Anziano' : citizen.age >= 55 ? 'Maturo' : 'Adulto';
      const illnessLabel = citizen.illness ? (citizen.illness.id === 'fever' ? 'Febbre' : 'Raffreddore') : '';
      const parents = (citizen.parentIds ?? []).map((id) => world.citizens.find((other) => other.id === id)?.name).filter((name): name is string => !!name);
      const story = (citizen.personalHistory ?? []).slice(-2).join(' · ');
      return '<article class="realm-citizen-card"><div class="realm-citizen-head"><div><strong>' + escapeRealmHtml(citizen.name) + '</strong><small>' + citizen.age + ' anni · ' + lifeStage + (illnessLabel ? ' · MALATTIA: ' + illnessLabel : '') + ' · ' + escapeRealmHtml(citizen.traits.join(' · ')) + ' · Casa: ' + escapeRealmHtml(home ? BUILDINGS[home.type].shortName : 'da assegnare') + ' · ' + escapeRealmHtml(citizen.familyId) + (parents.length ? ' · Figlio di ' + escapeRealmHtml(parents.join(' e ')) : '') + (relationshipNote ? ' · ' + escapeRealmHtml(relationshipNote) : '') + (citizen.status === 'exploring' ? ' · IN SPEDIZIONE' : '') + '</small></div>' +
        '<label>Mestiere<select data-citizen="' + escapeRealmHtml(citizen.id) + '"' + (citizen.status === 'exploring' || citizen.age < 14 ? ' disabled' : '') + '>' + options + '</select></label>' +
        '<label>Postazione<select data-workplace="' + escapeRealmHtml(citizen.id) + '"' + (citizen.status === 'exploring' || citizen.age < 14 ? ' disabled' : '') + '>' + workplaceOptions + '</select></label></div>' +
        '<div class="realm-needs">' + realmMeter('Fame', citizen.hunger) + realmMeter('Energia', citizen.energy) + realmMeter('Felicità', citizen.happiness) + realmMeter('Salute', citizen.health) + '</div>' +
        (story ? '<small class="realm-citizen-story">Storia personale: ' + escapeRealmHtml(story) + '</small>' : '') +
        '<div class="realm-citizen-footer"><span>' + escapeRealmHtml(routine) + ' · ' + escapeRealmHtml(citizen.lastAction) + '</span><b>Abilità: ' + Math.round(citizen.skills[citizen.profession]) + '/100</b></div></article>'; 
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
    const rawMarketPanel = '<div class="realm-card-title realm-raw-title"><h3>Acquista materie prime</h3><span>IMPORTAZIONI</span></div><div class="realm-market-grid realm-raw-market-grid">' + ([
      { id: 'wood' as const, name: 'Legname' },
      { id: 'stone' as const, name: 'Pietra' },
      { id: 'food' as const, name: 'Cibo' },
    ]).map((item) => {
      const amount = 5;
      const unitPrice = getResourcePurchasePrice(state, item.id);
      const cost = amount * unitPrice;
      return '<div class="realm-market-good"><div><strong>' + item.name + '</strong><small>Prezzo ' + unitPrice + ' monete/u.</small></div>' +
        '<b>' + cost + ' <small>monete</small></b>' +
        realmActionButton('Compra 5', 'buyResource', item.id, String(amount), !hasMarket || !hasMerchant || state.resources.coins < cost) +
        '</div>';
    }).join('') + '</div><p class="realm-market-note">' +
      (!hasMarket ? 'Costruisci un mercato per comprare o vendere.' : !hasMerchant ? 'Assegna un Mercante per commerciare.' : 'Acquistare materie prime risolve carenze urgenti ma costa monete. I prezzi salgono quando le tue scorte sono basse e seguono anche la domanda del mercato.') +
      '</p>';
    const employment = '<div class="realm-card"><div class="realm-card-title"><h3>Filiere produttive</h3><span>BENI LAVORATI</span></div>' + goodsStrip + marketPanel + rawMarketPanel +
      '<p>Le fattorie producono grano; mugnai e fornai lo trasformano in farina e pane. Il pane è consumato dagli abitanti e integra le scorte alimentari. Gli attrezzi aumentano del 12% la resa di fattorie, segherie, cave, mulini, panifici e officine finché sono disponibili; le botteghe attive ne consumano uno per la manutenzione ogni 180 minuti di gioco. I rimedi curano 22 punti salute all’abitante più debilitato ogni 60 minuti se ne ha bisogno. La capienza è ' +
      formatNumber(totalStoredGoods(goods)) + '/' + formatNumber(goodsStorageCapacity(state)) + ' unità complessive condivise tra tutti i beni. Ogni livello di Magazzino aggiunge 80 unità e riduce il deterioramento.</p>' +
      '<div class="realm-chain">' + ['farm', 'mill', 'bakery', 'workshop'].map((type) => {
        const count = state.buildings.filter((building) => building.type === type).length;
        const labels: Record<string, string> = { farm: 'Fattorie', mill: 'Mulini', bakery: 'Panifici', workshop: 'Officine' };
        return '<span><b>' + (labels[type] ?? type) + '</b>' + count + '</span>';
      }).join('') + '</div></div>';
    const weatherNotice = world.weather.id === 'drought' && state.gameMinutes < world.weather.endsAt
      ? '<div class="realm-weather-alert drought"><strong>☀ Siccità in corso</strong><span>Le fattorie rendono il 32% in meno. Il fenomeno dovrebbe durare ancora circa ' + Math.ceil((world.weather.endsAt - state.gameMinutes) / 60) + ' minuti reali.</span></div>'
      : '<div class="realm-weather-alert"><strong>☀ Tempo stabile</strong><span>Le condizioni stagionali si applicano normalmente; gli eventi climatici possono modificare i raccolti per un periodo limitato.</span></div>';
    root.innerHTML = '<div class="realm-summary-grid"><div><small>ABITANTI</small><strong>' + world.citizens.length + '</strong></div><div><small>IN SPEDIZIONE</small><strong>' + world.citizens.filter((citizen) => citizen.status === 'exploring').length + '</strong></div><div><small>PUNTI CONOSCENZA</small><strong>' + formatNumber(world.researchPoints) + '</strong></div></div>' +
      weatherNotice + '<p class="realm-intro">Ogni cittadino ha una storia personale, tratti che modificano il lavoro, relazioni che possono diventare amicizie o rivalità e un ciclo di vita con malattie, recupero e lutti. I bambini crescono prima di poter lavorare; gli anziani possono lasciare un ricordo nella cronaca. Assegna persone agli edifici giusti: gli edifici senza personale funzionano solo in parte.</p>' +
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
      '<div class="realm-card"><div class="realm-card-title"><h3>Gruppi d’interesse</h3><span>CONSENSO E INFLUENZA</span></div><p>Il sostegno cambia con scorte, occupazione, commercio, alloggi e politiche. I gruppi più influenti possono rendere una decisione più costosa sul piano sociale.</p><div class="realm-citizen-list">' + getInterestGroups(state).map((group) => '<article class="realm-citizen-card"><div class="realm-card-title"><h3>' + escapeRealmHtml(group.name) + '</h3><span>' + group.members + ' membri · influenza ' + Math.round(group.influence) + '%</span></div><p>' + escapeRealmHtml(group.concern) + '</p>' + realmMeter('Consenso', group.support) + '<small>' + (group.support >= 65 ? 'Favorevole' : group.support <= 35 ? 'Opposizione probabile' : 'Posizione negoziabile') + '</small></article>').join('') + '</div></div>' +
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
    const availableScouts = world.citizens.filter((citizen) => citizen.profession === 'scout' && citizen.status === 'resident');
    const availableCompanions = world.citizens.filter((citizen) => citizen.status === 'resident' && citizen.profession !== 'scout');
    const expeditionPlanner = '<div class="realm-card"><div class="realm-card-title"><h3>Preparazione spedizione</h3><span>EQUIPAGGIO E PROVVISTE</span></div><div class="realm-citizen-head"><label>Guida<select data-expedition-leader>' + availableScouts.map((citizen) => '<option value="' + escapeRealmHtml(citizen.id) + '">' + escapeRealmHtml(citizen.name) + ' · abilità ' + Math.round(citizen.skills.scout) + '</option>').join('') + '</select></label><label>Compagni<select data-expedition-crew multiple size="3">' + availableCompanions.map((citizen) => '<option value="' + escapeRealmHtml(citizen.id) + '">' + escapeRealmHtml(citizen.name) + ' · ' + escapeRealmHtml(PROFESSION_LABELS[citizen.profession]) + '</option>').join('') + '</select></label><label>Provviste<input data-expedition-food type="number" min="8" max="50" value="8"></label><label>Ritmo<select data-expedition-duration><option value="0.75">Rapido · 25% prima, più rischioso</option><option value="1" selected>Normale</option><option value="1.25">Prudente · 25% più lento</option><option value="1.5">Cauto · 50% più lento</option></select></label><label><input data-expedition-tools type="checkbox"' + (goods.tools > 0 ? ' checked' : '') + (goods.tools > 0 ? '' : ' disabled') + '> Porta un attrezzo (' + goods.tools + ' disponibili)</label></div><small>La guida deve essere un Esploratore. Ogni compagno aggiuntivo richiede almeno 3 unità di cibo in più; equipaggi massimi: 3 persone.</small></div>';
    const regions = REGIONS.map((region) => {
      const unlocked = canExploreRegion(world, region.id);
      const discovered = world.discoveredRegions.includes(region.id);
      const territory = world.frontierTerritories.find((entry) => entry.region === region.id);
      const trip = activeTrips.find((entry) => entry.region === region.id);
      const completed = world.expeditions.find((entry) => entry.region === region.id && entry.status !== 'active');
      const status = trip ? 'IN VIAGGIO' : territory ? 'COLONIZZATA' : discovered ? 'ESPLORATA' : unlocked ? 'SCOPERTA POSSIBILE' : 'BLOCCATA';
      const tripText = trip ? 'Rientro previsto tra ' + Math.max(0, Math.ceil((trip.eta - state.gameMinutes) / 60)) + ' minuti di gioco.' :
        completed?.outcome ?? region.description;
      const foundationCost = frontierFoundingCost(region.id);
      const foundationLabel = !discovered ? 'Prima esplora la regione' : !isEpochUnlocked(state, 'borough') ? 'Richiede l’epoca del Borgo' : 'Fonda avamposto · ' + formatCost(foundationCost);
      const foundationButton = territory ? '' : realmActionButton(foundationLabel, 'colonize', region.id, '', !canColonizeRegion(state, region.id) || !hasResourceCost(state.resources, foundationCost));
      let localMap = '';
      if (territory) {
        const localStock = (['wood', 'stone', 'food', 'coins'] as Resource[]).map((resource) =>
          '<span><small>' + escapeRealmHtml(RESOURCE_LABELS[resource]) + '</small><b>' + formatNumber(territory.stock[resource]) + '</b></span>').join('');
        const allowedStructures = (Object.entries(FRONTIER_STRUCTURES) as Array<[FrontierStructureType, (typeof FRONTIER_STRUCTURES)[FrontierStructureType]]>)
          .filter(([type]) => type !== 'outpost')
          .filter(([type]) => frontierStructureAllowed(region.id, type));
        const selectorOptions = allowedStructures.map(([type, definition]) => '<option value="' + type + '">' + escapeRealmHtml(definition.icon + ' ' + definition.name) + ' · ' + escapeRealmHtml(formatCost(definition.cost)) + '</option>').join('');
        const cells = Array.from({ length: FRONTIER_GRID_SIZE * FRONTIER_GRID_SIZE }, (_, index) => {
          const x = index % FRONTIER_GRID_SIZE;
          const y = Math.floor(index / FRONTIER_GRID_SIZE);
          const structure = territory.structures.find((entry) => entry.x === x && entry.y === y);
          if (structure) {
            const definition = FRONTIER_STRUCTURES[structure.type];
            return '<button type="button" class="realm-frontier-tile built" disabled title="' + escapeRealmHtml(definition.name + ' · livello ' + structure.level) + '"><span>' + definition.icon + '</span><small>' + escapeRealmHtml(definition.name) + '</small></button>';
          }
          return '<button type="button" class="realm-frontier-tile empty" data-action="frontierTile" data-id="' + region.id + '" data-value="' + x + ',' + y + '" aria-label="Costruisci nella casella ' + x + ',' + y + '">+</button>';
        }).join('');
        const activeIncident = territory.activeIncident && territory.activeIncident.endsAt > state.gameMinutes
          ? '<p class="realm-frontier-incident"><b>⚠ ' + escapeRealmHtml(territory.activeIncident.title) + '</b> · produzione ridotta per ' + Math.ceil((territory.activeIncident.endsAt - state.gameMinutes) / 60) + ' min di gioco</p>'
          : '';
        localMap = '<div class="realm-frontier-colony"><div class="realm-frontier-colony-head"><div><b>Territorio giocabile · griglia 5×5</b><small>Stabilità ' + Math.round(territory.stability) + '/100 · rischio climatico e incursioni locali</small></div></div>' +
          '<div class="realm-frontier-stock">' + localStock + '</div>' + activeIncident +
          '<div class="realm-frontier-buildbar"><label>Nuova struttura<select data-frontier-structure="' + region.id + '">' + selectorOptions + '</select></label><small>Scegli una struttura, poi clicca una casella vuota della mappa. Le riserve locali si esauriscono e gli incidenti riducono temporaneamente la produzione.</small></div>' +
          '<div class="realm-frontier-grid terrain-' + territory.climate + '" role="group" aria-label="Mappa costruibile di ' + escapeRealmHtml(region.name) + '">' + cells + '</div></div>';
      }
      return '<article class="realm-region-card"><div><div class="realm-card-title"><h3>' + escapeRealmHtml(region.name) + '</h3><span>' + status + '</span></div><p>' + escapeRealmHtml(tripText) + '</p><small>Durata base: ' + Math.ceil(region.duration / 60) + ' minuti · provviste e ritmo si scelgono qui sopra' + (goods.tools > 0 ? ' · 1 attrezzo migliora il successo' : '') + '</small></div>' +
        foundationButton + localMap +
        realmActionButton(trip ? 'Spedizione in corso' : discovered ? 'Esplora di nuovo' : 'Invia equipaggio', 'expedition', region.id, '', !unlocked || !availableScouts.length || state.resources.food < 8 || activeTrips.length >= (world.researched.includes('cartography') ? 2 : 1) || !!trip) + '</article>';
    }).join('');
    const trips = world.expeditions.slice(-5).reverse().map((trip) => {
      const regionName = REGIONS.find((region) => region.id === trip.region)?.name ?? trip.region;
      return '<div class="realm-history-row"><span class="realm-status-dot ' + trip.status + '"></span><div><b>' + escapeRealmHtml(regionName) + '</b><small>' + escapeRealmHtml(trip.outcome) + '</small></div><strong>' + (trip.status === 'active' ? Math.ceil((trip.eta - state.gameMinutes) / 60) + ' min' : trip.status === 'success' ? 'Riuscita' : 'Parziale') + '</strong></div>';
    }).join('');
    const diplomacy = world.factions.map((faction) => {
      const need = faction.need ?? (faction.id === 'salmastra' ? 'wood' : faction.id === 'rocciacupa' ? 'food' : 'stone');
      const offer = faction.offer ?? (faction.id === 'salmastra' ? 'food' : faction.id === 'rocciacupa' ? 'stone' : 'wood');
      const needAmount = faction.needAmount ?? (faction.id === 'salmastra' ? 6 : faction.id === 'rocciacupa' ? 8 : 5);
      const offerAmount = faction.offerAmount ?? (faction.id === 'salmastra' ? 10 : faction.id === 'rocciacupa' ? 7 : 9);
      const benefit = faction.treatyBenefit ?? (faction.id === 'salmastra' ? 'provviste e pesca' : faction.id === 'rocciacupa' ? 'pietra e strumenti' : 'legname e recupero forestale');
      return '<article class="realm-faction-card"><div><h3>' + escapeRealmHtml(faction.name) + '</h3><p>' + escapeRealmHtml(faction.specialty) + '</p><div class="realm-meter"><div><span>Relazioni</span><b>' + faction.relation + '/100</b></div><span class="realm-meter-track"><i style="width:' + faction.relation + '%"></i></span></div>' +
        '<p class="realm-faction-offer"><b>Chiede:</b> ' + needAmount + ' ' + escapeRealmHtml(RESOURCE_LABELS[need]) + ' · <b>Offre:</b> ' + offerAmount + ' ' + escapeRealmHtml(RESOURCE_LABELS[offer]) + '</p>' +
        '<small>' + (faction.treaty ? 'Trattato attivo · rotta: ' + escapeRealmHtml(benefit) : faction.relation >= 55 ? 'Pronta per un accordo commerciale' : 'Servono rapporti a 55 per un trattato') + '</small></div><div class="realm-button-row">' +
        realmActionButton('Dono · 8 monete', 'diplomacy', faction.id, 'gift', state.resources.coins < 8) +
        realmActionButton('Scambia ' + needAmount + ' ' + RESOURCE_LABELS[need], 'diplomacy', faction.id, 'trade', state.resources[need] < needAmount) +
        realmActionButton(faction.treaty ? 'Trattato firmato' : 'Firma trattato · 10 monete', 'diplomacy', faction.id, 'treaty', faction.treaty || faction.relation < 55 || state.resources.coins < 10) +
        '</div></article>';
    }).join('');
    const frontierMap = renderFrontierMap(world);
    root.innerHTML = '<div class="realm-summary-grid"><div><small>REGIONI NOTE</small><strong>' + world.discoveredRegions.length + '/' + REGIONS.length + '</strong></div><div><small>SPEDIZIONI ATTIVE</small><strong>' + activeTrips.length + '/' + (world.researched.includes('cartography') ? 2 : 1) + '</strong></div><div><small>ESPLORATORI DISPONIBILI</small><strong>' + activeScouts + '</strong></div></div>' +
      '<p class="realm-intro">Le spedizioni consumano provviste e possono sbloccare storie a scelta permanente. Dopo una ricognizione riuscita, nell’epoca del Borgo puoi fondare un avamposto: ogni regione ha una mappa costruibile 5×5, scorte locali finite, strutture specializzate e incidenti climatici o politici. Le colonie producono solo finché hanno riserve e stabilità sufficienti.</p>' +
      '<h3 class="realm-section-title">Carta generale della frontiera</h3>' + frontierMap +
      '<h3 class="realm-section-title">Frontiera e spedizioni</h3>' + expeditionPlanner + '<div class="realm-region-list">' + regions + '</div>' +
      '<div class="realm-card"><div class="realm-card-title"><h3>Diario delle spedizioni</h3><span>ULTIME CINQUE</span></div>' + (trips || '<p>Non è ancora partita nessuna squadra.</p>') + '</div>' +
      '<h3 class="realm-section-title">Diplomazia e rotte commerciali</h3><p class="realm-intro">Ogni comunità ha merci diverse da vendere e materiali di cui ha bisogno. Il trattato apre una rotta permanente con consegne periodiche dedicate: legname da Selvalunga, provviste da Porto Salmastra, pietra da Rocciacupa.</p>' +
      '<div class="realm-faction-list">' + diplomacy + '</div>';
    return;
  }

  if (realmTab === 'research') {
    const active = world.activeResearch;
    const assignedScholars = world.citizens.filter((citizen) => citizen.profession === 'scholar' && citizen.status === 'resident' && citizen.age >= 14 && !!citizen.workplaceId && ['school', 'university'].includes(state.buildings.find((building) => building.id === citizen.workplaceId)?.type ?? '')).length;
    const researches = RESEARCH.map((research) => {
      const done = world.researched.includes(research.id);
      const isActive = active === research.id;
      const unmet = researchRequirement(state, research);
      const disabled = done || !!active || world.researchPoints < research.cost || !!unmet;
      const progress = isActive ? Math.min(100, world.researchProgress / research.duration * 100) : 0;
      return '<article class="realm-research-card ' + (done ? 'completed' : isActive ? 'in-progress' : '') + '"><div class="realm-card-title"><h3>' + escapeRealmHtml(research.name) + '</h3><span>' + escapeRealmHtml(research.path) + '</span></div><p>' + escapeRealmHtml(research.description) + '</p>' +
        (isActive ? '<div class="realm-progress-track"><i style="width:' + progress + '%"></i></div><small>Ricerca in corso · ' + Math.floor(progress) + '%</small>' :
          done ? '<small class="realm-complete-label">Conoscenza acquisita</small>' : '<small>' + (unmet ? 'Requisito: ' + escapeRealmHtml(unmet) : 'Costo ' + research.cost + ' punti' + (research.resourceCost ? ' · materiali: ' + escapeRealmHtml(Object.entries(research.resourceCost).map(([key, value]) => value + ' ' + key).join(', ')) : '') + ' · durata base ' + Math.ceil(research.duration / 60) + ' min di gioco') + '</small>') +
        realmActionButton(done ? 'Completata' : isActive ? 'In corso' : 'Avvia ricerca', 'research', research.id, '', disabled) + '</article>';
    }).join('');
    root.innerHTML = '<div class="realm-summary-grid"><div><small>PUNTI CONOSCENZA</small><strong>' + formatNumber(world.researchPoints) + '</strong></div><div><small>RICERCHE ACQUISITE</small><strong>' + world.researched.length + '/' + RESEARCH.length + '</strong></div><div><small>STUDIOSI AL LAVORO</small><strong>' + assignedScholars + '</strong></div></div>' +
      '<p class="realm-intro">La conoscenza cresce solo con studiosi adulti assegnati esplicitamente alla Scuola o all’Università. Chi non ha una postazione di ricerca non genera punti e non accelera gli studi. I tratti curiosi fanno imparare più in fretta. Avvia una ricerca alla volta: una volta completata, il bonus resta attivo.</p>' +
      '<div class="realm-research-list">' + researches + '</div>';
    return;
  }

  const projects = PROJECTS.map((project) => {
    const stage = world.projectStages[project.id] ?? 0;
    const completed = world.completedProjects.includes(project.id);
    const cost = project.stages[Math.min(stage, project.stages.length - 1)] ?? {};
    const unmet = projectRequirement(state, project.id);
    return '<article class="realm-project-card ' + (completed ? 'completed' : '') + '"><div class="realm-card-title"><h3>' + escapeRealmHtml(project.name) + '</h3><span>' + (completed ? 'COMPLETATO' : 'FASE ' + (stage + 1) + '/3') + '</span></div><p>' + escapeRealmHtml(project.description) + '</p>' +
      '<div class="realm-project-stages">' + [0, 1, 2].map((step) => '<i class="' + (step < stage ? 'done' : '') + '"></i>').join('') + '</div>' +
      (completed ? '<small class="realm-complete-label">Beneficio permanente attivo</small>' : '<small>' + (unmet ? 'Requisito: ' + escapeRealmHtml(unmet) : 'Prossima fase: ' + escapeRealmHtml(formatCost(cost)) + ' · cantiere coordinato dai Costruttori') + '</small>') +
      realmActionButton(completed ? 'Completato' : 'Finanzia la fase', 'project', project.id, '', completed || !!unmet || !hasResourceCost(state.resources, cost)) + '</article>'; 
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
  const panelClasses = ['ui-panel-build','ui-panel-details','ui-panel-guide','ui-panel-village','ui-panel-goals','ui-panel-challenge'];
  const panelButtons = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-game-panel]'));
  const setGamePanel = (panel: string | null, toggle = false): void => {
    const currentlyOpen = panel ? document.body.classList.contains('ui-panel-' + panel) : false;
    const next = panel && !(toggle && currentlyOpen) ? panel : null;
    document.body.classList.remove(...panelClasses);
    if (next) document.body.classList.add('ui-panel-' + next);
    panelButtons.forEach((button) => {
      const active = !!next && button.dataset.gamePanel === next;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
  };
  let cameraSettingsApplied = false;
  let lastUiSelectedBuildingId: string | null = null;
  let lastUiBuildType: BuildingType | null = null;
  const settingsDialog = $('settings-dialog') as HTMLDialogElement;
  const rotationSlider = $('rotation-sensitivity') as HTMLInputElement;
  const rotationValue = $('rotation-sensitivity-value') as HTMLOutputElement;
  const cameraHints = $('toggle-camera-hints') as HTMLInputElement;
  const reducedMotion = $('toggle-reduced-motion') as HTMLInputElement;
  const storedPreference = (key: string): string | null => { try { return localStorage.getItem(key); } catch { return null; } };
  const savePreference = (key: string, value: string): void => { try { localStorage.setItem(key,value); } catch { /* Preferences are optional when storage is unavailable. */ } };
  const savedSensitivity = Number(storedPreference('microregno:rotation-sensitivity') ?? 6);
  rotationSlider.value = String(Number.isFinite(savedSensitivity) ? Math.min(12,Math.max(2,savedSensitivity)) : 6);
  rotationValue.value = rotationSlider.value;
  rotationValue.textContent = rotationSlider.value;
  cameraHints.checked = storedPreference('microregno:camera-hints') !== 'false';
  reducedMotion.checked = storedPreference('microregno:reduced-motion') === 'true';
  document.body.classList.toggle('hide-camera-hints',!cameraHints.checked);
  document.body.classList.toggle('reduce-motion-ui',reducedMotion.checked);
  const dispatchCamera = (type: string, value?: number): void => dispatch('microregno:camera',{type,value});
  $('game-menu-kingdom').addEventListener('click', () => { dispatch('microregno:mode','kingdom'); setGamePanel(null); });
  $('game-menu-challenge').addEventListener('click', () => { dispatch('microregno:mode','challenge'); setGamePanel('challenge'); });
  panelButtons.forEach((button) => button.addEventListener('click', () => setGamePanel(button.dataset.gamePanel ?? null,true)));
  $('settings-button').addEventListener('click', () => { if (!settingsDialog.open) settingsDialog.showModal(); });
  $('close-settings').addEventListener('click', () => settingsDialog.close());
  $('close-settings-footer').addEventListener('click', () => settingsDialog.close());
  $('settings-center').addEventListener('click', () => dispatchCamera('center'));
  $('settings-reset').addEventListener('click', () => { settingsDialog.close(); $('reset-game').click(); });
  rotationSlider.addEventListener('input', () => {
    rotationValue.value = rotationSlider.value;
    rotationValue.textContent = rotationSlider.value;
    savePreference('microregno:rotation-sensitivity',rotationSlider.value);
    dispatchCamera('sensitivity',Number(rotationSlider.value));
  });
  cameraHints.addEventListener('change', () => {
    document.body.classList.toggle('hide-camera-hints',!cameraHints.checked);
    savePreference('microregno:camera-hints',String(cameraHints.checked));
  });
  reducedMotion.addEventListener('change', () => {
    document.body.classList.toggle('reduce-motion-ui',reducedMotion.checked);
    savePreference('microregno:reduced-motion',String(reducedMotion.checked));
  });
  const fullscreenButton = $('fullscreen-toggle') as HTMLButtonElement;
  const syncFullscreen = (): void => {
    const fullscreen = !!document.fullscreenElement;
    $('fullscreen-icon').textContent = fullscreen ? '⤢' : '⛶';
    $('fullscreen-label').textContent = fullscreen ? 'Esci da schermo intero' : 'Schermo intero';
    fullscreenButton.setAttribute('aria-label',fullscreen ? 'Esci da schermo intero' : 'Attiva schermo intero');
    fullscreenButton.title = fullscreen ? 'Esci da schermo intero' : 'Schermo intero';
  };
  fullscreenButton.addEventListener('click', () => {
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => showToast('Impossibile uscire dalla modalità a schermo intero.'));
      return;
    }
    if (!document.documentElement.requestFullscreen) { showToast('Lo schermo intero non è supportato da questo browser.'); return; }
    void document.documentElement.requestFullscreen().catch(() => showToast('Il browser non ha consentito lo schermo intero.'));
  });
  document.addEventListener('fullscreenchange',syncFullscreen);
  [['camera-rotate-left','rotate-left'],['camera-rotate-right','rotate-right'],['camera-zoom-in','zoom-in'],['camera-zoom-out','zoom-out'],['camera-center','center']].forEach(([id,action]) => {
    $(id!).addEventListener('click', () => dispatchCamera(action!));
  });
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
    else if (action === 'colonize') dispatch('microregno:realm-action', { type: 'colonize', id: id as RegionId });
    else if (action === 'frontierTile') {
      const selected = realmContent.querySelector<HTMLSelectElement>('select[data-frontier-structure="' + id + '"]')?.value as FrontierStructureType | undefined;
      const [x, y] = value.split(',').map(Number);
      if (selected && Number.isInteger(x) && Number.isInteger(y)) dispatch('microregno:realm-action', { type: 'frontierBuild', region: id as RegionId, structure: selected, x: x!, y: y! });
    }
    else if (action === 'expedition') {
      const leader = realmContent.querySelector<HTMLSelectElement>('[data-expedition-leader]')?.value;
      const crewSelect = realmContent.querySelector<HTMLSelectElement>('[data-expedition-crew]');
      const crewIds = [leader, ...Array.from(crewSelect?.selectedOptions ?? []).map((option) => option.value)].filter((value): value is string => !!value);
      const foodSupply = Number(realmContent.querySelector<HTMLInputElement>('[data-expedition-food]')?.value ?? 8);
      const durationFactor = Number(realmContent.querySelector<HTMLSelectElement>('[data-expedition-duration]')?.value ?? 1);
      const useTools = realmContent.querySelector<HTMLInputElement>('[data-expedition-tools]')?.checked ?? false;
      dispatch('microregno:realm-action', { type: 'expedition', id, scoutId: leader || undefined, crewIds, foodSupply, durationFactor, useTools });
    }
    else if (action === 'project') dispatch('microregno:realm-action', { type: 'project', id });
    else if (action === 'event') dispatch('microregno:realm-action', { type: 'event', id });
    else if (action === 'diplomacy') dispatch('microregno:realm-action', { type: 'diplomacy', id, value });
    else if (action === 'tradeGoods') dispatch('microregno:realm-action', { type: 'tradeGoods', good: id as keyof GoodsBag, amount: Number(value) });
    else if (action === 'buyResource') dispatch('microregno:realm-action', { type: 'buyResource', resource: id as MarketResource, amount: Number(value) });
  });
  realmContent.addEventListener('change', (event) => {
    const target = event.target as HTMLElement;
    const workplace = target.closest<HTMLSelectElement>('select[data-workplace]');
    if (workplace) {
      dispatch('microregno:realm-action', { type: 'workplace', citizenId: workplace.dataset.workplace!, buildingId: workplace.value === 'auto' ? null : workplace.value });
      workplace.blur(); return;
    }
    const select = target.closest<HTMLSelectElement>('select[data-citizen]');
    if (!select) return;
    dispatch('microregno:realm-action', { type: 'assign', citizenId: select.dataset.citizen, value: select.value as Profession });
    select.blur();
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
  $('start-playing').addEventListener('click', () => {
    dialog.close();
    // Do not send a one-shot game event before Phaser has emitted its first snapshot:
    // startup is asynchronous, so that event could otherwise be lost.
    if (latestSnapshot?.mode === 'challenge') dispatch('microregno:mode', 'kingdom');
    if (latestSnapshot?.mode === 'kingdom') {
      const current = createTutorialSteps(latestSnapshot).find((step) => !step.done);
      if (current?.action === 'build' && current.actionType) dispatch('microregno:build', current.actionType);
    }
  });
  $('skip-tutorial').addEventListener('click', () => dialog.close());

  dialog.addEventListener('close', markTutorialSeen);

  try {
    if (localStorage.getItem(TUTORIAL_SEEN_KEY) !== '1') dialog.showModal();
  } catch {
    // If storage is unavailable, the tutorial remains reachable from the help button.
  }

  $('kingdom-mode').addEventListener('click', () => { dispatch('microregno:mode', 'kingdom'); setGamePanel(null); });
  $('challenge-mode').addEventListener('click', () => { dispatch('microregno:mode', 'challenge'); setGamePanel('challenge'); });
  $('challenge-retry').addEventListener('click', () => dispatch('microregno:challenge-retry'));
  $('center-map').addEventListener('click', () => dispatch('microregno:center'));
  $('cancel-build').addEventListener('click', () => dispatch('microregno:build', null));

  $('tutorial-action').addEventListener('click', () => {
    if (!latestSnapshot) return;
    if (latestSnapshot.mode === 'challenge') {
      dispatch('microregno:mode', 'kingdom');
      setGamePanel('guide');
      return;
    }
    const current = createTutorialSteps(latestSnapshot).find((step) => !step.done);
    if (!current) return;

    if (current.action === 'build' && current.actionType) {
      setGamePanel('build');
      if (latestSnapshot.selectedBuildType === current.actionType) {
        dispatch('microregno:notice', 'Perfetto: ora scegli una casella d’erba libera sulla mappa. I costi vengono scalati solo se la posizione è valida.');
      } else {
        dispatch('microregno:build', current.actionType);
      }
    } else if (current.action === 'upgrade') {
      if (latestSnapshot.selectedBuilding) {
        dispatch('microregno:upgrade');
      } else {
        dispatch('microregno:notice', 'Clicca un edificio sulla mappa per aprire i dettagli, poi premi “Migliora”.');
        $('game-mount').scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    } else if (current.action === 'research' || current.action === 'exploration' || current.action === 'projects') {
      realmTab = current.action === 'research' ? 'research' : current.action === 'exploration' ? 'exploration' : 'projects';
      $('realm-dashboard-button').click();
    } else if (current.action === 'community') {
      setGamePanel('village');
    } else if (current.action === 'objectives') {
      setGamePanel('goals');
    } else if (current.action === 'challenge') {
      dispatch('microregno:mode', 'challenge');
      setGamePanel('challenge');
    } else {
      tutorialExplainMore = true;
      renderTutorial(latestSnapshot);
    }
  });

  $('tutorial-explain').addEventListener('click', () => {
    tutorialExplainMore = !tutorialExplainMore;
    if (latestSnapshot) renderTutorial(latestSnapshot);
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
    if (!cameraSettingsApplied) { dispatchCamera('sensitivity',Number(rotationSlider.value)); cameraSettingsApplied = true; }
    $('game-menu-kingdom').setAttribute('aria-pressed',String(snapshot.mode === 'kingdom'));
    $('game-menu-challenge').setAttribute('aria-pressed',String(snapshot.mode === 'challenge'));
    const selectedBuildingId = snapshot.selectedBuilding?.id ?? null;
    if (selectedBuildingId && selectedBuildingId !== lastUiSelectedBuildingId) setGamePanel('details');
    lastUiSelectedBuildingId = selectedBuildingId;
    const selectedBuildType = snapshot.selectedBuildType ?? null;
    if (selectedBuildType && selectedBuildType !== lastUiBuildType) setGamePanel('build');
    lastUiBuildType = selectedBuildType;
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
      ? 'Ogni giorno porta una missione, regole speciali e nuove medaglie da conquistare.'
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
      ? 'Completata · record ' + snapshot.bestScore + ' pt'
      : 'Record: ' + (snapshot.bestScore ? snapshot.bestScore + ' pt' : '—');
    $('challenge-condition').textContent = snapshot.challenge.condition;
    const challengeEvent = $('challenge-event');
    challengeEvent.classList.toggle('hidden', snapshot.challenge.eventAt === undefined);
    if (snapshot.challenge.eventAt !== undefined) {
      challengeEvent.textContent = snapshot.challengeEventTriggered
        ? 'Evento risolto: ' + (snapshot.challenge.eventTitle ?? 'evento speciale') + '. Puoi ancora completare l’obiettivo.'
        : 'Evento in arrivo dopo ' + snapshot.challenge.eventAt + ' minuti di gioco: ' + (snapshot.challenge.eventTitle ?? 'evento speciale') + '. ' + (snapshot.challenge.eventDescription ?? '');
    }
    const challengeRecord = snapshot.playerProfile.records.find(record => record.challengeId === snapshot.challenge.id);
    const challengeMedal = snapshot.playerProfile.medals.find(medal => medal.id === snapshot.challenge.id);
    const challengeResult = $('challenge-result');
    challengeResult.classList.toggle('hidden', snapshot.mode !== 'challenge' || !snapshot.challengeCompleted);
    $('challenge-result-icon').textContent = challengeMedal?.icon ?? '✦';
    $('challenge-result-kicker').textContent = challengeMedal ? 'MEDAGLIA ' + challengeMedal.tier.toLocaleUpperCase('it-IT') : 'MEDAGLIA CONQUISTATA';
    $('challenge-result-title').textContent = challengeMedal?.name ?? snapshot.challenge.reward;
    $('challenge-result-copy').textContent = 'Record del giorno: ' + (challengeRecord?.bestScore ?? snapshot.bestScore) + ' punti. La medaglia è conservata nel profilo su questo dispositivo.';
    $('challenge-retry').textContent = 'Rigioca per migliorare il record';
    renderChallengeRewards(snapshot);

    $('save-status').textContent = snapshot.mode === 'kingdom' ? kingdomSaveStatus : challengeSaveStatus;
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
    renderEpochPanel(snapshot);
    renderObjectives(snapshot);
    renderInspector(snapshot);
    const realmDialog = $('realm-dialog') as HTMLDialogElement;
    const realmContent = $('realm-content');
    if (realmDialog.open && !((document.activeElement instanceof HTMLSelectElement || document.activeElement instanceof HTMLInputElement) && realmContent.contains(document.activeElement))) renderRealmDashboard(snapshot);
  }) as EventListener);

  window.addEventListener('microregno:clock', ((event: CustomEvent<string>) => {
    $('game-clock').textContent = event.detail;
  }) as EventListener);

  window.addEventListener('microregno:notice', ((event: CustomEvent<string>) => showToast(event.detail)) as EventListener);
  window.addEventListener('microregno:save-status', ((event: CustomEvent<{ mode?: 'kingdom' | 'challenge'; message?: string } | string>) => {
    const detail = event.detail;
    if (typeof detail === 'string') {
      kingdomSaveStatus = detail;
      challengeSaveStatus = detail;
    } else if (detail?.message) {
      if (detail.mode === 'challenge') challengeSaveStatus = detail.message;
      else kingdomSaveStatus = detail.message;
    }
    if (latestSnapshot) $('save-status').textContent = latestSnapshot.mode === 'challenge' ? challengeSaveStatus : kingdomSaveStatus;
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