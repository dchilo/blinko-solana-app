// import Fastify from "fastify";
// import cors from "@fastify/cors";
// import jwt from "jsonwebtoken";
// import nacl from "tweetnacl";
// import bs58 from "bs58";
// import { PublicKey } from "@solana/web3.js";
// import { z } from "zod";
// import { createClient } from "@supabase/supabase-js";

// // ─── Configuración Inicial ───────────────────────────────────────────────────
// const app = Fastify({ logger: true });

// const PORT = Number(process.env.PORT ?? 4000);
// const JWT_SECRET = process.env.JWT_SECRET ;

// // ⚠️ IMPORTANTE: En producción (Netlify) pondrás estas variables en su panel
// const SUPABASE_URL = process.env.SUPABASE_URL ;
// // Usa la SERVICE_ROLE_KEY (la secreta), NO la public (anon) key para el backend
// const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY ; 

// const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// // ─── Schemas ─────────────────────────────────────────────────────────────────
// const nonceRequestSchema = z.object({ walletAddress: z.string().min(32) });
// const verifyRequestSchema = z.object({ walletAddress: z.string().min(32), message: z.string().min(1), signature: z.string().min(1) });
// const createOfferSchema = z.object({
//   pda: z.string().min(32),
//   offerId: z.number().int().nonnegative(),
//   amountSol: z.number().positive(),
//   title: z.string().min(1).max(80),
//   description: z.string().min(1).max(400),
//   category: z.enum(["food", "retail", "services", "entertainment", "other"]),
//   expiryTs: z.number().int().positive(),
//   platformFeeBps: z.number().int().min(0).max(10000).default(500),
// });
// const redeemSchema = z.object({
//   pda: z.string().min(32),
//   offerId: z.number().int().nonnegative(),
//   amountSol: z.number().positive(),
//   offerTitle: z.string().min(1),
//   customerWallet: z.string().min(32),
// });

// // ─── Helpers ─────────────────────────────────────────────────────────────────
// function decodeSignature(signature: string): Uint8Array {
//   try { return bs58.decode(signature); } catch { return Uint8Array.from(Buffer.from(signature, "base64")); }
// }
// function makeNonce(): string { return Math.random().toString(36).slice(2, 12); }
// function buildLoginMessage(walletAddress: string, nonce: string): string {
//   return ["Sign in to Local Escrow MVP", `Wallet: ${walletAddress}`, `Nonce: ${nonce}`, `IssuedAt: ${new Date().toISOString()}`].join("\n");
// }
// function getWalletFromToken(authHeader: string | undefined): string | null {
//   if (!authHeader?.startsWith("Bearer ")) return null;
//   try {
//     const token = authHeader.slice("Bearer ".length).trim();
//     const payload = jwt.verify(token, JWT_SECRET) as { walletAddress?: string; sub?: string };
//     return payload.walletAddress ?? payload.sub ?? null;
//   } catch { return null; }
// }

// // Transformadores de DB (snake_case) a Frontend (camelCase)
// const mapOffer = (row: any) => ({
//   pda: row.pda,
//   merchantWallet: row.merchant_wallet,
//   offerId: Number(row.offer_id),
//   amountSol: Number(row.amount_sol),
//   title: row.title,
//   description: row.description,
//   category: row.category,
//   expiryTs: Number(row.expiry_ts),
//   platformFeeBps: Number(row.platform_fee_bps),
//   createdAt: Number(row.created_at)
// });

// const mapTransaction = (row: any) => ({
//   id: row.id,
//   merchantWallet: row.merchant_wallet,
//   customerWallet: row.customer_wallet,
//   offerId: Number(row.offer_id),
//   offerTitle: row.offer_title,
//   amountSol: Number(row.amount_sol),
//   merchantEarningSol: Number(row.merchant_earning_sol),
//   platformFeeSol: Number(row.platform_fee_sol),
//   timestamp: Number(row.timestamp),
//   status: row.status
// });

// // ─── Rutas ───────────────────────────────────────────────────────────────────
// app.register(cors, { origin: true, credentials: true });
// app.get("/health", async () => ({ ok: true }));

