const SAVE_KEY='ludusSubterraSave';
const LEGACY_SAVE_KEY='scoundrelRetroSave';
const SCORES_KEY='ludusSubterraHighScores';

const SUITS=['♠','♣','♦','♥'];
const RANKS=['2','3','4','5','6','7','8','9','10','J','Q','K','A'];

const value=r=>r==='A'?14:r==='K'?13:r==='Q'?12:r==='J'?11:Number(r);
const type=s=>s==='♠'||s==='♣'?'monster':s==='♦'?'weapon':'potion';

let state=null;
let pending=null;

const $=id=>document.getElementById(id);

let backgroundMusic=null;
let musicStarted=false;
let musicStarting=null;
let cheatBuffer='';
let konamiBuffer=[];
const konamiCode=['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','b','a'];
let raptorActive=false;
let raptorTimer=null;

function showRaptor(){
 const overlay=$('raptorOverlay');
 if(!overlay)return;
 cheatBuffer='';
 konamiBuffer=[];
 raptorActive=true;
 overlay.setAttribute('aria-hidden','false');
 overlay.classList.add('show');
 clearTimeout(raptorTimer);
 raptorTimer=setTimeout(()=>{
  overlay.classList.remove('show');
  overlay.setAttribute('aria-hidden','true');
  raptorActive=false;
 },4000);
}

document.addEventListener('keydown',event=>{
 if(raptorActive){
  event.preventDefault();
  event.stopImmediatePropagation();
  return;
 }
 if(event.key==='Shift'||event.key==='CapsLock')return;
 if(event.ctrlKey||event.altKey||event.metaKey){cheatBuffer='';konamiBuffer=[];return}
 if(/^[a-z]$/i.test(event.key))cheatBuffer=(cheatBuffer+event.key.toLowerCase()).slice(-5);
 else cheatBuffer='';
 const key=event.key.length===1?event.key.toLowerCase():event.key;
 konamiBuffer.push(key);
 if(konamiBuffer.length>konamiCode.length)konamiBuffer.shift();
 const konamiEntered=konamiBuffer.length===konamiCode.length&&konamiBuffer.every((value,index)=>value===konamiCode[index]);
 if(cheatBuffer==='iddqd'||konamiEntered){
  event.preventDefault();
  showRaptor();
 }
},true);

function updateMusicButton(){
 const button=$('musicToggle');
 if(!button||!backgroundMusic)return;
 button.textContent=!musicStarted?'▶ ACTIVAR MÚSICA':backgroundMusic.muted?'🔇 MÚSICA':'🔊 MÚSICA';
 button.setAttribute('aria-label',!musicStarted?'Activar música':backgroundMusic.muted?'Activar música':'Silenciar música');
 button.setAttribute('aria-pressed',String(musicStarted&&backgroundMusic.muted));
}

function initMusic(){
 const button=$('musicToggle');
 if(!button||!window.MidiPlayer||!window.MIDI_TRACKS?.length){
  if(button){button.disabled=true;button.title='No se pudieron cargar las pistas MIDI.';}
  return;
 }

 backgroundMusic=new window.MidiPlayer(window.MIDI_TRACKS);
 const startMusic=()=>{
  if(musicStarted)return backgroundMusic.activate();
  if(musicStarting)return musicStarting;
  musicStarting=backgroundMusic.startRandom().then(()=>{
   musicStarted=true;
   button.title='';
   updateMusicButton();
   return true;
  }).catch(()=>{
   button.title='El navegador no pudo iniciar el audio. Pulsa para volver a intentarlo.';
   return false;
  }).finally(()=>{musicStarting=null});
  return musicStarting;
 };
 document.addEventListener('pointerdown',event=>{
  if(!event.target.closest?.('#musicToggle'))startMusic();
 });
 document.addEventListener('keydown',event=>{
  if(!event.target.closest?.('#musicToggle'))startMusic();
 });
 document.addEventListener('visibilitychange',()=>{
  if(!document.hidden&&musicStarted)backgroundMusic.activate();
 });
 button.onclick=async()=>{
  if(!musicStarted){await startMusic();return}
  backgroundMusic.toggleMute();
  updateMusicButton();
 };
 updateMusicButton();
}

