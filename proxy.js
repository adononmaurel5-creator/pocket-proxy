const express = require('express');
const cors = require('cors');
const WebSocket = require('ws');
const { HttpsProxyAgent } = require('https-proxy-agent');

const app = express();
app.use(cors());
app.use(express.json());

// ✅ COOKIES DE SESSION POCKET OPTION
const CI_SESSION = "a%3A4%3A%7Bs%3A10%3A%22session_id%22%3Bs%3A32%3A%22f36579ce10258d2e2d8c1d968e3f22a5%22%3Bs%3A10%3A%22ip_address%22%3Bs%3A13%3A%22156.0.214.220%22%3Bs%3A10%3A%22user_agent%22%3Bs%3A68%3A%22Mozilla%2F5.0%20%28Android%2013%3B%20Mobile%3B%20rv%3A150.0%29%20Gecko%2F150.0%20Firefox%2F150.0%22%3Bs%3A13%3A%22last_activity%22%3Bi%3A1778014235%3B%7Ddad3757b31f62d32c34d8b74958861e5";
const AUTOLOGIN = "a%3A2%3A%7Bs%3A6%3A%22key_id%22%3Bs%3A16%3A%2219b7f421d8d9e912%22%3Bs%3A7%3A%22user_id%22%3Bs%3A8%3A%2299154142%22%3B%7D";
const USER_AGENT = "Mozilla/5.0 (Android 13; Mobile; rv:150.0) Gecko/150.0 Firefox/150.0";

// ✅ PROXY DECODO ISP STATIQUE (mot de passe correct : lQ4iibFeya87QSd6_e)
const PROXY_URL = 'http://spr5gith3k:lQ4iibFeya87QSd6_e@isp.decodo.com:10007';
const proxyAgent = new HttpsProxyAgent(PROXY_URL);

let prices = {};
let ws = null;

function connectPO() {
  if (ws) return;

  console.log('🔵 Connexion WebSocket...');
  ws = new WebSocket("wss://api-l.po.market/socket.io/?EIO=4&transport=websocket", {
    agent: proxyAgent,
    headers: {
      'Origin': 'https://pocketoption.com',
      'Cookie': `ci_session=${CI_SESSION}; autologin=${AUTOLOGIN}`,
      'User-Agent': USER_AGENT,
      'Referer': 'https://pocketoption.com/trading',
      'Accept-Encoding': 'gzip, deflate, br',
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
    console.log('🔴 Déconnecté, reconnexion dans 5s');
    setTimeout(connectPO, 5000);
  });

  ws.on('error', err => console.error('❌ Erreur WS:', err.message));
}

app.get('/prices', (req, res) => {
  res.json({ connected: ws && ws.readyState === 1, prices });
});

app.get('/', (req, res) => res.send('Pocket Proxy v2 actif'));

// Démarrage
connectPO();

const PORT = process.env.PORT || 3456;
app.listen(PORT, () => console.log(`🚀 Proxy prêt sur port ${PORT}`));  
  
