import { Connection, Keypair, PublicKey } from '@solana/web3.js'
import { DispatcherClient } from '../api/DispatcherClient'
import { TransactionExecutor } from '../execution/TransactionExecutor'
import { WalletManager } from '../wallet/WalletManager'
import { Logger } from '../utils/Logger'
import { Metrics } from '../monitoring/Metrics'
import { HealthServer } from '../monitoring/HealthServer'
import { loadConfig } from '../utils/Config'
import { Offer, OfferAcceptance, ExecutionReceipt } from '../types'

export class ShhNode {
  private logger = new Logger('ShhNode')
  private config = loadConfig()
  
  private connection: Connection
  private dispatcher: DispatcherClient
  private executor: TransactionExecutor
  private walletManager: WalletManager
  private metrics: Metrics
  private healthServer: HealthServer
  
  private isRunning = false
  private activeOffers = new Map<string, Offer>()
  private heartbeatInterval?: NodeJS.Timeout
  
  constructor() {
    // Initialize Solana connection
    this.connection = new Connection(
      process.env.RPC_URL || 'https://api.devnet.solana.com',
      { commitment: process.env.RPC_COMMITMENT as any || 'confirmed' }
    )
    
    // Initialize wallet manager
    this.walletManager = new WalletManager()
    
    // Initialize dispatcher client
    this.dispatcher = new DispatcherClient(
      process.env.DISPATCHER_URL || 'https://dispatcher.dev.shh.cash',
      this.walletManager.nodeKeypair
    )
    
    // Initialize transaction executor
    this.executor = new TransactionExecutor(
      this.connection,
      this.walletManager,
      this.config
    )
    
    // Initialize monitoring
    this.metrics = new Metrics()
    this.healthServer = new HealthServer(this.getHealthStatus.bind(this))
  }
  
  async start(): Promise<void> {
    if (this.isRunning) {
      throw new Error('Node is already running')
    }
    
    this.logger.info('🔌 Connecting to Solana RPC...')
    await this.validateConnection()
    
    this.logger.info('🔑 Validating wallet balances...')
    await this.walletManager.validateBalances(this.connection)
    
    this.logger.info('📡 Connecting to dispatcher...')
    await this.dispatcher.connect()
    
    this.logger.info('📊 Starting monitoring servers...')
    await this.healthServer.start()
    
    this.logger.info('💓 Starting heartbeat...')
    this.startHeartbeat()
    
    this.logger.info('🎯 Subscribing to offers...')
    this.dispatcher.onOffer(this.handleOffer.bind(this))
    await this.dispatcher.subscribeToOffers()
    
    this.isRunning = true
    this.logger.info('✅ SHH Node started successfully')
  }
  
  async stop(): Promise<void> {
    if (!this.isRunning) return
    
    this.logger.info('🛑 Stopping SHH Node...')
    this.isRunning = false
    
    // Stop heartbeat
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
    }
    
    // Wait for active offers to complete
    if (this.activeOffers.size > 0) {
      this.logger.info(`⏳ Waiting for ${this.activeOffers.size} active offers to complete...`)
      // Give them 30 seconds to complete
      await this.waitForActiveOffers(30000)
    }
    
    // Disconnect from dispatcher
    await this.dispatcher.disconnect()
    
    // Stop monitoring
    await this.healthServer.stop()
    