function shuffle(a){
 for(let i=a.length-1;i>0;i--){
  let j=Math.floor(Math.random()*(i+1));
  [a[i],a[j]]=[a[j],a[i]];
 }
 return a;
}

function makeDeck(){
 let d=[];
 for(const s of SUITS){
  for(const r of RANKS){
   d.push({s,r,v:value(r),id:s+r});
  }
 }
 return shuffle(d);
}

function cardHTML(c,idx){
 if(!c)return `<div class="card blank">VACÍO</div>`;
 const red=c.s==='♦'||c.s==='♥';
 const t=type(c.s);
 const label=t==='monster'?'MONSTRUO':t==='weapon'?'ARMA':'POCIÓN';

 return `<button class="card ${red?'red':'black'}" data-card="${idx}" aria-label="${c.r} ${c.s}">
 <span class="corner">${c.r}<br>${c.s}</span>
 <span class="big">${c.s}</span>
 <span class="kind">${label} · ${c.v}</span>
 <span class="corner bottom">${c.r}<br>${c.s}</span>
 </button>`;
}

function log(msg){
 const remainingDamage=state.weapon?state.weaponDurability:'—';
 state.log.unshift(`${msg} — Vida: ${state.hp} / 20 · Daño restante del arma: ${remainingDamage}`);
}

function startGame(){
 $('endHistory').style.display='none';
 $('endLog').innerHTML='';
 state={
  deck:makeDeck(),
  room:[],
  hp:20,
  weapon:null,
  weaponDurability:0,
  monstersDefeated:0,
  defeatedMonsters:[],
  roomsResolved:0,
  leftEnemyOnEscape:false,
  avoided:false,
  roomNo:0,
  resolved:0,
  gameOver:false,
  won:false,
  log:[]
 };

 $('overlay').style.display='none';
 fillRoom();
 log('Entras en la mazmorra con 20 puntos de vida.');
 render();
 say('La primera habitación te espera. Resuelve tres de las cuatro cartas, en el orden que prefieras.');
}

function fillRoom(){
 while(state.room.length<4&&state.deck.length){
  state.room.push(state.deck.shift());
 }
 if(state.room.length)state.roomNo++;
}

let roomNoticeTimer=null;
let roomNoticeUnlockTimer=null;
let roomTransitionActive=false;

function showRoomNotice(transition='room'){
 const notice=$('roomNotice');
 if(!notice)return;

 notice.classList.toggle('escape-transition',transition==='escape');
 $('roomNoticeText').textContent=(transition==='escape'?'ESCAPANDO · ':'HABITACIÓN ')+String(state.roomNo).padStart(2,'0');
 roomTransitionActive=true;
 $('room').querySelectorAll('[data-card]').forEach(card=>card.disabled=true);
 notice.classList.add('show');

 clearTimeout(roomNoticeTimer);
 clearTimeout(roomNoticeUnlockTimer);
 roomNoticeTimer=setTimeout(()=>{
  notice.classList.remove('show');
  roomNoticeUnlockTimer=setTimeout(()=>{
   roomTransitionActive=false;
   $('room').querySelectorAll('[data-card]').forEach(card=>card.disabled=false);
  },220);
 },3000);
}

