#!/usr/bin/env node

/**
 * SHH Node - Privacy Relay Node for SHH.cash Network
 * 
 * Connects to the SHH dispatcher to receive and execute privacy transfer parts.
 * Earns SOL fees for successful transaction execution.
 * 
 * Pre-Contract Phase: Off-chain coordination with SOL payouts
 * Post-Contract Phase: On-chain execution with immediate SOL rewards
 */

import { config } from 'dotenv'
import { ShhNode } from './node/ShhNode'
import { Logger } from './utils/Logger'
import { validateEnvironment } from './utils/Environment'

// Load environment variables
config({ path: '.env.local' })

const logger = new Logger('main')

async function main() {
  try {
    logger.info('🚀 Starting SHH Privacy Relay Node...')
    logger.info('=====================================')
    
    // Validate environment configuration
    const validation = validateEnvironment()
    if (!validation.valid) {
      logger.error('❌ Environment validation failed:')
      validation.errors.forEach(error => logger.error(`  - ${error}`))
      process.exit(1)
    }
    
    logger.info('✅ Environment validation passed')
    
    // Initialize and start the node
    const node = new ShhNode()
    
    // Handle graceful shutdown
    const shutdown = async (signal: string) => {
      logger.info(`📤 Received ${signal}, shutting down gracefully...`)
      await node.stop()
      logger.info('👋 SHH Node stopped')
      process.exit(0)
    }
    
    process.on('SIGINT', () => shutdown('SIGINT'))
    process.on('SIGTERM', () => shutdown('SIGTERM'))
    process.on('uncaughtException', (error) => {
      logger.error('💥 Uncaught exception:', error)
      shutdown('uncaughtException')
    })
    process.on('unhandledRejection', (reason) => {
      logger.error('💥 Unhandled rejection:', reason)
      shutdown('unhandledRejection')
    })
    
    // Start the node
    await node.start()
    
    logger.info('🎯 SHH Node is running and accepting offers!')
    logger.info('📊 Monitor status at: http://localhost:8080/health')
    logger.info('📈 Metrics available at: http://localhost:9090/metrics')
    
  } catch (error) {
    logger.error('💥 Failed to start SHH Node:', error)
    process.exit(1)
  }
}

// Start the node
main().catch((error) => {
  console.error('💥 Fatal error:', error)
  process.exit(1)
})