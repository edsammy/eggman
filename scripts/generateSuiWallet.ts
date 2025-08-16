// save in .env
// import into sui cli:
// sui keytool import [private_key] ed25519
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';

const keyPair = new Ed25519Keypair();
const privateKey = keyPair.getSecretKey();
const publicKey = keyPair.toSuiAddress();

console.log('Private Key:\n', privateKey);
console.log('Wallet Address:\n', publicKey );