function showRoomDecision(){
 if(!state||state.gameOver||state.resolved<3||state.room.length===0)return;

 const card=state.room[state.room.length-1];
 const cardType=type(card.s);
 const isMonster=cardType==='monster';

 const lastRoom=state.deck.length===0;
 $('roomChoiceTitle').textContent=lastRoom?'¿ENFRENTAR O ESCAPAR?':isMonster?'¿LUCHAS O HUYES?':'¿USAS EL OBJETO O TE LO LLEVAS?';
 $('roomChoiceText').textContent=lastRoom
  ?`No quedan cartas en la mazmorra. Puedes ${isMonster?'enfrentar al último monstruo':'resolver la última carta'} o escapar ahora y dejar atrás ${isMonster?'al enemigo':'la carta'}.`
  :isMonster
   ?`La última carta es el monstruo ${card.r}${card.s} (fuerza ${card.v}). Puedes enfrentarlo ahora o huir; te perseguirá y aparecerá en la siguiente habitación.`
   :`La última carta es ${cardType==='weapon'?'el arma':'la poción'} ${card.r}${card.s}. Puedes usarla ahora o llevártela a la siguiente habitación.`;
 $('resolveRoomBtn').textContent=isMonster?'ENFRENTAR AHORA':cardType==='weapon'?'EQUIPAR AHORA':'USAR AHORA';
 $('deferRoomBtn').textContent=lastRoom?'ESCAPAR DE LA MAZMORRA':isMonster?'AVANZAR (TE PERSEGUIRÁ)':cardType==='weapon'?'LLEVARTE EL ARMA':'LLEVARME LA POCIÓN';
 $('roomChoiceOverlay').style.display='flex';
}

function deferLastCard(){
 if(!state||state.gameOver||state.resolved<3||state.room.length===0)return;

 const card=state.room[state.room.length-1];
 const cardType=type(card.s);
 $('roomChoiceOverlay').style.display='none';
 state.roomsResolved=(state.roomsResolved||0)+1;

 if(state.deck.length===0){
  state.leftEnemyOnEscape=cardType==='monster';
  log(`Escapas de la mazmorra y dejas atrás ${cardType==='monster'?'al monstruo '+card.r+card.s:'la carta '+card.r+card.s}.`);
  state.room=[];
  say('¡Enhorabuena! Has escapado de la mazmorra.');
  endGame(true);
  return;
 }

 if(cardType==='monster'){
  log(`Huyes del monstruo ${card.r}${card.s}; te persigue hasta la siguiente habitación.`);
  say(`Escapas del monstruo ${card.r}${card.s}, pero te seguirá.`);
 }else{
  log(`Te llevas ${cardType==='weapon'?'el arma':'la poción'} ${card.r}${card.s} a la siguiente habitación.`);
  say(`Te llevas ${cardType==='weapon'?'el arma':'la poción'} ${card.r}${card.s} contigo.`);
 }

 beginNextRoom();
 save(false);
}

function beginNextRoom(transition='room'){
 if(state.hp<=0){
  endGame(false);
  return;
 }

 if(state.deck.length===0&&state.room.length===0){
  endGame(true);
  return;
 }

 state.resolved=0;
 fillRoom();

 if(state.room.length===0){
  endGame(true);
  return;
 }

 render();
 say('Nueva habitación. Elige tres cartas; al quedar una, podrás resolverla aquí o posponerla a la siguiente.');
 showRoomNotice(transition);
}

function render(){
 if(!state)return;

 $('hp').textContent=state.hp+' / 20';
 $('hpfill').style.width=Math.max(0,state.hp/20*100)+'%';

 $('remaining').textContent=`${state.deck.length} / 52`;
 $('remainingfill').style.width=Math.max(0,state.deck.length/52*100)+'%';
 $('remainingfill').parentElement.setAttribute('aria-valuenow',String(state.deck.length));
 $('roomNo').textContent=String(state.roomNo).padStart(2,'0');

 $('roomProgress').textContent=state.resolved+' / 3 resueltas';

 $('defeatedMonsters').textContent=state.defeatedMonsters?.length
  ?state.defeatedMonsters.map(card=>`${card.r}${card.s}`).join(' ')
  :'—';

 $('weaponCard').className='weapon-card'+(state.weapon?'':' empty');

 $('weaponCard').innerHTML=state.weapon
  ?`<span class="rank">${state.weapon.r}</span><span class="suit">♦</span><span class="kind">ARMA</span>`
  :'SIN ARMA<br>—';

 $('weaponName').textContent=state.weapon
  ?`Arma de diamantes ${state.weapon.r}`
  :'Todavía no has encontrado un arma';

 $('weaponPower').textContent='DAÑO RESTANTE: '+(state.weapon?state.weaponDurability:'—');

 $('room').innerHTML=state.room.map((c,i)=>cardHTML(c,i)).join('');

 $('room').querySelectorAll('[data-card]').forEach(b=>{
  b.disabled=roomTransitionActive;
  b.addEventListener('click',()=>selectCard(Number(b.dataset.card)));
 });

 $('avoidBtn').disabled=state.gameOver||state.avoided||state.resolved!==0||state.room.length!==4;

 $('newBtn').textContent=state.gameOver?'JUGAR OTRA VEZ':'NUEVA PARTIDA';

 $('log').innerHTML=state.log.map(x=>'<li>'+escapeHTML(x)+'</li>').join('');
}

