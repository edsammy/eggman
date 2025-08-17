import { Hono } from 'hono';
import { timeout } from 'hono/timeout';
import { Address } from 'viem';
import { paymentMiddleware } from 'x402-hono';
import { storeFile } from './lib/walrus.js';
import { join } from 'path';
import { randomUUID } from 'crypto';

const app = new Hono();
const DEFAULT_RECEIVING_ADDRESS = process.env.EVM_ADDRESS as Address;

// Store for payment transactions with detailed info (in production, use Redis or database)
interface TransactionData {
  transactionString: string;
  fileName?: string;
  blobId?: string;
  blobObjectId?: string;
  used: boolean;
  createdAt: Date;
  usedAt?: Date;
}

const validTransactions = new Map<string, TransactionData>();

// Add default ADMIN transaction for testing
const ADMIN_TRANSACTION = 'ADMIN_TEST_TRANSACTION';
validTransactions.set(ADMIN_TRANSACTION, {
  transactionString: ADMIN_TRANSACTION,
  used: false,
  createdAt: new Date(),
});

// Payment endpoint - returns x402 payment transaction string
app.use('/pay', paymentMiddleware(
  DEFAULT_RECEIVING_ADDRESS,
  {
    "/pay": {
      price: "$0.10",
      network: "base-sepolia",
      config: {
        description: "Payment for file storage",
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

// Payment endpoint - user pays here and gets transaction string
app.get('/pay', async c => {
  try {
    // Extract transaction hash from x402 payment headers
    const transactionHash = c.req.header('X-PAYMENT');
    // console.dir(c.req, { depth: null});

    if (!transactionHash) {
      return c.json({ error: 'No transaction hash provided' }, 400);
    }

    // In a real implementation, verify the transaction on-chain
    // For now, we'll just generate a unique transaction string
    const transactionString = `tx_${randomUUID()}_${Date.now()}`;

    // Store the valid transaction with metadata
    validTransactions.set(transactionString, {
      transactionString,
      used: false,
      createdAt: new Date(),
    });

    // Set expiration (mark as expired after 10 minutes, but don't delete)
    setTimeout(() => {
      const transaction = validTransactions.get(transactionString);
      if (transaction && !transaction.used) {
        transaction.used = true; // Mark as expired
        transaction.usedAt = new Date();
      }
    }, 10 * 60 * 1000);

    return c.json({
      transactionString,
      message: 'Payment confirmed. Use this transaction string to upload your file.',
      expiresIn: '10 minutes'
    });
  } catch (error) {
    return c.json({ error: 'Payment processing failed' }, 500);
  }
});

// Store endpoint - requires valid transaction string
app.post('/store', timeout(5 * 60 * 1000), async c => {
  try {
    const body = await c.req.parseBody();
    const file = body['file'] as File;
    const transactionString = body['transactionString'] as string;

    if (!file) {
      return c.json({ error: 'No file provided' }, 400);
    }

    if (!transactionString) {
      return c.json({ error: 'No transaction string provided. Please pay first using /pay endpoint.' }, 400);
    }

    // Verify transaction string is valid and not used
    const transaction = validTransactions.get(transactionString);
    if (!transaction) {
      return c.json({ error: 'Invalid transaction string. Please pay first.' }, 401);
    }

    if (transaction.used) {
      return c.json({ error: 'Transaction string already used or expired. Please pay again.' }, 401);
    }

    // Mark transaction as used (but don't delete)
    transaction.used = true;
    transaction.usedAt = new Date();

    const arrayBuffer = await file.arrayBuffer();
    const blob = new Uint8Array(arrayBuffer);

    // Generate unique filename with original extension
    const fileExtension = file.name.split('.').pop() || '';
    const uniqueId = randomUUID();
    const tempFileName = `${uniqueId}.${fileExtension}`;
    const tempFilePath = join(process.cwd(), 'tmp', tempFileName);

    // Write to temp file as backup using Bun.write
    await Bun.write(tempFilePath, blob);

    try {
      // Attempt Walrus upload
      const blobId = await storeFile(blob);

      // Update transaction with file details
      transaction.fileName = tempFileName;
      transaction.blobId = blobId.blobId;
      transaction.blobObjectId = blobId.blobObjectId;

      return c.json({
        ...blobId,
        tempFile: tempFileName,
        message: 'File stored on Walrus and saved to temp folder',
        transactionUsed: transactionString
      });
    } catch (walrusError) {
      // If Walrus fails, still update transaction with temp file info
      transaction.fileName = tempFileName;

      return c.json({
        tempFile: tempFileName,
        message: 'Walrus upload failed, file saved to temp folder only',
        error: 'Walrus storage failed',
        transactionUsed: transactionString
      }, 202);
    }
  } catch (error) {
    return c.json({ error: 'Failed to store file' }, 500);
  }
});

// Admin endpoint to view transaction history
app.get('/admin/transactions', async c => {
  const transactions = Array.from(validTransactions.entries()).map(([key, data]) => ({
    transactionString: key,
    fileName: data.fileName || null,
    blobId: data.blobId || null,
    blobObjectId: data.blobObjectId || null,
    used: data.used,
    createdAt: data.createdAt.toISOString(),
    usedAt: data.usedAt?.toISOString() || null,
  }));

  return c.json({
    totalTransactions: transactions.length,
    usedTransactions: transactions.filter(t => t.used).length,
    unusedTransactions: transactions.filter(t => !t.used).length,
    transactions
  });
});

app.get('/get/:blobId', async c => {
  const { blobId } = c.req.param();
  const txnByBlobId = validTransactions.values().find(entry => entry.blobId === blobId);
  const file = txnByBlobId ? txnByBlobId.fileName : null;

  c.json({
    blobId,
    fileName: file,
    message: 'File retrieved from Walrus'
  });
});

export default app;
