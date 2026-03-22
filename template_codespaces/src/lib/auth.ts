import { BACKEND_URL } from "./backend";

const TOKEN_KEY = "blinko_jwt";

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearStoredToken() {
  localStorage.removeItem(TOKEN_KEY);
}

type NonceResponse = { message: string; nonce: string; expiresAt: number; walletAddress: string };
type VerifyResponse = { token: string; walletAddress: string };

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

export async function signInWithWallet(
  walletAddress: string,
  signMessage: (msg: Uint8Array) => Promise<Uint8Array>,
): Promise<string> {
  const nonceRes = await fetch(`${BACKEND_URL}/auth/nonce`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ walletAddress }),
  });
  if (!nonceRes.ok) throw new Error("Error solicitando nonce");

  const { message } = (await nonceRes.json()) as NonceResponse;
  const sigBytes = await signMessage(new TextEncoder().encode(message));
  const signature = bytesToBase64(sigBytes);

  const verifyRes = await fetch(`${BACKEND_URL}/auth/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ walletAddress, message, signature }),
  });
  if (!verifyRes.ok) throw new Error("Firma inválida");

  const { token } = (await verifyRes.json()) as VerifyResponse;
  setStoredToken(token);
  return token;
}
