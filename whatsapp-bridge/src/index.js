import express from "express";
import fs from "node:fs/promises";
import path from "node:path";
import makeWASocket, {
  DisconnectReason,
  fetchLatestWaWebVersion,
  makeCacheableSignalKeyStore,
  useMultiFileAuthState,
  USyncQuery,
  USyncUser,
} from "@whiskeysockets/baileys";
import pino from "pino";
import QRCode from "qrcode";

const PORT = Number(process.env.PORT || 3001);
const DATA_DIR = process.env.DATA_DIR || "/data";
const BRIDGE_API_TOKEN = process.env.BRIDGE_API_TOKEN || "";
const logger = pino({ level: process.env.LOG_LEVEL || "info" });
const sessions = new Map();
let waWebVersionPromise;
const LOGGED_OUT_ERROR = "WhatsApp Web session expired. Click Connect to generate a fresh QR code.";

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
  if (!jid || typeof jid !== "string") return null;
  const [user, server] = jid.split("@", 2);
  if (!user || !server || !["s.whatsapp.net", "c.us"].includes(server)) return null;
  const value = user.split(":")[0].replace(/^\+/, "");
  return /^\d{5,20}$/.test(value) ? value : null;
}

function phoneFromValue(value) {
  if (!value || typeof value !== "string") return null;
  if (value.includes("@")) return phoneFromJid(value);
  const normalized = value.split(":")[0].replace(/^\+/, "");
  return /^\d{5,20}$/.test(normalized) ? normalized : null;
}

function rememberLidPhone(session, lid, phone) {
  const phoneNumber = phoneFromValue(phone);
  if (!lid || !phoneNumber) return;
  const normalizedLid = lid.includes("@") ? lid : `${lid}@lid`;
  session.lidToPhone ||= new Map();
  session.lidToPhone.set(normalizedLid, phoneNumber);
  session.lidToPhone.set(normalizedLid.split("@", 1)[0], phoneNumber);
}

function rememberContact(session, contact) {
  if (!contact) return;
  rememberLidPhone(session, contact.lid, contact.jid || contact.id);
  if (contact.id?.endsWith("@lid")) rememberLidPhone(session, contact.id, contact.jid);
}

function rememberContacts(session, contacts) {
  for (const contact of contacts || []) rememberContact(session, contact);
}

function phoneForJid(session, jid) {
  return phoneFromJid(jid) || session.lidToPhone?.get(jid) || session.lidToPhone?.get(jid?.split("@", 1)[0]) || null;
}

function phoneForParty(session, jid, alternates = []) {
  for (const value of [jid, ...alternates]) {
    const phone = phoneForJid(session, value) || phoneFromValue(value);
    if (phone) return phone;
  }
  return null;
}

async function phoneForPartyWithLookup(session, socket, jid, alternates = []) {
  const knownPhone = phoneForParty(session, jid, alternates);
  if (knownPhone) return knownPhone;

  for (const value of [jid, ...alternates]) {
    if (!value || typeof value !== "string" || !value.endsWith("@lid")) continue;
    session.lidLookups ||= new Map();
    const normalizedLid = value.split(":", 1)[0] + "@lid";
    let lookup = session.lidLookups.get(normalizedLid);
    if (!lookup) {
      lookup = (async () => {
        try {
          // WhatsApp's USync LID protocol can return the phone JID paired
          // with an anonymous conversation identifier. This is needed for
          // outbound events, where the message key often contains only the
          // recipient's @lid and no sender_pn/participant_pn field.
          const query = new USyncQuery()
            .withContext("message")
            .withContactProtocol()
            .withLIDProtocol()
            .withUser(new USyncUser().withId(normalizedLid));
          const result = await socket.executeUSyncQuery(query);
          const match = result?.list?.find((item) => item.id === normalizedLid || item.lid === normalizedLid) || result?.list?.[0];
          const phone = phoneFromValue(match?.id) || phoneFromValue(match?.jid);
          if (phone) rememberLidPhone(session, normalizedLid, phone);
          return phone;
        } catch (error) {
          logger.debug({ err: error, lid: normalizedLid, sessionKey: session.config.session_key }, "Could not resolve WhatsApp LID");
          return null;
        } finally {
          session.lidLookups.delete(normalizedLid);
        }
      })();
      session.lidLookups.set(normalizedLid, lookup);
    }
    const phone = await lookup;
    if (phone) return phone;
  }
  return null;
}