    this.logger.info('✅ SHH Node stopped')
  }
  
  private async validateConnection(): Promise<void> {
    try {
      const slot = await this.connection.getSlot()
      this.logger.info(`📍 Connected to Solana (slot: ${slot})`)
    } catch (error) {
      throw new Error(`Failed to connect to Solana RPC: ${error}`)
    }
  }
  
  private startHeartbeat(): void {
    const interval = parseInt(process.env.HEARTBEAT_INTERVAL_MS || '30000')
    
    this.heartbeatInterval = setInterval(async () => {
      try {
        const status = await this.getHealthStatus()
        await this.dispatcher.sendHeartbeat({
          timestamp: Date.now(),
          status: status.status,
          balances: status.wallets,
          activeOffers: this.activeOffers.size,
          version: this.config.version
        })
        
        this.metrics.recordHeartbeat()
        this.logger.debug('💓 Heartbeat sent')
      } catch (error) {
        this.logger.warn('💔 Heartbeat failed:', error)
        this.metrics.recordHeartbeatError()
      }
    }, interval)
  }
  
  private async handleOffer(offer: Offer): Promise<void> {
    const startTime = Date.now()
    
    try {
      this.logger.info(`📩 Received offer ${offer.id} (${offer.asset} ${offer.amount})`)
      
      // Validate offer
      if (!this.validateOffer(offer)) {
        this.logger.warn(`❌ Invalid offer ${offer.id}, skipping`)
        return
      }
      
      // Accept the offer
      const acceptance: OfferAcceptance = {\n        offerId: offer.id,\n        nodeId: this.walletManager.nodeKeypair.publicKey.toString(),\n        timestamp: Date.now()\n      }\n      \n      const accepted = await this.dispatcher.acceptOffer(acceptance)\n      if (!accepted) {\n        this.logger.info(`⏭️  Offer ${offer.id} was claimed by another node`)\n        return\n      }\n      \n      this.activeOffers.set(offer.id, offer)\n      this.metrics.recordOfferAccepted()\n      \n      this.logger.info(`✅ Accepted offer ${offer.id}, executing...`)\n      \n      // Execute the transaction\n      const receipt = await this.executor.execute(offer)\n      \n      // Submit receipt to dispatcher\n      await this.dispatcher.submitReceipt(receipt)\n      \n      this.activeOffers.delete(offer.id)\n      this.metrics.recordOfferCompleted(Date.now() - startTime)\n      \n      this.logger.info(`🎉 Completed offer ${offer.id} (${receipt.txSignature})`)\n      \n    } catch (error) {\n      this.activeOffers.delete(offer.id)\n      this.metrics.recordOfferFailed()\n      this.logger.error(`💥 Failed to execute offer ${offer.id}:`, error)\n    }\n  }\n  \n  private validateOffer(offer: Offer): boolean {\n    // Check transaction limits\n    const maxPerTx = parseInt(process.env.MAX_PER_TX_LAMPORTS || '500000000')\n    if (offer.asset === 'SOL' && parseInt(offer.amount) > maxPerTx) {\n      this.logger.warn(`Offer ${offer.id} exceeds per-tx limit: ${offer.amount} > ${maxPerTx}`)\n      return false\n    }\n    \n    // Check if we have capacity\n    if (this.activeOffers.size >= this.config.node.maxConcurrent) {\n      this.logger.warn(`At capacity: ${this.activeOffers.size}/${this.config.node.maxConcurrent}`)\n      return false\n    }\n    \n    // Check if offer is still valid\n    if (offer.expiresAt && Date.now() > offer.expiresAt) {\n      this.logger.warn(`Offer ${offer.id} has expired`)\n      return false\n    }\n    \n    return true\n  }\n  \n  private async waitForActiveOffers(timeoutMs: number): Promise<void> {\n    const start = Date.now()\n    \n    while (this.activeOffers.size > 0 && (Date.now() - start) < timeoutMs) {\n      await new Promise(resolve => setTimeout(resolve, 1000))\n    }\n    \n    if (this.activeOffers.size > 0) {\n      this.logger.warn(`⚠️  ${this.activeOffers.size} offers still active after timeout`)\n    }\n  }\n  \n  private async getHealthStatus() {\n    const wallets = await this.walletManager.getBalances(this.connection)\n    \n    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy'\n    \n    // Check if any wallet is low on balance\n    const minBalance = 0.01 // 0.01 SOL minimum\n    const lowBalanceWallets = wallets.filter(w => w.balanceSOL < minBalance)\n    \n    if (lowBalanceWallets.length > 0) {\n      status = 'degraded'\n      if (lowBalanceWallets.length === wallets.length) {\n        status = 'unhealthy'\n      }\n    }\n    \n    return {\n      status,\n      uptime: process.uptime(),\n      wallets,\n      activeOffers: this.activeOffers.size,\n      metrics: this.metrics.getSnapshot()\n    }\n  }\n}"