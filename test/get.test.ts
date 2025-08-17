
import { getBlob } from '../src/lib/walrus';

const blobId = 'YzuQbtKTVhJBgk0_GBg91bYQ0DUX6rJs3s2-3E7qb9o';
const blob = await getBlob(blobId);
// save blob to file
await Bun.write('test.blob.svg', blob);
