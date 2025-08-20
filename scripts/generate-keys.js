#!/usr/bin/env node

/**
 * Generate Node and Relay Wallet Keypairs for SHH Node
 * 
 * Phase 1: Generates keys for testing and preparation
 * Phase 2: These keys will be used for actual node operation
 */

const { Keypair } = require('@solana/web3.js')
const fs = require('fs')
const path = require('path')

function generateKeypair() {
  const keypair = Keypair.generate()
  return {
    publicKey: keypair.publicKey.toString(),
    secretKey: Buffer.from(keypair.secretKey).toString('base64')
  }
}

function main() {
  console.log('🔑 Generating SHH Node Keypairs...')
  console.log('=====================================')
  
  // Generate node signer keypair
  const nodeSigner = generateKeypair()
  console.log('📝 Node Signer Generated:')
  console.log(`   Public Key:  ${nodeSigner.publicKey}`)
  console.log(`   Secret Key:  ${nodeSigner.secretKey}`)
  console.log()
  
  // Generate relay wallets (multiple for privacy)
  const numRelayWallets = parseInt(process.argv[2]) || 3
  const relayWallets = []
  
  console.log(`🏦 Generating ${numRelayWallets} Relay Wallets:`)
  
  for (let i = 1; i <= numRelayWallets; i++) {
    const relay = generateKeypair()
    relayWallets.push(relay.secretKey)
    
    console.log(`   Relay ${i}:`)
    console.log(`     Public Key:  ${relay.publicKey}`)
    console.log(`     Secret Key:  ${relay.secretKey}`)
    console.log()
  }
  
  // Generate .env template
  const envTemplate = `# SHH Node Configuration
# Generated on ${new Date().toISOString()}

# Solana RPC Configuration
RPC_URL=https://api.devnet.solana.com
RPC_COMMITMENT=confirmed

# Node Authentication
NODE_SIGNER_SECRET=${nodeSigner.secretKey}

# Relay Wallets (JSON array of base64 secret keys)
RELAY_SIGNERS=${JSON.stringify(relayWallets)}

# Dispatcher Configuration (Phase 2)
DISPATCHER_URL=https://dispatcher.dev.shh.cash
HEARTBEAT_INTERVAL_MS=30000
OFFER_POLL_INTERVAL_MS=5000

# Fee Configuration
FEE_PAYER_MODE=sponsored
# FEE_PAYER_SECRET=your_fee_payer_secret_here

# Monitoring
HEALTH_PORT=8080
METRICS_PORT=9090
LOG_LEVEL=info

# Limits
MAX_PER_TX_LAMPORTS=500000000
MAX_PER_DAY_LAMPORTS=5000000000

# Environment
NODE_ENV=development`

  // Write to .env.local
  const envPath = path.join(process.cwd(), '.env.local')
  fs.writeFileSync(envPath, envTemplate)
  
  console.log('✅ Keys generated successfully!')
  console.log()
  console.log('📁 Configuration saved to .env.local')
  console.log()
  console.log('⚠️  IMPORTANT SECURITY NOTES:')
  console.log('   • Never commit .env.local to version control')
  console.log('   • Keep your secret keys secure and backed up')
  console.log('   • These are for TESTING ONLY until Phase 2 launches')
  console.log()
  console.log('🚀 Next steps:')
  console.log('   1. Fund your relay wallets with test SOL:')
  relayWallets.forEach((_, i) => {
    const keypair = Keypair.fromSecretKey(Buffer.from(relayWallets[i], 'base64'))
    console.log(`      solana airdrop 2 ${keypair.publicKey.toString()} --url https://api.devnet.solana.com`)
  })
  console.log('   2. Run: npm run test:setup')
  console.log('   3. Run: npm run dev:mock')
}

if (require.main === module) {
  main()
}