import { Address, getAddressEncoder, createAddressWithSeed } from "@solana/kit";
import { VAULT_PROGRAM_ADDRESS } from "../generated/vault/programs";

export function getProductAccountPda(authority: Address, productId: string): Address {
  return createAddressWithSeed({
    programAddress: VAULT_PROGRAM_ADDRESS,
    seeds: [
      getAddressEncoder().encode(new TextEncoder().encode("product")),
      getAddressEncoder().encode(authority),
      getAddressEncoder().encode(new TextEncoder().encode(productId)),
    ],
  });
}

export function getPurchaseRecordPda(productAccount: Address, buyer: Address): Address {
  return createAddressWithSeed({
    programAddress: VAULT_PROGRAM_ADDRESS,
    seeds: [
      getAddressEncoder().encode(new TextEncoder().encode("purchase")),
      getAddressEncoder().encode(productAccount),
      getAddressEncoder().encode(buyer),
    ],
  });
}

export function getNftMintPda(productAccount: Address, buyer: Address): Address {
  return createAddressWithSeed({
    programAddress: VAULT_PROGRAM_ADDRESS,
    seeds: [
      getAddressEncoder().encode(new TextEncoder().encode("nft_mint")),
      getAddressEncoder().encode(productAccount),
      getAddressEncoder().encode(buyer),
    ],
  });
}

export function getNftCustodyAccountPda(companyWallet: Address, nftMint: Address): Address {
  return createAddressWithSeed({
    programAddress: VAULT_PROGRAM_ADDRESS,
    seeds: [
      getAddressEncoder().encode(new TextEncoder().encode("nft_custody")),
      getAddressEncoder().encode(companyWallet),
      getAddressEncoder().encode(nftMint),
    ],
  });
}