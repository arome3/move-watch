import { Account } from '@aptos-labs/ts-sdk';

// Generate a new account
const account = Account.generate();

console.log('=== Simulation Account Generated ===');
console.log('Address:', account.accountAddress.toString());
console.log('Private Key (hex):', account.privateKey.toString());
console.log('Public Key (hex):', account.publicKey.toString());

// Output in a format we can use
console.log('\n=== Environment Variables ===');
console.log('SIMULATION_ACCOUNT_ADDRESS=' + account.accountAddress.toString());
console.log('SIMULATION_ACCOUNT_PRIVATE_KEY=' + account.privateKey.toString());

console.log('\n=== Next Steps ===');
console.log('1. Fund this account on Movement testnet:');
console.log('   curl -X POST "https://faucet.testnet.movementnetwork.xyz/" -H "Content-Type: application/json" -d \'{"address":"' + account.accountAddress.toString() + '"}\'');
console.log('2. Add the environment variables to apps/api/.env');
