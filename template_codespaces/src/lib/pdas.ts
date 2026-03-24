import { Address, getAddressEncoder, getProgramDerivedAddress } from '@solana/kit';
import { VAULT_PROGRAM_ADDRESS } from '../generated/vault/index';
export async function getProductAccountPda(authority: Address, productId: string): Promise<Address> {
  const [address] = await getProgramDerivedAddress({
    programAddress: VAULT_PROGRAM_ADDRESS,
    seeds: [
      new TextEncoder().encode("product"),
      getAddressEncoder().encode(authority),
      new TextEncoder().encode(productId),
    ],
  });
  return address;
}

export async function getPurchaseRecordPda(productAccount: Address, buyer: Address): Promise<Address> {
  const [address] = await getProgramDerivedAddress({
    programAddress: VAULT_PROGRAM_ADDRESS,
    seeds: [
      new TextEncoder().encode("purchase"),
      getAddressEncoder().encode(productAccount),
      getAddressEncoder().encode(buyer),
    ],
  });
  return address;
}

export async function getNftMintPda(productAccount: Address, buyer: Address): Promise<Address> {
  const [address] = await getProgramDerivedAddress({
    programAddress: VAULT_PROGRAM_ADDRESS,
    seeds: [
      new TextEncoder().encode("nft_mint"),
      getAddressEncoder().encode(productAccount),
      getAddressEncoder().encode(buyer),
    ],
  });
  return address;
}

export async function getNftCustodyAccountPda(companyWallet: Address, nftMint: Address): Promise<Address> {
  const [address] = await getProgramDerivedAddress({
    programAddress: VAULT_PROGRAM_ADDRESS,
    seeds: [
      new TextEncoder().encode("nft_custody"),
      getAddressEncoder().encode(companyWallet),
      getAddressEncoder().encode(nftMint),
    ],
  });
  return address;
}