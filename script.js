const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];

const balanceEl = $('#balance');
const balanceCardEl = $('#balanceCard');
const betInput = $('#betAmount');
const autoStopInput = $('#autoStop');
const autoStopField = $('#autoStopField');
const lossProtectionInput = $('#lossProtection');
const startBtn = $('#startBtn');
const mobileStartBtn = $('#mobileStartBtn');
const cashoutBtn = $('#cashoutBtn');
const multiplierEl = $('#multiplier');
const statusLabel = $('#statusLabel');
const currentBetEl = $('#currentBet');
const potentialReturnEl = $('#potentialReturn');
const cashoutValueEl = $('#cashoutValue');
const plane = $('#plane');
const flightCurve = $('#flightCurve');
const flightFill = $('#flightFill');
const trajectoryClipRect = $('#trajectoryClipRect');
const historyEl = $('#history');
const betPreviewEl = $('#betPreview');
const betsList = $('#betsList');
const toast = $('#toast');
const rtpInput = $('#rtpInput');
const rtpBetCountInput = $('#rtpBetCount');
const rtpStakeInput = $('#rtpStake');
const rtpSimulateBtn = $('#rtpSimulateBtn');
const rtpRows = $$('[data-rtp-row]');
const actionButtons = [startBtn, mobileStartBtn].filter(Boolean);
const RTP_MULTIPLIERS = [1.01, 1.5, 2, 3, 5, 10];

function setActionButtons(disabled, label) {
  actionButtons.forEach(button => {
    button.disabled = disabled;
    button.textContent = label;
  });
}

const BET_HISTORY_KEY = 'avionix-demo-bet-history-v1';
const AUTH_USER_KEY = 'avionix-demo-user-v2';
const publicBets = [
  { user: 'Joao***', amount: 50, multiplier: 2.35, profit: 67.5, won: true, dot: 'dot-yellow' },
  { user: 'Ana***', amount: 25, multiplier: 0, profit: -25, won: false, dot: 'dot-pink' },
  { user: 'Bruno***', amount: 100, multiplier: 5.12, profit: 412, won: true, dot: 'dot-blue' },
  { user: 'Mari***', amount: 10, multiplier: 1.22, profit: 2.2, won: true, dot: 'dot-lilac' },
  { user: 'Cris***', amount: 200, multiplier: 0, profit: -200, won: false, dot: 'dot-yellow' },
  { user: 'Rafa***', amount: 30, multiplier: 3.76, profit: 82.8, won: true, dot: 'dot-pink' },
  { user: 'Lari***', amount: 15, multiplier: 0, profit: -15, won: false, dot: 'dot-blue' },
  { user: 'Gust***', amount: 100, multiplier: 12.45, profit: 1145, won: true, dot: 'dot-yellow' },
  { user: 'Nath***', amount: 20, multiplier: 1.44, profit: 28.8, won: true, dot: 'dot-lilac' },
  { user: 'Vini***', amount: 50, multiplier: 0, profit: -50, won: false, dot: 'dot-pink' },
  { user: 'Bia***', amount: 10, multiplier: 2.11, profit: 11.1, won: true, dot: 'dot-blue' },
  { user: 'Caio***', amount: 75, multiplier: 4.61, profit: 270.75, won: true, dot: 'dot-yellow' },
  { user: 'Duda***', amount: 50, multiplier: 0, profit: -50, won: false, dot: 'dot-pink' },
  { user: 'Leo***', amount: 25, multiplier: 1.07, profit: 1.75, won: true, dot: 'dot-lilac' },
];
let activeBetsTab = 'all';
let userBets = [];
try {
  const storedBets = JSON.parse(localStorage.getItem(BET_HISTORY_KEY) || '[]');
  userBets = Array.isArray(storedBets) ? storedBets : [];
} catch {
  userBets = [];
}

const STARTING_BALANCE = 500;
const BALANCE_KEY = 'avionix-demo-balance-v3';
const savedBalance = localStorage.getItem(BALANCE_KEY);
let balance = savedBalance === null ? STARTING_BALANCE : Number(savedBalance);
let running = false;
let currentBet = 0;
let roundProtection = false;
let gameMode = 'manual';
let multiplier = 1;
let crashAt = 0;
let animationTimer = null;
let startedAt = 0;

function brl(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
}

function parseMoney(value) {
  const cleaned = String(value).replace(/\s/g, '').replace(/R\$/gi, '');
  if (cleaned.includes(',')) return Number(cleaned.replace(/\./g, '').replace(',', '.')) || 0;
  return Number(cleaned) || 0;
}

