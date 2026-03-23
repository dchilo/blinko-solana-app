import Fastify from "fastify";
import cors from "@fastify/cors";
import jwt from "jsonwebtoken";
import nacl from "tweetnacl";
import bs58 from "bs58";
import { PublicKey } from "@solana/web3.js";
import { z } from "zod";

const app = Fastify({ logger: true });

const PORT = Number(process.env.PORT ?? 4000);
const JWT_SECRET = process.env.JWT_SECRET ?? "dev-secret-change-me";

// ─── Auth state ──────────────────────────────────────────────────────────────

const nonces = new Map<string, { nonce: string; expiresAt: number; used: boolean }>();

// ─── Offer store (in-memory, replace with DB later) ──────────────────────────

export type OfferCategory = "food" | "retail" | "services" | "entertainment" | "other";

export type OfferRecord = {
  pda: string;
  merchantWallet: string;
  offerId: number;
  amountSol: number;
  title: string;
  description: string;
  category: OfferCategory;
  expiryTs: number;
  platformFeeBps: number;
  createdAt: number;
};

export type TransactionRecord = {
  id: string;
  merchantWallet: string;
  customerWallet: string;
  offerId: number;
  offerTitle: string;
  amountSol: number;
  merchantEarningSol: number;
  platformFeeSol: number;
  timestamp: number;
  status: "completed" | "pending" | "failed";
};

const offers = new Map<string, OfferRecord>(); // key = pda
const transactions = new Map<string, TransactionRecord>(); // key = transaction id

// ─── Schemas ─────────────────────────────────────────────────────────────────

const nonceRequestSchema = z.object({
  walletAddress: z.string().min(32),
});

const verifyRequestSchema = z.object({
  walletAddress: z.string().min(32),
  message: z.string().min(1),
  signature: z.string().min(1),
});

const createOfferSchema = z.object({
  pda: z.string().min(32),
  offerId: z.number().int().nonnegative(),
  amountSol: z.number().positive(),
  title: z.string().min(1).max(80),
  description: z.string().min(1).max(400),
  category: z.enum(["food", "retail", "services", "entertainment", "other"]),
  expiryTs: z.number().int().positive(),
  platformFeeBps: z.number().int().min(0).max(10000).default(500),
});

