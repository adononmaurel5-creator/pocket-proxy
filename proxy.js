const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { wrapper } = require('axios-cookiejar-support');
const tough = require('tough-cookie');
const WebSocket = require('ws');
const { HttpsProxyAgent } = require('https-proxy-agent');
const qs = require('qs');

const app = express();
app.use(cors());
app.use(express.json());

// Proxy Decodo (votre proxy résidentiel)
const PROXY_URL = 'https://spjfzd4lq7:7Bt17qtmtil4Ft_wIN@gate.decodo.com:7000';
const proxyAgent = new HttpsProxyAgent(PROXY_URL);

// Identifiants Pocket Option (à définir sur Render, PAS dans le code)
const PO_EMAIL = process.env.PO_EMAIL || '';
const PO_PASSWORD = process.env.PO_PASSWORD || '';

// Stockage des cookies de session
const cookieJar = new tough.CookieJar();
const client = wrapper(axios.create({
  httpsAgent: proxyAgent,
  jar: cookieJar,
  withCredentials: true,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
    'Accept-Language': 'fr-FR,fr;q=0.9',
  }
}));

let prices = {};
let ws = null;

// Connexion HTTP automatique
async function loginAndGetSession() {
  try {
    await client.get('https://pocketoption.com/', { headers: { 'Referer': 'https://www.google.com/' } });
    await client.post('https://pocketoption.com/api/auth/login', qs.stringify({
      email: PO_EMAIL,
      password: PO_PASSWORD,
      g_recaptcha_response: '',
      is_terms_accepted: true,
    }), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Origin': 'https://pocketoption.com',
        'Referer': 'https://pocketoption.com/login',
      }
    });
    console.log('✅ Authentifié sur Pocket Option');
    return true;
  } catch (e) {
    console.error('❌ Échec authentification:', e.response?.status, e.message);
    return false;
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const tough = require('tough-cookie');
const WebSocket = require('ws');
const { HttpsProxyAgent } = require('https-proxy-agent');
const qs = require('qs');

const app = express();
app.use(cors());
app.use(express.json());

// Proxy Decodo
const PROXY_URL = 'https://spjfzd4lq7:7Bt17qtmtil4Ft_wIN@gate.decodo.com:7000';
const proxyAgent = new HttpsProxyAgent(PROXY_URL);

// Identifiants Pocket Option
const PO_EMAIL = process.env.PO_EMAIL || '';
const PO_PASSWORD = process.env.PO_PASSWORD || '';

// Jar de cookies
const cookieJar = new tough.CookieJar();

// Client axios avec gestion manuelle des cookies
const client = axios.create({
  httpsAgent: proxyAgent,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
    'Accept-Language': 'fr-FR,fr;q=0.9',
  }
});

// Intercepteur pour envoyer les cookies
client.interceptors.request.use(async (config) => {
  const cookies = await cookieJar.getCookies(config.url);
  if (cookies.length) {
    config.headers.Cookie = cookies.map(c => `${c.key}=${c.value}`).join('; ');
  }
  return config;
});

// Intercepteur pour stocker les cookies reçus
client.interceptors.response.use(response => {
  const setCookie = response.headers['set-cookie'];
  if (setCookie) {
    setCookie.forEach(cookieStr => {
      cookieJar.setCookieSync(cookieStr, response.config.url);
    });
  }
  return response;
});

let prices = {};
let ws = null;

async function loginAndGetSession() {
  try {
    // Page d'accueil
    await client.get('https://pocketoption.com/', { headers: { 'Referer': 'https://www.google.com/' } });
    // Login
    await client.post('https://pocketoption.com/api/auth/login', qs.stringify({
      email: PO_EMAIL,
      password: PO_PASSWORD,
      g_recaptcha_response: '',
      is_terms_accepted: true,
    }), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Origin': 'https://pocketoption.com',
        'Referer': 'https://pocketoption.com/login',
      }
    });
    console.log('✅ Authentifié sur Pocket Option');
    return true;
  } catch (e) {
    console.error('❌ Échec authentification:', e.response?.status, e.message);
    return false;
  }
}

function connectPO() {
  cookieJar.getCookies('https://pocketoption.com', (err, cookies) => {
    if (err) {
      console.error('Erreur cookies:', err);
      return;
    }
    const cookieString = cookies.map(c => `${c.key}=${c.value}`).join('; ');

    ws = new WebSocket("wss://api-l.po.market/socket.io/?EIO=4&transport=websocket", {
      agent: proxyAgent,
      headers: {
        'Origin': 'https://pocketoption.com',
        'Cookie': cookieString,
        'User-Agent': client.defaults.headers['User-Agent'],
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

    ws.on('error', err => console.error('Erreur WS:', err.message));
  });
}

app.get('/prices', (req, res) => {
  res.json({ connected: ws && ws.readyState === 1, prices });
});

app.get('/', (req, res) => res.send('Pocket Proxy v2 actif'));

(async () => {
  if (!PO_EMAIL || !PO_PASSWORD) {
    console.error('❌ PO_EMAIL et PO_PASSWORD doivent être définis');
    return;
  }
  const ok = await loginAndGetSession();
  if (ok) {
    connectPO();
    setInterval(async () => {
      await loginAndGetSession();
      if (ws) ws.close();
    }, 5 * 60 * 60 * 1000);
  }
})();

const PORT = process.env.PORT || 3456;
app.listen(PORT, () => console.log(`🚀 Proxy prêt sur port ${PORT}`));
