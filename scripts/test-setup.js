#!/usr/bin/env node

/**
 * Test Node Setup and Configuration
 * 
 * Validates that the node is properly configured for Phase 2 operation
 */

require('dotenv').config({ path: '.env.local' })
const { Connection, Keypair, LAMPORTS_PER_SOL } = require('@solana/web3.js')

async function testRPCConnection() {
  console.log('🔌 Testing RPC Connection...')
  
  try {
    const connection = new Connection(process.env.RPC_URL || 'https://api.devnet.solana.com')
    const slot = await connection.getSlot()
    const blockHeight = await connection.getBlockHeight()
    
    console.log(`   ✅ Connected to Solana`)
    console.log(`   📍 Current slot: ${slot}`)
    console.log(`   📏 Block height: ${blockHeight}`)
    console.log(`   🌐 RPC URL: ${process.env.RPC_URL}`)
    
    return { success: true, connection }
  } catch (error) {
    console.log(`   ❌ RPC connection failed: ${error.message}`)
    return { success: false }
  }
}

async function testNodeSigner() {
  console.log('🔑 Testing Node Signer...')
  
  try {
    if (!process.env.NODE_SIGNER_SECRET) {
      throw new Error('NODE_SIGNER_SECRET not found in environment')
    }
    
    const secretKey = Buffer.from(process.env.NODE_SIGNER_SECRET, 'base64')
    const keypair = Keypair.fromSecretKey(secretKey)
    
    console.log(`   ✅ Node signer loaded`)
    console.log(`   🔑 Public key: ${keypair.publicKey.toString()}`)
    
    return { success: true, keypair }
  } catch (error) {
    console.log(`   ❌ Node signer failed: ${error.message}`)
    return { success: false }
  }
}

async function testRelayWallets(connection) {
  console.log('🏦 Testing Relay Wallets...')
  
  try {
    if (!process.env.RELAY_SIGNERS) {
      throw new Error('RELAY_SIGNERS not found in environment')
    }
    
    const relaySecrets = JSON.parse(process.env.RELAY_SIGNERS)
    const wallets = []
    let totalBalance = 0
    let fundedWallets = 0
    
    for (const [index, secret] of relaySecrets.entries()) {
      const secretKey = Buffer.from(secret, 'base64')
      const keypair = Keypair.fromSecretKey(secretKey)
      
      let balance = 0
      let status = '❌ No connection'
      
      if (connection) {
        try {
          const balanceLamports = await connection.getBalance(keypair.publicKey)
          balance = balanceLamports / LAMPORTS_PER_SOL
          totalBalance += balance
          
          if (balance >= 0.01) {
            status = '✅ Funded'
            fundedWallets++
          } else if (balance > 0) {
            status = '⚠️  Low balance'
          } else {
            status = '❌ No balance'
          }
        } catch (error) {
          status = `❌ Error: ${error.message}`
        }
      }
      
      wallets.push({ index: index + 1, publicKey: keypair.publicKey.toString(), balance, status })
      
      console.log(`   Relay ${index + 1}: ${keypair.publicKey.toString()}`)
      console.log(`     Balance: ${balance.toFixed(4)} SOL`)
      console.log(`     Status: ${status}`)
    }
    
    console.log(`   📊 Summary: ${fundedWallets}/${wallets.length} wallets funded`)
    console.log(`   💰 Total balance: ${totalBalance.toFixed(4)} SOL`)
    
    if (fundedWallets === 0) {
      console.log(`   ⚠️  No wallets are funded! Fund them with:`)
      wallets.forEach(wallet => {
        console.log(`      solana airdrop 2 ${wallet.publicKey} --url ${process.env.RPC_URL}`)
      })
    }
    
    return { success: wallets.length > 0, wallets, fundedWallets }
  } catch (error) {
    console.log(`   ❌ Relay wallets failed: ${error.message}`)
    return { success: false }
  }
}

