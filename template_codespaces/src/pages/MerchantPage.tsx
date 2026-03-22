import { useCallback, useEffect, useState } from "react";
import { useWalletConnection, useSendTransaction } from "@solana/react-hooks";
import {
  getProgramDerivedAddress,
  getAddressEncoder,
  getBytesEncoder,
  getU64Encoder,
  type Address,
} from "@solana/kit";
import {
  getCreateOfferInstructionDataEncoder,
  VAULT_PROGRAM_ADDRESS,
} from "../generated/vault";
import {
  createOfferMetadata,
  deleteOfferMetadata,
  fetchOffers,
  CATEGORY_LABELS,
  CATEGORY_EMOJI,
  type OfferRecord,
  type OfferCategory,
} from "../lib/backend";
import { getStoredToken, signInWithWallet } from "../lib/auth";

const LAMPORTS_PER_SOL = 1_000_000_000n;
const SYSTEM_PROGRAM_ADDRESS = "11111111111111111111111111111111" as Address;
const PLATFORM_WALLET = "CqKRP8jMd8FURtaGC65zzapurQ2dxgBskCZYN5fvWe1w" as Address;

function useAuthToken(
  walletAddress: string | undefined,
  signMessage: ((m: Uint8Array) => Promise<Uint8Array>) | undefined,
) {
  const [token, setToken] = useState<string | null>(getStoredToken);
  const [loading, setLoading] = useState(false);

  const ensureToken = useCallback(async () => {
    if (token) return token;
    if (!walletAddress || !signMessage) throw new Error("Wallet no conectada");
    setLoading(true);
    try {
      const t = await signInWithWallet(walletAddress, signMessage);
      setToken(t);
      return t;
    } finally {
      setLoading(false);
    }
  }, [token, walletAddress, signMessage]);

  return { ensureToken, authLoading: loading };
}