// // -- Auth --
// app.post("/auth/nonce", async (request, reply) => {
//   const parsed = nonceRequestSchema.safeParse(request.body);
//   if (!parsed.success) return reply.code(400).send({ error: "Invalid payload" });
  
//   const { walletAddress } = parsed.data;
//   try { new PublicKey(walletAddress); } catch { return reply.code(400).send({ error: "Invalid wallet address" }); }

//   const nonce = makeNonce();
//   const expiresAt = Date.now() + 5 * 60 * 1000;
  
//   await supabase.from('nonces').upsert({
//     wallet_address: walletAddress, nonce, expires_at: expiresAt, used: false
//   });

//   return reply.send({ walletAddress, nonce, message: buildLoginMessage(walletAddress, nonce), expiresAt });
// });

// app.post("/auth/verify", async (request, reply) => {
//   const parsed = verifyRequestSchema.safeParse(request.body);
//   if (!parsed.success) return reply.code(400).send({ error: "Invalid payload" });

//   const { walletAddress, message, signature } = parsed.data;
//   const { data: nonceData } = await supabase.from('nonces').select('*').eq('wallet_address', walletAddress).single();

//   if (!nonceData) return reply.code(400).send({ error: "Nonce not found" });
//   if (nonceData.used) return reply.code(400).send({ error: "Nonce already used" });
//   if (Date.now() > Number(nonceData.expires_at)) return reply.code(400).send({ error: "Nonce expired" });
//   if (!message.includes(`Nonce: ${nonceData.nonce}`)) return reply.code(400).send({ error: "Nonce mismatch" });

//   try {
//     const valid = nacl.sign.detached.verify(new TextEncoder().encode(message), decodeSignature(signature), new PublicKey(walletAddress).toBytes());
//     if (!valid) return reply.code(401).send({ error: "Invalid signature" });

//     await supabase.from('nonces').update({ used: true }).eq('wallet_address', walletAddress);
//     const token = jwt.sign({ sub: walletAddress, walletAddress }, JWT_SECRET, { expiresIn: "7d" });
//     return reply.send({ token, walletAddress });
//   } catch (error) {
//     return reply.code(500).send({ error: "Failed to verify signature" });
//   }
// });

// app.get("/auth/me", async (request, reply) => {
//   const wallet = getWalletFromToken(request.headers.authorization);
//   if (!wallet) return reply.code(401).send({ error: "Invalid token" });
//   return reply.send({ walletAddress: wallet });
// });

// // -- Offers --
// app.get("/offers", async (_request, reply) => {
//   const { data } = await supabase.from('offers').select('*').order('created_at', { ascending: false });
//   return reply.send((data || []).map(mapOffer));
// });

// app.get("/offers/:pda", async (request, reply) => {
//   const { pda } = request.params as { pda: string };
//   const { data, error } = await supabase.from('offers').select('*').eq('pda', pda).single();
//   if (error || !data) return reply.code(404).send({ error: "Offer not found" });
//   return reply.send(mapOffer(data));
// });

// app.post("/offers", async (request, reply) => {
//   const wallet = getWalletFromToken(request.headers.authorization);
//   if (!wallet) return reply.code(401).send({ error: "Unauthorized" });

//   const parsed = createOfferSchema.safeParse(request.body);
//   if (!parsed.success) return reply.code(400).send({ error: "Invalid payload" });

//   const d = parsed.data;
//   const { data, error } = await supabase.from('offers').insert({
//     pda: d.pda, merchant_wallet: wallet, offer_id: d.offerId, amount_sol: d.amountSol,
//     title: d.title, description: d.description, category: d.category,
//     expiry_ts: d.expiryTs, platform_fee_bps: d.platformFeeBps, created_at: Date.now()
//   }).select().single();

//   if (error) return reply.code(409).send({ error: "Error creating offer or PDA already exists" });
//   return reply.code(201).send(mapOffer(data));
// });

