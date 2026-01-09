# MoveWatch Demo Contract

A demonstration contract for showcasing MoveWatch simulator features.

## Deployment

### Prerequisites

1. Install the Aptos CLI:
```bash
curl -fsSL "https://aptos.dev/scripts/install_cli.py" | python3
```

2. Initialize your account (if not done):
```bash
aptos init --network custom --rest-url https://aptos.testnet.bardock.movementlabs.xyz/v1
```

### Deploy to Movement Testnet

```bash
cd contracts

# Compile
aptos move compile --named-addresses movewatch_demo=default

# Deploy
aptos move publish --named-addresses movewatch_demo=default
```

### Note the deployed address

After deployment, the contract will be available at:
```
<your-account-address>::showcase
```

Update the demo presets in the web app with your deployed address.

## Demo Scenarios

| Function | Scenario | Expected Result |
|----------|----------|-----------------|
| `create_vault(1000)` | Success | Creates vault, emits VaultCreated event |
| `deposit(500)` | Success | Increases balance, emits DepositMade event |
| `withdraw(100)` | Success | Decreases balance, emits WithdrawalMade event |
| `withdraw(999999)` | Failure | E_INSUFFICIENT_BALANCE (1) |
| `deposit(0)` | Failure | E_INVALID_AMOUNT (3) |
| `admin_action(other_addr)` | Failure | E_UNAUTHORIZED (2) |
| `lock_vault()` then `deposit(100)` | Failure | E_VAULT_LOCKED (6) |

## Error Codes

| Code | Constant | Description |
|------|----------|-------------|
| 1 | E_INSUFFICIENT_BALANCE | Withdrawal exceeds balance |
| 2 | E_UNAUTHORIZED | Caller is not vault owner |
| 3 | E_INVALID_AMOUNT | Amount is zero or invalid |
| 4 | E_VAULT_NOT_FOUND | No vault at address |
| 5 | E_VAULT_ALREADY_EXISTS | Vault already created |
| 6 | E_VAULT_LOCKED | Vault is locked |
| 7 | E_EXCEEDS_MAX_DEPOSIT | Deposit too large |