function rememberMessageAddresses(session, message) {
  const key = message.key || {};
  rememberLidPhone(session, key.senderLid, key.senderPn);
  rememberLidPhone(session, key.participantLid, key.participantPn);
  if (key.remoteJid === key.senderLid) rememberLidPhone(session, key.remoteJid, key.senderPn);
  if (key.remoteJid === key.participantLid) rememberLidPhone(session, key.remoteJid, key.participantPn);
  if (key.participant === key.participantLid) rememberLidPhone(session, key.participant, key.participantPn);
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

async function groupSubject(session, socket, remoteJid) {
  if (!remoteJid.endsWith("@g.us")) return null;
  session.groupNames ||= new Map();
  if (session.groupNames.has(remoteJid)) return session.groupNames.get(remoteJid);
  try {
    const metadata = await socket.groupMetadata(remoteJid);
    const subject = metadata?.subject || null;
    session.groupNames.set(remoteJid, subject);
    return subject;
  } catch (error) {
    logger.debug({ err: error, remoteJid, sessionKey: session.config.session_key }, "Could not load WhatsApp group metadata");
    return null;
  }
}

async function postMessageEvent(session, socket, message) {
  const key = message.key || {};
  const remoteJid = key.remoteJid;
  const body = messageText(message.message);
  if (!remoteJid || remoteJid.endsWith("@status") || !message.message || !body) return;

  rememberMessageAddresses(session, message);
  const fromMe = Boolean(key.fromMe);
  const chatType = remoteJid.endsWith("@g.us") ? "group" : "direct";
  const groupName = await groupSubject(session, socket, remoteJid);
  const ownJid = socket.user?.id || null;
  const participantJid = key.participant || null;
  const senderJid = fromMe ? ownJid : chatType === "group" ? participantJid || remoteJid : remoteJid;
  const recipientJid = chatType === "group" ? remoteJid : fromMe ? remoteJid : ownJid;
  const senderPhone = fromMe
    ? await phoneForPartyWithLookup(session, socket, senderJid, [socket.user?.jid])
    : await phoneForPartyWithLookup(session, socket, senderJid, [key.senderLid, key.senderPn, key.participantLid, key.participantPn]);
  const recipientPhone = chatType === "group"
    ? null
    : fromMe
      ? await phoneForPartyWithLookup(session, socket, recipientJid, [key.participantLid, key.participantPn, ...(key.senderLid === recipientJid ? [key.senderLid, key.senderPn] : [])])
      : await phoneForPartyWithLookup(session, socket, recipientJid, [socket.user?.lid, socket.user?.jid]);
  const contactPhone = chatType === "group" ? null : fromMe ? recipientPhone : senderPhone;
  const timestamp = Number(message.messageTimestamp || Math.floor(Date.now() / 1000));

  await postWebhook(session, {
    event: "message",
    phone_number: phoneForParty(session, ownJid, [socket.user?.jid]),
    message: {
      external_message_id: key.id || null,
      // Do not persist a group/LID identifier as if it were a phone number.
      // The backend keeps the real conversation identifier in chat_id.
      contact_phone: contactPhone || (chatType === "group" ? "Group chat" : "Unknown contact"),
      contact_name: chatType === "group" ? groupName : fromMe ? null : message.pushName || null,
      chat_id: remoteJid,
      chat_type: chatType,
      chat_name: groupName,
      sender_phone: senderPhone,
      sender_name: fromMe ? "You" : message.pushName || null,
      recipient_phone: recipientPhone,
      recipient_name: chatType === "group" ? groupName : null,
      direction: fromMe ? "outbound" : "inbound",
      message_type: messageType(message.message),
      body,
      sent_at: new Date(timestamp * 1000).toISOString(),
      metadata: {
        remote_jid: remoteJid,
        participant_jid: participantJid,
        sender_lid: key.senderLid || null,
        sender_pn: key.senderPn || null,
        participant_lid: key.participantLid || null,
        participant_pn: key.participantPn || null,
        sender_jid: senderJid,
        recipient_jid: recipientJid,
        from_me: fromMe,
        chat_type: chatType,
        group_name: groupName,
      },
    },
  });
}

async function writeSessionConfig(session) {
  const dir = sessionDir(session.config.session_key);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, "config.json"), JSON.stringify(session.config), { mode: 0o600 });
}

