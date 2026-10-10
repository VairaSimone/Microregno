import Phaser from 'phaser';
import './style.css';
import {setupUI} from './ui';
import {KingdomScene} from './game/KingdomScene';
setupUI();
const game=new Phaser.Game({type:Phaser.AUTO,parent:'game-mount',width:1024,height:660,backgroundColor:'#c7e0d3',antialias:true,powerPreference:'high-performance',scale:{mode:Phaser.Scale.FIT,autoCenter:Phaser.Scale.CENTER_BOTH,width:1024,height:660},render:{pixelArt:false,roundPixels:false,antialias:true},scene:[KingdomScene]});
window.addEventListener('beforeunload',()=>game.destroy(true));