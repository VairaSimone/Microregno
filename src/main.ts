import Phaser from 'phaser';
import './style.css';
import {setupUI} from './ui';
import {KingdomScene} from './game/KingdomScene';
setupUI();
const game=new Phaser.Game({type:Phaser.AUTO,parent:'game-mount',width:1280,height:720,backgroundColor:'#9dbd96',resolution:Math.min(window.devicePixelRatio||1,1.25),antialias:true,powerPreference:'low-power',fps:{target:30,limit:30,forceSetTimeOut:true},scale:{mode:Phaser.Scale.RESIZE,autoCenter:Phaser.Scale.CENTER_BOTH,width:1280,height:720},render:{pixelArt:false,roundPixels:false,antialias:true},scene:[KingdomScene]});
window.addEventListener('beforeunload',()=>game.destroy(true));