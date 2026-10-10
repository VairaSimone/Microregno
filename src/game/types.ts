export type Resource = 'wood' | 'stone' | 'food' | 'coins';
export type BuildingType = 'townHall' | 'house' | 'farm' | 'sawmill' | 'quarry' | 'market' | 'mill' | 'bakery' | 'warehouse' | 'school' | 'watchtower' | 'workshop';
export type Terrain = 'grass' | 'forest' | 'rock' | 'water';
export type GameMode = 'kingdom' | 'challenge';
export type SeasonId = 'spring' | 'summer' | 'autumn' | 'winter';
export interface SeasonInfo { id: SeasonId; name: string; icon: string; description: string; farmMultiplier: number; foodConsumptionMultiplier: number }
export interface CitizenRequestOption { id: string; label: string; detail: string; cost: Partial<ResourceBag>; reward: Partial<ResourceBag>; moodDelta: number; trustDelta: number; populationDelta?: number; housingDelta?: number }
export interface CitizenRequest { id: string; citizen: string; role: string; title: string; description: string; deadline: number; options: CitizenRequestOption[] }
export interface CommunityState { morale: number; trust: number; fulfilledRequests: number; ignoredRequests: number; requestNumber: number; nextRequestAt: number; activeRequest: CitizenRequest | null; history: string[]; lastOutcome: string; housingBonus?: number }
export type ResourceBag = Record<Resource, number>;
export type Profession = 'farmer' | 'lumberjack' | 'miner' | 'merchant' | 'miller' | 'baker' | 'scholar' | 'scout' | 'builder' | 'guard' | 'artisan';
export type CitizenStatus = 'resident' | 'exploring';
export interface Citizen { id: string; name: string; age: number; profession: Profession; traits: string[]; skills: Record<Profession, number>; hunger: number; energy: number; happiness: number; health: number; experience: number; status: CitizenStatus; expeditionId: string | null; lastAction: string; relationships: Record<string, number>; homeId: string | null; familyId: string; bornAt: number }
export interface GoodsBag { grain: number; flour: number; bread: number; tools: number; medicine: number }
export type TaxPolicy = 'low' | 'balanced' | 'high';
export type FoodPolicy = 'reserve' | 'balanced' | 'generous';
export type ForestPolicy = 'protected' | 'managed' | 'intensive';
export type GuardPolicy = 'none' | 'patrol';
export interface RealmPolicies { tax: TaxPolicy; food: FoodPolicy; forest: ForestPolicy; guard: GuardPolicy }
export type ResearchId = 'irrigation' | 'tools' | 'trade' | 'education' | 'cartography' | 'forestry';
export interface ResearchDefinition { id: ResearchId; name: string; path: string; description: string; cost: number; duration: number }
export type RegionId = 'forest' | 'mountains' | 'lake' | 'ancient-ruins' | 'borderlands';
export interface Expedition { id: string; region: RegionId; scoutId: string; startedAt: number; eta: number; status: 'active' | 'success' | 'partial' | 'failed'; successChance: number; outcome: string }
export interface RealmEventChoice { id: string; label: string; detail: string; cost?: Partial<ResourceBag>; reward?: Partial<ResourceBag>; goodsCost?: Partial<GoodsBag>; goodsReward?: Partial<GoodsBag>; moodDelta?: number; trustDelta?: number; researchDelta?: number; populationDelta?: number; chain?: string; profession?: Profession }
export interface RealmEvent { id: string; title: string; description: string; choices: RealmEventChoice[]; startedAt: number }
export type ProjectId = 'aqueduct' | 'stone-bridge' | 'artisan-quarter' | 'grand-archive';
export interface Faction { id: string; name: string; specialty: string; relation: number; lastContact: number; treaty: boolean }
export interface WorldState { version: 1; nextCitizenId: number; citizens: Citizen[]; goods: GoodsBag; policies: RealmPolicies; researchPoints: number; activeResearch: ResearchId | null; researchProgress: number; researched: ResearchId[]; expeditions: Expedition[]; discoveredRegions: RegionId[]; chronicle: string[]; activeEvent: RealmEvent | null; nextEventAt: number; queuedEvent: string | null; projectStages: Record<ProjectId, number>; completedProjects: ProjectId[]; factions: Faction[]; tradeRoutes: string[] }
export type RealmAction = | { type: 'assign'; citizenId: string; value: Profession } | { type: 'law'; id: 'tax' | 'food' | 'forest' | 'guard'; value: string } | { type: 'research'; id: ResearchId } | { type: 'expedition'; id: RegionId } | { type: 'project'; id: ProjectId } | { type: 'event'; id: string } | { type: 'diplomacy'; id: string; value: 'gift' | 'trade' | 'treaty' };
export interface Building { id: string; type: BuildingType; x: number; y: number; level: number }
export interface GameState { version: 1; seed: number; resources: ResourceBag; population: number; gameMinutes: number; buildings: Building[]; lastSavedAt: number; milestones?: number[]; community?: CommunityState; world?: WorldState }
export interface BuildingDefinition { type: BuildingType; name: string; shortName: string; description: string; icon: string; cost: Partial<ResourceBag>; unlockedAt: number; housing?: number; production?: Partial<Record<Resource, number>> }
export interface BuildCheck { ok: boolean; reason?: string }
export interface DailyChallenge { date: string; seed: number; title: string; description: string; kind: 'population' | 'resources' | 'buildings'; target: number; buildingType?: BuildingType; reward: string }
export interface ChallengeSave { date: string; state: GameState; completed: boolean; score: number; bestScore: number }
export interface GameSnapshot { state: GameState; mode: GameMode; challenge: DailyChallenge; challengeProgress: number; challengeCompleted: boolean; bestScore: number; selectedBuildType: BuildingType | null; selectedBuilding: Building | null }