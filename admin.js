const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const LIVE_RTP_KEY = 'avionix-demo-live-rtp-v1';
const RTP_MULTIPLIERS = [1.01, 1.5, 2, 3, 5, 10];
const rtpInput = $('#adminRtpInput');
const rtpRows = $$('[data-rtp-row]');
let liveRtpBets = [];

function brl(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
}

function parseMoney(value) {
  const cleaned = String(value).replace(/\s/g, '').replace(/R\$/gi, '');
  if (cleaned.includes(',')) return Number(cleaned.replace(/\./g, '').replace(',', '.')) || 0;
  return Number(cleaned) || 0;
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

function houseResultLabel(value) {
  return value < 0 ? `-${brl(Math.abs(value))}` : brl(value);
}

function nearestRtpMultiplierIndex(value) {
  return RTP_MULTIPLIERS.reduce((closest, candidate, index) => (
    Math.abs(candidate - value) < Math.abs(RTP_MULTIPLIERS[closest] - value) ? index : closest
  ), 0);
}

function readLiveBets() {
  try {
    const saved = JSON.parse(localStorage.getItem(LIVE_RTP_KEY) || '[]');
    liveRtpBets = Array.isArray(saved) ? saved : [];
  } catch {
    liveRtpBets = [];
  }
}

function renderLiveMonitor() {
  const rtpPercent = Math.min(100, Math.max(0, parseMoney(rtpInput.value)));
  const rtp = rtpPercent / 100;
  const allBets = liveRtpBets.filter((bet) => Number(bet.amount) > 0);
  const settledBets = allBets.filter((bet) => bet.status !== 'pending' && Number(bet.multiplier) >= 1);
  const pendingBets = allBets.filter((bet) => bet.status === 'pending');
  const totalBet = allBets.reduce((sum, bet) => sum + Number(bet.amount), 0);
  const totalPaid = settledBets.reduce((sum, bet) => sum + Number(bet.payout || 0), 0);
  const observedHits = settledBets.filter((bet) => bet.won).length;
  const expectedPaid = totalBet * rtp;
  const expectedHouseResult = totalBet * (1 - rtp);
  const expectedHits = settledBets.reduce((sum, bet) => sum + Math.min(1, rtp / Number(bet.multiplier)), 0);
  const variance = settledBets.reduce((sum, bet) => {
    const amount = Number(bet.amount);
    const multiplier = Number(bet.multiplier);
    const probability = Math.min(1, rtp / multiplier);
    return sum + (amount * multiplier) ** 2 * probability * (1 - probability);
  }, 0);
  const standardDeviation = Math.sqrt(variance);
  const p5 = expectedHouseResult - 1.64485362695147 * standardDeviation;
  const p95 = expectedHouseResult + 1.64485362695147 * standardDeviation;
  const lossChance = standardDeviation === 0
    ? (expectedHouseResult < 0 ? 1 : 0)
    : normalCdf(-expectedHouseResult / standardDeviation);
  const houseResult = totalBet - totalPaid;

  rtpInput.value = rtpPercent.toFixed(2).replace('.', ',');
  $('#rtpValuePreview').textContent = formatPercent(rtpPercent);
  $('#houseEdgeValue').textContent = formatPercent(100 - rtpPercent);
  $('#rtpDataSource').textContent = allBets.length
    ? `Registros disponíveis: ${formatCount(allBets.length)}${pendingBets.length ? ` · ${formatCount(pendingBets.length)} em andamento` : ''}`
    : 'Aguardando apostas do demo';
  $('#rtpTableCaption').textContent = settledBets.length
    ? 'Apostas registradas agrupadas pelo multiplicador de referência mais próximo. Resultado negativo indica prejuízo da casa nessa faixa.'
    : 'Aguardando apostas concluídas para detalhar pagamentos e resultado da casa.';
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

  const liveRows = RTP_MULTIPLIERS.map(() => ({ count: 0, wagered: 0, paid: 0, observed: 0, expected: 0 }));
  settledBets.forEach((bet) => {
    const multiplier = Number(bet.multiplier);
    const bucket = liveRows[nearestRtpMultiplierIndex(multiplier)];
    bucket.count += 1;
    bucket.wagered += Number(bet.amount);
    bucket.paid += Number(bet.payout || 0);
    bucket.observed += bet.won ? 1 : 0;
    bucket.expected += Math.min(1, rtp / multiplier);
  });

  rtpRows.forEach((row, index) => {
    const multiplier = RTP_MULTIPLIERS[index];
    const probability = Math.min(1, rtp / multiplier);
    const bucket = liveRows[index];
    const rowHouseResult = bucket.wagered - bucket.paid;
    row.querySelector('[data-rtp-prob]').textContent = formatPercent(probability * 100);
    row.querySelector('[data-rtp-payout]').textContent = bucket.observed ? brl(bucket.paid / bucket.observed) : '—';
    row.querySelector('[data-rtp-bets]').textContent = bucket.count ? formatCount(bucket.count) : '—';
    row.querySelector('[data-rtp-paid]').textContent = bucket.count ? brl(bucket.paid) : '—';
    row.querySelector('[data-rtp-house]').textContent = bucket.count ? houseResultLabel(rowHouseResult) : '—';
    row.querySelector('[data-rtp-observed]').textContent = bucket.count ? formatCount(bucket.observed) : '—';
    row.querySelector('[data-rtp-expected]').textContent = bucket.count ? formatCount(bucket.expected) : '—';
    row.classList.toggle('house-loss', bucket.count > 0 && rowHouseResult < 0);
    row.classList.toggle('house-profit', bucket.count > 0 && rowHouseResult >= 0);
  });
}

rtpInput.addEventListener('input', renderLiveMonitor);
window.addEventListener('storage', (event) => {
  if (event.key !== LIVE_RTP_KEY) return;
  readLiveBets();
  renderLiveMonitor();
});

readLiveBets();
renderLiveMonitor();
setInterval(() => {
  readLiveBets();
  renderLiveMonitor();
}, 1000);

