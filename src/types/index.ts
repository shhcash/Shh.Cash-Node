export interface Offer {
  id: string
  partId: string
  asset: 'SOL' | 'USDC'
  amount: string
  recipient: string
  feeLamports: number
  expiresAt?: number
  metadata?: {
    requestId: string
    partIndex: number
    totalParts: number
  }
}

export interface OfferAcceptance {
  offerId: string
  nodeId: string
  timestamp: number
}

export interface ExecutionReceipt {
  partId: string
  txSignature: string
  spentLamports: number
  feePaid: number
  timestamp: number
  success: boolean
  error?: string
}

export interface HeartbeatData {
  timestamp: number
  status: 'healthy' | 'degraded' | 'unhealthy'
  balances: WalletBalance[]
  activeOffers: number
  version: string
}

export interface WalletBalance {
  publicKey: string
  balanceSOL: number
  balanceUSDC?: number
  isActive: boolean
}

export interface NodeConfig {
  version: string
  node: {
    maxConcurrent: number
    timeout: {
      heartbeatMs: number
      offerTimeoutMs: number
      txConfirmTimeoutMs: number
    }
    retry: {
      max: number
      backoffMs: number
      maxBackoffMs: number
    }
  }
  limits: {
    perTxLamports: number
    perDayLamports: number
    maxPartsPerHour: number
  }
  rotation: {
    strategy: 'round_robin' | 'least_used' | 'random'
    rebalanceThreshold: number
    minBalanceSOL: number
  }
  privacy: {
    avoidPercents: number[]
    delayJitterSec: [number, number]
    rotateOnLowBalance: boolean
    randomizeOrder: boolean
  }
  monitoring: {
    enableMetrics: boolean
    metricsPort: number
    healthCheckPort: number
    logRotation: {
      enabled: boolean
      maxSizeMB: number
      maxFiles: number
    }
  }
  security: {
    requireTLS: boolean
    allowedOrigins: string[]
    rateLimits: {
      requestsPerMinute: number
      offersPerMinute: number
    }
  }
}

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy'
  uptime: number
  wallets: WalletBalance[]
  activeOffers: number
  metrics: MetricsSnapshot
}

export interface MetricsSnapshot {
  offersReceived: number
  offersAccepted: number
  offersCompleted: number
  offersFailed: number
  avgExecutionTime: number
  totalEarnings: number
  uptime: number
}

export interface ValidationResult {
  valid: boolean
  errors: string[]
  warnings?: string[]
}