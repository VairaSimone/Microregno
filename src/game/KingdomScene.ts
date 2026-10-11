import Phaser from 'phaser';
import {BUILDINGS,BOARD_SIZE,TILE_HEIGHT,TILE_WIDTH} from './definitions';
import {advanceTime,awardPopulationMilestones,buildAt,canBuild,createInitialState,demolish,formatGameClock,generateTerrain,upgradeBuilding} from './engine';
import {getSeason,resolveCitizenRequest} from './community';
import {getCitizenActivity,getCitizenWorkplace,performRealmAction} from './livingWorld';
import {challengeProgress,challengeScore,createChallengeState,createDailyChallenge,isChallengeComplete,localDateKey} from './challenge';
import {applyProfileBonuses,loadPlayerProfile,recordChallengeVictory,savePlayerProfile} from './profile';
import {applyOfflineProgress,loadChallengeSave,loadKingdom,resetKingdom,saveChallenge,saveKingdom} from './save';
import {EPOCHS,getBuildingEpoch,isBuildingEpochAvailable,synchronizeKingdomProgression} from './progression';
import type {BuildingType,ChallengeSave,Citizen,DailyChallenge,GameMode,GameSnapshot,GameState,PlayerProfile,RealmAction,Terrain} from './types';
const SPRITES:Record<BuildingType,string>={townHall:'town-hall',house:'house',farm:'farm',sawmill:'sawmill',quarry:'quarry',market:'market',road:'road',mill:'mill',bakery:'bakery',warehouse:'warehouse',school:'school',watchtower:'watchtower',workshop:'workshop',university:'university'};
function publicAssetBase():string{const page=new URL(window.location.href);const finalSegment=page.pathname.split('/').pop()??'';if(!page.pathname.endsWith('/')&&!finalSegment.includes('.'))page.pathname+='/';return new URL('assets/',page).toString();}
export class KingdomScene extends Phaser.Scene{
private state!:GameState;private kingdom!:GameState;private mode:GameMode='kingdom';private challenge!:DailyChallenge;private terrain!:Terrain[][];
private board!:Phaser.GameObjects.Graphics;private hover!:Phaser.GameObjects.Graphics;private objects:Phaser.GameObjects.GameObject[]=[];
private buildType:BuildingType|null=null;private selectedId:string|null=null;private villagerTweens=new Map<Phaser.GameObjects.Container,Phaser.Tweens.Tween>();private completed=false;private best=0;private savedAt=0;private ox=512;private oy=88;private profile:PlayerProfile=loadPlayerProfile();private challengeEventTriggered=false;private dragState:{button:number;startX:number;startY:number;lastX:number;lastY:number;startRotation:number;moved:boolean}|null=null;private cameraTouched=false;private rotationSensitivity=.006;private cameraRotation=0;
constructor(){super('KingdomScene');}
preload():void{this.load.setPath(publicAssetBase());this.load.on('loaderror',(file:{key:string})=>{window.dispatchEvent(new CustomEvent('microregno:notice',{detail:'Grafica non caricata: '+file.key+'. Controlla la cartella public/assets.'}));});[['town-hall','town-hall.svg'],['house','house.svg'],['farm','farm.svg'],['sawmill','sawmill.svg'],['quarry','quarry.svg'],['market','market.svg'],['road','road.svg'],['mill','mill.svg'],['bakery','bakery.svg'],['warehouse','warehouse.svg'],['school','school.svg'],['watchtower','watchtower.svg'],['workshop','workshop.svg'],['university','university.svg'],['tree','tree.svg'],['rock','rock.svg'],['leaf','leaf.svg']].forEach(([k,p])=>this.load.image(k!,p!));}
create():void{
  this.cameras.main.setBackgroundColor('#9dbd96');
  this.board=this.add.graphics().setDepth(0);
  this.hover=this.add.graphics().setDepth(1000);
  this.challenge=createDailyChallenge();
  this.profile=loadPlayerProfile();
  const offline=applyOfflineProgress(loadKingdom());
  this.kingdom=offline.state;
  this.state=this.kingdom;
  this.terrain=generateTerrain(this.state.seed);
  const initialSaveOk=saveKingdom(this.kingdom);
  this.savedAt=Date.now();
  this.reportSaveStatus(initialSaveOk,'kingdom');
  if(offline.minutes)this.notice('Bentornato! Il regno ha continuato a lavorare durante la tua assenza.');
  this.bindEvents();
  this.applyPopulationMilestones();
  this.resizeWorld(this.scale.width||1280,this.scale.height||720,true);
  this.scale.on(Phaser.Scale.Events.RESIZE,(size:{width:number;height:number})=>this.resizeWorld(size.width,size.height));
  this.input.mouse?.disableContextMenu();
  this.input.on('pointerdown',(p:Phaser.Input.Pointer)=>{
    if(p.button!==0&&p.button!==2)return;
    this.dragState={button:p.button,startX:p.x,startY:p.y,lastX:p.x,lastY:p.y,startRotation:this.cameraRotation,moved:false};
    document.body.classList.add('camera-dragging');
  });
  this.input.on('pointermove',(p:Phaser.Input.Pointer)=>{
    const drag=this.dragState;
    if(drag&&p.isDown){
      const dx=p.x-drag.lastX,dy=p.y-drag.lastY;
      if(Math.abs(p.x-drag.startX)+Math.abs(p.y-drag.startY)>5)drag.moved=true;
      if(drag.moved&&drag.button===0){
        const camera=this.cameras.main,cos=Math.cos(this.cameraRotation),sin=Math.sin(this.cameraRotation);
        camera.scrollX-=(dx*cos+dy*sin)/camera.zoom;
        camera.scrollY-=(-dx*sin+dy*cos)/camera.zoom;
        this.cameraTouched=true;
      }else if(drag.moved&&drag.button===2){
        this.cameraRotation=drag.startRotation+(p.x-drag.startX)*this.rotationSensitivity;this.cameras.main.setRotation(this.cameraRotation);
        this.cameraTouched=true;
      }
      drag.lastX=p.x;drag.lastY=p.y;
    }
    const world=this.cameras.main.getWorldPoint(p.x,p.y);
    this.drawHover(world.x,world.y);
  });
  this.input.on('pointerup',(p:Phaser.Input.Pointer)=>{
    const drag=this.dragState;
    this.dragState=null;
    document.body.classList.remove('camera-dragging');
    if(drag&&drag.button===0&&!drag.moved){
      const world=this.cameras.main.getWorldPoint(p.x,p.y);
      this.clickMap(world.x,world.y);
    }
  });
  this.input.on('pointerupoutside',()=>{
    this.dragState=null;
    document.body.classList.remove('camera-dragging');
  });
  this.input.on('wheel',(_p:Phaser.Input.Pointer,_over:Phaser.GameObjects.GameObject[],_dx:number,deltaY:number)=>{
    const camera=this.cameras.main;
    camera.setZoom(Phaser.Math.Clamp(camera.zoom*(deltaY>0?.9:1.1),.55,2.4));
    this.cameraTouched=true;
  });
  this.time.addEvent({delay:1000,loop:true,callback:()=>this.tick()});
  this.redraw();
  this.emit();
}
private fitZoom(width:number,height:number):number{
  const worldWidth=(BOARD_SIZE-1)*TILE_WIDTH+110;
  const worldHeight=(BOARD_SIZE-1)*TILE_HEIGHT+120;
  return Phaser.Math.Clamp(Math.min((width-26)/worldWidth,(height-28)/worldHeight,1.8),.55,1.8);
}
private resizeWorld(width:number,height:number,initial=false):void{
  this.ox=width/2;
  const mapHeight=(BOARD_SIZE-1)*TILE_HEIGHT;
  this.oy=(height-mapHeight)/2+22;
  const camera=this.cameras.main;
  if(initial||!this.cameraTouched)camera.setZoom(this.fitZoom(width,height));
  camera.centerOn(this.ox,this.oy+mapHeight/2);
  if(!initial&&this.board&&this.state&&this.terrain)this.redraw();
}
private centerCamera(resetOrientation=true):void{
  const width=this.scale.width||1280,height=this.scale.height||720;
  if(resetOrientation){this.cameraRotation=0;this.cameras.main.setRotation(0);this.cameraTouched=false;this.cameras.main.setZoom(this.fitZoom(width,height));}
  this.cameras.main.centerOn(this.ox,this.oy+(BOARD_SIZE-1)*TILE_HEIGHT/2);
}

private bindEvents():void{
window.addEventListener('microregno:build',((e:CustomEvent<BuildingType|null>)=>{const t=e.detail;if(!t){this.buildType=null;this.emit();return;}if(this.mode==='challenge'&&this.completed){this.notice('Hai già completato la sfida di oggi. Usa “Rigioca” per tentare un punteggio migliore.');return;}if(this.mode==='challenge'&&this.challenge.constraint==='no-roads'&&t==='road'){this.notice('Vincolo della sfida: non puoi costruire strade.');return;}if(this.state.population<BUILDINGS[t].unlockedAt){this.notice('Servono almeno '+BUILDINGS[t].unlockedAt+' abitanti per sbloccare '+BUILDINGS[t].name+'.');return;}if(!isBuildingEpochAvailable(this.state,t)){this.notice('Per costruire '+BUILDINGS[t].name+' devi prima raggiungere l’epoca '+EPOCHS[getBuildingEpoch(t)].name+'.');return;}this.buildType=this.buildType===t?null:t;this.selectedId=null;this.emit();this.notice(this.buildType?'Seleziona una casella libera per costruire: '+BUILDINGS[t].name+'.':'Costruzione annullata.');}) as EventListener);
window.addEventListener('microregno:mode',((e:CustomEvent<GameMode>)=>{const m=e.detail;if(m!=='kingdom'&&m!=='challenge')return;this.mode=m;this.buildType=null;this.selectedId=null;if(m==='kingdom'){this.state=this.kingdom;this.terrain=generateTerrain(this.kingdom.seed);this.challenge=createDailyChallenge();}else{this.challenge=createDailyChallenge();this.profile=loadPlayerProfile();const save=loadChallengeSave(this.challenge.date,this.challenge.id);if(save){this.state=save.state;this.completed=save.completed;this.best=save.bestScore;this.challengeEventTriggered=save.eventTriggered??false;}else{this.state=applyProfileBonuses(createChallengeState(this.challenge),this.profile);this.completed=false;this.best=0;this.challengeEventTriggered=false;}this.reportSaveStatus(!!save,'challenge',!save);this.terrain=generateTerrain(this.challenge.seed);}this.redraw();this.emit();}) as EventListener);
window.addEventListener('microregno:demolish',(()=>{if(!this.selectedId)return;const b=this.state.buildings.find(v=>v.id===this.selectedId);if(!b||b.type==='townHall'||(this.mode==='challenge'&&this.completed))return;if(this.mode==='challenge'&&this.challenge.constraint==='no-demolition'){this.notice('Vincolo della sfida: non puoi demolire edifici.');return;}this.state=demolish(this.state,b.id);this.sync();this.selectedId=null;this.redraw();this.emit();this.notice('Edificio demolito: hai recuperato una parte dei materiali.');}) as EventListener);
window.addEventListener('microregno:request-choice',((e:CustomEvent<string>)=>{const result=resolveCitizenRequest(this.state,e.detail);if(!result.ok){this.notice(result.message);return;}const oldPopulation=this.state.population;this.state=result.state;this.sync();this.applyPopulationMilestones();if(this.state.population!==oldPopulation)this.redraw();this.emit();this.notice(result.message);}) as EventListener);
window.addEventListener('microregno:realm-action',((e:CustomEvent<RealmAction>)=>{if(this.mode!=='kingdom'){this.notice('La Sala del Regno è disponibile nella partita principale.');return;}const oldPopulation=this.state.population;const result=performRealmAction(this.state,e.detail);if(!result.ok){this.notice(result.message);return;}this.state=result.state;this.applyPopulationMilestones();this.sync();if(this.state.population!==oldPopulation||e.detail.type==='expedition'||e.detail.type==='workplace'||e.detail.type==='assign')this.redraw();this.emit();this.notice(result.message);}) as EventListener);
window.addEventListener('microregno:upgrade',(()=>{if(!this.selectedId)return;if(this.mode==='challenge'&&this.completed){this.notice('Hai già completato la sfida di oggi.');return;}const result=upgradeBuilding(this.state,this.selectedId);if(!result.check.ok){this.notice(result.check.reason??'Non puoi migliorare questo edificio.');return;}this.state=result.state;this.sync();this.redraw();this.emit();const b=this.state.buildings.find(v=>v.id===this.selectedId);if(b)this.notice(BUILDINGS[b.type].name+' migliorato al livello '+b.level+'. La sua efficacia è aumentata.');}) as EventListener);
window.addEventListener('microregno:challenge-retry',(()=>{if(this.mode!=='challenge')return;this.challenge=createDailyChallenge();const previous=loadChallengeSave(this.challenge.date,this.challenge.id);this.profile=loadPlayerProfile();this.state=applyProfileBonuses(createChallengeState(this.challenge),this.profile);this.completed=false;this.challengeEventTriggered=false;this.best=previous?.bestScore??this.best;this.buildType=null;this.selectedId=null;const saved=saveChallenge({date:this.challenge.date,challengeId:this.challenge.id,state:this.state,completed:false,score:0,bestScore:this.best,eventTriggered:false});this.reportSaveStatus(saved,'challenge');this.terrain=generateTerrain(this.challenge.seed);this.redraw();this.emit();this.notice('Nuovo tentativo avviato. Il record e le medaglie già ottenute restano conservati.');}) as EventListener);
window.addEventListener('microregno:reset',(()=>{resetKingdom();this.kingdom=createInitialState();this.state=this.kingdom;this.mode='kingdom';this.buildType=null;this.selectedId=null;this.completed=false;this.best=0;this.terrain=generateTerrain(this.state.seed);const saved=saveKingdom(this.kingdom);this.savedAt=Date.now();this.reportSaveStatus(saved,'kingdom');this.redraw();this.emit();this.notice('È iniziato un nuovo regno. Buona fortuna, custode.');}) as EventListener);
window.addEventListener('microregno:center',(()=>{this.centerCamera(true);this.redraw();}) as EventListener);
window.addEventListener('microregno:camera',((e:CustomEvent<{type:string;value?:number}>)=>{
  const action=e.detail,camera=this.cameras.main;
  if(action.type==='rotate-left'){this.cameraRotation-=Math.PI/4;camera.setRotation(this.cameraRotation);this.cameraTouched=true;}
  else if(action.type==='rotate-right'){this.cameraRotation+=Math.PI/4;camera.setRotation(this.cameraRotation);this.cameraTouched=true;}
  else if(action.type==='zoom-in'){camera.setZoom(Phaser.Math.Clamp(camera.zoom*1.15,.55,2.4));this.cameraTouched=true;}
  else if(action.type==='zoom-out'){camera.setZoom(Phaser.Math.Clamp(camera.zoom/1.15,.55,2.4));this.cameraTouched=true;}
  else if(action.type==='center')this.centerCamera(true);
  else if(action.type==='sensitivity'&&typeof action.value==='number')this.rotationSensitivity=Phaser.Math.Clamp(action.value,2,12)/1000;
}) as EventListener);}
private reportSaveStatus(saved:boolean,mode:GameMode=this.mode,pending=false):void{const message=mode==='challenge'?(saved?'Progressi della sfida salvati oggi':pending?'Sfida pronta, salvataggio in attesa':'Salvataggio della sfida non disponibile in questo browser'):(saved?'Salvataggio locale attivo':'Salvataggio non disponibile in questo browser');window.dispatchEvent(new CustomEvent('microregno:save-status',{detail:{mode,message}}));}
private sync():void{
if(this.mode==='kingdom'){
const previous=this.state;
this.state=synchronizeKingdomProgression(this.state).state;
this.announceProgression(previous,this.state);
this.kingdom=this.state;
const saved=saveKingdom(this.kingdom);
this.savedAt=Date.now();
this.reportSaveStatus(saved,'kingdom');
}else{
const old=loadChallengeSave(this.challenge.date,this.challenge.id);
this.reportSaveStatus(saveChallenge({date:this.challenge.date,challengeId:this.challenge.id,state:this.state,completed:this.completed,score:old?.score??0,bestScore:Math.max(old?.bestScore??0,this.best),eventTriggered:this.challengeEventTriggered}),'challenge');
}
}
private announceProgression(previous:GameState,next:GameState):void{
if(this.mode!=='kingdom')return;
const known=new Set(previous.progression?.unlockedEpochs??['settlement']);
for(const id of next.progression?.unlockedEpochs??[]){if(!known.has(id))this.notice('Nuova epoca: '+EPOCHS[id].name+'! '+EPOCHS[id].summary+' Ricompensa ricevuta: '+EPOCHS[id].reward+' monete.');}
if(!previous.progression?.campaignComplete&&next.progression?.campaignComplete)this.notice('La Carta della Corona è firmata! Hai completato la campagna di Brumadoro e ricevuto 150 monete.');
}
private tick():void{if(localDateKey()!==this.challenge.date){this.challenge=createDailyChallenge();const todaysSave=loadChallengeSave(this.challenge.date,this.challenge.id);this.best=todaysSave?.bestScore??0;if(this.mode==='challenge'){this.profile=loadPlayerProfile();if(todaysSave){this.state=todaysSave.state;this.completed=todaysSave.completed;this.best=todaysSave.bestScore;this.challengeEventTriggered=todaysSave.eventTriggered??false;}else{this.state=applyProfileBonuses(createChallengeState(this.challenge),this.profile);this.completed=false;this.best=0;this.challengeEventTriggered=false;}this.reportSaveStatus(!!todaysSave,'challenge',!todaysSave);}this.terrain=generateTerrain(this.mode==='challenge'?this.challenge.seed:this.state.seed);this.redraw();this.notice('La nuova sfida giornaliera è disponibile: '+this.challenge.title+'.');}const oldPopulation=this.state.population,oldSeason=getSeason(this.state.gameMinutes).id,oldExploring=(this.state.world?.citizens??[]).filter(c=>c.status==='exploring').map(c=>c.id).sort().join(',');if(this.mode==='kingdom'){const previous=this.state;this.state=advanceTime(this.state,1,true);this.announceProgression(previous,this.state);this.kingdom=this.state;if(Date.now()-this.savedAt>10000){const ok=saveKingdom(this.kingdom);this.savedAt=Date.now();this.reportSaveStatus(ok,'kingdom');}}else if(!this.completed){this.state=advanceTime(this.state,1,false,false);this.resolveChallengeEvent();if(isChallengeComplete(this.state,this.challenge,this.challengeEventTriggered))this.complete();const old=loadChallengeSave(this.challenge.date,this.challenge.id);const v:ChallengeSave={date:this.challenge.date,challengeId:this.challenge.id,state:this.state,completed:this.completed,score:this.completed?challengeScore(this.state,this.challenge):0,bestScore:Math.max(old?.bestScore??0,this.best,this.completed?challengeScore(this.state,this.challenge):0),eventTriggered:this.challengeEventTriggered};this.best=v.bestScore;this.reportSaveStatus(saveChallenge(v),'challenge');}if(this.mode==='kingdom')this.applyPopulationMilestones();const newSeason=getSeason(this.state.gameMinutes);if(oldSeason!==newSeason.id){
this.redraw();
const seasonMessage='È arrivata '+newSeason.name.toLocaleLowerCase('it-IT')+'. '+newSeason.description;
if(this.mode==='kingdom'&&this.state.community){
const community=this.state.community;
this.state={...this.state,community:{...community,lastOutcome:seasonMessage,history:[seasonMessage,...community.history].slice(0,6)}};
this.kingdom=this.state;
const saved=saveKingdom(this.kingdom);
this.savedAt=Date.now();
this.reportSaveStatus(saved,'kingdom');
}
this.notice(seasonMessage);
}else if(this.state.population!==oldPopulation||oldExploring!==(this.state.world?.citizens??[]).filter(c=>c.status==='exploring').map(c=>c.id).sort().join(','))this.redraw();this.emit();}
private resolveChallengeEvent():void{if(this.mode!=='challenge'||this.challengeEventTriggered||this.challenge.eventAt===undefined||this.state.gameMinutes-(this.challenge.startGameMinutes??0)<this.challenge.eventAt)return;this.challengeEventTriggered=true;const delta=this.challenge.eventDelta??{};const resources={...this.state.resources};for(const key of ['wood','stone','food','coins'] as const){const change=delta[key]??0;resources[key]=Math.max(0,Math.min(9999,resources[key]+change));}let world=this.state.world;if(this.challenge.scenario==='drought'&&world)world={...world,weather:{id:'clear',endsAt:0}};this.state={...this.state,resources,world};this.notice((this.challenge.eventTitle??'Evento speciale')+': '+(this.challenge.eventDescription??'Il mondo cambia le sue condizioni.')+' Effetti: '+Object.entries(delta).map(([key,value])=>(Number(value)>0?'+':'')+value+' '+({wood:'legname',stone:'pietra',food:'cibo',coins:'monete'} as Record<string,string>)[key]).join(', ')+'.');}
private applyPopulationMilestones():void{
if(this.mode!=='kingdom')return;
const result=awardPopulationMilestones(this.state);
if(result.reward<=0)return;
this.state=result.state;
this.kingdom=this.state;
const saved=saveKingdom(this.kingdom);
this.savedAt=Date.now();
this.reportSaveStatus(saved,'kingdom');
this.notice('Traguardo raggiunto: '+result.earned.map(n=>n+' abitanti').join(', ')+'. Il Consiglio ti ricompensa con '+result.reward+' monete!');
}
private complete():void{this.completed=true;const score=challengeScore(this.state,this.challenge),old=loadChallengeSave(this.challenge.date,this.challenge.id);this.best=Math.max(this.best,old?.bestScore??0,score);const result=recordChallengeVictory(this.profile,this.challenge,score,this.state.gameMinutes);this.profile=result.profile;const profileSaved=savePlayerProfile(this.profile);const challengeSaved=saveChallenge({date:this.challenge.date,challengeId:this.challenge.id,state:this.state,completed:true,score,bestScore:this.best,eventTriggered:this.challengeEventTriggered});this.reportSaveStatus(challengeSaved&&profileSaved,'challenge');const tier=result.medal.tier==='gold'?'oro':result.medal.tier==='silver'?'argento':'bronzo';this.notice('Sfida completata! Medaglia '+tier+' · '+score+' punti. '+(result.newAchievements.length?'Nuovo traguardo: '+result.newAchievements.map(id=>this.profile.achievements.find(a=>a.id===id)?.name??id).join(', ')+'. ':'')+(result.newRewards.length?'Ricompensa permanente sbloccata: '+result.newRewards.join(', ')+'.':'Rigioca per migliorare il punteggio e il grado della medaglia.'));}
private clickMap(px:number,py:number):void{const t=this.toTile(px,py);if(t.x<0||t.y<0||t.x>=BOARD_SIZE||t.y>=BOARD_SIZE)return;const found=this.state.buildings.find(b=>b.x===t.x&&b.y===t.y);if(found&&!this.buildType){this.selectedId=found.id;this.emit();return;}if(this.buildType){if(this.mode==='challenge'&&this.completed)return;const result=buildAt(this.state,this.terrain,t.x,t.y,this.buildType);if(!result.check.ok){this.notice(result.check.reason??'Non puoi costruire qui.');return;}this.state=result.state;this.sync();this.buildType=null;this.selectedId=this.state.buildings[this.state.buildings.length-1]?.id??null;this.redraw();this.emit();const b=this.state.buildings[this.state.buildings.length-1]!;this.notice(BUILDINGS[b.type].name+' costruito!');if(this.mode==='challenge'&&isChallengeComplete(this.state,this.challenge,this.challengeEventTriggered))this.complete();return;}this.selectedId=null;this.emit();}
private toTile(px:number,py:number):{x:number;y:number}{const a=(px-this.ox)/(TILE_WIDTH/2),b=(py-this.oy)/(TILE_HEIGHT/2);return{x:Math.round((a+b)/2),y:Math.round((b-a)/2)};}
private toScreen(x:number,y:number):{x:number;y:number}{return{x:this.ox+(x-y)*TILE_WIDTH/2,y:this.oy+(x+y)*TILE_HEIGHT/2};}
private diamond(cx:number,cy:number):Phaser.Geom.Point[]{return[new Phaser.Geom.Point(cx,cy-TILE_HEIGHT/2),new Phaser.Geom.Point(cx+TILE_WIDTH/2,cy),new Phaser.Geom.Point(cx,cy+TILE_HEIGHT/2),new Phaser.Geom.Point(cx-TILE_WIDTH/2,cy)];}
private drawHover(px:number,py:number):void{const t=this.toTile(px,py);this.hover.clear();if(t.x<0||t.y<0||t.x>=BOARD_SIZE||t.y>=BOARD_SIZE)return;const p=this.toScreen(t.x,t.y),color=this.buildType?(canBuild(this.state,this.terrain,t.x,t.y,this.buildType).ok?0xeff7b0:0xed8e7a):0xf5d47c;this.hover.lineStyle(3,color,.96);this.hover.strokePoints(this.diamond(p.x,p.y),true);}
private redraw():void{if(!this.board)return;this.villagerTweens.forEach(t=>t.stop());this.villagerTweens.clear();this.board.clear();this.objects.forEach(o=>o.destroy());this.objects=[];const tiles:{x:number;y:number}[]=[];for(let sum=0;sum<BOARD_SIZE*2-1;sum++)for(let y=0;y<BOARD_SIZE;y++){const x=sum-y;if(x>=0&&x<BOARD_SIZE)tiles.push({x,y});}
const season=getSeason(this.state.gameMinutes);tiles.forEach(({x,y})=>{const p=this.toScreen(x,y),t=this.terrain[y]![x]!;let fill=t==='water'?(season.id==='winter'?0x8daeb2:0x6ebbc8):t==='forest'?(season.id==='autumn'?0x8f9d64:season.id==='winter'?0x8d9f92:0x79a96f):t==='rock'?0xa6a99d:(season.id==='autumn'?0xb5b37f:season.id==='winter'?0xa7b5a6:season.id==='summer'?0xa6bf79:0x9fbe83);if(t==='grass'&&(x*7+y*3+this.state.seed)%4===0)fill=season.id==='autumn'?0xc0b477:season.id==='winter'?0xb7c2b1:0x95b77a;this.board.fillStyle(fill,1);this.board.fillPoints(this.diamond(p.x,p.y),true);this.board.lineStyle(1,t==='water'?0x5aa6b6:0x769b69,.72);this.board.strokePoints(this.diamond(p.x,p.y),true);});
tiles.forEach(({x,y})=>{const p=this.toScreen(x,y),t=this.terrain[y]![x]!;if(t==='forest'){const treeTint=season.id==='autumn'?0xc99a54:season.id==='winter'?0xaab8aa:season.id==='summer'?0x97b875:0xffffff;const o=this.add.image(p.x,p.y-22,'tree').setDisplaySize(61,76).setTint(treeTint).setOrigin(.5,.83).setDepth((x+y)*10+3);this.objects.push(o);}else if(t==='rock'){const o=this.add.image(p.x,p.y-3,'rock').setDisplaySize(48,42).setOrigin(.5,.76).setDepth((x+y)*10+3);this.objects.push(o);}else if(t==='water'&&(x+y)%2===0){const o=this.add.image(p.x,p.y-2,'leaf').setDisplaySize(22,9).setTint(0xd9f1e9).setAlpha(.58).setDepth((x+y)*10+3);this.objects.push(o);}const b=this.state.buildings.find(v=>v.x===x&&v.y===y);if(b){const sizes:Record<BuildingType,[number,number]>={townHall:[111,112],house:[81,79],farm:[93,79],sawmill:[91,83],quarry:[87,82],market:[91,80],road:[62,35],mill:[87,82],bakery:[86,82],warehouse:[88,82],school:[86,88],watchtower:[72,96],workshop:[86,80],university:[96,94]};const z=sizes[b.type];const depth=(x+y)*10+6;const o=this.add.image(p.x,p.y+1,SPRITES[b.type]).setDisplaySize(z[0],z[1]).setOrigin(.5,.83).setDepth(depth);this.objects.push(o);if(b.level>1){const bx=p.x+25,by=p.y-47;const badge=this.add.circle(bx,by,10,0x285238).setStrokeStyle(2,0xf0d58c).setDepth(depth+2);const level=this.add.text(bx,by,String(b.level),{fontFamily:'Arial',fontSize:'12px',fontStyle:'bold',color:'#fffbe8',align:'center'}).setOrigin(.5).setDepth(depth+3);this.objects.push(badge,level);}}});this.drawVillagers();this.hover.clear();}
private walkableTile(x:number,y:number):boolean{
return x>=0&&y>=0&&x<BOARD_SIZE&&y<BOARD_SIZE&&this.terrain[y]![x]==='grass'&&!this.state.buildings.some(b=>b.x===x&&b.y===y);
}
private pathBetween(start:{x:number;y:number},target:{x:number;y:number}):Array<{x:number;y:number}>{
const key=(p:{x:number;y:number})=>p.x+','+p.y,startKey=key(start),targetKey=key(target),queue=[start],previous=new Map<string,string|null>([[startKey,null]]);
while(queue.length){const current=queue.shift()!;if(key(current)===targetKey)break;for(const next of [{x:current.x+1,y:current.y},{x:current.x-1,y:current.y},{x:current.x,y:current.y+1},{x:current.x,y:current.y-1}]){const k=key(next);if(!this.walkableTile(next.x,next.y)||previous.has(k))continue;previous.set(k,key(current));queue.push(next);}}
if(!previous.has(targetKey))return [];
const path:Array<{x:number;y:number}>=[];let cursor:string|null=targetKey;
while(cursor){const [x,y]=cursor.split(',').map(Number);path.push({x:x!,y:y!});cursor=previous.get(cursor)??null;}
return path.reverse();
}
private citizenDestination(citizen:Citizen,offset:number,start:{x:number;y:number}):{x:number;y:number}{
const activity=getCitizenActivity(this.state,citizen),workplace=getCitizenWorkplace(this.state,citizen);
const home=this.state.buildings.find(b=>b.id===citizen.homeId)??this.state.buildings.find(b=>b.type==='house')??this.state.buildings.find(b=>b.type==='townHall');
let targetBuilding=activity==='working'?workplace:activity==='resting'||activity==='eating'?home:undefined;
if(activity==='commuting'){const hour=this.state.gameMinutes%1440;targetBuilding=hour>=6*60&&hour<9*60?workplace:home;}
if(targetBuilding){const adjacent=[{x:targetBuilding.x+1,y:targetBuilding.y},{x:targetBuilding.x-1,y:targetBuilding.y},{x:targetBuilding.x,y:targetBuilding.y+1},{x:targetBuilding.x,y:targetBuilding.y-1}].filter(p=>this.walkableTile(p.x,p.y));adjacent.sort((a,b)=>Math.abs(a.x-start.x)+Math.abs(a.y-start.y)-(Math.abs(b.x-start.x)+Math.abs(b.y-start.y)));if(adjacent.length)return adjacent[0]!;}
const plaza=[{x:4,y:6},{x:4,y:7},{x:5,y:7},{x:6,y:7},{x:6,y:6},{x:6,y:5},{x:5,y:5},{x:4,y:5},{x:5,y:4},{x:6,y:4}].filter(p=>this.walkableTile(p.x,p.y));
return plaza.length?plaza[(Math.floor(this.state.gameMinutes/18)+offset)%plaza.length]!:start;
}
private drawVillagers():void{
const walkTiles:Array<[number,number]>=[[4,6],[4,7],[5,7],[6,7],[6,6],[6,5],[5,5],[4,5],[5,4],[6,4]];
const route=walkTiles.filter(([x,y])=>this.walkableTile(x,y));if(route.length<2)return;
const coats=[0x8d5b45,0x416b8e,0x8b9b54,0x8a6aa5,0xb56b4b,0x4b7f74,0x6d8260,0x986b3f],hair=[0x4b3528,0x3d342c,0x7c5638,0x43372f,0x6a4934,0x302c2a,0x8b6546,0x554033],skins=[0xe7bf9a,0xc98f69,0xf0d0ad,0xb97859,0xe4b58d,0xd8a47c,0xf0c8a1,0xbd8767];
const residents=(this.state.world?.citizens??[]).filter(c=>c.status==='resident').slice(0,24);
const professionCoats:Record<string,number>={farmer:0x8b9850,lumberjack:0x836144,miner:0x666f79,merchant:0x466f9a,miller:0xb7a16a,baker:0xb96d4b,scholar:0x8276a5,scout:0x447d72,builder:0xa96a4a,guard:0x536b51,artisan:0x9b7751};
for(let i=0;i<residents.length;i++){const tile=route[(i*2)%route.length]!,p=this.toScreen(tile[0],tile[1]),resident=residents[i]!,shadow=this.add.ellipse(0,0,10,4,0x314b39,.22),body=this.add.ellipse(0,-7,7,9,professionCoats[resident.profession]??coats[i%coats.length]),head=this.add.circle(0,-14,3.2,skins[i%skins.length]),cap=this.add.ellipse(0,-16,5.5,2.5,hair[i%hair.length]),person=this.add.container(p.x,p.y+4,[shadow,body,head,cap]).setDepth((tile[0]+tile[1])*10+7);this.objects.push(person);this.walkVillager(person,resident.id,{x:tile[0],y:tile[1]},1050+(i%4)*140,i);}
}
private walkVillager(person:Phaser.GameObjects.Container,citizenId:string,fallback:{x:number;y:number},duration:number,offset:number):void{
if(!person.active)return;const record=this.state.world?.citizens.find(c=>c.id===citizenId);if(!record||record.status!=='resident')return;
let current=this.toTile(person.x,person.y-4);if(!this.walkableTile(current.x,current.y))current=fallback;
let destination=this.citizenDestination(record,offset,current),path=this.pathBetween(current,destination);
if(path.length<2){const idle=[{x:4,y:6},{x:4,y:7},{x:5,y:7},{x:6,y:7},{x:6,y:6},{x:6,y:5},{x:5,y:5},{x:4,y:5},{x:5,y:4},{x:6,y:4}].filter(p=>this.walkableTile(p.x,p.y));destination=idle.find(p=>p.x!==current.x||p.y!==current.y)??current;path=this.pathBetween(current,destination);}
const next=path[1]??destination;if(next.x===current.x&&next.y===current.y){this.time.delayedCall(400,()=>this.walkVillager(person,citizenId,fallback,duration,offset));return;}
const target=this.toScreen(next.x,next.y),tween=this.tweens.add({targets:person,x:target.x,y:target.y+4,duration,ease:'Sine.inOut',onComplete:()=>{this.villagerTweens.delete(person);person.setDepth((next.x+next.y)*10+7);this.walkVillager(person,citizenId,next,duration,offset);}});this.villagerTweens.set(person,tween);
}
private emit():void{const selected=this.state.buildings.find(b=>b.id===this.selectedId)??null,saved=loadChallengeSave(this.challenge.date,this.challenge.id);const challengeState=this.mode==='challenge'?this.state:(saved?.state??createChallengeState(this.challenge));const challengeDone=this.mode==='challenge'?this.completed:(saved?.completed??false);const snap:GameSnapshot={state:this.state,mode:this.mode,challenge:this.challenge,challengeProgress:challengeProgress(challengeState,this.challenge),challengeCompleted:challengeDone,bestScore:Math.max(this.best,saved?.bestScore??0),playerProfile:this.profile,challengeEventTriggered:this.challengeEventTriggered,selectedBuildType:this.buildType,selectedBuilding:selected};window.dispatchEvent(new CustomEvent('microregno:state',{detail:snap}));window.dispatchEvent(new CustomEvent('microregno:clock',{detail:formatGameClock(this.state.gameMinutes)}));}
private notice(message:string):void{window.dispatchEvent(new CustomEvent('microregno:notice',{detail:message}));}}