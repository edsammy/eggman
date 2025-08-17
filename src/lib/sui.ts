import { getFullnodeUrl, SuiClient } from '@mysten/sui/client';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';

const PRIVATE_KEY = process.env.SUI_PRIVATE_KEY;
if (!PRIVATE_KEY) throw new Error('SUI_PRIVATE_KEY is not set');

export const suiWallet = Ed25519Keypair.fromSecretKey(PRIVATE_KEY);

export const suiClient = new SuiClient({
	url: getFullnodeUrl('testnet'),
});

export async function getWalletAddress() {
	return suiWallet.getPublicKey().toSuiAddress();
}

export async function getWalletBalance(owner: string) {
	const balance = await suiClient.getAllBalances({ owner });
	return balance;
}
