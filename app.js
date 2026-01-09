console.log('于神庙脚本加载 v2.0');

const LS_KEY = 'shrine_state_v2';

/**
 * 你可以把你的召唤图放这里，比如：
 * /images/yushen1.jpg
 * /images/yushen2.png
 */
const SUMMON_IMAGES = [
  'images/yxr1.jpg',
  'images/yxr2.jpg',
  'images/yxr3.jpg',
  'images/yxr4.jpg',
  'images/yxr5.jpg',
  'images/yxr6.jpg',
  'images/yxr7.jpg',
];

// 抽签冷却：更长（单位 ms）
const DRAW_COOLDOWN_MS = 15000;

// 点香按钮小冷却，防连点刷爆
const BURN_COOLDOWN_MS = 300;

// 香最多保留多少根（不消失，但做个上限防卡）
const MAX_STICKS = 60;

// 召唤逐出概率（小概率）
const EXPEL_PROB = 0.1; // 10%

const defaults = {
  incenseCount: 0,
  drawCount: 0,
  merit: 0,      // 功德：货币
  luck: 50,      // 运势：0-100
  lastFortune: null,
  lastDrawAt: 0,
  sticks: [],    // 记录香的位置（这样刷新还能“香还在”）
  expelled: false
};

let state = loadState();

/** ---------- DOM ---------- */
const incenseCountEl = document.getElementById('incenseCount');
const drawCountEl = document.getElementById('drawCount');

const meritText = document.getElementById('meritText');
const luckText = document.getElementById('luckText');
const meritFill = document.getElementById('meritFill');
const luckFill = document.getElementById('luckFill');

const toastEl = document.getElementById('toast');
const burnBtn = document.getElementById('burnBtn');
const drawBtn = document.getElementById('drawBtn');
const cooldownHint = document.getElementById('cooldownHint');

const summonBtn = document.getElementById('summonBtn');
const resetBtn = document.getElementById('resetBtn');

const fortuneCard = document.getElementById('fortuneCard');
const fortuneLevel = document.getElementById('fortuneLevel');
const fortuneTag = document.getElementById('fortuneTag');
const fortuneText = document.getElementById('fortuneText');
const fortuneDelta = document.getElementById('fortuneDelta');

const incenseStage = document.getElementById('incenseStage');

const modal = document.getElementById('modal');
const modalBackdrop = document.getElementById('modalBackdrop');
const modalContent = document.getElementById('modalContent');
const modalCloseBtn = document.getElementById('modalCloseBtn');

const expel = document.getElementById('expel');
const refreshBtn = document.getElementById('refreshBtn');

/** ---------- Utils ---------- */
function clamp(v, min, max) { return Math.min(max, Math.max(min, v)); }
function randInt(a, b) { return Math.floor(Math.random() * (b - a + 1)) + a; }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function now() { return Date.now(); }

function saveState() {
  localStorage.setItem(LS_KEY, JSON.stringify(state));
}

function loadState() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return Object.assign({}, defaults, JSON.parse(raw));
  } catch (e) {
    console.warn('load state err', e);
  }
  return Object.assign({}, defaults);
}

/** ---------- 文案库（于神语录） ---------- */
const incenseReplies = [
  '于神：收到',
  '于神：香火+1，心诚则灵（也可能不灵）。',
  '于神：哎，都在卷',
  '于神：怎么还卖菜',
  '于神：不要内卷',
  '于神：为什么我闻到了一股汉堡的味道',
  '于神：狗叫？',
  '于神：快交物理作业'
];

const levels = [
  { id: '大吉', weight: 6 },
  { id: '中吉', weight: 20 },
  { id: '小吉', weight: 24 },
  { id: '抽象', weight: 25 },
  { id: '寄', weight: 25 }
];

const textsByLevel = {
  '大吉': ['天府临门，诸事大吉。', '金榜题名！', '考的全会，蒙的全对。', '贵人相助，风调雨顺。'],
  '中吉': ['可喜可贺，谨慎为上。', '顺风而行，但别飘。', '稳住，你能赢。'],
  '小吉': ['小有收获，日渐向好。', '凡事不贪多，稳中有进。', '今天至少不会太离谱。'],
  '抽象': ['为什么这里有股汉堡的味道？', '难绷', '若前方无路，那就…', '逆天', '我要给你竖手指头了'],
  '寄': ['内卷还是躺平，这是一个问题。', '太菜了', '对不起我不会']
};

function weightedPick(items) {
  const total = items.reduce((s, i) => s + i.weight, 0);
  let r = Math.random() * total;
  for (const it of items) {
    r -= it.weight;
    if (r <= 0) return it.id;
  }
  return items[items.length - 1].id;
}

