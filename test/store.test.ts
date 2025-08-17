import { storeFile } from '../src/lib/walrus';

const blobId = await storeFile();
console.log(blobId);
