import express from "express";
import fs from "node:fs/promises";
import path from "node:path";
import makeWASocket, {
  DisconnectReason,
  fetchLatestWaWebVersion,
  makeCacheableSignalKeyStore,
  useMultiFileAuthState,
} from "@whiskeysockets/baileys";
import pino from "pino";
import QRCode from "qrcode";

const PORT = Number(process.env.PORT || 3001);
const DATA_DIR = process.env.DATA_DIR || "/data";
const BRIDGE_API_TOKEN = process.env.BRIDGE_API_TOKEN || "";
const logger = pino({ level: process.env.LOG_LEVEL || "info" });
const sessions = new Map();
let waWebVersionPromise;

async function getWaWebVersion() {
  if (!waWebVersionPromise) {
    waWebVersionPromise = fetchLatestWaWebVersion({ timeout: 10000 })
      .then((result) => {
        if (!result.isLatest) {
          logger.warn({ err: result.error, version: result.version }, "Could not fetch the latest WhatsApp Web version; using the bundled version");
        } else {
          logger.info({ version: result.version }, "Using the latest WhatsApp Web version");
        }
        return result.version;
      })
      .catch((error) => {
        logger.warn({ err: error }, "Could not fetch the latest WhatsApp Web version; using the bundled version");
        return undefined;
      });
  }
  return waWebVersionPromise;
}

function safeSessionName(sessionKey) {
  return sessionKey.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 100);
}

function sessionDir(sessionKey) {
  return path.join(DATA_DIR, safeSessionName(sessionKey));
}

function phoneFromJid(jid) {
  if (!jid) return null;
  const value = jid.split("@")[0].split(":")[0];
  return value || null;
}

function messageText(message) {
  return (
    message?.conversation ||
    message?.extendedTextMessage?.text ||
    message?.imageMessage?.caption ||
    message?.videoMessage?.caption ||
    message?.documentMessage?.caption ||
    ""
  );
}

function messageType(message) {
  if (!message) return "unknown";
  return Object.keys(message).find((key) => !key.endsWith("MessageContextInfo")) || "unknown";
}

async function writeSessionConfig(session) {
  const dir = sessionDir(session.config.session_key);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, "config.json"), JSON.stringify(session.config), { mode: 0o600 });
}

async function postWebhook(session, event) {
  try {
    const response = await fetch(session.config.webhook_url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "X-WhatsApp-Token": session.config.webhook_token,
      },
      body: JSON.stringify(event),
    });
    if (!response.ok) {
      logger.warn({ status: response.status, sessionKey: session.config.session_key }, "CRM webhook rejected event");
    }
  } catch (error) {
    logger.warn({ err: error, sessionKey: session.config.session_key }, "CRM webhook request failed");
  }
}

async function postStatus(session, status, extra = {}) {
  const phoneNumber = phoneFromJid(session.socket?.user?.id);
  await postWebhook(session, {
    event: "status",
    status,
    phone_number: phoneNumber,
    ...extra,
  });
}

function scheduleReconnect(session) {
  if (session.reconnectTimer || session.closing) return;
  session.reconnectTimer = setTimeout(() => {
    session.reconnectTimer = null;
    void openSocket(session);
  }, 3000);
}

