import { useMemo, useState } from "react";
import { useWalletConnection } from "@solana/react-hooks";

function resolveDefaultBackendUrl(): string {
  const envUrl = import.meta.env.VITE_BACKEND_URL?.toString().trim();
  if (envUrl) return envUrl;

  if (typeof window !== "undefined") {
    const { hostname, port, protocol } = window.location;
    if (hostname.endsWith(".app.github.dev")) {
      const currentPort = port || "5173";
      const expectedSuffix = `-${currentPort}.app.github.dev`;
      if (hostname.includes(expectedSuffix)) {
        return `${protocol}//${hostname.replace(expectedSuffix, "-4000.app.github.dev")}`;
      }
    }
  }

  return "http://localhost:4000";
}

const BACKEND_URL = resolveDefaultBackendUrl();

type NonceResponse = {
  message: string;
  nonce: string;
  expiresAt: number;
  walletAddress: string;
};

type VerifyResponse = {
  token: string;
  walletAddress: string;
};

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function formatAuthError(error: unknown): string {
  if (!(error instanceof Error)) {
    return "Auth failed: Unknown error";
  }

  if (error.message === "Failed to fetch") {
    return [
      "Auth failed: cannot reach backend.",
      "If using github.dev, run backend on port 4000 and use its forwarded HTTPS URL.",
      `Current backend URL: ${BACKEND_URL}`,
    ].join(" ");
  }

  return `Auth failed: ${error.message}`;
}

export function AuthCard() {
  const { wallet, status } = useWalletConnection();
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [authStatus, setAuthStatus] = useState<string | null>(null);

  const walletAddress = useMemo(
    () => wallet?.account.address.toString() ?? null,
    [wallet?.account.address],
  );

  async function signInWithWallet() {
    if (!walletAddress || !wallet?.signMessage) {
      setAuthStatus("This wallet does not support signMessage.");
      return;
    }

    setIsAuthenticating(true);
    setAuthStatus("Requesting nonce...");

    try {
      const nonceRes = await fetch(`${BACKEND_URL}/auth/nonce`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress }),
      });

      if (!nonceRes.ok) {
        throw new Error(`Nonce request failed with status ${nonceRes.status}`);
      }

      const nonceData = (await nonceRes.json()) as NonceResponse;

      setAuthStatus("Please sign the login message in your wallet...");
      const signatureBytes = await wallet.signMessage(
        new TextEncoder().encode(nonceData.message),
      );
      const signature = bytesToBase64(signatureBytes);

      const verifyRes = await fetch(`${BACKEND_URL}/auth/verify`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          walletAddress,
          message: nonceData.message,
          signature,
        }),
      });

      if (!verifyRes.ok) {
        throw new Error(`Verify failed with status ${verifyRes.status}`);
      }

      const verifyData = (await verifyRes.json()) as VerifyResponse;
      setAuthToken(verifyData.token);
      setAuthStatus("Authenticated. JWT issued by backend.");
    } catch (error) {
      setAuthStatus(formatAuthError(error));
    } finally {
      setIsAuthenticating(false);
    }
  }

  if (status !== "connected") {
    return (
      <section className="w-full max-w-3xl space-y-3 rounded-2xl border border-border-low bg-card p-6">
        <p className="text-lg font-semibold">Backend Auth</p>
        <p className="text-sm text-muted">
          Connect wallet to test nonce + signature login.
        </p>
      </section>
    );
  }

  return (
    <section className="w-full max-w-3xl space-y-3 rounded-2xl border border-border-low bg-card p-6">
      <div className="space-y-1">
        <p className="text-lg font-semibold">Backend Auth</p>
        <p className="text-sm text-muted">
          Sign-in with wallet using nonce and signature verification.
        </p>
      </div>

      <p className="text-xs text-muted">Backend: {BACKEND_URL}</p>

      <button
        onClick={signInWithWallet}
        disabled={isAuthenticating || !wallet?.signMessage}
        className="rounded-lg bg-foreground px-4 py-2.5 text-sm font-medium text-background disabled:opacity-40"
      >
        {isAuthenticating ? "Authenticating..." : "Sign In With Wallet"}
      </button>

      {authStatus && (
        <div className="rounded-lg border border-border-low bg-cream/50 px-4 py-3 text-sm">
          {authStatus}
        </div>
      )}

      {authToken && (
        <div className="rounded-lg border border-border-low bg-cream/30 px-4 py-3 text-xs">
          <p className="mb-1 uppercase tracking-wide text-muted">JWT</p>
          <p className="truncate font-mono">{authToken}</p>
        </div>
      )}
    </section>
  );
}