function escapeHTML(s){
 return s.replace(/[&<>"']/g,c=>({
  '&':'&amp;',
  '<':'&lt;',
  '>':'&gt;',
  '"':'&quot;',
  "'":'&#39;'
 }[c]));
}

function say(s){
 $('message').textContent=s;
}

function selectCard(i){
 if(!state||state.gameOver||roomTransitionActive||!state.room[i])return;

 const c=state.room[i];
 const t=type(c.s);

 if(t==='monster'){
  pending={i,c};

  $('choiceTitle').textContent='MONSTRUO: '+c.r+c.s;

  const canWeapon=Boolean(state.weapon);

  let explanation='';

  if(canWeapon){
   if(c.v>=state.weaponDurability){
    explanation=`Puedes usar tu arma, pero se romperá. Absorberá los ${state.weaponDurability} puntos que le quedan y perderás ${c.v-state.weaponDurability} de vida.`;
   }else{
    explanation=`Puedes combatir cuerpo a cuerpo o utilizar tu arma. Absorberá ${c.v} puntos y le quedarán ${state.weaponDurability-c.v}.`;
   }
  }else{
   explanation='No tienes un arma equipada; combatirás cuerpo a cuerpo.';
  }

  $('choiceText').textContent=`Este monstruo tiene fuerza ${c.v}. ${explanation}`;
  $('choiceStatus').textContent=canWeapon
   ?`VIDA ACTUAL: ${state.hp} / 20\nDAÑO RESTANTE DEL ARMA: ${state.weaponDurability}`
   :`VIDA ACTUAL: ${state.hp} / 20`;

  $('weaponBtn').disabled=!canWeapon;
  $('choiceOverlay').style.display='flex';
  return;
 }

 resolve(i,t);
}

function resolve(i,method){
 state.avoided=false;

 const c=state.room[i];
 const t=type(c.s);

 if(t==='weapon'){
  state.weapon=c;
  state.weaponDurability=c.v;

  log(`Equipas el arma ${c.r}♦. El arma anterior se descarta.`);
  say(`Has equipado el arma ${c.r}♦. Su potencia es ${c.v}.`);

  removeCard(i);
  return;
 }

 if(t==='potion'){
  let before=state.hp;
  state.hp=Math.min(20,state.hp+c.v);

  log(`Usas la poción ${c.r}♥ y recuperas ${state.hp-before} puntos de vida.`);
  say(`Poción utilizada: recuperas ${state.hp-before} puntos de vida.`);

  removeCard(i);
  return;
 }

 if(t==='monster'){
  let damage=c.v;

  let historyMessage='';
  if(method==='weapon'&&state.weapon){

   const weaponDurability=state.weaponDurability;

   if(c.v>=weaponDurability){

    damage=c.v-weaponDurability;

    say(`¡Arma destruida! Monstruo ${c.v} − durabilidad ${weaponDurability} = ${damage} de daño.`);
    historyMessage=`¡Tu arma se rompe contra el monstruo ${c.r}${c.s}! Absorbe sus ${weaponDurability} puntos de durabilidad restantes y pierdes ${damage} de vida.`;

    state.weapon=null;
    state.weaponDurability=0;
  
   }else{

    damage=0;
    state.weaponDurability-=c.v;

    say(`¡Victoria! El arma absorbe ${c.v} puntos; le quedan ${state.weaponDurability}.`);
    historyMessage=`Derrotas al monstruo ${c.r}${c.s} con tu arma. Absorbe ${c.v} puntos; quedan ${state.weaponDurability}. No pierdes vida.`;
   }

  }else{

   damage=c.v;

   say(`Combate cuerpo a cuerpo: pierdes ${damage} puntos de vida.`);
   historyMessage=`Combates cuerpo a cuerpo contra ${c.r}${c.s}. Pierdes ${damage} de vida.`;
  }

  // Contador general: suma cualquier monstruo derrotado.
  // No se reinicia al cambiar o romper un arma.
  state.monstersDefeated=(state.monstersDefeated||0)+1;
  if(!Array.isArray(state.defeatedMonsters))state.defeatedMonsters=[];
  state.defeatedMonsters.push({r:c.r,s:c.s});

  state.hp=Math.max(0,state.hp-damage);
  log(historyMessage);

  removeCard(i);

  if(state.hp<=0){
   endGame(false);
   return;
  }
 }
}

