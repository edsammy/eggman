import { getFullnodeUrl, SuiClient } from '@mysten/sui/client';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { WalrusClient } from '@mysten/walrus';

const PRIVATE_KEY = process.env.SUI_PRIVATE_KEY;
if (!PRIVATE_KEY) throw new Error('SUI_PRIVATE_KEY is not set');

const suiWallet = Ed25519Keypair.fromSecretKey(PRIVATE_KEY);

const suiClient = new SuiClient({
	url: getFullnodeUrl('testnet'),
});

const walrusClient = new WalrusClient({
	network: 'testnet',
	suiClient,
});

export async function getWalletAddress () {
	return suiWallet.getPublicKey().toSuiAddress();
}

export async function getWalletBalance (address: string) {
	const balance = await suiClient.getAllBalances({
		owner: address,
	});
	return balance;
}

export async function getWALBalance () {
	// WAL token coin type - you'll need to find this from Walrus docs or inspect transactions
	const WAL_COIN_TYPE = '0x...'; // Replace with actual WAL coin type

	try {
		const balance = await suiClient.getBalance({
			owner: await getWalletAddress(),
			coinType: WAL_COIN_TYPE,
		});
		return balance.totalBalance;
	} catch (error) {
		console.log('WAL balance check failed - token type may be incorrect:', error);
		return '0';
	}
}

export async function getEstimateSuiCost (size: number, epochs: number) {
	const estimate = await walrusClient.storageCost(size, epochs);
	return estimate;
};
