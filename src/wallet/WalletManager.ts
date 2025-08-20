import { Connection, Keypair, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js'
import { getAccount, getAssociatedTokenAddress } from '@solana/spl-token'
import { WalletBalance } from '../types'
import { Logger } from '../utils/Logger'

export class WalletManager {
  private logger = new Logger('WalletManager')
  public nodeKeypair: Keypair
  public relayKeypairs: Keypair[] = []
  
  private currentRelayIndex = 0
  
  constructor() {
    // Load node signer keypair
    const nodeSignerSecret = process.env.NODE_SIGNER_SECRET
    if (!nodeSignerSecret) {
      throw new Error('NODE_SIGNER_SECRET environment variable is required')
    }
    
    try {
      const secretKey = Buffer.from(nodeSignerSecret, 'base64')
      this.nodeKeypair = Keypair.fromSecretKey(secretKey)
      this.logger.info(`🔑 Node signer loaded: ${this.nodeKeypair.publicKey.toString()}`)
    } catch (error) {
      throw new Error(`Failed to load node signer: ${error}`)
    }
    
    // Load relay signers
    this.loadRelaySigners()
  }
  
  private loadRelaySigners(): void {
    const relaySignersEnv = process.env.RELAY_SIGNERS
    if (!relaySignersEnv) {
      throw new Error('RELAY_SIGNERS environment variable is required')
    }
    
    try {
      const relaySecrets = JSON.parse(relaySignersEnv) as string[]
      
      for (const [index, secret] of relaySecrets.entries()) {
        const secretKey = Buffer.from(secret, 'base64')
        const keypair = Keypair.fromSecretKey(secretKey)
        this.relayKeypairs.push(keypair)
        
        this.logger.info(`🔑 Relay wallet ${index + 1} loaded: ${keypair.publicKey.toString()}`)
      }
      
      if (this.relayKeypairs.length === 0) {
        throw new Error('At least one relay signer is required')
      }
      
    } catch (error) {
      throw new Error(`Failed to load relay signers: ${error}`)
    }
  }
  
  getNextRelayWallet(): Keypair {
    if (this.relayKeypairs.length === 0) {
      throw new Error('No relay wallets available')
    }
    
    const wallet = this.relayKeypairs[this.currentRelayIndex]
    this.currentRelayIndex = (this.currentRelayIndex + 1) % this.relayKeypairs.length
    
    return wallet
  }
  
  getRelayWalletByIndex(index: number): Keypair | null {
    if (index < 0 || index >= this.relayKeypairs.length) {
      return null
    }
    return this.relayKeypairs[index]
  }
  
  async validateBalances(connection: Connection): Promise<void> {
    const balances = await this.getBalances(connection)
    const minBalance = 0.01 // 0.01 SOL minimum
    
    const lowBalanceWallets = balances.filter(w => w.balanceSOL < minBalance)
    
    if (lowBalanceWallets.length > 0) {
      const addresses = lowBalanceWallets.map(w => w.publicKey).join(', ')
      this.logger.warn(`⚠️  Low balance wallets (< ${minBalance} SOL): ${addresses}`)
    }
    
    if (lowBalanceWallets.length === balances.length) {
      throw new Error('All wallets have insufficient balance. Please fund your relay wallets.')
    }
    
    this.logger.info(`✅ ${balances.length - lowBalanceWallets.length}/${balances.length} wallets properly funded`)
  }
  
  async getBalances(connection: Connection): Promise<WalletBalance[]> {
    const balances: WalletBalance[] = []
    
    // Check all relay wallets
    for (const [index, keypair] of this.relayKeypairs.entries()) {
      try {
        const balance = await connection.getBalance(keypair.publicKey)
        const balanceSOL = balance / LAMPORTS_PER_SOL
        
        // Try to get USDC balance if available
        let balanceUSDC: number | undefined
        try {
          const usdcMint = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v') // USDC mainnet
          const ata = await getAssociatedTokenAddress(usdcMint, keypair.publicKey)
          const account = await getAccount(connection, ata)
          balanceUSDC = Number(account.amount) / 1_000_000 // USDC has 6 decimals
        } catch {
          // ATA doesn't exist or other error, that's okay
        }
        
        balances.push({
          publicKey: keypair.publicKey.toString(),
          balanceSOL,
          balanceUSDC,
          isActive: balanceSOL >= 0.001 // Consider active if has at least 0.001 SOL
        })
        
      } catch (error) {
        this.logger.warn(`Failed to get balance for wallet ${index + 1}: ${error}`)
        balances.push({
          publicKey: keypair.publicKey.toString(),
          balanceSOL: 0,
          isActive: false
        })
      }
    }
    
    return balances
  }
  
  getActiveWallets(): Keypair[] {
    // For now, return all wallets. In the future, could filter by balance
    return this.relayKeypairs
  }
}