function parseMultiplier(value) {
  return Number(String(value).replace(',', '.')) || 0;
}

function updateModeVisibility() {
  const automatic = gameMode === 'automatic';
  autoStopField.hidden = !automatic;
  autoStopInput.disabled = !automatic;
}

function multiplierLabel(value) {
  return `${value.toFixed(2).replace('.', ',')}x`;
}

function signedBrl(value) {
  return value >= 0 ? `+${brl(value)}` : `-${brl(Math.abs(value))}`;
}

function userBetRow(bet) {
  const profit = Number(bet.payout || 0) - Number(bet.amount || 0);
  return {
    user: 'Você',
    amount: Number(bet.amount || 0),
    multiplier: Number(bet.multiplier || 0),
    profit,
    won: Boolean(bet.won),
    protected: Boolean(bet.protected),
    dot: 'dot-blue',
    mine: true,
  };
}

function renderBets() {
  if (!betsList) return;
  const mine = userBets.map(userBetRow);
  const rows = activeBetsTab === 'mine' ? mine : [...mine, ...publicBets].slice(0, 14);
  betsList.replaceChildren();

  if (!rows.length) {
    const empty = document.createElement('p');
    empty.className = 'bets-empty';
    empty.textContent = 'Você ainda não fez nenhuma aposta. Faça uma rodada para ver seu histórico aqui.';
    betsList.append(empty);
    return;
  }

  rows.forEach((row) => {
    const item = document.createElement('div');
    item.className = `bet-row${row.mine ? ' mine' : ''}`;

    const user = document.createElement('span');
    const dot = document.createElement('i');
    dot.className = `user-dot ${row.dot || 'dot-yellow'}`;
    user.append(dot, document.createTextNode(row.user));

    const amount = document.createElement('span');
    amount.textContent = brl(row.amount);

    const retired = document.createElement('span');
    retired.textContent = row.won ? multiplierLabel(row.multiplier) : (row.protected ? 'Proteção' : '–');
    if (row.won) retired.className = 'positive';

    const profit = document.createElement('strong');
    profit.className = row.profit >= 0 ? 'positive' : 'negative';
    profit.textContent = signedBrl(row.profit);

    item.append(user, amount, retired, profit);
    betsList.append(item);
  });
}

function recordUserBet(won, resolvedMultiplier, payout) {
  userBets.unshift({
    amount: currentBet,
    multiplier: resolvedMultiplier,
    payout,
    won,
    protected: roundProtection,
    timestamp: Date.now(),
  });
  userBets = userBets.slice(0, 20);
  localStorage.setItem(BET_HISTORY_KEY, JSON.stringify(userBets));
  renderBets();
}

function syncBetPreview() {
  if (betPreviewEl) betPreviewEl.textContent = brl(parseMoney(betInput.value));
}

function updateBalance() {
  balanceEl.textContent = brl(balance);
  if (balanceCardEl) balanceCardEl.textContent = brl(balance);
  localStorage.setItem(BALANCE_KEY, String(balance));
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(showToast.t);
  showToast.t = setTimeout(() => toast.classList.remove('show'), 2300);
}