async function openSocket(session) {
  if (session.closing) return;
  const { state, saveCreds } = await useMultiFileAuthState(sessionDir(session.config.session_key));
  const version = await getWaWebVersion();
  const socket = makeWASocket({
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, logger),
    },
    ...(version ? { version } : {}),
    browser: ["TalkoCRM", "Chrome", "1.0"],
    markOnlineOnConnect: false,
    syncFullHistory: false,
    logger: logger.child({ sessionKey: session.config.session_key }),
  });
  session.socket = socket;
  socket.ev.on("creds.update", saveCreds);
  socket.ev.on("connection.update", ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      void QRCode.toDataURL(qr, { width: 320, margin: 1 })
        .then((qrCode) => postStatus(session, "connecting", { qr_code: qrCode }))
        .catch((error) => logger.warn({ err: error }, "Could not render WhatsApp QR code"));
    }
    if (connection === "open") {
      session.qr = null;
      void postStatus(session, "connected");
      return;
    }
    if (connection !== "close") return;

    session.socket = null;
    const statusCode = lastDisconnect?.error?.output?.statusCode;
    const loggedOut = statusCode === DisconnectReason.loggedOut || statusCode === DisconnectReason.forbidden;
    if (session.closing || loggedOut) {
      void postStatus(session, loggedOut ? "error" : "disconnected", {
        error: loggedOut ? "WhatsApp Web logged out this session; connect again to show a new QR code." : null,
      });
      return;
    }
    void postStatus(session, "connecting", { error: "WhatsApp Web connection interrupted; reconnecting." });
    scheduleReconnect(session);
  });
  socket.ev.on("messages.upsert", ({ messages, type }) => {
    if (type !== "notify") return;
    for (const message of messages) {
      const remoteJid = message.key?.remoteJid;
      const body = messageText(message.message);
      if (!remoteJid || remoteJid.endsWith("@status") || !message.message || !body) continue;
      const timestamp = Number(message.messageTimestamp || Math.floor(Date.now() / 1000));
      void postWebhook(session, {
        event: "message",
        phone_number: phoneFromJid(session.socket?.user?.id),
        message: {
          external_message_id: message.key.id || null,
          contact_phone: phoneFromJid(remoteJid) || remoteJid,
          contact_name: message.pushName || null,
          direction: message.key.fromMe ? "outbound" : "inbound",
          message_type: messageType(message.message),
          body,
          sent_at: new Date(timestamp * 1000).toISOString(),
          metadata: {
            remote_jid: remoteJid,
            from_me: Boolean(message.key.fromMe),
          },
        },
      });
    }
  });
}

async function startSession(config) {
  if (!config?.session_key || !config.webhook_url || !config.webhook_token) {
    throw new Error("session_key, webhook_url, and webhook_token are required");
  }
  const existing = sessions.get(config.session_key);
  if (existing) {
    existing.config = config;
    await writeSessionConfig(existing);
    if (!existing.socket) await openSocket(existing);
    return existing;
  }
  const session = { config, socket: null, qr: null, reconnectTimer: null, closing: false };
  sessions.set(config.session_key, session);
  await writeSessionConfig(session);
  await openSocket(session);
  return session;
}

async function stopSession(sessionKey, removeAuth = false) {
  const session = sessions.get(sessionKey);
  if (!session) return;
  session.closing = true;
  if (session.reconnectTimer) clearTimeout(session.reconnectTimer);
  try {
    session.socket?.end(undefined);
  } catch (error) {
    logger.debug({ err: error }, "WhatsApp socket already closed");
  }
  sessions.delete(sessionKey);
  if (removeAuth) await fs.rm(sessionDir(sessionKey), { recursive: true, force: true });
}

function requireBridgeAuth(request, response, next) {
  if (!BRIDGE_API_TOKEN || request.headers.authorization !== `Bearer ${BRIDGE_API_TOKEN}`) {
    response.status(401).json({ detail: "Bridge authentication required" });
    return;
  }
  next();
}

const app = express();
app.use(express.json({ limit: "1mb" }));
app.get("/health", (_request, response) => response.json({ status: "ok", sessions: sessions.size }));
app.use(requireBridgeAuth);
app.post("/sessions", async (request, response) => {
  try {
    const session = await startSession(request.body);
    response.status(202).json({ session_key: session.config.session_key, status: "connecting" });
  } catch (error) {
    logger.error({ err: error }, "Could not start WhatsApp Web session");
    response.status(400).json({ detail: error instanceof Error ? error.message : "Could not start session" });
  }
});
app.delete("/sessions/:sessionKey", async (request, response) => {
  await stopSession(request.params.sessionKey);
  response.status(204).end();
});

await fs.mkdir(DATA_DIR, { recursive: true });
for (const entry of await fs.readdir(DATA_DIR, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  try {
    const config = JSON.parse(await fs.readFile(path.join(DATA_DIR, entry.name, "config.json"), "utf8"));
    await startSession(config);
  } catch (error) {
    logger.warn({ err: error, directory: entry.name }, "Could not restore WhatsApp Web session");
  }
}

app.listen(PORT, "0.0.0.0", () => logger.info({ port: PORT, sessions: sessions.size }, "WhatsApp bridge listening"));
