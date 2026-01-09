/// MoveWatch Demo Contract (Simplified)
///
/// This contract demonstrates various transaction scenarios for the MoveWatch simulator.
/// Optimized for faster deployment with minimal dependencies.
module movewatch_demo::showcase {
    use std::signer;

    // ============================================================================
    // ERROR CODES - These demonstrate different failure scenarios
    // ============================================================================

    /// Thrown when trying to withdraw more than available balance
    const E_INSUFFICIENT_BALANCE: u64 = 1;

    /// Thrown when caller is not the vault owner
    const E_UNAUTHORIZED: u64 = 2;

    /// Thrown when amount is zero or invalid
    const E_INVALID_AMOUNT: u64 = 3;

    /// Thrown when trying to access a vault that doesn't exist
    const E_VAULT_NOT_FOUND: u64 = 4;

    /// Thrown when vault already exists for this account
    const E_VAULT_ALREADY_EXISTS: u64 = 5;

    /// Thrown when vault is locked and cannot be modified
    const E_VAULT_LOCKED: u64 = 6;

    /// Thrown when deposit exceeds maximum allowed
    const E_EXCEEDS_MAX_DEPOSIT: u64 = 7;

    // ============================================================================
    // CONSTANTS
    // ============================================================================

    /// Maximum deposit amount (1 billion units)
    const MAX_DEPOSIT: u64 = 1_000_000_000;

    /// Minimum withdraw amount
    const MIN_WITHDRAW: u64 = 1;

    // ============================================================================
    // STRUCTS
    // ============================================================================

    /// A simple vault that holds a balance
    struct Vault has key {
        balance: u64,
        owner: address,
        is_locked: bool,
        total_deposited: u64,
        total_withdrawn: u64,
    }

    // ============================================================================
    // ENTRY FUNCTIONS - SUCCESS SCENARIOS
    // ============================================================================

    /// Creates a new vault with an initial balance
    ///
    /// SUCCESS: Demonstrates resource creation
    /// DEMO: Use to show successful transaction with state changes
    public entry fun create_vault(account: &signer, initial_balance: u64) {
        let addr = signer::address_of(account);

        // Check vault doesn't already exist
        assert!(!exists<Vault>(addr), E_VAULT_ALREADY_EXISTS);

        // Validate initial balance
        assert!(initial_balance <= MAX_DEPOSIT, E_EXCEEDS_MAX_DEPOSIT);

        // Create the vault
        move_to(account, Vault {
            balance: initial_balance,
            owner: addr,
            is_locked: false,
            total_deposited: initial_balance,
            total_withdrawn: 0,
        });
    }

    /// Deposits additional funds into the vault
    ///
    /// SUCCESS: Shows balance updates
    /// FAIL: E_INVALID_AMOUNT if amount is 0, E_VAULT_LOCKED if locked
    public entry fun deposit(account: &signer, amount: u64) acquires Vault {
        let addr = signer::address_of(account);

        // Validate amount
        assert!(amount > 0, E_INVALID_AMOUNT);
        assert!(amount <= MAX_DEPOSIT, E_EXCEEDS_MAX_DEPOSIT);

        // Check vault exists
        assert!(exists<Vault>(addr), E_VAULT_NOT_FOUND);

        let vault = borrow_global_mut<Vault>(addr);

        // Check not locked
        assert!(!vault.is_locked, E_VAULT_LOCKED);

        // Update balance
        vault.balance = vault.balance + amount;
        vault.total_deposited = vault.total_deposited + amount;
    }

    /// Withdraws funds from the vault
    ///
    /// SUCCESS: Shows balance decrease
    /// FAIL: E_INSUFFICIENT_BALANCE if amount > balance
    public entry fun withdraw(account: &signer, amount: u64) acquires Vault {
        let addr = signer::address_of(account);

        // Validate amount
        assert!(amount >= MIN_WITHDRAW, E_INVALID_AMOUNT);

        // Check vault exists
        assert!(exists<Vault>(addr), E_VAULT_NOT_FOUND);

        let vault = borrow_global_mut<Vault>(addr);

        // Check not locked
        assert!(!vault.is_locked, E_VAULT_LOCKED);

        // Check sufficient balance
        assert!(vault.balance >= amount, E_INSUFFICIENT_BALANCE);

        // Update balance
        vault.balance = vault.balance - amount;
        vault.total_withdrawn = vault.total_withdrawn + amount;
    }

