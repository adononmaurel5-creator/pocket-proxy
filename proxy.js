  const express = require('express');
const cors = require('cors');
const puppeteer = require('puppeteer');
const WebSocket = require('ws');

const app = express();
app.use(cors());
app.use(express.json());

const PO_EMAIL = process.env.PO_EMAIL || '';
const PO_PASSWORD = process.env.PO_PASSWORD || '';

let cookieString = '';
let prices = {};
let ws = null;

async function loginWithPuppeteer() {
  console.log('🔵 Lancement du navigateur...');
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();

  try {
    await page.goto('https://pocketoption.com/login', { waitUntil: 'networkidle2' });
    console.log('✅ Page de login chargée');

    await page.type('input[name="email"]', PO_EMAIL);
    await page.type('input[name="password"]', PO_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForNavigation({ waitUntil: 'networkidle2' });
    console.log('✅ Connexion réussie');

    const cookies = await page.cookies();
    cookieString = cookies.map(c => `${c.name}=${c.value}`).join('; ');
    console.log('✅ Cookies récupérés :', cookieString.substring(0, 80) + '...');

    await browser.close();
    return true;
  } catch (e) {
    console.error('❌ Erreur Puppeteer :', e.message);
    await browser.close();
    return false;
  }
}

function connectPO() {
  if (!cookieString) {
    console.log('⏳ Pas de cookie, nouvelle tentative...');
    setTimeout(connectPO, 5000);
    return;
  }

  ws = new WebSocket("wss://ws-l.po.market/socket.io/?EIO=4&transport=websocket", {
    headers: {
      'Origin': 'https://pocketoption.com',
      'Cookie': cookieString,
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Referer': 'https://pocketoption.com/trading',
      'Connection': 'Upgrade',
      'Upgrade': 'websocket',
    }
  });

  ws.on('open', () => {
    console.log('✅ WebSocket connecté');
    ws.send('40');
  });

  ws.on('message', (raw) => {
    const msg = raw.toString();
    if (msg === '2') { ws.send('3'); return; }
    if (msg === '40') {
      console.log('🟢 Abonnement aux 4 paires OTC');
      ['EURUSD_otc','GBPUSD_otc','USDJPY_otc','AUDUSD_otc'].forEach(sym => {
        ws.send(`42["subscribeSymbol","${sym}"]`);
      });
      return;
    }
    if (msg.startsWith('42')) {
      try {
        const data = JSON.parse(msg.slice(2))[1];
        if (data?.asset && data?.price) prices[data.asset] = { price: data.price, time: Date.now() };
        if (data?.symbol && (data?.value || data?.close)) prices[data.symbol] = { price: data.value || data.close, time: Date.now() };
      } catch {}
    }
  });

  ws.on('close', () => {
    ws = null;
    console.log('🔴 Déconnecté, reconnexion...');
    setTimeout(connectPO, 5000);
  });

  ws.on('error', err => console.error('❌ Erreur WS:', err.message));
}

app.get('/prices', (req, res) => {
  res.json({ connected: ws && ws.readyState === 1, prices });
});

app.get('/', (req, res) => res.send('Pocket Proxy v3 (Puppeteer)'));

(async () => {
  if (!PO_EMAIL || !PO_PASSWORD) {
    console.error('❌ PO_EMAIL et PO_PASSWORD manquants');
    return;
  }
  const ok = await loginWithPuppeteer();
  if (ok) connectPO();
})();

const PORT = process.env.PORT || 3456;
app.listen(PORT, () => console.log(`🚀 Proxy prêt sur port ${PORT}`));