// app.delete("/offers/:pda", async (request, reply) => {
//   const wallet = getWalletFromToken(request.headers.authorization);
//   if (!wallet) return reply.code(401).send({ error: "Unauthorized" });

//   const { pda } = request.params as { pda: string };
//   const { data: offer } = await supabase.from('offers').select('merchant_wallet').eq('pda', pda).single();
  
//   if (!offer) return reply.code(404).send({ error: "Offer not found" });
//   if (offer.merchant_wallet !== wallet) return reply.code(403).send({ error: "Forbidden" });

//   await supabase.from('offers').delete().eq('pda', pda);
//   return reply.send({ ok: true });
// });

// // -- Redeem --
// app.post("/redeem", async (request, reply) => {
//   const wallet = getWalletFromToken(request.headers.authorization);
//   if (!wallet) return reply.code(401).send({ error: "Unauthorized" });

//   const parsed = redeemSchema.safeParse(request.body);
//   if (!parsed.success) return reply.code(400).send({ error: "Invalid payload" });

//   const d = parsed.data;
//   const platformFeeSol = d.amountSol * (500 / 10000);
//   const transactionId = `tx_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

//   const { data, error } = await supabase.from('transactions').insert({
//     id: transactionId, merchant_wallet: wallet, customer_wallet: d.customerWallet,
//     offer_id: d.offerId, offer_title: d.offerTitle, amount_sol: d.amountSol,
//     merchant_earning_sol: (d.amountSol - platformFeeSol), platform_fee_sol: platformFeeSol,
//     timestamp: Date.now(), status: "completed"
//   }).select().single();

//   if (error) return reply.code(500).send({ error: "Failed to record transaction" });
//   return reply.code(201).send(mapTransaction(data));
// });

// // -- Dashboard --
// app.get("/merchant/transactions", async (request, reply) => {
//   const wallet = getWalletFromToken(request.headers.authorization);
//   if (!wallet) return reply.code(401).send({ error: "Unauthorized" });

//   const { data } = await supabase.from('transactions').select('*').eq('merchant_wallet', wallet).order('timestamp', { ascending: false });
//   return reply.send((data || []).map(mapTransaction));
// });

// app.get("/merchant/stats", async (request, reply) => {
//   const wallet = getWalletFromToken(request.headers.authorization);
//   if (!wallet) return reply.code(401).send({ error: "Unauthorized" });

//   const { data: txs } = await supabase.from('transactions').select('*').eq('merchant_wallet', wallet);
//   const merchantTxs = (txs || []).map(mapTransaction);

//   const today = new Date();
//   today.setHours(0, 0, 0, 0);
  
//   const todayTxs = merchantTxs.filter((tx) => new Date(tx.timestamp) >= today);
//   const totalIncomeSol = merchantTxs.reduce((sum, tx) => sum + tx.merchantEarningSol, 0);
//   const totalPlatformFee = merchantTxs.reduce((sum, tx) => sum + tx.platformFeeSol, 0);

//   // Generar datos semanales
//   const days = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
//   const weeklyEarnings = [];
//   for (let i = 6; i >= 0; i--) {
//     const date = new Date();
//     date.setDate(date.getDate() - i);
//     date.setHours(0, 0, 0, 0);
//     const nextDate = new Date(date);
//     nextDate.setDate(nextDate.getDate() + 1);
    
//     const dayTxs = merchantTxs.filter((tx) => new Date(tx.timestamp) >= date && new Date(tx.timestamp) < nextDate);
//     weeklyEarnings.push({
//       day: i === 0 ? "Hoy" : days[date.getDay()],
//       earnings: dayTxs.reduce((sum, tx) => sum + tx.merchantEarningSol, 0)
//     });
//   }

//   return reply.send({
//     totalIncomeSol, totalCouponsRedeemed: merchantTxs.length, couponsRedeemedToday: todayTxs.length,
//     totalPlatformFee, weeklyEarnings
//   });
// });

// // ─── Start ────────────────────────────────────────────────────────────────────
// app.listen({ port: PORT, host: "0.0.0.0" }).catch((error) => {
//   app.log.error(error);
//   process.exit(1);
// });