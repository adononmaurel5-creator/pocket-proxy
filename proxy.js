  
  const express = require('express');
const cors = require('cors');
const axios = require('axios');
const WebSocket = require('ws');
const { HttpsProxyAgent } = require('https-proxy-agent');

const app = express();
app.use(cors());
app.use(express.json());

// Identifiants Decodo (session statique)
const PROXY_URL = 'https://spr5gith3k:lQ4iibFeya87QSd6_e@isp.decodo.com:10007';
const proxyAgent = new HttpsProxyAgent(PROXY_URL);

// Identifiants Pocket Option (variables d'environnement Render)
const PO_EMAIL = process.env.PO_EMAIL || '';
const PO_PASSWORD = process.env.PO_PASSWORD || '';

let cookieString = '';
let prices = {};
let ws = null;

async function loginAndGetCookies() {
  try {
    const client = axios.create({
      httpsAgent: proxyAgent,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
        'Accept-Language': 'fr-FR,fr;q=0.9',
      }
    });

    console.log('🔵 Récupération page d’accueil...');
    const homeResp = await client.get('https://pocketoption.com/', {
      headers: { 'Referer': 'https://www.google.com/' }
    });
    console.log('✅ Page d’accueil reçue (status ' + homeResp.status + ')');

    console.log('🔵 Tentative de connexion en JSON...');
    const loginResp = await client.post('https://pocketoption.com/api/auth/login', 
      {
        email: PO_EMAIL,
        password: PO_PASSWORD,
        remember: 1
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Origin': 'https://pocketoption.com',
          'Referer': 'https://pocketoption.com/login',
          'X-Requested-With': 'XMLHttpRequest'
        }
      }
    );

    console.log('✅ Réponse login status ' + loginResp.status);

    const setCookie = loginResp.headers['set-cookie'];
    if (setCookie) {
      cookieString = setCookie.join('; ');
      console.log('✅ Cookies récupérés : ' + cookieString.substring(0, 80) + '...');
    } else {
      console.log('⚠️ Aucun cookie reçu, contenu de la réponse : ' + JSON.stringify(loginResp.data));
    }
    return true;
  } catch (e) {
    console.error('❌ Échec authentification :', e.response?.status, e.message);
    return false;
  }
}

function connectPO() {
  if (!cookieString) {
    console.log('⏳ Pas encore de cookie, nouvelle tentative dans 5s');
    setTimeout(connectPO, 5000);
    return;
  }

  console.log('🔵 Connexion WebSocket...');
  ws = new WebSocket("wss://api-l.po.market/socket.io/?EIO=4&transport=websocket", {
    agent: proxyAgent,
    headers: {
      'Origin': 'https://pocketoption.com',
      'Cookie': cookieString,
      'User-Agent': 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
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

(async () => {
  if (!PO_EMAIL || !PO_PASSWORD) {
    console.error('❌ PO_EMAIL et PO_PASSWORD manquants');
    return;
  }
  const ok = await loginAndGetCookies();
  if (ok) {
    connectPO();
    setInterval(async () => {
      await loginAndGetCookies();
      if (ws) ws.close();
    }, 5 * 60 * 60 * 1000);
  }
})();

const PORT = process.env.PORT || 3456;
app.listen(PORT, () => console.log(`🚀 Proxy prêt sur port ${PORT}`));      
