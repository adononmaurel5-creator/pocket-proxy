const express = require('express');
const cors = require('cors');
const WebSocket = require('ws');

const app = express();
app.use(cors());
app.use(express.json());

let prices = {};
let connected = false;
let ssid = '';
let ws = null;

function connectToPocketOption() {
  if (!ssid) return;
  if (ws) ws.terminate();
  
  ws = new WebSocket('wss://ws2.pocket-option.com/ws', {
    headers: {
      'Cookie': `ssid=${ssid}`,
      'Origin': 'https://pocket-option.com',
      'User-Agent': 'Mozilla/5.0'
    }
  });

  ws.on('open', () => {
    connected = true;
    console.log('Connecté à PO');
    ws.send(JSON.stringify({"action":"subscribe","message":{"assets":["EURUSD_otc","GBPUSD_otc","USDJPY_otc","AUDUSD_otc"]}}));
  });

  ws.on('message', (data) => {
    try {
      const raw = data.toString();
      console.log('MSG:', raw.substring(0,200));
      const msg = JSON.parse(raw);
      if (msg.asset && msg.price) prices[msg.asset] = {price: msg.price, time: Date.now()};
      if (msg.symbol && msg.close) prices[msg.symbol] = {price: msg.close, time: Date.now()};
    } catch(e) {}
  });

  ws.on('close', () => { connected = false; setTimeout(connectToPocketOption, 5000); });
  ws.on('error', (e) => { connected = false; console.log('Erreur:', e.message); });
}

app.post('/ssid', (req, res) => {
  ssid = req.body.ssid;
  connectToPocketOption();
  res.json({ok: true});
});

app.get('/prices', (req, res) => {
  res.json({connected, prices});
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Proxy actif sur port', PORT));