const redeemSchema = z.object({
  pda: z.string().min(32),
  offerId: z.number().int().nonnegative(),
  amountSol: z.number().positive(),
  offerTitle: z.string().min(1),
  customerWallet: z.string().min(32),
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function decodeSignature(signature: string): Uint8Array {
  try {
    return bs58.decode(signature);
  } catch {
    return Uint8Array.from(Buffer.from(signature, "base64"));
  }
}

function makeNonce(): string {
  return Math.random().toString(36).slice(2, 12);
}

function buildLoginMessage(walletAddress: string, nonce: string): string {
  return [
    "Sign in to Local Escrow MVP",
    `Wallet: ${walletAddress}`,
    `Nonce: ${nonce}`,
    `IssuedAt: ${new Date().toISOString()}`,
  ].join("\n");
}

function getWalletFromToken(authHeader: string | undefined): string | null {
  if (!authHeader?.startsWith("Bearer ")) return null;
  try {
    const token = authHeader.slice("Bearer ".length).trim();
    const payload = jwt.verify(token, JWT_SECRET) as { walletAddress?: string; sub?: string };
    return payload.walletAddress ?? payload.sub ?? null;
  } catch {
    return null;
  }
}

// ─── CORS ─────────────────────────────────────────────────────────────────────

app.register(cors, { origin: true, credentials: true });

// ─── Health ───────────────────────────────────────────────────────────────────

app.get("/health", async () => ({ ok: true }));

// ─── Auth routes ──────────────────────────────────────────────────────────────

app.post("/auth/nonce", async (request, reply) => {
  const parsed = nonceRequestSchema.safeParse(request.body);
  if (!parsed.success) return reply.code(400).send({ error: "Invalid payload" });

  const { walletAddress } = parsed.data;
  try { new PublicKey(walletAddress); } catch {
    return reply.code(400).send({ error: "Invalid wallet address" });
  }

  const nonce = makeNonce();
  const expiresAt = Date.now() + 5 * 60 * 1000;
  nonces.set(walletAddress, { nonce, expiresAt, used: false });
  const message = buildLoginMessage(walletAddress, nonce);
  return reply.send({ walletAddress, nonce, message, expiresAt });
});

app.post("/auth/verify", async (request, reply) => {
  const parsed = verifyRequestSchema.safeParse(request.body);
  if (!parsed.success) return reply.code(400).send({ error: "Invalid payload" });

  const { walletAddress, message, signature } = parsed.data;
  const nonceData = nonces.get(walletAddress);

  if (!nonceData) return reply.code(400).send({ error: "Nonce not found" });
  if (nonceData.used) return reply.code(400).send({ error: "Nonce already used" });
  if (Date.now() > nonceData.expiresAt) return reply.code(400).send({ error: "Nonce expired" });
  if (!message.includes(`Nonce: ${nonceData.nonce}`)) return reply.code(400).send({ error: "Nonce mismatch" });

  try {
    const publicKey = new PublicKey(walletAddress);
    const messageBytes = new TextEncoder().encode(message);
    const signatureBytes = decodeSignature(signature);
    const valid = nacl.sign.detached.verify(messageBytes, signatureBytes, publicKey.toBytes());
    if (!valid) return reply.code(401).send({ error: "Invalid signature" });

    nonceData.used = true;
    const token = jwt.sign({ sub: walletAddress, walletAddress }, JWT_SECRET, { expiresIn: "7d" });
    return reply.send({ token, walletAddress });
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ error: "Failed to verify signature" });
  }
});

app.get("/auth/me", async (request, reply) => {
  const wallet = getWalletFromToken(request.headers.authorization);
  if (!wallet) return reply.code(401).send({ error: "Invalid token" });
  return reply.send({ walletAddress: wallet });
});

// ─── Offer routes ─────────────────────────────────────────────────────────────

// List all offers
app.get("/offers", async (_request, reply) => {
  const list = Array.from(offers.values()).sort((a, b) => b.createdAt - a.createdAt);
  return reply.send(list);
});

// Get single offer by PDA
app.get("/offers/:pda", async (request, reply) => {
  const { pda } = request.params as { pda: string };
  const offer = offers.get(pda);
  if (!offer) return reply.code(404).send({ error: "Offer not found" });
  return reply.send(offer);
});

// Create offer metadata (requires JWT)
app.post("/offers", async (request, reply) => {
  const wallet = getWalletFromToken(request.headers.authorization);
  if (!wallet) return reply.code(401).send({ error: "Unauthorized" });

  const parsed = createOfferSchema.safeParse(request.body);
  if (!parsed.success) return reply.code(400).send({ error: "Invalid payload", details: parsed.error.flatten() });

  const data = parsed.data;

  if (offers.has(data.pda)) {
    return reply.code(409).send({ error: "Offer with this PDA already exists" });
  }

  const record: OfferRecord = {
    pda: data.pda,
    merchantWallet: wallet,
    offerId: data.offerId,
    amountSol: data.amountSol,
    title: data.title,
    description: data.description,
    category: data.category,
    expiryTs: data.expiryTs,
    platformFeeBps: data.platformFeeBps,
    createdAt: Date.now(),
  };

  offers.set(data.pda, record);
  return reply.code(201).send(record);
});