export function MerchantPage() {
  const { wallet, status } = useWalletConnection();
  const { send, isSending } = useSendTransaction();

  const walletAddress = wallet?.account.address.toString();
  const { ensureToken, authLoading } = useAuthToken(walletAddress, wallet?.signMessage);

  // Form state
  const [title, setTitle]           = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory]     = useState<OfferCategory>("food");
  const [amountSol, setAmountSol]   = useState("0.1");
  const [offerId, setOfferId]       = useState(String(Date.now()).slice(-6));
  const [expiryDays, setExpiryDays] = useState("7");

  // UI state
  const [myOffers, setMyOffers]         = useState<OfferRecord[]>([]);
  const [loadingOffers, setLoadingOffers] = useState(true);
  const [txStatus, setTxStatus]         = useState<string | null>(null);
  const [isCreating, setIsCreating]     = useState(false);
  const [offerPda, setOfferPda]         = useState<Address | null>(null);

  // Derive PDA
  useEffect(() => {
    async function derive() {
      if (!walletAddress || !offerId) { setOfferPda(null); return; }
      try {
        const [pda] = await getProgramDerivedAddress({
          programAddress: VAULT_PROGRAM_ADDRESS,
          seeds: [
            getBytesEncoder().encode(new Uint8Array([111, 102, 102, 101, 114])),
            getAddressEncoder().encode(walletAddress as Address),
            getU64Encoder().encode(BigInt(offerId)),
          ],
        });
        setOfferPda(pda);
      } catch { setOfferPda(null); }
    }
    derive();
  }, [walletAddress, offerId]);

  // Load my offers
  useEffect(() => {
    if (!walletAddress) return;
    fetchOffers()
      .then((all) => setMyOffers(all.filter((o) => o.merchantWallet === walletAddress)))
      .catch(() => {})
      .finally(() => setLoadingOffers(false));
  }, [walletAddress, txStatus]);

  const handleCreate = useCallback(async () => {
    if (!walletAddress || !offerPda) return;
    setIsCreating(true);
    setTxStatus(null);
    try {
      setTxStatus("Autenticando wallet...");
      const t = await ensureToken();

      setTxStatus("Creando oferta on-chain...");
      const amountLamports = BigInt(Math.floor(Number(amountSol) * Number(LAMPORTS_PER_SOL)));
      const expiryTs = BigInt(Math.floor(Date.now() / 1000) + Number(expiryDays) * 86400);

      const instruction = {
        programAddress: VAULT_PROGRAM_ADDRESS,
        accounts: [
          { address: walletAddress as Address, role: 3 },
          { address: offerPda, role: 1 },
          { address: PLATFORM_WALLET, role: 0 },
          { address: SYSTEM_PROGRAM_ADDRESS, role: 0 },
        ],
        data: getCreateOfferInstructionDataEncoder().encode({
          offerId: BigInt(offerId),
          amount: amountLamports,
          expiryTs,
          platformFeeBps: 500,
        }),
      };

      const sig = await send({ instructions: [instruction] });
      setTxStatus(`Transacción confirmada: ${sig?.slice(0, 16)}...`);

      setTxStatus("Guardando metadata...");
      await createOfferMetadata(t, {
        pda: offerPda,
        offerId: Number(offerId),
        amountSol: Number(amountSol),
        title,
        description,
        category,
        expiryTs: Number(expiryTs),
        platformFeeBps: 500,
      });

      setTxStatus("¡Oferta publicada exitosamente!");
      setTitle(""); setDescription(""); setAmountSol("0.1");
      setOfferId(String(Date.now()).slice(-6)); setExpiryDays("7");
    } catch (err) {
      setTxStatus(`Error: ${err instanceof Error ? err.message : "Error desconocido"}`);
    } finally {
      setIsCreating(false);
    }
  }, [walletAddress, offerPda, ensureToken, amountSol, expiryDays, offerId, title, description, category, send]);

  const handleDelete = useCallback(async (pda: string) => {
    try {
      const t = await ensureToken();
      await deleteOfferMetadata(t, pda);
      setMyOffers((prev) => prev.filter((o) => o.pda !== pda));
    } catch (err) {
      alert(`Error eliminando: ${err instanceof Error ? err.message : "Error"}`);
    }
  }, [ensureToken]);

  if (status !== "connected") {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center gap-4 px-6 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary-soft text-3xl">🔐</div>
        <div>
          <p className="font-bold text-foreground">Conectá tu wallet</p>
          <p className="mt-1 text-sm text-muted">Necesitás Phantom o Backpack en Devnet.</p>
        </div>
      </div>
    );
  }

  const inputClass = "w-full rounded-2xl border border-border-low bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted outline-none focus:border-primary/40 transition";

  return (
    <div className="mx-auto max-w-2xl space-y-5 px-4 py-6">

      <div>
        <h1 className="text-2xl font-black text-foreground">Panel del Comercio</h1>
        <p className="mt-1 text-sm text-muted">Creá ofertas con escrow on-chain.</p>
      </div>

      {/* ── Formulario ── */}
      <section className="space-y-3 rounded-3xl border border-border-low bg-card p-5 shadow-sm">
        <h2 className="font-bold text-foreground">Nueva oferta</h2>

        <input
          className={inputClass}
          placeholder="Título (ej: 30% en café y medialunas)"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />

        <textarea
          className={`${inputClass} resize-none`}
          placeholder="Descripción, condiciones, dirección del local..."
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />

        <div className="grid grid-cols-2 gap-3">
          <select
            className={inputClass}
            value={category}
            onChange={(e) => setCategory(e.target.value as OfferCategory)}
          >
            {(Object.keys(CATEGORY_LABELS) as OfferCategory[]).map((k) => (
              <option key={k} value={k}>{CATEGORY_EMOJI[k]} {CATEGORY_LABELS[k]}</option>
            ))}
          </select>

          <input
            className={inputClass}
            placeholder="Precio en SOL"
            value={amountSol}
            onChange={(e) => setAmountSol(e.target.value)}
            type="number" min="0.001" step="0.001"
          />

          <input
            className={inputClass}
            placeholder="Offer ID"
            value={offerId}
            onChange={(e) => setOfferId(e.target.value)}
            type="number"
          />

          <select
            className={inputClass}
            value={expiryDays}
            onChange={(e) => setExpiryDays(e.target.value)}
          >
            <option value="1">Expira en 1 día</option>
            <option value="3">Expira en 3 días</option>
            <option value="7">Expira en 7 días</option>
            <option value="30">Expira en 30 días</option>
          </select>
        </div>

        {/* PDA */}
        {offerPda && (
          <div className="rounded-2xl bg-primary-soft px-4 py-2.5">
            <p className="text-xs text-muted">PDA derivada</p>
            <p className="truncate font-mono text-xs text-foreground">{offerPda}</p>
          </div>
        )}

        {/* Status */}
        {txStatus && (
          <div className={`rounded-2xl border px-4 py-3 text-sm ${
            txStatus.startsWith("Error")
              ? "border-red-200 bg-red-50 text-red-700 dark:border-red-900/30 dark:bg-red-900/20 dark:text-red-400"
              : "border-border-low bg-primary-soft text-primary"
          }`}>
            {txStatus}
          </div>
        )}

        <button
          onClick={handleCreate}
          disabled={isCreating || isSending || authLoading || !title || !description || !offerPda}
          className="w-full rounded-2xl bg-primary py-4 text-sm font-bold text-primary-fg transition active:scale-95 disabled:opacity-40"
        >
          {isCreating || isSending ? "Procesando..." : "Publicar oferta (on-chain + backend)"}
        </button>
      </section>

      {/* ── Mis ofertas ── */}
      <section className="space-y-3">
        <h2 className="font-bold text-foreground">Mis ofertas publicadas</h2>

        {loadingOffers ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="h-20 animate-pulse rounded-3xl border border-border-low bg-card" />
            ))}
          </div>
        ) : myOffers.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-border-low bg-card py-10 text-center text-sm text-muted">
            Todavía no publicaste ninguna oferta.
          </div>
        ) : (
          <div className="space-y-3">
            {myOffers.map((offer) => {
              const isExpired = Date.now() / 1000 > offer.expiryTs;
              return (
                <div key={offer.pda} className="flex items-center gap-3 rounded-3xl border border-border-low bg-card px-5 py-4 shadow-sm">
                  <span className="text-2xl">{CATEGORY_EMOJI[offer.category]}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-foreground truncate">{offer.title}</p>
                      {isExpired && (
                        <span className="shrink-0 rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-600 dark:bg-red-900/30 dark:text-red-400">
                          Expirado
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-muted">{offer.amountSol} SOL · ID {offer.offerId}</p>
                    <p className="mt-0.5 truncate font-mono text-xs text-muted">{offer.pda}</p>
                  </div>
                  <button
                    onClick={() => handleDelete(offer.pda)}
                    className="shrink-0 rounded-xl border border-border-low px-3 py-2 text-xs font-medium text-muted transition active:scale-95 hover:border-red-300 hover:text-red-500"
                  >
                    Eliminar
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