function formatPercent(value) {
  return `${Number(value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
}

function formatCount(value) {
  return Number(value || 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 });
}

function normalCdf(value) {
  const sign = value < 0 ? -1 : 1;
  const x = Math.abs(value) / Math.sqrt(2);
  const t = 1 / (1 + 0.3275911 * x);
  const erf = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return 0.5 * (1 + sign * erf);
}

function distributeBets(total, groups) {
  const base = Math.floor(total / groups);
  const remainder = total % groups;
  return Array.from({ length: groups }, (_, index) => base + (index < remainder ? 1 : 0));
}

function updateRtpPreview() {
  const rtpPercent = Math.min(100, Math.max(0, parseMoney(rtpInput.value)));
  $('#rtpValuePreview').textContent = formatPercent(rtpPercent);
  $('#houseEdgeValue').textContent = formatPercent(100 - rtpPercent);
}

function simulateRtpBlock() {
  const rtpPercent = Math.min(100, Math.max(0, parseMoney(rtpInput.value)));
  const rtp = rtpPercent / 100;
  const totalBets = Math.max(1, Math.round(parseMoney(rtpBetCountInput.value)));
  const stake = parseMoney(rtpStakeInput.value);

  if (stake <= 0) {
    showToast('Informe um valor de aposta maior que zero.');
    return;
  }

  rtpInput.value = rtpPercent.toFixed(2).replace('.', ',');
  rtpBetCountInput.value = String(totalBets);
  rtpStakeInput.value = stake.toFixed(2).replace('.', ',');
  updateRtpPreview();

  const betsByMultiplier = distributeBets(totalBets, RTP_MULTIPLIERS.length);
  let totalPaid = 0;
  let observedHits = 0;
  let expectedHits = 0;
  let variance = 0;

  rtpRows.forEach((row, index) => {
    const multiplierValue = RTP_MULTIPLIERS[index];
    const bets = betsByMultiplier[index];
    const probability = Math.min(1, rtp / multiplierValue);
    const expected = bets * probability;
    let observed = 0;

    for (let attempt = 0; attempt < bets; attempt += 1) {
      if (Math.random() < probability) observed += 1;
    }

    totalPaid += observed * stake * multiplierValue;
    observedHits += observed;
    expectedHits += expected;
    variance += bets * (stake * multiplierValue) ** 2 * probability * (1 - probability);

    row.querySelector('[data-rtp-prob]').textContent = formatPercent(probability * 100);
    row.querySelector('[data-rtp-payout]').textContent = brl(stake * multiplierValue);
    row.querySelector('[data-rtp-bets]').textContent = formatCount(bets);
    row.querySelector('[data-rtp-observed]').textContent = formatCount(observed);
    row.querySelector('[data-rtp-expected]').textContent = formatCount(expected);
  });

  const totalBet = totalBets * stake;
  const expectedPaid = totalBet * rtp;
  const expectedHouseResult = totalBet * (1 - rtp);
  const houseResult = totalBet - totalPaid;
  const standardDeviation = Math.sqrt(variance);
  const p5 = expectedHouseResult - 1.64485362695147 * standardDeviation;
  const p95 = expectedHouseResult + 1.64485362695147 * standardDeviation;
  const lossChance = standardDeviation === 0
    ? (expectedHouseResult < 0 ? 1 : 0)
    : normalCdf(-expectedHouseResult / standardDeviation);

  $('#rtpTotalBet').textContent = brl(totalBet);
  $('#rtpTotalPaid').textContent = brl(totalPaid);
  $('#rtpHouseResult').textContent = brl(houseResult);
  $('#rtpHouseResult').className = houseResult >= 0 ? 'positive' : 'negative';
  $('#rtpExpectedPaid').textContent = brl(expectedPaid);
  $('#rtpObservedHits').textContent = formatCount(observedHits);
  $('#rtpExpectedHits').textContent = formatCount(expectedHits);
  $('#rtpStdDev').textContent = brl(standardDeviation);
  $('#rtpRange').textContent = `${brl(p5)} – ${brl(p95)}`;
  $('#rtpLossChance').textContent = formatPercent(lossChance * 100);
}

function randomCrashPoint() {
  const r = Math.random();
  if (r < 0.45) return 1.05 + Math.random() * 0.8;
  if (r < 0.83) return 1.85 + Math.random() * 2.2;
  if (r < 0.97) return 4.05 + Math.random() * 5.8;
  return 10 + Math.random() * 15;
}

function addHistory(value, animate = false) {
  const el = document.createElement('span');
  el.className = 'history-pill' + (value >= 5 ? ' high' : value >= 2 ? ' hot' : '');
  el.textContent = multiplierLabel(value);
  historyEl.append(el);

  if (!animate) {
    while (historyEl.children.length > 9) historyEl.firstElementChild.remove();
    return;
  }

  const first = historyEl.firstElementChild;
  if (historyEl.children.length <= 9 || !first) return;
  const distance = first.getBoundingClientRect().width + 8;
  historyEl.style.transition = 'transform .45s cubic-bezier(.2,.75,.25,1)';
  requestAnimationFrame(() => {
    historyEl.style.transform = `translateX(-${distance}px)`;
  });
  setTimeout(() => {
    first.remove();
    historyEl.style.transition = 'none';
    historyEl.style.transform = 'translateX(0)';
    requestAnimationFrame(() => {
      historyEl.style.transition = 'transform .45s cubic-bezier(.2,.75,.25,1)';
    });
  }, 470);
}

function setPlaneProgress(value) {
  const progress = Math.min(1, Math.log(value) / Math.log(12));
  const pathLength = flightCurve.getTotalLength();
  const point = flightCurve.getPointAtLength(pathLength * progress);
  const nextPoint = flightCurve.getPointAtLength(Math.min(pathLength, pathLength * (progress + .015)));
  const angle = Math.atan2(nextPoint.y - point.y, nextPoint.x - point.x) * 180 / Math.PI;
  plane.style.left = `${point.x / 10}%`;
  plane.style.bottom = `${(1 - point.y / 520) * 100}%`;
  plane.style.transform = `translate(-10%, 42%) rotate(${angle}deg) scale(${1 + progress * .32})`;
  flightCurve.style.opacity = running ? '1' : '0';
  flightFill.style.opacity = running ? '1' : '0';
  flightCurve.style.strokeDashoffset = String(1 - progress);
  trajectoryClipRect.setAttribute('width', String(point.x));
}

function resetStage() {
  multiplier = 1;
  multiplierEl.textContent = '1,00x';
  multiplierEl.className = 'multiplier';
  statusLabel.textContent = 'PRONTO PARA DECOLAR';
  plane.classList.remove('plane-won', 'plane-leaving');
  plane.style.opacity = '1';
  plane.style.left = '3%';
  plane.style.bottom = '2%';
  plane.style.transform = 'translate(-10%, 42%) rotate(-2deg)';
  flightCurve.style.opacity = '0';
  flightFill.style.opacity = '0';
  flightCurve.style.strokeDashoffset = '1';
  trajectoryClipRect.setAttribute('width', '0');
  currentBetEl.textContent = brl(0);
  potentialReturnEl.textContent = brl(0);
  cashoutValueEl.textContent = brl(0);
}

function endRound(won = false) {
  running = false;
  cancelAnimationFrame(animationTimer);
  setActionButtons(false, '🚀  APOSTAR');
  cashoutBtn.disabled = true;
  lossProtectionInput.disabled = false;
  addHistory(won ? multiplier : crashAt, true);

  if (!won) {
    const refund = roundProtection ? currentBet * 0.5 : 0;
    if (refund > 0) {
      balance += refund;
      updateBalance();
      potentialReturnEl.textContent = brl(refund);
      cashoutValueEl.textContent = brl(refund);
    }
    recordUserBet(false, crashAt, refund);
    multiplierEl.textContent = multiplierLabel(crashAt);
    multiplierEl.className = 'multiplier crashed';
    statusLabel.textContent = 'VOCÊ PERDEU';
    plane.classList.remove('plane-won');
    plane.classList.add('plane-leaving');
    flightCurve.style.opacity = '1';
    flightFill.style.opacity = '1';
    showToast(refund > 0
      ? `Rodada encerrada. Proteção devolveu ${brl(refund)}.`
      : `Rodada encerrada em ${multiplierLabel(crashAt)}`);
  }

  setTimeout(() => {
    if (!running) resetStage();
  }, 2200);
}

function cashout(auto = false) {
  if (!running) return;
  const payout = currentBet * multiplier;
  balance += payout;
  updateBalance();
  running = false;
  cancelAnimationFrame(animationTimer);

  multiplierEl.className = 'multiplier won';
  statusLabel.textContent = auto ? 'VOCÊ GANHOU · PARADA AUTOMÁTICA' : 'VOCÊ GANHOU';
  plane.classList.remove('plane-leaving');
  plane.classList.add('plane-won');
  potentialReturnEl.textContent = brl(payout);
  cashoutValueEl.textContent = brl(payout);
  setActionButtons(false, '🚀  APOSTAR');
  cashoutBtn.disabled = true;
  lossProtectionInput.disabled = false;
  addHistory(multiplier, true);
  recordUserBet(true, multiplier, payout);
  flightCurve.style.opacity = '1';
  flightFill.style.opacity = '1';
  showToast(`Você recebeu ${brl(payout)} em créditos demo.`);

  setTimeout(() => {
    if (!running) resetStage();
  }, 2200);
}

function animate() {
  if (!running) return;
  const elapsed = (performance.now() - startedAt) / 1000;
  multiplier = 1 + Math.pow(elapsed * .58, 1.55);

  if (multiplier >= crashAt) {
    multiplier = crashAt;
    setPlaneProgress(multiplier);
    endRound(false);
    return;
  }

  multiplierEl.textContent = multiplierLabel(multiplier);
  potentialReturnEl.textContent = brl(currentBet * multiplier);
  cashoutValueEl.textContent = brl(currentBet * multiplier);
  setPlaneProgress(multiplier);

  if (gameMode === 'automatic') {
    const autoStop = parseMultiplier(autoStopInput.value);
    if (autoStop >= 1.01 && multiplier >= autoStop) {
      multiplier = autoStop;
      multiplierEl.textContent = multiplierLabel(multiplier);
      cashout(true);
      return;
    }
  }

  animationTimer = requestAnimationFrame(animate);
}

function startRound() {
  if (running) return;
  if (!isAuthenticated) {
    showToast('Cadastre-se e entre na sua conta para apostar.');
    openModal('login');
    return;
  }
  const bet = parseMoney(betInput.value);
  const autoStop = parseMultiplier(autoStopInput.value);
  if (bet <= 0) return showToast('Informe um valor de créditos para a rodada.');
  if (bet > balance) return showToast('Saldo demo insuficiente.');
  if (gameMode === 'automatic' && autoStop < 1.01) return showToast('A retirada automática deve ser maior que 1,00x.');

  currentBet = bet;
  roundProtection = lossProtectionInput.checked;
  balance -= bet;
  updateBalance();
  currentBetEl.textContent = brl(currentBet);
  potentialReturnEl.textContent = brl(currentBet);
  cashoutValueEl.textContent = brl(currentBet);

  crashAt = randomCrashPoint();
  running = true;
  startedAt = performance.now();
  statusLabel.textContent = 'EM VOO';
  multiplierEl.className = 'multiplier running';
  setActionButtons(true, 'AVIÃO EM VOO...');
  cashoutBtn.disabled = false;
  lossProtectionInput.disabled = true;
  animate();
}

$$('.quick-values button').forEach(btn => {
  btn.addEventListener('click', () => {
    betInput.value = Number(btn.dataset.value).toFixed(2).replace('.', ',');
    syncBetPreview();
  });
});

betInput.addEventListener('input', syncBetPreview);

$$('[data-step]').forEach(btn => {
  btn.addEventListener('click', () => {
    const next = Math.max(1, parseMoney(betInput.value) + Number(btn.dataset.step));
    betInput.value = next.toFixed(2).replace('.', ',');
    syncBetPreview();
  });
});

$$('[data-auto-step]').forEach(btn => {
  btn.addEventListener('click', () => {
    const next = Math.max(1.01, parseMultiplier(autoStopInput.value) + Number(btn.dataset.autoStep));
    autoStopInput.value = next.toFixed(2).replace('.', ',');
  });
});

$$('.mode-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    gameMode = tab.dataset.mode;
    $$('.mode-tab').forEach(item => item.classList.toggle('active', item === tab));
    updateModeVisibility();
    showToast(gameMode === 'automatic' ? 'Modo automático selecionado.' : 'Modo manual selecionado.');
  });
});

startBtn.addEventListener('click', startRound);
mobileStartBtn?.addEventListener('click', startRound);
cashoutBtn.addEventListener('click', cashout);
$('#depositBtn')?.addEventListener('click', () => showToast('Depósitos desativados na demonstração.'));

$$('.bets-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    activeBetsTab = tab.dataset.betsTab;
    $$('.bets-tab').forEach(item => item.classList.toggle('active', item === tab));
    renderBets();
  });
});

// Auth modal: local-only demonstration.
const modalBackdrop = $('#modalBackdrop');
const modalTitle = $('#modalTitle');
const modalSubtitle = $('#modalSubtitle');
const authSubmit = $('#authSubmit');
const email = $('#email');
const password = $('#password');
const registerFields = $('#registerFields');
const pixKeyType = $('#pixKeyType');
const pixKey = $('#pixKey');
let authMode = 'login';
let isAuthenticated = false;
const pixKeyPlaceholders = {
  email: 'voce@exemplo.com',
  cpf: '000.000.000-00',
  phone: '(11) 99999-9999',
  evp: 'Digite sua chave aleatória',
};

function formatCpf(value) {
  const digits = String(value).replace(/\D/g, '').slice(0, 11);
  return digits
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/^(\d{3})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3-$4');
}

function updatePixKeyField() {
  pixKey.placeholder = pixKeyPlaceholders[pixKeyType.value] || 'Digite sua chave PIX';
  pixKey.inputMode = pixKeyType.value === 'cpf' ? 'numeric' : 'text';
  if (pixKeyType.value === 'cpf') pixKey.value = formatCpf(pixKey.value);
}

function setAuthMode(mode) {
  authMode = mode;
  $$('.auth-tab').forEach(tab => tab.classList.toggle('active', tab.dataset.tab === mode));
  const register = mode === 'register';
  modalTitle.textContent = register ? 'Criar conta' : 'Entrar';
  modalSubtitle.textContent = register ? 'Use seu e-mail, senha e chave PIX para criar a conta.' : 'Acesse sua conta demonstrativa.';
  authSubmit.textContent = register ? 'Cadastrar' : 'Entrar';
  registerFields.hidden = !register;
  pixKeyType.required = register;
  pixKey.required = register;
  if (register) updatePixKeyField();
}

function openModal(mode) {
  setAuthMode(mode);
  modalBackdrop.hidden = false;
  email.value = '';
  password.value = '';
  email.setAttribute('readonly', 'readonly');
  password.setAttribute('readonly', 'readonly');
  setTimeout(() => {
    email.removeAttribute('readonly');
    password.removeAttribute('readonly');
    email.focus();
  }, 80);
}

function closeModal() {
  modalBackdrop.hidden = true;
}

$$('[data-open]').forEach(btn => btn.addEventListener('click', () => openModal(btn.dataset.open)));
$$('.auth-tab').forEach(tab => tab.addEventListener('click', () => setAuthMode(tab.dataset.tab)));
pixKeyType.addEventListener('change', updatePixKeyField);
pixKey.addEventListener('input', () => {
  if (pixKeyType.value === 'cpf') pixKey.value = formatCpf(pixKey.value);
});
$('#modalClose').addEventListener('click', closeModal);
modalBackdrop.addEventListener('click', (e) => { if (e.target === modalBackdrop) closeModal(); });

// Cada navegador precisa criar sua própria conta demo antes de entrar.
// A versão v2 invalida qualquer usuário demo salvo pela versão anterior.
function hasLocalAccount() {
  try {
    const saved = JSON.parse(localStorage.getItem(AUTH_USER_KEY) || 'null');
    return Boolean(saved?.email && saved?.password);
  } catch {
    return false;
  }
}

// Sempre inicia pelo cadastro para impedir que uma conta antiga seja reutilizada.
setTimeout(() => openModal('register'), 350);

$('#authForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const key = AUTH_USER_KEY;
  const saved = JSON.parse(localStorage.getItem(key) || 'null');
  const emailValue = email.value.trim().toLowerCase();
  const passwordValue = password.value;

  if (authMode === 'register') {
    if (saved?.email === emailValue) return showToast('Já existe uma conta demo com este e-mail.');
    if (pixKeyType.value === 'cpf' && pixKey.value.replace(/\D/g, '').length !== 11) {
      return showToast('Informe o CPF completo no formato 000.000.000-00.');
    }
    localStorage.setItem(key, JSON.stringify({
      email: emailValue,
      password: passwordValue,
      pixKeyType: pixKeyType.value,
      pixKey: pixKey.value.trim(),
    }));
    balance = STARTING_BALANCE;
    localStorage.setItem(BALANCE_KEY, String(balance));
    userBets = [];
    localStorage.removeItem(BET_HISTORY_KEY);
    isAuthenticated = false;
    updateBalance();
    renderBets();
    showToast('Conta criada. Entre para começar a apostar.');
    $('#authForm').reset();
    setAuthMode('login');
    return;
  }

  if (saved && saved.email === emailValue && saved.password === passwordValue) {
    isAuthenticated = true;
    showToast('Login demo realizado com sucesso.');
    closeModal();
  } else {
    showToast('E-mail ou senha demo não conferem.');
  }
});

// Seed history with visual-only example multipliers.
[1.23, 2.45, 1.01, 5.12, 3.76, 1.44, 8.21, 1.03, 12.45, 1.22, 4.61, 1.07].forEach(addHistory);
const carouselSequence = [1.07, 4.67, 1.13, 1.07, 4.61, 1.22, 12.45, 1.03, 8.21, 1.44, 3.28, 2.11, 6.72];
let carouselIndex = 0;
setInterval(() => {
  addHistory(carouselSequence[carouselIndex], true);
  carouselIndex = (carouselIndex + 1) % carouselSequence.length;
}, 2600);
rtpInput.addEventListener('input', updateRtpPreview);
rtpBetCountInput.addEventListener('input', updateRtpPreview);
rtpStakeInput.addEventListener('input', updateRtpPreview);
rtpSimulateBtn.addEventListener('click', simulateRtpBlock);
renderBets();
syncBetPreview();
updateBalance();
updateModeVisibility();
resetStage();
updateRtpPreview();
simulateRtpBlock();

