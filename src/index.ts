import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { timeout } from 'hono/timeout';
import { Address } from 'viem';
import { paymentMiddleware } from 'x402-hono';
import { getBlob, storeFile } from './lib/walrus.js';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { serveStatic } from "hono/bun";
import { readdir, stat } from 'fs/promises';
import { addBlobToUser } from "./lib/base.js";

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

const addressToBlob = new Map<string, string[]>();

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
    const payment = c.req.header('X-PAYMENT');
    // console.dir(c.req, { depth: null});

    if (!payment) {
      return c.json({ error: 'No transaction hash provided' }, 400);
    }
    if (payment) {
      const paymentData = JSON.parse(Buffer.from(payment, 'base64').toString());
      console.log(paymentData)
      const payerAddress = paymentData.payload.authorization.from;
      console.log('Payment received from:', payerAddress);
    }
    // In a real implementation, verify the transaction on-chain
    // For now, we'll just generate a unique transaction string
    const transactionString = `tx_${randomUUID()}_${Date.now()}`;

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
    const walletAddress = body['walletAddress'] as Address;

    if (!file) {
      return c.json({ error: 'No file provided' }, 400);
    }
    
    if (!walletAddress) {
      return c.json({ error: 'No wallet address provided' }, 400);
    }
    console.log(`got file ${file.size} from wallet ${walletAddress}`)
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
      
      // const existingBlobs = addressToBlob.get(walletAddress) || [];
      // existingBlobs.push(blobId.blobId);
      // addressToBlob.set(walletAddress, existingBlobs);
      await addBlobToUser(walletAddress, blobId.blobId);
      return c.json({
        ...blobId,
        tempFile: tempFileName,
        walletAddress,
        message: 'File stored on Walrus and saved to temp folder'
      });
    } catch (walrusError) {
      return c.json({
        tempFile: tempFileName,
        walletAddress,
        message: 'Walrus upload failed, file saved to temp folder only',
        error: 'Walrus storage failed'
      }, 202);
    }
  } catch (error) {
    return c.json({ error: 'Failed to store file' }, 500);
  }
});

// Admin endpoint to view transaction history
app.get('/admin', async c => {
  return c.json({
    addressToBlobMap: Object.fromEntries(addressToBlob),
    totalEntries: addressToBlob.size
  });
});

// app.get('/:blobId', async c => {
//   const { blobId } = c.req.param();
//   const blob = await getBlob(blobId);
  
//   // Set headers to display in browser instead of downloading
//   c.header('Content-Type', 'image/jpeg'); // Adjust MIME type based on your file type
//   c.header('Content-Disposition', 'inline'); // This tells the browser to display instead of download
  
//   // Return the blob data
//   return c.body(blob);
// });

// Serve static files from tmp folder
app.get('/images/*', serveStatic({
  root: './tmp',
  rewriteRequestPath: (path) => path.replace('/images', '')
}));

// API route to list all images in tmp folder with metadata
app.get('/images', async c => {
  try {
    const tmpDir = join(process.cwd(), 'tmp');
    const files = await readdir(tmpDir);
    
    // Filter for image files and get metadata
    const imageFiles = await Promise.all(
      files
        .filter(file => /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(file))
        .map(async (file) => {
          const filePath = join(tmpDir, file);
          const stats = await stat(filePath);
          return {
            filename: file,
            url: `/images/${file}`,
            size: stats.size,
            createdAt: stats.birthtime,
            modifiedAt: stats.mtime
          };
        })
    );
    
    // Sort by creation date (newest first)
    imageFiles.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    
    return c.json({
      total: imageFiles.length,
      images: imageFiles
    });
  } catch (error) {
    return c.json({ error: 'Failed to list images' }, 500);
  }
});

export default app;
