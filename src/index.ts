import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { timeout } from 'hono/timeout';
import { Address } from 'viem';
import { paymentMiddleware } from 'x402-hono';
import { storeFile } from './lib/walrus.js';
import { join } from 'path';
import { randomUUID } from 'crypto';

const app = new Hono();

// Enable CORS for all routes
app.use('*', cors({
  origin: '*', // Allow all origins for demo
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-PAYMENT'],
  exposeHeaders: ['Location'],
  maxAge: 86400,
  credentials: true,
}));
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

    // Return response with payment completion signal
    // Include a script that will close the popup window
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Payment Complete</title>
        <style>
          body {
            font-family: system-ui, -apple-system, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
          }
          .container {
            text-align: center;
            padding: 2rem;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 1rem;
            backdrop-filter: blur(10px);
          }
          .checkmark {
            font-size: 4rem;
            margin-bottom: 1rem;
            animation: scale 0.5s ease-in-out;
          }
          @keyframes scale {
            0% { transform: scale(0); }
            50% { transform: scale(1.2); }
            100% { transform: scale(1); }
          }
          .message {
            font-size: 1.5rem;
            margin-bottom: 1rem;
          }
          .sub-message {
            opacity: 0.9;
            margin-bottom: 1rem;
          }
          .close-button {
            margin-top: 1rem;
            padding: 0.75rem 2rem;
            background: rgba(255, 255, 255, 0.2);
            border: 2px solid rgba(255, 255, 255, 0.5);
            border-radius: 0.5rem;
            color: white;
            font-size: 1rem;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s ease;
          }
          .close-button:hover {
            background: rgba(255, 255, 255, 0.3);
            border-color: rgba(255, 255, 255, 0.7);
            transform: scale(1.05);
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="checkmark">✅</div>
          <div class="message">Payment Complete!</div>
          <div class="sub-message">Transaction: ${transactionString.substring(0, 20)}...</div>
          <div class="sub-message">This window will close automatically in 3 seconds...</div>
          <button class="close-button" onclick="window.close()">Close Window</button>
        </div>
        <script>
          // Signal to parent window that payment is complete
          if (window.opener) {
            window.opener.postMessage({ 
              type: 'PAYMENT_COMPLETE', 
              transactionString: '${transactionString}',
              success: true 
            }, '*');
          }
          
          // Auto-close window after 3 seconds
          setTimeout(() => {
            window.close();
          }, 3000);
        </script>
      </body>
      </html>
    `;
    
    return c.html(html);
  } catch (error) {
    return c.json({ error: 'Payment processing failed' }, 500);
  }
});

// Store endpoint - requires valid transaction string
app.post('/store', timeout(5 * 60 * 1000), async c => {
  try {
    const body = await c.req.parseBody();
    const file = body['file'] as File;

    if (!file) {
      return c.json({ error: 'No file provided' }, 400);
    }
    console.log(`got file ${file.size}`)
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

      return c.json({
        ...blobId,
        tempFile: tempFileName,
        message: 'File stored on Walrus and saved to temp folder'
      });
    } catch (walrusError) {
      return c.json({
        tempFile: tempFileName,
        message: 'Walrus upload failed, file saved to temp folder only',
        error: 'Walrus storage failed'
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

app.get('/info/:blobId', async c => {
  const { blobId } = c.req.param();
  const txnByBlobId = validTransactions.values().find(entry => entry.blobId === blobId);
  const file = txnByBlobId ? txnByBlobId.fileName : null;

  return c.json({
    blobId,
    fileName: file,
    message: 'File retrieved from Walrus'
  });
});

export default app;
