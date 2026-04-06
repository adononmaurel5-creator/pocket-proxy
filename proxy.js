const WebSocket = require("ws");
const http = require("http");

let ssid = null;
let prices = {};
let ws = null;

function connectPO() {
  if (!ssid) return;
  ws = new WebSocket("wss://api-l.po.market/socket.io/?EIO=4&transport=websocket", {
  headers: {
    
    'Origin': 'https://pocket-option.com',
    'Cookie': `ssid=${ssid}`
  }
});

  ws.on("open", () => {
    console.log("✅ Connecté à Pocket Option");
    ws.send("40");
    setTimeout(() => {
      ws.send(`42["auth",{"session":"${ssid}","isDemo":0}]`);
      ws.send(`42["subscribeSymbol","EURUSD_otc"]`);
    }, 1000);
  });

  ws.on("message", (raw) => {
    const msg = raw.toString();
    if (msg === "2") { ws.send("3"); return; }
    if (msg.startsWith("42")) {
      try {
        const [event, data] = JSON.parse(msg.slice(2));
        if (data?.asset && data?.price) {
          prices[data.asset] = { price: data.price, time: Date.now() };
        }
        // Certains formats utilisent "value" ou "close"
        if (data?.symbol && (data?.value || data?.close)) {
          prices[data.symbol] = { price: data.value || data.close, time: Date.now() };
        }
      } catch {}
    }
  });

  ws.on("close", () => {
    console.log("🔴 Déconnecté, reconnexion dans 5s...");
    setTimeout(connectPO, 5000);
  });

  ws.on("error", (err) => console.error("Erreur WS:", err.message));
}

const server = http.createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "*");
  res.setHeader("Access-Control-Allow-Methods", "*");

  if (req.method === "OPTIONS") { res.writeHead(200); res.end(); return; }

  if (req.url === "/ssid" && req.method === "POST") {
    let body = "";
    req.on("data", (c) => body += c);
    req.on("end", () => {
      ssid = JSON.parse(body).ssid;
      console.log("🔑 SSID reçu:", ssid.slice(0, 8) + "...");
      connectPO();
      res.end(JSON.stringify({ ok: true }));
    });
    return;
  }

  if (req.url === "/prices") {
    res.end(JSON.stringify({ connected: !!ws && ws.readyState === 1, prices }));
    return;
  }

  res.writeHead(404); res.end("Not found");
});

const PORT = process.env.PORT || 3456;
server.listen(PORT, () => console.log("🚀 Proxy sur port", PORT));
