import { describe, it, expect } from 'bun:test';
import { getEstimateSuiCost } from '../src/lib/walrus/index.ts';

describe('getEstimateSuiCost', () => {
  it('should return a cost estimate for small file', async () => {
    const size = 1024; // 1KB
    const epochs = 1;

    const estimate = await getEstimateSuiCost(size, epochs);
    console.log(estimate);
    expect(estimate).toBeDefined();
    expect(estimate.totalCost).toBeGreaterThan(0n);
  });
});
