import { Hono } from 'hono';
import { Address } from 'viem';
import { paymentMiddleware } from 'x402-hono';
import { storeFile } from './lib/walrus.js';

const app = new Hono();
const DEFAULT_RECEIVING_ADDRESS = process.env.EVM_ADDRESS as Address;

// make dynamic
// https://pinata.cloud/blog/pay-to-pin-on-ipfs-with-x402/
app.use(paymentMiddleware(
  DEFAULT_RECEIVING_ADDRESS,
  {
    "/store": {
      price: "$0.10",
      network: "base-sepolia",
      config: {
        description: "Access to premium content",
      }
    }
  },
  {
    url: "https://x402.org/facilitator",
  }
));

app.get('/hello', c => {
  return c.text('Hello World!');
});

app.get('/store', async c => {
  const blobId = await storeFile();
  c.json(blobId);
});

export default app;