function removeCard(i){
 state.room.splice(i,1);
 state.resolved++;

 if(state.hp<=0){
  render();
  return;
 }

 if(state.resolved>=3&&state.room.length>0){
  render();
  say('Queda una carta. Puedes resolverla aquí o llevarla/huir a la siguiente habitación.');
  showRoomDecision();
  save(false);
  return;
 }

 if(state.resolved>=3||state.room.length===0){
  state.roomsResolved=(state.roomsResolved||0)+1;

  if(state.deck.length===0&&state.room.length===0){
   endGame(true);
   return;
  }

  beginNextRoom();

 }else{
  render();
 }

 save(false);
}

function readHighScores(){
 try{
  const scores=JSON.parse(localStorage.getItem(SCORES_KEY)||'[]');
  return Array.isArray(scores)?scores:[];
 }catch(e){
  return [];
 }
}

function saveHighScore(score){
 const scores=readHighScores();
 scores.push({
  score,
  monsters:state.monstersDefeated||0,
  rooms:state.roomsResolved||0,
  won:!!state.won,
  medal:state.won?(state.leftEnemyOnEscape?'silver':'gold'):null,
  date:new Date().toISOString()
 });
 scores.sort((a,b)=>(Number(b.score)||0)-(Number(a.score)||0)||Date.parse(b.date)-Date.parse(a.date));
 localStorage.setItem(SCORES_KEY,JSON.stringify(scores.slice(0,10)));
}

function renderHighScores(){
 const list=$('highScoresList');
 const scores=readHighScores().sort((a,b)=>(Number(b.score)||0)-(Number(a.score)||0)||Date.parse(b.date)-Date.parse(a.date)).slice(0,10);
 list.replaceChildren();
 $('emptyHighScores').style.display=scores.length?'none':'block';
 $('clearScoresBtn').disabled=scores.length===0;

 scores.forEach((entry,index)=>{
  const row=document.createElement('li');
  row.className='high-score-row';
  const rank=document.createElement('span');
  rank.className='high-score-rank';
  rank.textContent=String(index+1).padStart(2,'0');
  const details=document.createElement('div');
  const value=document.createElement('span');
  value.className='high-score-value';
  value.textContent=(Number(entry.score)||0)+' PUNTOS';
  let medal=null;
  if(entry.won){
   const silver=entry.medal?entry.medal==='silver':(Number(entry.monsters)||0)<26;
   medal=document.createElement('span');
   medal.className='high-score-medal '+(silver?'silver':'gold');
   medal.textContent='✦';
   medal.title=silver?'Pieza de plata: escapaste dejando un enemigo':'Pieza de oro: escapaste con la mazmorra limpia';
   medal.setAttribute('role','img');
   medal.setAttribute('aria-label',medal.title);
  }
  const sub=document.createElement('span');
  sub.className='high-score-detail';
  const date=new Date(entry.date);
  const dateText=Number.isNaN(date.getTime())?'':date.toLocaleDateString('es-ES');
  sub.textContent=`${entry.won?'VICTORIA':'PARTIDA TERMINADA'} · ${Number(entry.monsters)||0} monstruos · ${Number(entry.rooms)||0} habitaciones · ${dateText}`;
  details.append(value,sub);
  if(medal)row.append(rank,details,medal);
  else row.append(rank,details);
  list.append(row);
 });
}