function classForLevel(level) {
  switch (level) {
    case '大吉': return 'luck-great';
    case '中吉': return 'luck-good';
    case '小吉': return 'luck-small';
    case '抽象': return 'luck-odd';
    case '寄': return 'luck-bad';
    default: return '';
  }
}

/** ---------- UI 渲染 ---------- */
function render() {
  // 顶部 meter
  meritText.textContent = state.merit;
  luckText.textContent = state.luck;

  const meritPct = clamp(state.merit, 0, 100); // 50 作为“召唤阈值”
  const luckPct = clamp(state.luck, 0, 100);

  meritFill.style.width = `${meritPct}%`;
  luckFill.style.width = `${luckPct}%`;

  // 顶部按钮显示逻辑：功德>=50 显示召唤
  if (state.merit >= 50 && !state.expelled) {
    summonBtn.classList.remove('hidden');
  } else {
    summonBtn.classList.add('hidden');
  }

  // 基础计数
  incenseCountEl.textContent = state.incenseCount;
  drawCountEl.textContent = state.drawCount;

  // 抽签卡片
  if (state.lastFortune) {
    fortuneLevel.textContent = state.lastFortune.level;
    fortuneTag.textContent = `运势 ${state.luck}/100`;
    fortuneText.textContent = state.lastFortune.text;

    const d = state.lastFortune.delta;
    fortuneDelta.textContent = `影响：${d > 0 ? '+' : ''}${d} 运势`;

    fortuneCard.classList.remove('empty', 'luck-great', 'luck-good', 'luck-small', 'luck-odd', 'luck-bad');
    fortuneCard.classList.add(classForLevel(state.lastFortune.level));
  } else {
    fortuneLevel.textContent = '—';
    fortuneTag.textContent = '未抽签';
    fortuneText.textContent = '抽一签，试试手气。';
    fortuneDelta.textContent = '影响：—';
    fortuneCard.classList.add('empty');
  }

  // 渲染香（根据 state.sticks 复原）
  renderSticks();

  // 冷却状态
  updateDrawCooldownUI();

  // 被逐出
  if (state.expelled) {
    showExpelOverlay();
  } else {
    // 防止“解除逐出”后 overlay 还挂着
    expel.classList.add('hidden');
    expel.setAttribute('aria-hidden', 'true');
    burnBtn.disabled = false;
    summonBtn.disabled = false;
    // drawBtn 是否可用还要看冷却
    updateDrawCooldownUI();
  }
}

function showToast(txt) {
  toastEl.textContent = txt;
}

/** ---------- 香：不消失（持久化） ---------- */
function renderSticks() {
  // 清空再画（数量不多，简单粗暴）
  incenseStage.innerHTML = '';

  for (const s of state.sticks) {
    const stick = document.createElement('div');
    stick.className = 'incense-stick';
    stick.style.left = `${s.x}%`;
    stick.style.bottom = `${s.bottom}px`;
    stick.style.transform = `rotate(${s.rot}deg)`;
    incenseStage.appendChild(stick);
  }
}

function spawnStickAndSmoke() {
  // stick 位置：随机分布在台子上
  const stick = {
    x: randInt(6, 94),         // 百分比
    bottom: randInt(10, 22),   // 像是插在香炉台里
    rot: randInt(-6, 6)
  };

  state.sticks.push(stick);
  if (state.sticks.length > MAX_STICKS) {
    state.sticks.shift(); // 老香“被香火供奉得太久，挪走了”
  }

  // 立即渲染 stick
  renderSticks();

  // smoke: 只飘一会儿就没了（烟是瞬态，香是永恒）
  const smoke = document.createElement('div');
  smoke.className = 'smoke';
  smoke.style.left = `calc(${stick.x}% - 10px)`;
  incenseStage.appendChild(smoke);

  setTimeout(() => smoke.remove(), 1900);
}

/** ---------- 抽签冷却 ---------- */
function drawReady() {
  return (now() - state.lastDrawAt) >= DRAW_COOLDOWN_MS;
}

function updateDrawCooldownUI() {
  const remain = DRAW_COOLDOWN_MS - (now() - state.lastDrawAt);
  if (remain <= 0) {
    cooldownHint.textContent = '冷却：就绪';
    drawBtn.disabled = state.expelled ? true : false;
    drawBtn.textContent = '抽签（-10功德）';
    return;
  }

  const sec = Math.ceil(remain / 1000);
  cooldownHint.textContent = `冷却：${sec}s`;
  drawBtn.disabled = true;
  drawBtn.textContent = `冷却中（${sec}s）`;
}