async function testConfiguration() {
  console.log('⚙️  Testing Configuration...')
  
  const checks = [
    { name: 'RPC_URL', value: process.env.RPC_URL, required: true },
    { name: 'NODE_SIGNER_SECRET', value: process.env.NODE_SIGNER_SECRET ? '***' : undefined, required: true },
    { name: 'RELAY_SIGNERS', value: process.env.RELAY_SIGNERS ? `[${JSON.parse(process.env.RELAY_SIGNERS).length} wallets]` : undefined, required: true },
    { name: 'DISPATCHER_URL', value: process.env.DISPATCHER_URL, required: false },
    { name: 'FEE_PAYER_MODE', value: process.env.FEE_PAYER_MODE, required: false },
    { name: 'HEALTH_PORT', value: process.env.HEALTH_PORT, required: false },
  ]
  
  let allValid = true
  
  for (const check of checks) {
    const status = check.value ? '✅' : (check.required ? '❌' : '⚠️ ')
    const displayValue = check.value || 'Not set'
    
    console.log(`   ${status} ${check.name}: ${displayValue}`)
    
    if (check.required && !check.value) {
      allValid = false
    }
  }
  
  return { success: allValid }
}

async function testDispatcher() {
  console.log('📡 Testing Dispatcher Connection...')
  
  try {
    const dispatcherUrl = process.env.DISPATCHER_URL || 'https://dispatcher.dev.shh.cash'
    
    // For Phase 1, dispatcher doesn't exist yet
    console.log(`   🔗 Dispatcher URL: ${dispatcherUrl}`)
    console.log(`   ⏳ Phase 1: Dispatcher not active yet`)
    console.log(`   🚀 Phase 2: Will connect to live dispatcher`)
    
    return { success: true, phase1: true }
  } catch (error) {
    console.log(`   ❌ Dispatcher test failed: ${error.message}`)
    return { success: false }
  }
}

async function main() {
  console.log('🧪 SHH Node Setup Test')
  console.log('======================')
  console.log('⚠️  Phase 1: Testing preparation setup only')
  console.log('🚀 Phase 2: Will test live node operation')
  console.log()
  
  const results = {}
  
  // Test RPC connection
  const rpcResult = await testRPCConnection()
  results.rpc = rpcResult.success
  console.log()
  
  // Test node signer
  const signerResult = await testNodeSigner()
  results.signer = signerResult.success
  console.log()
  
  // Test relay wallets
  const walletResult = await testRelayWallets(rpcResult.connection)
  results.wallets = walletResult.success
  results.fundedWallets = walletResult.fundedWallets || 0
  console.log()
  
  // Test configuration
  const configResult = await testConfiguration()
  results.config = configResult.success
  console.log()
  
  // Test dispatcher
  const dispatcherResult = await testDispatcher()
  results.dispatcher = dispatcherResult.success
  console.log()
  
  // Overall result
  console.log('📋 Test Summary')
  console.log('===============')
  
  const overallSuccess = results.rpc && results.signer && results.wallets && results.config
  
  if (overallSuccess) {
    console.log('✅ Node setup is valid for Phase 2!')
    console.log()
    console.log('🎯 Ready for Phase 2 features:')
    console.log('   • Connecting to live dispatcher')
    console.log('   • Receiving real privacy transfer offers')
    console.log('   • Executing transactions and earning SOL')
    console.log()
    
    if (results.fundedWallets > 0) {
      console.log('💰 Wallet funding status: READY')
    } else {
      console.log('⚠️  Wallet funding status: NEEDS FUNDING')
      console.log('   Fund wallets with: npm run fund:devnet')
    }
  } else {
    console.log('❌ Node setup has issues that need to be fixed')
    console.log()
    console.log('🔧 Fix the issues above and run this test again')
  }
  
  console.log()
  console.log('📚 Next steps:')
  console.log('   • npm run test:wallets - Check wallet balances')
  console.log('   • npm run dev:mock - Start mock node simulation')
  console.log('   • npm run build - Build for production')
  
  process.exit(overallSuccess ? 0 : 1)
}

if (require.main === module) {
  main().catch(error => {
    console.error('💥 Test failed:', error)
    process.exit(1)
  })
}