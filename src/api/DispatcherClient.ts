import { Keypair } from '@solana/web3.js'
import { sign } from 'tweetnacl'
import { Offer, OfferAcceptance, ExecutionReceipt, HeartbeatData } from '../types'
import { Logger } from '../utils/Logger'

export class DispatcherClient {
  private logger = new Logger('DispatcherClient')
  private baseUrl: string
  private nodeKeypair: Keypair
  private offerCallback?: (offer: Offer) => void
  
  constructor(baseUrl: string, nodeKeypair: Keypair) {
    this.baseUrl = baseUrl.replace(/\/$/, '') // Remove trailing slash
    this.nodeKeypair = nodeKeypair
  }
  
  async connect(): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/api/node/ping`, {
        method: 'GET',
        headers: this.getAuthHeaders('GET', '/api/node/ping', '')
      })
      
      if (!response.ok) {
        throw new Error(`Dispatcher ping failed: ${response.statusText}`)
      }
      
      this.logger.info(`📡 Connected to dispatcher: ${this.baseUrl}`)
    } catch (error) {
      throw new Error(`Failed to connect to dispatcher: ${error}`)
    }
  }
  
  async disconnect(): Promise<void> {
    this.logger.info('📡 Disconnected from dispatcher')
  }
  
  onOffer(callback: (offer: Offer) => void): void {
    this.offerCallback = callback
  }
  
  async subscribeToOffers(): Promise<void> {
    // For MVP, we'll poll for offers instead of using WebSocket/SSE
    // In Phase 2, this would be a real-time subscription
    this.logger.info('🎯 Starting offer polling...')
    this.pollOffers()
  }
  
  private async pollOffers(): Promise<void> {
    const pollInterval = parseInt(process.env.OFFER_POLL_INTERVAL_MS || '5000')
    
    const poll = async () => {
      try {
        // This endpoint doesn't exist yet - it's for Phase 2
        // For now, just log that we're polling
        this.logger.debug('🔍 Polling for offers...')
        
        // In Phase 2, this would be:
        // const offers = await this.getOffers()
        // offers.forEach(offer => this.offerCallback?.(offer))
        
      } catch (error) {
        this.logger.warn('Failed to poll offers:', error)
      }
      
      // Schedule next poll
      setTimeout(poll, pollInterval)
    }
    
    // Start polling
    setTimeout(poll, pollInterval)
  }
  
  async getOffers(): Promise<Offer[]> {
    const response = await fetch(`${this.baseUrl}/api/node/offers`, {
      method: 'GET',
      headers: this.getAuthHeaders('GET', '/api/node/offers', '')
    })
    
    if (!response.ok) {
      throw new Error(`Failed to get offers: ${response.statusText}`)
    }
    
    const data = await response.json()
    return data.offers || []
  }
  
  async acceptOffer(acceptance: OfferAcceptance): Promise<boolean> {
    const body = JSON.stringify(acceptance)
    
    const response = await fetch(`${this.baseUrl}/api/node/accept`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.getAuthHeaders('POST', '/api/node/accept', body)
      },
      body
    })
    
    if (response.status === 409) {
      // Offer was already accepted by another node
      return false
    }
    
    if (!response.ok) {
      throw new Error(`Failed to accept offer: ${response.statusText}`)
    }
    
    return true
  }
  
  async submitReceipt(receipt: ExecutionReceipt): Promise<void> {
    const body = JSON.stringify(receipt)
    
    const response = await fetch(`${this.baseUrl}/api/node/receipt`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.getAuthHeaders('POST', '/api/node/receipt', body)
      },
      body
    })
    
    if (!response.ok) {
      throw new Error(`Failed to submit receipt: ${response.statusText}`)
    }
  }
  
  async sendHeartbeat(heartbeat: HeartbeatData): Promise<void> {
    const body = JSON.stringify(heartbeat)
    
    const response = await fetch(`${this.baseUrl}/api/node/heartbeat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.getAuthHeaders('POST', '/api/node/heartbeat', body)
      },
      body
    })
    
    if (!response.ok) {
      this.logger.warn(`Heartbeat failed: ${response.statusText}`)
    }
  }
  
  private getAuthHeaders(method: string, path: string, body: string): Record<string, string> {
    const timestamp = Date.now()
    const message = `${timestamp}${method}${path}${body}`
    const messageBytes = new TextEncoder().encode(message)
    
    const signature = sign.detached(messageBytes, this.nodeKeypair.secretKey)
    const signatureBase64 = Buffer.from(signature).toString('base64')
    
    return {
      'X-Node-Pubkey': this.nodeKeypair.publicKey.toString(),
      'X-Signature': signatureBase64,
      'X-Timestamp': timestamp.toString()
    }
  }
}