function openHighScores(){
 renderHighScores();
 $('scoresOverlay').style.display='flex';
}

function endGame(win){
 if(!state||state.gameOver)return;
 state.gameOver=true;
 state.won=win;

 $('choiceOverlay').style.display='none';
 $('roomChoiceOverlay').style.display='none';

 const score=(state.monstersDefeated||0)+(state.roomsResolved||0);
 state.score=score;
 saveHighScore(score);

 log(win?'Has superado la mazmorra.':'La mazmorra te ha vencido.');

 say(win
  ?`¡Enhorabuena! Has superado la mazmorra. Puntuación: ${score}.`
  :`Fin de la partida. Puntuación: ${score}.`
 );

 render();

 $('overlay').style.display='flex';

 $('overlay').querySelector('h2').textContent=win
  ?'¡MAZMORRA SUPERADA!'
  :'FIN DE LA PARTIDA';
 $('endDeathImage').style.display=win?'none':'block';
 $('endVictoryImage').style.display=win?'block':'none';

 $('overlay').querySelector('p').innerHTML=win
  ?`¡Enhorabuena! Has escapado con ${state.hp} puntos de vida.<br>
    Criaturas derrotadas: ${state.monstersDefeated}.<br>
    Habitaciones resueltas: ${state.roomsResolved||0}.<br>
    Puntuación: ${score}`
  :`Te has quedado sin vida.<br>
    Criaturas derrotadas: ${state.monstersDefeated}.<br>
    Habitaciones resueltas: ${state.roomsResolved||0}.<br>
    Puntuación: ${score}`;

 $('endLog').innerHTML=state.log.map(entry=>'<li>'+escapeHTML(entry)+'</li>').join('');
 $('endHistory').style.display='block';
 $('startBtn').textContent='NUEVA PARTIDA';

 save(false);
}

function avoidRoom(){
 if(!state||state.gameOver||state.avoided||state.resolved!==0||state.room.length!==4)return;

 state.deck.push(...state.room);
 state.room=[];
 state.avoided=true;

 log('Evitas la habitación y colocas sus cuatro cartas al fondo de la mazmorra.');

 beginNextRoom('escape');
}

function save(show=true){
 if(!state)return;

 localStorage.setItem(SAVE_KEY,JSON.stringify(state));

 if(show)say('Partida guardada en este dispositivo.');
}

function load(){
 try{
  let raw=localStorage.getItem(SAVE_KEY);
  if(!raw)raw=localStorage.getItem(LEGACY_SAVE_KEY);
  if(!raw)return false;

  let s=JSON.parse(raw);

  if(!s||!Array.isArray(s.deck)||!Array.isArray(s.room))return false;

  // Compatibilidad con partidas guardadas anteriormente.
  if(s.monstersDefeated===undefined)s.monstersDefeated=0;
  if(s.roomsResolved===undefined)s.roomsResolved=0;
  if(!Array.isArray(s.defeatedMonsters)){
   const defeatedPattern=/(?:¡Tu arma se rompe contra el monstruo|Derrotas al monstruo|Combates (?:a mano limpia|cuerpo a cuerpo) contra)\s+(10|[2-9JQKA])([♠♣])/i;
   s.defeatedMonsters=Array.isArray(s.log)
    ?s.log.slice().reverse().flatMap(entry=>{
     const match=String(entry).match(defeatedPattern);
     return match?[{r:match[1].toUpperCase(),s:match[2]}]:[];
    })
    :[];
  }
  if(s.weaponDurability===undefined)s.weaponDurability=s.weapon?s.weapon.v:0;

  state=s;

  $('overlay').style.display='none';

  render();
  say('Partida guardada recuperada.');
  if(state.resolved>=3&&state.room.length>0)showRoomDecision();
  if(!localStorage.getItem(SAVE_KEY))save(false);

  return true;

 }catch(e){
  return false;
 }
}

