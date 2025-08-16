import { WalrusClient } from '@mysten/walrus';
import { suiClient } from './sui';

const walrusClient = new WalrusClient({
	network: 'testnet',
	suiClient,
});

export async function getEstimateSuiCost (size: number, epochs: number) {
	const estimate = await walrusClient.storageCost(size, epochs);
	return estimate;
};
