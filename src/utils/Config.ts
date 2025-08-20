import { readFileSync } from 'fs'
import { join } from 'path'
import { NodeConfig } from '../types'

let cachedConfig: NodeConfig | null = null

export function loadConfig(): NodeConfig {
  if (cachedConfig) {
    return cachedConfig
  }

  try {
    const configPath = join(process.cwd(), 'config.json')
    const configFile = readFileSync(configPath, 'utf-8')
    cachedConfig = JSON.parse(configFile) as NodeConfig
    return cachedConfig
  } catch (error) {
    throw new Error(`Failed to load config.json: ${error}`)
  }
}

export function validateConfig(config: NodeConfig): string[] {
  const errors: string[] = []

  if (!config.version) {
    errors.push('Config version is required')
  }

  if (!config.node?.maxConcurrent || config.node.maxConcurrent < 1) {
    errors.push('node.maxConcurrent must be >= 1')
  }

  if (!config.limits?.perTxLamports || config.limits.perTxLamports < 1000) {
    errors.push('limits.perTxLamports must be >= 1000')
  }

  if (!config.rotation?.minBalanceSOL || config.rotation.minBalanceSOL < 0.001) {
    errors.push('rotation.minBalanceSOL must be >= 0.001')
  }

  if (!Array.isArray(config.privacy?.avoidPercents)) {
    errors.push('privacy.avoidPercents must be an array')
  }

  return errors
}