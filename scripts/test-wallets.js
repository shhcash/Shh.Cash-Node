#!/usr/bin/env node

/**
 * Test Wallet Balances and Status
 * 
 * Checks all relay wallets for adequate funding and displays detailed balance information
 */

require('dotenv').config({ path: '.env.local' })
const { Connection, Keypair, LAMPORTS_PER_SOL, PublicKey } = require('@solana/web3.js')
const { getAssociatedTokenAddress, getAccount } = require('@solana/spl-token')

const USDC_MINT = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v') // Mainnet USDC

async function getUSDCBalance(connection, publicKey) {
  try {
    const ata = await getAssociatedTokenAddress(USDC_MINT, publicKey)
    const account = await getAccount(connection, ata)
    return Number(account.amount) / 1_000_000 // USDC has 6 decimals
  } catch {
    return 0 // ATA doesn't exist or other error
  }
}

async function checkWallet(connection, keypair, index) {
  const publicKey = keypair.publicKey
  
  try {
    // Get SOL balance
    const solBalance = await connection.getBalance(publicKey)
    const solAmount = solBalance / LAMPORTS_PER_SOL
    
    // Get USDC balance
    const usdcAmount = await getUSDCBalance(connection, publicKey)
    
    // Determine status
    let status = '✅ Ready'
    let issues = []
    
    if (solAmount < 0.01) {
      status = '❌ Low SOL'
      issues.push(`Need ${(0.01 - solAmount).toFixed(4)} more SOL`)
    } else if (solAmount < 0.05) {
      status = '⚠️  Low SOL'
      issues.push('Consider adding more SOL for gas fees')
    }
    
    // Check if this looks like devnet vs mainnet
    const isDevnet = process.env.RPC_URL?.includes('devnet')
    
    return {
      index,
      publicKey: publicKey.toString(),
      solBalance: solAmount,
      usdcBalance: usdcAmount,
      status,
      issues,
      isDevnet
    }
  } catch (error) {
    return {
      index,
      publicKey: publicKey.toString(),
      solBalance: 0,
      usdcBalance: 0,
      status: '❌ Error',
      issues: [error.message],
      isDevnet: false
    }
  }
}

async function main() {
  console.log('🏦 SHH Node Wallet Status')
  console.log('=========================')
  
  // Check environment
  if (!process.env.RELAY_SIGNERS) {
    console.log('❌ RELAY_SIGNERS not found in environment')
    console.log('   Run: npm run generate:keys')
    process.exit(1)
  }
  
  // Connect to Solana
  const connection = new Connection(process.env.RPC_URL || 'https://api.devnet.solana.com')
  const isDevnet = (process.env.RPC_URL || '').includes('devnet')
  
  try {
    const slot = await connection.getSlot()
    console.log(`🔗 Connected to Solana (slot: ${slot})`)
    console.log(`🌐 Network: ${isDevnet ? 'Devnet' : 'Mainnet'}`)
    console.log()
  } catch (error) {
    console.log(`❌ Failed to connect to RPC: ${error.message}`)
    process.exit(1)
  }
  
  // Load wallets
  const relaySecrets = JSON.parse(process.env.RELAY_SIGNERS)
  const wallets = []
  
  console.log('📊 Checking wallet balances...')
  console.log()
  
  // Check each wallet
  for (const [index, secret] of relaySecrets.entries()) {
    const secretKey = Buffer.from(secret, 'base64')
    const keypair = Keypair.fromSecretKey(secretKey)
    
    const walletInfo = await checkWallet(connection, keypair, index + 1)
    wallets.push(walletInfo)
    
    console.log(`🏦 Relay Wallet ${walletInfo.index}`)
    console.log(`   Address: ${walletInfo.publicKey}`)
    console.log(`   SOL Balance: ${walletInfo.solBalance.toFixed(6)} SOL`)
    console.log(`   USDC Balance: ${walletInfo.usdcBalance.toFixed(2)} USDC`)
    console.log(`   Status: ${walletInfo.status}`)
    
    if (walletInfo.issues.length > 0) {
      walletInfo.issues.forEach(issue => {
        console.log(`   ⚠️  ${issue}`)
      })
    }
    console.log()
  }
  
  // Summary
  const totalSOL = wallets.reduce((sum, w) => sum + w.solBalance, 0)
  const totalUSDC = wallets.reduce((sum, w) => sum + w.usdcBalance, 0)
  const readyWallets = wallets.filter(w => w.status === '✅ Ready').length
  const lowSOLWallets = wallets.filter(w => w.status.includes('Low SOL')).length
  const errorWallets = wallets.filter(w => w.status.includes('Error')).length
  
  console.log('📋 Summary')
  console.log('==========')
  console.log(`Total Wallets: ${wallets.length}`)
  console.log(`Ready: ${readyWallets}`)
  console.log(`Low SOL: ${lowSOLWallets}`)
  console.log(`Errors: ${errorWallets}`)
  console.log()
  console.log(`Total SOL: ${totalSOL.toFixed(6)}`)
  console.log(`Total USDC: ${totalUSDC.toFixed(2)}`)
  console.log()
  
  // Recommendations
  if (readyWallets === wallets.length) {
    console.log('✅ All wallets are ready for Phase 2!')
  } else {
    console.log('🔧 Funding recommendations:')
    
    if (isDevnet) {
      console.log('📍 For Devnet testing:')
      wallets.forEach(wallet => {
        if (wallet.solBalance < 0.01) {
          console.log(`   solana airdrop 2 ${wallet.publicKey} --url https://api.devnet.solana.com`)
        }
      })
    } else {
      console.log('📍 For Mainnet operation:')
      wallets.forEach(wallet => {
        if (wallet.solBalance < 0.01) {
          const needed = (0.05 - wallet.solBalance).toFixed(4)
          console.log(`   Send ${needed} SOL to ${wallet.publicKey}`)
        }
      })
    }
  }
  
  console.log()
  console.log('💡 Tips:')
  console.log('   • Minimum 0.01 SOL per wallet for gas fees')
  console.log('   • Recommended 0.05 SOL for USDC token account creation')
  console.log('   • USDC balances will be managed by the SHH system')
  console.log('   • Keep SOL topped up for reliable operation')
  
  process.exit(readyWallets === wallets.length ? 0 : 1)
}

if (require.main === module) {
  main().catch(error => {
    console.error('💥 Wallet check failed:', error)
    process.exit(1)
  })
}