/** ---------- 事件：烧香 ---------- */
burnBtn.addEventListener('click', () => {
  if (state.expelled) return;
  if (burnBtn.disabled) return;

  burnBtn.disabled = true;
  setTimeout(() => burnBtn.disabled = false, BURN_COOLDOWN_MS);

  state.incenseCount += 1;

  // 功德增长：2~7
  const meritAdd = randInt(2, 7);
  state.merit = clamp(state.merit + meritAdd, 0, 200); // 允许攒到 200，爽一点

  // 运势轻微变化：-1~+3（烧香也可能“烟熏到眼”）
  const luckDelta = randInt(-1, 3);
  state.luck = clamp(state.luck + luckDelta, 0, 100);

  showToast(`${pick(incenseReplies)}（功德 +${meritAdd}）`);

  spawnStickAndSmoke();

  saveState();
  render();
});

/** ---------- 事件：抽签 ---------- */
drawBtn.addEventListener('click', () => {
  if (state.expelled) return;

  // 冷却检查
  if (!drawReady()) {
    showToast('于神：别急，签筒在加载……');
    return;
  }

  // 功德支付
  if (state.merit < 10) {
    showToast('功德不足（需要10）。去烧香攒点吧。');
    // 小小的“打脸抖动”
    drawBtn.animate(
      [{ transform: 'translateX(0)' }, { transform: 'translateX(-6px)' }, { transform: 'translateX(6px)' }, { transform: 'translateX(0)' }],
      { duration: 260 }
    );
    return;
  }

  state.merit -= 10;
  state.drawCount += 1;
  state.lastDrawAt = now();

  const level = weightedPick(levels);
  const text = pick(textsByLevel[level] || ['于神沉默……']);

  // 运势变化：围绕“运势”而不是功德
  let delta = 0;
  switch (level) {
    case '大吉': delta = randInt(10, 18); break;
    case '中吉': delta = randInt(5, 10); break;
    case '小吉': delta = randInt(2, 6); break;
    case '抽象': delta = randInt(-8, 8); break;
    case '寄': delta = randInt(-16, -6); break;
  }

  state.luck = clamp(state.luck + delta, 0, 100);
  state.lastFortune = { level, text, delta };

  showToast(`抽到：${level} · ${text}`);

  saveState();
  render();
});

/** ---------- 召唤于神（功德>=50 才出现） ---------- */
summonBtn.addEventListener('click', () => {
  if (state.expelled) return;
  if (state.merit < 50) {
    showToast('功德未满，召唤阵法自动熄火。');
    return;
  }

  // 我做成“消耗50功德召唤一次”，这样更像游戏循环
  state.merit -= 50;

  // 小概率逐出
  if (Math.random() < EXPEL_PROB) {
    state.expelled = true;
    saveState();
    render();
    return;
  }

  // 正常召唤：随机展示一张图
  const img = pick(SUMMON_IMAGES);
  openModal(`
    <p>天灵灵，地灵灵，于神竟然显灵了！</p>
    <img src="${img}" alt="于神显灵图" />
    <p style="margin-top:10px;color:#6c6a5f;font-size:12px;">
    </p>
  `);

  saveState();
  render();
});

/** ---------- 弹窗 ---------- */
function openModal(html) {
  modalContent.innerHTML = html;
  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden', 'false');
}

function closeModal() {
  modal.classList.add('hidden');
  modal.setAttribute('aria-hidden', 'true');
  modalContent.innerHTML = '';
}

modalBackdrop.addEventListener('click', closeModal);
modalCloseBtn.addEventListener('click', closeModal);

/** ---------- 被逐出：强制刷新（清档重开版） ---------- */
function showExpelOverlay() {
  expel.classList.remove('hidden');
  expel.setAttribute('aria-hidden', 'false');

  // 直接禁用主要操作
  burnBtn.disabled = true;
  drawBtn.disabled = true;
  summonBtn.disabled = true;

  showToast('于神：你被逐出了于神庙（清档重开）。');
}

refreshBtn.addEventListener('click', (e) => {
  e.preventDefault();

  // ✅ 关键：清掉存档再刷新（被逐出 = 清档重开）
  try {
    localStorage.removeItem(LS_KEY);
  } catch (err) {
    console.warn('清档失败', err);
  }

  // 可选：立即给出“按下去了”的反馈
  refreshBtn.disabled = true;
  refreshBtn.textContent = '正在赎罪…';

  // 用 replace + cache-bust，减少“看起来没刷新”的情况
  location.replace(location.pathname + '?r=' + Date.now());
});

/** ---------- 重置 ---------- */
resetBtn.addEventListener('click', () => {
  const ok = confirm('确认要清空本地进度吗？（香也会清掉）');
  if (!ok) return;
  localStorage.removeItem(LS_KEY);
  state = Object.assign({}, defaults);
  showToast('已重置：从零开始修行。');
  render();
});

/** ---------- 冷却 UI 定时刷新 ---------- */
setInterval(() => {
  updateDrawCooldownUI();
}, 200);

/** ---------- 初始渲染 ---------- */
render();
