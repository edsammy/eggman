
import { getBlob } from '../src/lib/walrus';

const blobId = 'k2aw84q10Put86pjV3KvgKrQSDrYzx_fwF9odUFaRQY';
const blob = await getBlob(blobId);
// save blob to file
await Bun.write('test.blob.jpeg', blob);
