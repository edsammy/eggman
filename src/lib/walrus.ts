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

export async function storeFile(blob?: Uint8Array) {
  let fileBlob: Uint8Array;
  
  if (blob) {
    fileBlob = blob;
  } else {
    // Fallback to default file for testing
    const file = Bun.file('./test/IMG_9048.jpeg');
    const arrayBuffer = await file.arrayBuffer();
    fileBlob = new Uint8Array(arrayBuffer);
  }
  
  const epochs = 1;
  const { blobId, blobObject } = await walrusClient.writeBlob({
  	blob: fileBlob,
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