    /// Locks the vault to prevent modifications
    ///
    /// SUCCESS: Demonstrates state flag changes
    public entry fun lock_vault(account: &signer) acquires Vault {
        let addr = signer::address_of(account);

        assert!(exists<Vault>(addr), E_VAULT_NOT_FOUND);

        let vault = borrow_global_mut<Vault>(addr);

        // Only owner can lock
        assert!(vault.owner == addr, E_UNAUTHORIZED);

        vault.is_locked = true;
    }

    /// Unlocks the vault
    public entry fun unlock_vault(account: &signer) acquires Vault {
        let addr = signer::address_of(account);

        assert!(exists<Vault>(addr), E_VAULT_NOT_FOUND);

        let vault = borrow_global_mut<Vault>(addr);

        // Only owner can unlock
        assert!(vault.owner == addr, E_UNAUTHORIZED);

        vault.is_locked = false;
    }

    /// Transfers vault ownership to another address
    ///
    /// SUCCESS: Shows ownership transfer pattern
    /// FAIL: E_UNAUTHORIZED if not owner
    public entry fun transfer_ownership(
        account: &signer,
        new_owner: address
    ) acquires Vault {
        let addr = signer::address_of(account);

        assert!(exists<Vault>(addr), E_VAULT_NOT_FOUND);

        let vault = borrow_global_mut<Vault>(addr);

        // Only current owner can transfer
        assert!(vault.owner == addr, E_UNAUTHORIZED);

        vault.owner = new_owner;
    }

    // ============================================================================
    // ENTRY FUNCTIONS - INTENTIONAL FAILURE SCENARIOS FOR DEMO
    // ============================================================================

    /// Admin function that requires authorization
    ///
    /// DEMO: Always fails with E_UNAUTHORIZED when called by non-owner
    /// Use this to demonstrate permission errors
    public entry fun admin_action(account: &signer, vault_address: address) acquires Vault {
        let caller = signer::address_of(account);

        assert!(exists<Vault>(vault_address), E_VAULT_NOT_FOUND);

        let vault = borrow_global<Vault>(vault_address);

        // This will fail if caller is not the vault owner
        assert!(vault.owner == caller, E_UNAUTHORIZED);

        // Admin action would go here...
    }

    /// Attempts to withdraw from someone else's vault
    ///
    /// DEMO: Shows cross-account access control failure
    public entry fun withdraw_from_vault(
        account: &signer,
        vault_address: address,
        amount: u64
    ) acquires Vault {
        let caller = signer::address_of(account);

        assert!(exists<Vault>(vault_address), E_VAULT_NOT_FOUND);

        let vault = borrow_global_mut<Vault>(vault_address);

        // Only owner can withdraw
        assert!(vault.owner == caller, E_UNAUTHORIZED);

        // Check balance
        assert!(vault.balance >= amount, E_INSUFFICIENT_BALANCE);

        vault.balance = vault.balance - amount;
    }

    // ============================================================================
    // VIEW FUNCTIONS
    // ============================================================================

    #[view]
    /// Returns the vault balance for an address
    public fun get_balance(vault_address: address): u64 acquires Vault {
        assert!(exists<Vault>(vault_address), E_VAULT_NOT_FOUND);
        borrow_global<Vault>(vault_address).balance
    }

    #[view]
    /// Returns whether a vault exists for the address
    public fun vault_exists(vault_address: address): bool {
        exists<Vault>(vault_address)
    }

    #[view]
    /// Returns vault details
    public fun get_vault_info(vault_address: address): (u64, address, bool, u64, u64) acquires Vault {
        assert!(exists<Vault>(vault_address), E_VAULT_NOT_FOUND);
        let vault = borrow_global<Vault>(vault_address);
        (vault.balance, vault.owner, vault.is_locked, vault.total_deposited, vault.total_withdrawn)
    }
}