async function resetSessionAuth(session) {
  // WhatsApp's logout invalidates the saved multi-file credentials. Remove
  // only the bridge auth state; CRM messages live in Postgres and are kept.
  await fs.rm(sessionDir(session.config.session_key), { recursive: true, force: true });
  await writeSessionConfig(session);
  session.qr = null;
  session.groupNames = new Map();
  session.lidToPhone = new Map();
  session.lidLookups = new Map();
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
  const phoneNumber = phoneForParty(session, session.socket?.user?.id, [session.socket?.user?.jid]);
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
  rememberContact(session, socket.user);
  socket.ev.on("creds.update", (update) => {
    rememberContact(session, update.me);
    void saveCreds(update);
  });
  socket.ev.on("chats.phoneNumberShare", ({ lid, jid }) => rememberLidPhone(session, lid, jid));
  socket.ev.on("contacts.upsert", (contacts) => rememberContacts(session, contacts));
  socket.ev.on("contacts.update", (contacts) => rememberContacts(session, contacts));
  socket.ev.on("messaging-history.set", ({ contacts }) => rememberContacts(session, contacts));
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

    // A reset can intentionally detach an old socket before replacing its
    // auth state. Ignore close events from sockets that are no longer active.
    if (session.socket !== socket) return;

    session.socket = null;
    const statusCode = lastDisconnect?.error?.output?.statusCode;
    const loggedOut = statusCode === DisconnectReason.loggedOut || statusCode === DisconnectReason.forbidden;
    if (session.closing || loggedOut) {
      void postStatus(session, loggedOut ? "error" : "disconnected", {
        error: loggedOut ? LOGGED_OUT_ERROR : null,
      });
      return;
    }
    void postStatus(session, "connecting", { error: "WhatsApp Web connection interrupted; reconnecting." });
    scheduleReconnect(session);
  });
  socket.ev.on("messages.upsert", ({ messages, type }) => {
    if (type !== "notify") return;
    for (const message of messages) {
      void postMessageEvent(session, socket, message);
    }
  });
}

async function startSession(config, { resetAuth = false } = {}) {
  if (!config?.session_key || !config.webhook_url || !config.webhook_token) {
    throw new Error("session_key, webhook_url, and webhook_token are required");
  }
  const existing = sessions.get(config.session_key);
  if (existing) {
    existing.config = config;
    existing.closing = false;
    if (resetAuth) {
      if (existing.reconnectTimer) {
        clearTimeout(existing.reconnectTimer);
        existing.reconnectTimer = null;
      }
      const oldSocket = existing.socket;
      existing.socket = null;
      try {
        oldSocket?.end(undefined);
      } catch (error) {
        logger.debug({ err: error }, "WhatsApp socket already closed while resetting auth");
      }
      await resetSessionAuth(existing);
    }
    await writeSessionConfig(existing);
    if (!existing.socket) await openSocket(existing);
    return existing;
  }
  const session = {
    config,
    socket: null,
    qr: null,
    reconnectTimer: null,
    closing: false,
    groupNames: new Map(),
    lidToPhone: new Map(),
    lidLookups: new Map(),
  };
  sessions.set(config.session_key, session);
  if (resetAuth) await resetSessionAuth(session);
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
    const { reset_auth: resetAuth, ...config } = request.body || {};
    const session = await startSession(config, { resetAuth: Boolean(resetAuth) });
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
