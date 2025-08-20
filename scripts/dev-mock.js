#!/usr/bin/env node

/**
 * Mock Node Development Server
 * 
 * Simulates node operation for Phase 1 testing
 * Shows what the node will do in Phase 2 without actual execution
 */

require('dotenv').config({ path: '.env.local' })
const { Connection, Keypair } = require('@solana/web3.js')

class MockShhNode {
  constructor() {
    this.isRunning = false
    this.startTime = Date.now()
    this.stats = {
      offersReceived: 0,
      offersAccepted: 0,
      offersCompleted: 0,
      offersFailed: 0,
      totalEarnings: 0
    }
  }
  
  async start() {
    console.log('🚀 Starting SHH Mock Node...')
    console.log('============================')
    console.log('⚠️  Phase 1: Simulation only - no real transactions')
    console.log('🚀 Phase 2: Will execute real privacy transfers')
    console.log()
    
    // Validate environment
    await this.validateSetup()
    
    // Start mock services
    this.startMockServices()
    
    // Start offer simulation
    this.startOfferSimulation()
    
    this.isRunning = true
    console.log('✅ Mock node is running!')
    console.log('📊 Monitor at: http://localhost:8080/health')
    console.log('🛑 Press Ctrl+C to stop')
    console.log()
  }
  
  async validateSetup() {
    console.log('🔍 Validating setup...')
    
    // Check environment
    if (!process.env.NODE_SIGNER_SECRET || !process.env.RELAY_SIGNERS) {
      throw new Error('Missing required environment variables. Run: npm run generate:keys')
    }
    
    // Test RPC connection
    const connection = new Connection(process.env.RPC_URL || 'https://api.devnet.solana.com')
    try {
      await connection.getSlot()
      console.log('   ✅ RPC connection working')
    } catch (error) {
      throw new Error(`RPC connection failed: ${error.message}`)
    }
    
    // Load wallets
    const relaySecrets = JSON.parse(process.env.RELAY_SIGNERS)
    console.log(`   ✅ ${relaySecrets.length} relay wallets loaded`)
    
    const nodeSecret = Buffer.from(process.env.NODE_SIGNER_SECRET, 'base64')
    const nodeKeypair = Keypair.fromSecretKey(nodeSecret)
    console.log(`   ✅ Node signer: ${nodeKeypair.publicKey.toString()}`)
    
    console.log('   ✅ Setup validation passed')
    console.log()
  }
  
  startMockServices() {
    console.log('🏥 Starting mock health server on port 8080...')
    
    const http = require('http')
    const server = http.createServer((req, res) => {
      res.setHeader('Access-Control-Allow-Origin', '*')
      res.setHeader('Content-Type', 'application/json')
      
      if (req.url === '/health' || req.url === '/') {
        const uptime = Date.now() - this.startTime
        const status = {
          status: 'healthy',
          phase: 'Phase 1 - Mock Mode',
          uptime: Math.floor(uptime / 1000),
          stats: this.stats,
          message: 'Node is ready for Phase 2 operation',
          timestamp: new Date().toISOString()
        }
        res.writeHead(200)
        res.end(JSON.stringify(status, null, 2))
      } else {
        res.writeHead(404)
        res.end(JSON.stringify({ error: 'Not found', available: ['/health'] }))
      }
    })
    
    server.listen(8080, () => {
      console.log('   ✅ Health server ready at http://localhost:8080/health')
    })
  }
  
  startOfferSimulation() {
    console.log('🎯 Starting offer simulation...')
    console.log('   📡 Simulating dispatcher connection')
    console.log('   🔄 Will simulate offers every 30-60 seconds')
    console.log()
    
    // Simulate offers periodically
    const simulateOffer = () => {
      if (!this.isRunning) return
      
      // Random delay between 30-60 seconds
      const delay = 30000 + Math.random() * 30000
      
      setTimeout(() => {
        this.handleMockOffer()
        simulateOffer() // Schedule next offer
      }, delay)
    }
    
    // Start first offer after 10 seconds
    setTimeout(simulateOffer, 10000)
  }
  
  handleMockOffer() {
    const offerId = Math.random().toString(36).substr(2, 9)
    const assets = ['SOL', 'USDC']
    const asset = assets[Math.floor(Math.random() * assets.length)]
    const amount = asset === 'SOL' 
      ? (Math.random() * 0.1 + 0.01).toFixed(6) // 0.01-0.11 SOL
      : (Math.random() * 100 + 10).toFixed(2)   // 10-110 USDC
    
    this.stats.offersReceived++
    
    console.log(`📩 Mock Offer Received: ${offerId}`)
    console.log(`   Asset: ${asset}`)
    console.log(`   Amount: ${amount}`)
    console.log(`   Action: Simulating acceptance and execution...`)
    
    // Simulate processing time
    setTimeout(() => {
      const success = Math.random() > 0.1 // 90% success rate
      
      if (success) {
        this.stats.offersAccepted++
        this.stats.offersCompleted++
        
        const earnedSOL = Math.random() * 0.001 + 0.0005 // 0.0005-0.0015 SOL fee
        this.stats.totalEarnings += earnedSOL
        
        console.log(`   ✅ Mock execution successful`)
        console.log(`   💰 Simulated earnings: ${earnedSOL.toFixed(6)} SOL`)
      } else {
        this.stats.offersFailed++
        console.log(`   ❌ Mock execution failed (simulation)`)
      }
      
      console.log(`   📊 Stats: ${this.stats.offersCompleted} completed, ${this.stats.offersFailed} failed`)
      console.log()
    }, 2000 + Math.random() * 3000) // 2-5 second processing time
  }
  
  stop() {
    this.isRunning = false
    console.log()
    console.log('🛑 Stopping mock node...')
    console.log('📊 Final Stats:')
    console.log(`   Offers received: ${this.stats.offersReceived}`)
    console.log(`   Offers completed: ${this.stats.offersCompleted}`)
    console.log(`   Offers failed: ${this.stats.offersFailed}`)
    console.log(`   Total earnings (simulated): ${this.stats.totalEarnings.toFixed(6)} SOL`)
    console.log()
    console.log('👋 Mock node stopped')
    process.exit(0)
  }
}

async function main() {
  const node = new MockShhNode()
  
  // Handle graceful shutdown
  process.on('SIGINT', () => node.stop())
  process.on('SIGTERM', () => node.stop())
  
  try {
    await node.start()
    
    // Keep the process running
    setInterval(() => {
      // Show periodic status
      const uptime = Date.now() - node.startTime
      const uptimeMinutes = Math.floor(uptime / 60000)
      
      if (uptimeMinutes > 0 && uptimeMinutes % 5 === 0) {
        console.log(`⏱️  Uptime: ${uptimeMinutes} minutes | Offers: ${node.stats.offersReceived} received, ${node.stats.offersCompleted} completed`)
      }
    }, 60000) // Check every minute
    
  } catch (error) {
    console.error('💥 Mock node failed to start:', error.message)
    console.log()
    console.log('🔧 Fix the issues and try again:')
    console.log('   • npm run generate:keys - Generate new keys')
    console.log('   • npm run test:setup - Validate configuration')
    process.exit(1)
  }
}

if (require.main === module) {
  main()
}