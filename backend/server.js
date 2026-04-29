/**
 * Smart Energy Tracker — Backend Server
 * Node.js + Express + serialport
 *
 * Install deps:
 *   npm install express cors serialport
 *
 * Run:
 *   node server.js
 *
 * Environment variables (optional):
 *   PORT        HTTP port (default 3001)
 *   SERIAL_PORT Serial device path (default /dev/ttyUSB0 on Linux,
 *               COM3 on Windows, /dev/tty.usbmodem* on macOS)
 *   BAUD_RATE   Serial baud rate (default 9600)
 *   MOCK_ARDUINO Set to "true" to skip real Arduino (useful for dev)
 */

const express    = require("express");
const ALLOWED_ORIGINS = [
  "http://localhost:3000",          // Next.js dev server
  process.env.FRONTEND_URL,        // Production Vercel URL (set via env var)
].filter(Boolean);
const cors       = require("cors");
const { SerialPort } = require("serialport");
const { ReadlineParser } = require("@serialport/parser-readline");

// ─── Configuration ──────────────────────────────────────────────────────────
const PORT        = process.env.PORT        || 3001;
const SERIAL_PATH = process.env.SERIAL_PORT || "/dev/ttyUSB0";
const BAUD_RATE   = parseInt(process.env.BAUD_RATE || "9600");
const MOCK        = process.env.MOCK_ARDUINO === "true";

// ─── State ───────────────────────────────────────────────────────────────────
/**
 * appliances: a dictionary of appliance objects.
 * Easy to extend — just add more entries.
 */
const appliances = {
  light_bulb: {
    id:              "light_bulb",
    name:            "Light Bulb",
    watts_per_minute: 1,          // simulation rate
    status:          "OFF",
    turned_on_at:    null,        // Date when last turned ON
    energy_watt_min: 0,           // accumulated watt-minutes (÷60 → watt-hours)
  },
};

// ─── Arduino Serial Connection ────────────────────────────────────────────────
let serialPort = null;
let parser     = null;

function connectSerial() {
  if (MOCK) {
    console.log("[MOCK] Arduino serial connection skipped.");
    return;
  }

  serialPort = new SerialPort({ path: SERIAL_PATH, baudRate: BAUD_RATE });
  parser     = serialPort.pipe(new ReadlineParser({ delimiter: "\r\n" }));

  serialPort.on("open", () => console.log(`[Serial] Connected to ${SERIAL_PATH}`));
  serialPort.on("error", (err) => console.error("[Serial] Error:", err.message));

  parser.on("data", (line) => {
    console.log("[Serial] Arduino →", line);
    // If the Arduino sends LED:ON or LED:OFF we could sync state here,
    // but since we control it ourselves, it is just for confirmation logging.
  });
}

function sendCommand(cmd) {
  if (MOCK) {
    console.log(`[MOCK] Command sent to Arduino: ${cmd}`);
    return;
  }
  if (serialPort && serialPort.isOpen) {
    serialPort.write(cmd + "\n", (err) => {
      if (err) console.error("[Serial] Write error:", err.message);
    });
  } else {
    console.warn("[Serial] Port not open — command dropped:", cmd);
  }
}

connectSerial();

// ─── Energy Calculation Helper ────────────────────────────────────────────────
/**
 * Returns how many watt-minutes an appliance has consumed in total,
 * including any partial session that is currently running.
 */
function getCurrentEnergy(appliance) {
  let total = appliance.energy_watt_min;

  if (appliance.status === "ON" && appliance.turned_on_at) {
    const elapsedMs  = Date.now() - appliance.turned_on_at;
    const elapsedMin = elapsedMs / 60_000;           // convert ms → minutes
    total += elapsedMin * appliance.watts_per_minute;
  }

  return total; // watt-minutes
}

/** Serialize an appliance for the API response */
function serializeAppliance(a) {
  const wattMin = getCurrentEnergy(a);
  return {
    id:         a.id,
    name:       a.name,
    status:     a.status,
    energyUsed: parseFloat((wattMin / 60).toFixed(4)),  // watt-hours
    energyWatt: parseFloat(wattMin.toFixed(2)),          // watt-minutes (for demo)
    unit:       "Wh",
  };
}

// ─── Express App ─────────────────────────────────────────────────────────────
const app = express();
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (Postman, curl, health checks)
    if (!origin) return callback(null, true);

    // Allow localhost dev, ngrok tunnels, and Vercel deployments
    const allowed =
      origin.startsWith("http://localhost") ||
      origin.endsWith(".ngrok-free.app") ||
      origin.endsWith(".ngrok.io") ||
      origin.endsWith(".vercel.app") ||
      ALLOWED_ORIGINS.includes(origin);

    if (allowed) {
      callback(null, true);
    } else {
      callback(new Error(`CORS: origin '${origin}' is not allowed`));
    }
  },
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type"],
}));
app.use(express.json());

// GET /api/appliances — list all appliances
app.get("/api/appliances", (_req, res) => {
  const result = Object.values(appliances).map(serializeAppliance);
  res.json(result);
});

// GET /api/appliances/:id — get single appliance
app.get("/api/appliances/:id", (req, res) => {
  const a = appliances[req.params.id];
  if (!a) return res.status(404).json({ error: "Appliance not found" });
  res.json(serializeAppliance(a));
});

// POST /api/appliances/:id/toggle — toggle appliance ON↔OFF
app.post("/api/appliances/:id/toggle", (req, res) => {
  const a = appliances[req.params.id];
  if (!a) return res.status(404).json({ error: "Appliance not found" });

  if (a.status === "OFF") {
    // ── Turn ON ──
    a.status        = "ON";
    a.turned_on_at  = Date.now();
    sendCommand("ON");
    console.log(`[App] ${a.name} turned ON`);
  } else {
    // ── Turn OFF ──
    // Accumulate the session energy before resetting the timer
    const elapsedMs  = Date.now() - a.turned_on_at;
    const elapsedMin = elapsedMs / 60_000;
    a.energy_watt_min += elapsedMin * a.watts_per_minute;

    a.status       = "OFF";
    a.turned_on_at = null;
    sendCommand("OFF");
    console.log(`[App] ${a.name} turned OFF — session +${elapsedMin.toFixed(2)} min`);
  }

  res.json(serializeAppliance(a));
});

// POST /api/appliances/:id/reset — reset energy counter
app.post("/api/appliances/:id/reset", (req, res) => {
  const a = appliances[req.params.id];
  if (!a) return res.status(404).json({ error: "Appliance not found" });

  a.energy_watt_min = 0;
  a.turned_on_at    = a.status === "ON" ? Date.now() : null; // restart session timer
  res.json(serializeAppliance(a));
});

// Health check
app.get("/health", (_req, res) => res.json({ ok: true, mock: MOCK }));

// ─── AI Advisor ───────────────────────────────────────────────────────────────
const aiRoutes = require('./ai-advisor/routes');
app.use('/api/ai', aiRoutes(appliances.light_bulb));

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════╗
║  Smart Energy Tracker — Backend      ║
║  http://localhost:${PORT}               ║
║  Arduino: ${MOCK ? "MOCK MODE           " : SERIAL_PATH.padEnd(22)} ║
╚══════════════════════════════════════╝
  `);
});