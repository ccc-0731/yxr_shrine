console.log('于神庙脚本加载');
const LS_KEY = 'shrine_state_v1';

const defaults = {
  incenseCount: 0,
  blessing: 0,
  drawCount: 0,
  lastFortune: null
};

let state = loadState();

// DOM
const incenseCountEl = document.getElementById('incenseCount');
const blessingEl = document.getElementById('blessing');
const drawCountEl = document.getElementById('drawCount');
const toastEl = document.getElementById('toast');
const burnBtn = document.getElementById('burnBtn');
const drawBtn = document.getElementById('drawBtn');
const fortuneCard = document.getElementById('fortuneCard');
const fortuneLevel = document.getElementById('fortuneLevel');
const fortuneText = document.getElementById('fortuneText');
const animationStage = document.getElementById('animationStage');
const resetBtn = document.getElementById('resetBtn');

// update UI
function render() {
  incenseCountEl.textContent = state.incenseCount;
  blessingEl.textContent = state.blessing;
  drawCountEl.textContent = state.drawCount;
  if (state.lastFortune) {
    fortuneLevel.textContent = state.lastFortune.level;
    fortuneText.textContent = state.lastFortune.text + (state.lastFortune.delta !== undefined ? ` （影响：${state.lastFortune.delta>0?'+':''}${state.lastFortune.delta}）` : '');
    fortuneCard.classList.remove('empty');
    fortuneCard.classList.remove('luck-great','luck-good','luck-small','luck-odd','luck-bad');
    fortuneCard.classList.add(classForLevel(state.lastFortune.level));
  } else {
    fortuneLevel.textContent = '—';
    fortuneText.textContent = '抽一签，试试手气';
    fortuneCard.classList.add('empty');
  }
}

function saveState() {
  localStorage.setItem(LS_KEY, JSON.stringify(state));
}

function loadState(){
  try{
    const raw = localStorage.getItem(LS_KEY);
    if(raw) return Object.assign({}, defaults, JSON.parse(raw));
  }catch(e){console.warn('load state err',e)}
  return Object.assign({}, defaults);
}

function clamp(v,min,max){return Math.min(max,Math.max(min,v))}

function randomInt(a,b){return Math.floor(Math.random()*(b-a+1))+a}

// incense replies
const replies = [
  '于神：已收到，正在排队处理…',
  '于神：香火+1，心诚则灵（也可能不灵）',
  '于神：别卷了，先喝水。',
  '于神：嗯？好像闻到烤肉的味道，香在路上。',
  '于神：收到，你的愿望已列入待办。'
];

burnBtn.addEventListener('click', ()=>{
  if(burnBtn.disabled) return;
  burnBtn.disabled = true;
  setTimeout(()=>burnBtn.disabled = false, 800);

  state.incenseCount += 1;
  const add = randomInt(2,7);
  state.blessing = clamp(state.blessing + add, 0, 100);

  const reply = replies[Math.floor(Math.random()*replies.length)];
  showToast(reply);

  // animate incense
  spawnIncense();

  saveState(); render();
});

function showToast(txt){
  toastEl.textContent = txt;
}

function spawnIncense(){
  const stick = document.createElement('div');
  stick.className = 'incense-stick';
  const smoke = document.createElement('div');
  smoke.className = 'smoke';
  animationStage.appendChild(stick);
  animationStage.appendChild(smoke);
  // remove after animation
  setTimeout(()=>{stick.remove();},1800);
  setTimeout(()=>{smoke.remove();},1800);
}

// draw logic
const levels = [
  {id:'大吉', weight:5},
  {id:'中吉', weight:20},
  {id:'小吉', weight:30},
  {id:'抽象', weight:30},
  {id:'寄', weight:15}
];

function weightedPick(items){
  const total = items.reduce((s,i)=>s+i.weight,0);
  let r = Math.random()*total;
  for(const it of items){
    r -= it.weight;
    if(r<=0) return it.id;
  }
  return items[items.length-1].id;
}

function classForLevel(level){
  switch(level){
    case '大吉': return 'luck-great';
    case '中吉': return 'luck-good';
    case '小吉': return 'luck-small';
    case '抽象': return 'luck-odd';
    case '寄': return 'luck-bad';
    default: return '';
  }
}

const textsByLevel = {
  '大吉': ['天府临门，诸事大吉。','诸事顺遂，福寿康宁。'],
  '中吉': ['可喜可贺，谨慎为上。','行且温顺，顺风而行。'],
  '小吉': ['小有收获，日渐向好。','凡事不宜贪多，稳中有进。'],
  '抽象': ['虚虚实实，自己参悟。','莫问归期，随缘而安。'],
  '寄': ['寄了个希望，别太认真。','哎呀，这签有点意思，先笑纳。']
};

drawBtn.addEventListener('click', ()=>{
  if(drawBtn.disabled) return;
  drawBtn.disabled = true;
  setTimeout(()=>drawBtn.disabled = false, 700);

  state.drawCount += 1;
  const level = weightedPick(levels);
  const pool = textsByLevel[level]||['于神沉默…'];
  const text = pool[Math.floor(Math.random()*pool.length)];

  // determine blessing delta
  let delta = 0;
  switch(level){
    case '大吉': delta = randomInt(8,18); break;
    case '中吉': delta = randomInt(3,9); break;
    case '小吉': delta = randomInt(1,5); break;
    case '抽象': delta = randomInt(-6,6); break;
    case '寄': delta = randomInt(-12,-2); break;
  }

  state.blessing = clamp(state.blessing + delta, 0, 100);
  state.lastFortune = {level,text,delta};

  showToast(`抽到：${level} — ${text}`);
  saveState(); render();
});

resetBtn.addEventListener('click', ()=>{
  if(!confirm('确认要清空本地进度吗？')) return;
  localStorage.removeItem(LS_KEY);
  state = Object.assign({}, defaults);
  showToast('已重置进度');
  render();
});

// initial render
render();
