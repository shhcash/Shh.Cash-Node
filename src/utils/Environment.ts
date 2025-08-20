import { ValidationResult } from '../types'

export function validateEnvironment(): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  // Required environment variables
  const required = [
    'RPC_URL',
    'NODE_SIGNER_SECRET',
    'RELAY_SIGNERS'
  ]

  for (const envVar of required) {
    if (!process.env[envVar]) {
      errors.push(`Missing required environment variable: ${envVar}`)
    }
  }

  // Validate RPC URL format
  if (process.env.RPC_URL && !isValidUrl(process.env.RPC_URL)) {
    errors.push('RPC_URL must be a valid URL')
  }

  // Validate dispatcher URL
  if (process.env.DISPATCHER_URL && !isValidUrl(process.env.DISPATCHER_URL)) {
    errors.push('DISPATCHER_URL must be a valid URL')
  }

  // Check for development vs production settings
  if (process.env.NODE_ENV === 'production') {
    if (process.env.RPC_URL?.includes('devnet')) {
      warnings.push('Using devnet RPC in production environment')
    }
    
    if (!process.env.DISPATCHER_URL?.includes('https://')) {
      warnings.push('Dispatcher URL should use HTTPS in production')
    }
  }

  // Validate relay signers format
  if (process.env.RELAY_SIGNERS) {
    try {
      const signers = JSON.parse(process.env.RELAY_SIGNERS)
      if (!Array.isArray(signers) || signers.length === 0) {
        errors.push('RELAY_SIGNERS must be a non-empty JSON array')
      }
    } catch {
      errors.push('RELAY_SIGNERS must be valid JSON')
    }
  }

  // Check fee payer mode
  if (process.env.FEE_PAYER_MODE === 'self' && !process.env.FEE_PAYER_SECRET) {
    errors.push('FEE_PAYER_SECRET required when FEE_PAYER_MODE=self')
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  }
}

function isValidUrl(url: string): boolean {
  try {
    new URL(url)
    return true
  } catch {
    return false
  }
}

export function getEnvOrDefault(key: string, defaultValue: string): string {
  return process.env[key] || defaultValue
}

export function getEnvAsNumber(key: string, defaultValue: number): number {
  const value = process.env[key]
  if (!value) return defaultValue
  
  const parsed = parseInt(value, 10)
  return isNaN(parsed) ? defaultValue : parsed
}

export function getEnvAsBoolean(key: string, defaultValue: boolean): boolean {
  const value = process.env[key]
  if (!value) return defaultValue
  
  return value.toLowerCase() === 'true'
}