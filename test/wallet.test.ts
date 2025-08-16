import { test, expect } from 'bun:test';
import { getWalletAddress, getWalletBalance } from '../src/lib/walrus/index.ts';

test('wallet address matches SUI_ADDRESS env var', async () => {
  const walletAddress = await getWalletAddress();
  const expectedAddress = process.env.SUI_ADDRESS || '';

  console.log('Wallet address:', walletAddress);
  console.log('Expected address:', expectedAddress);

  expect(walletAddress).toBeDefined();
  expect(walletAddress).toBe(expectedAddress);
});

test('wallet has SUI balance', async () => {
  const address = await getWalletAddress();
  const balance = await getWalletBalance(address);

  console.log('Wallet balance:', balance);

  expect(balance).toBeDefined();
});
