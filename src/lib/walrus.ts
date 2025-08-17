import { WalrusClient } from '@mysten/walrus';
import { suiClient, suiWallet } from './sui';

const walrusClient = new WalrusClient({
	network: 'testnet',
	suiClient,
});

export async function getStorageCost(size: number, epochs: number) {
	const estimate = await walrusClient.storageCost(size, epochs);
	return estimate;
};

export async function storeFile() {
  const file = Bun.file('./test/IMG_9048.jpeg');
  const arrayBuffer = await file.arrayBuffer();
  const blob = new Uint8Array(arrayBuffer);
  const epochs = 1;
  const { blobId, blobObject } = await walrusClient.writeBlob({
  	blob,
  	deletable: false,
  	epochs,
  	signer: suiWallet,
  });

  return { blobId, blobObjectId: blobObject.id.id };
};

export const getBlob = async (blobId: string) => {
	const blob = await walrusClient.readBlob({ blobId });
	return blob;
};