function help(){
 $('endHistory').style.display='none';
 $('overlay').style.display='flex';

 $('overlay').querySelector('h2').textContent='REGLAS RÁPIDAS';
 $('endDeathImage').style.display='none';
 $('endVictoryImage').style.display='none';

 $('overlay').querySelector('p').innerHTML=
 'Ludus Subterra está basado en Scoundrel, el juego de cartas en solitario creado por Zach Gage y Kurt Bieg.'+
 '<br><br>'+
 'Empiezas con 20 puntos de vida. ♣ y ♠ son monstruos (J=11, Q=12, K=13, A=14). ♦ son armas y ♥ son pociones.'+
 '<br><br>'+
 'Resuelve tres cartas de cada habitación. Cuando quede una, puedes usarla/enfrentarte a ella ahora o llevarte el objeto o huir del monstruo para resolverlo en la siguiente habitación. Puedes evitar una habitación completa, pero no dos seguidas.'+
 '<br><br>'+
 'La durabilidad inicial del arma es igual a su potencia. Puedes usarla contra cualquier monstruo: si su fuerza es menor que la durabilidad restante, lo vence sin daño y pierde esa cantidad de durabilidad.'+
 '<br><br>'+
 'Si el monstruo iguala o supera la durabilidad restante, el arma se rompe, absorbe lo que le queda y pierdes la diferencia de vida.'+
 '<br><br>'+
 'A mano limpia recibes todo el daño del monstruo. Puedes usar varias pociones por habitación; la vida máxima es 20.'+
 '<br><br>'+
 'El contador de criaturas derrotadas suma todos los monstruos vencidos durante la partida. La puntuación final es la suma de monstruos derrotados y habitaciones resueltas; evitar habitaciones no suma puntos.';

 $('startBtn').textContent=state?'VOLVER AL JUEGO':'COMENZAR PARTIDA';
}

$('startBtn').onclick=()=>{
 if(state&&!state.gameOver){
  $('overlay').style.display='none';
  return;
 }
 startGame();
};

$('newBtn').onclick=()=>startGame();
$('avoidBtn').onclick=avoidRoom;
$('saveBtn').onclick=()=>save(true);

$('resetSaveBtn').onclick=()=>{
 localStorage.removeItem(SAVE_KEY);
 localStorage.removeItem(LEGACY_SAVE_KEY);
 say('Guardado eliminado.');
};

$('helpBtn').onclick=help;
$('highScoresBtn').onclick=openHighScores;
$('viewScoresBtn').onclick=openHighScores;
$('closeScoresBtn').onclick=()=>{ $('scoresOverlay').style.display='none'; };
$('clearScoresBtn').onclick=()=>{
 if(!readHighScores().length)return;
 if(!window.confirm('¿Quieres borrar todas las puntuaciones guardadas?'))return;
 localStorage.removeItem(SCORES_KEY);
 renderHighScores();
};

$('fistBtn').onclick=()=>{
 let p=pending;
 $('choiceOverlay').style.display='none';
 pending=null;
 if(p)resolve(p.i,'fist');
};

$('weaponBtn').onclick=()=>{
 let p=pending;
 $('choiceOverlay').style.display='none';
 pending=null;
 if(p)resolve(p.i,'weapon');
};

$('cancelBtn').onclick=()=>{
 $('choiceOverlay').style.display='none';
 pending=null;
 if(state&&state.resolved>=3&&state.room.length>0)showRoomDecision();
};

$('resolveRoomBtn').onclick=()=>{
 if(!state||state.resolved<3||state.room.length===0)return;
 $('roomChoiceOverlay').style.display='none';
 selectCard(state.room.length-1);
};

$('deferRoomBtn').onclick=deferLastCard;

initMusic();

if(!load())$('overlay').style.display='flex';