// Delete offer (only by merchant who created it)
app.delete("/offers/:pda", async (request, reply) => {
  const wallet = getWalletFromToken(request.headers.authorization);
  if (!wallet) return reply.code(401).send({ error: "Unauthorized" });


// ─── Redeem routes (registrar canjes) ──────────────────────────────────────────

app.post("/redeem", async (request, reply) => {
  const wallet = getWalletFromToken(request.headers.authorization);
  if (!wallet) return reply.code(401).send({ error: "Unauthorized" });

  const parsed = redeemSchema.safeParse(request.body);
  if (!parsed.success) return reply.code(400).send({ error: "Invalid payload", details: parsed.error.flatten() });

  const data = parsed.data;
  const transactionId = `tx_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

  // Calcular comisión (5% por defecto)
  const platformFeeBps = 500; // 5%
  const platformFeeSol = data.amountSol * (platformFeeBps / 10000);
  const merchantEarningSol = data.amountSol - platformFeeSol;

  const transaction: TransactionRecord = {
    id: transactionId,
    merchantWallet: wallet,
    customerWallet: data.customerWallet,
    offerId: data.offerId,
    offerTitle: data.offerTitle,
    amountSol: data.amountSol,
    merchantEarningSol,
    platformFeeSol,
    timestamp: Date.now(),
    status: "completed",
  };

  transactions.set(transactionId, transaction);
  return reply.code(201).send(transaction);
});

// ─── Dashboard routes ──────────────────────────────────────────────────────────

app.get("/merchant/stats", async (request, reply) => {
  const wallet = getWalletFromToken(request.headers.authorization);
  if (!wallet) return reply.code(401).send({ error: "Unauthorized" });

  const merchantTxs = Array.from(transactions.values()).filter((tx) => tx.merchantWallet === wallet);

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayTxs = merchantTxs.filter((tx) => new Date(tx.timestamp) >= today);

  // Calcular totales
  const totalIncomeSol = merchantTxs.reduce((sum, tx) => sum + tx.merchantEarningSol, 0);
  const totalCouponsRedeemed = merchantTxs.length;
  const couponsRedeemedToday = todayTxs.length;
  const totalPlatformFee = merchantTxs.reduce((sum, tx) => sum + tx.platformFeeSol, 0);

  // Generar datos de últimos 7 días
  const weeklyEarnings = generateWeeklyEarnings(merchantTxs);

  return reply.send({
    totalIncomeSol,
    totalCouponsRedeemed,
    couponsRedeemedToday,
    totalPlatformFee,
    weeklyEarnings,
  });
});

app.get("/merchant/transactions", async (request, reply) => {
  const wallet = getWalletFromToken(request.headers.authorization);
  if (!wallet) return reply.code(401).send({ error: "Unauthorized" });

  const merchantTxs = Array.from(transactions.values())
    .filter((tx) => tx.merchantWallet === wallet)
    .sort((a, b) => b.timestamp - a.timestamp);

  return reply.send(merchantTxs);
});

// ─── Helpers para stats ────────────────────────────────────────────────────────

function generateWeeklyEarnings(txs: TransactionRecord[]): Array<{ day: string; earnings: number }> {
  const days = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
  const today = new Date();
  const result = [];

  // Últimos 7 días
  for (let i = 6; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    date.setHours(0, 0, 0, 0);

    const nextDate = new Date(date);
    nextDate.setDate(nextDate.getDate() + 1);

    const dayTxs = txs.filter(
      (tx) => new Date(tx.timestamp) >= date && new Date(tx.timestamp) < nextDate
    );

    const earnings = dayTxs.reduce((sum, tx) => sum + tx.merchantEarningSol, 0);
    const dayName = i === 0 ? "Hoy" : days[date.getDay()];

    result.push({ day: dayName, earnings });
  }

  return result;
}
  const { pda } = request.params as { pda: string };
  const offer = offers.get(pda);
  if (!offer) return reply.code(404).send({ error: "Offer not found" });
  if (offer.merchantWallet !== wallet) return reply.code(403).send({ error: "Forbidden" });

  offers.delete(pda);
  return reply.send({ ok: true });
});

// ─── Start ────────────────────────────────────────────────────────────────────

app.listen({ port: PORT, host: "0.0.0.0" }).catch((error) => {
  app.log.error(error);
  process.exit(1);
});
