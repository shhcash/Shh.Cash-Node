import { 
  Connection, 
  Keypair, 
  PublicKey, 
  SystemProgram, 
  Transaction,
  sendAndConfirmTransaction,
  LAMPORTS_PER_SOL
} from '@solana/web3.js'
import {
  createTransferInstruction,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  getAccount
} from '@solana/spl-token'
import { Offer, ExecutionReceipt, NodeConfig } from '../types'
import { WalletManager } from '../wallet/WalletManager'
import { Logger } from '../utils/Logger'

export class TransactionExecutor {
  private logger = new Logger('TransactionExecutor')
  private connection: Connection
  private walletManager: WalletManager
  private config: NodeConfig
  
  // USDC mint address (mainnet)
  private readonly USDC_MINT = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v')
  
  constructor(connection: Connection, walletManager: WalletManager, config: NodeConfig) {
    this.connection = connection
    this.walletManager = walletManager
    this.config = config
  }
  
  async execute(offer: Offer): Promise<ExecutionReceipt> {
    const startTime = Date.now()
    
    try {
      this.logger.info(`🚀 Executing offer ${offer.id} (${offer.asset} ${offer.amount})`)
      
      // Get a relay wallet to execute from
      const fromWallet = this.walletManager.getNextRelayWallet()
      const recipient = new PublicKey(offer.recipient)
      
      let transaction: Transaction
      let spentLamports = 0
      
      if (offer.asset === 'SOL') {
        transaction = await this.createSOLTransfer(fromWallet, recipient, offer.amount)
        spentLamports = parseInt(offer.amount)
      } else if (offer.asset === 'USDC') {
        const result = await this.createUSDCTransfer(fromWallet, recipient, offer.amount)
        transaction = result.transaction
        spentLamports = result.feesPaid
      } else {
        throw new Error(`Unsupported asset: ${offer.asset}`)
      }
      
      // Send and confirm transaction
      const signature = await sendAndConfirmTransaction(
        this.connection,
        transaction,
        [fromWallet],
        {
          commitment: 'confirmed',
          maxRetries: this.config.node.retry.max
        }
      )
      
      const executionTime = Date.now() - startTime
      this.logger.info(`✅ Executed ${offer.id} in ${executionTime}ms (${signature})`)
      
      return {
        partId: offer.partId,
        txSignature: signature,
        spentLamports,
        feePaid: offer.feeLamports,
        timestamp: Date.now(),
        success: true
      }
      
    } catch (error) {
      const executionTime = Date.now() - startTime
      this.logger.error(`❌ Failed to execute ${offer.id} after ${executionTime}ms:`, error)
      
      return {
        partId: offer.partId,
        txSignature: '',
        spentLamports: 0,
        feePaid: 0,
        timestamp: Date.now(),
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }
  
  private async createSOLTransfer(
    fromWallet: Keypair, 
    recipient: PublicKey, 
    amount: string
  ): Promise<Transaction> {
    const lamports = parseInt(amount)
    
    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: fromWallet.publicKey,
        toPubkey: recipient,
        lamports
      })
    )
    
    // Get recent blockhash
    const { blockhash } = await this.connection.getLatestBlockhash()
    transaction.recentBlockhash = blockhash
    transaction.feePayer = fromWallet.publicKey
    
    return transaction
  }
  
  private async createUSDCTransfer(
    fromWallet: Keypair,
    recipient: PublicKey,
    amount: string
  ): Promise<{ transaction: Transaction; feesPaid: number }> {
    const usdcAmount = parseInt(amount) // Amount in smallest units (6 decimals for USDC)
    
    // Get associated token addresses
    const fromATA = await getAssociatedTokenAddress(this.USDC_MINT, fromWallet.publicKey)
    const toATA = await getAssociatedTokenAddress(this.USDC_MINT, recipient)
    
    const transaction = new Transaction()
    let feesPaid = 0
    
    // Check if recipient ATA exists, create if not
    try {
      await getAccount(this.connection, toATA)
    } catch (error) {
      // ATA doesn't exist, need to create it
      this.logger.info(`Creating USDC ATA for recipient: ${toATA.toString()}`)
      transaction.add(
        createAssociatedTokenAccountInstruction(
          fromWallet.publicKey, // payer
          toATA, // ata
          recipient, // owner
          this.USDC_MINT // mint
        )
      )
      
      // Estimate fee for ATA creation (roughly 0.002 SOL)
      feesPaid += 0.002 * LAMPORTS_PER_SOL
    }
    
    // Add the USDC transfer instruction
    transaction.add(
      createTransferInstruction(
        fromATA, // source
        toATA, // destination
        fromWallet.publicKey, // owner
        usdcAmount // amount
      )
    )
    
    // Get recent blockhash
    const { blockhash } = await this.connection.getLatestBlockhash()
    transaction.recentBlockhash = blockhash
    transaction.feePayer = fromWallet.publicKey
    
    return { transaction, feesPaid }
  }
}