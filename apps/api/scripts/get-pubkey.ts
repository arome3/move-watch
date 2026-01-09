import { Account, Ed25519PrivateKey } from '@aptos-labs/ts-sdk';

const pk = new Ed25519PrivateKey('0x14bccf8b94ea8590c443ff3e871e24aab3aa24b9bb1ec0540f05f38de059ea1a');
const acc = Account.fromPrivateKey({ privateKey: pk });
console.log('Address:', acc.accountAddress.toString());
console.log('Public Key:', acc.publicKey.toString());
