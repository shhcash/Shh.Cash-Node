import http from 'http'
import { HealthStatus } from '../types'
import { Logger } from '../utils/Logger'
import { Metrics } from './Metrics'

export class HealthServer {
  private logger = new Logger('HealthServer')
  private server?: http.Server
  private port: number
  private getHealthStatus: () => Promise<HealthStatus>
  
  constructor(getHealthStatus: () => Promise<HealthStatus>) {
    this.port = parseInt(process.env.HEALTH_PORT || '8080')
    this.getHealthStatus = getHealthStatus
  }
  
  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server = http.createServer(this.handleRequest.bind(this))
      
      this.server.listen(this.port, () => {
        this.logger.info(`🏥 Health server listening on port ${this.port}`)
        resolve()
      })
      
      this.server.on('error', (error) => {
        this.logger.error('Health server error:', error)
        reject(error)
      })
    })
  }
  
  async stop(): Promise<void> {
    if (!this.server) return
    
    return new Promise((resolve) => {
      this.server!.close(() => {
        this.logger.info('🏥 Health server stopped')
        resolve()
      })
    })
  }
  
  private async handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const url = req.url || '/'
    
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
    
    if (req.method === 'OPTIONS') {
      res.writeHead(204)
      res.end()
      return
    }
    
    try {
      if (url === '/health' || url === '/') {
        await this.handleHealth(res)
      } else if (url === '/metrics') {
        await this.handleMetrics(res)
      } else if (url === '/ready') {
        await this.handleReady(res)
      } else {
        this.handleNotFound(res)
      }
    } catch (error) {
      this.logger.error('Request handler error:', error)
      this.handleError(res, error)
    }
  }
  
  private async handleHealth(res: http.ServerResponse): Promise<void> {
    const status = await this.getHealthStatus()
    
    const httpStatus = status.status === 'healthy' ? 200 : 
                      status.status === 'degraded' ? 200 : 503
    
    res.writeHead(httpStatus, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({
      status: status.status,
      uptime: status.uptime,
      wallets: status.wallets.length,
      activeWallets: status.wallets.filter(w => w.isActive).length,
      activeOffers: status.activeOffers,
      metrics: status.metrics,
      timestamp: new Date().toISOString()
    }, null, 2))
  }
  
  private async handleMetrics(res: http.ServerResponse): Promise<void> {
    // This would typically integrate with Prometheus metrics
    // For now, return basic JSON metrics
    const status = await this.getHealthStatus()
    
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(status.metrics, null, 2))
  }
  
  private async handleReady(res: http.ServerResponse): Promise<void> {
    const status = await this.getHealthStatus()
    
    const isReady = status.status !== 'unhealthy' && 
                   status.wallets.some(w => w.isActive)
    
    res.writeHead(isReady ? 200 : 503, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({
      ready: isReady,
      reason: isReady ? 'Node is ready to accept offers' : 'Node not ready - check wallet balances'
    }))
  }
  
  private handleNotFound(res: http.ServerResponse): void {
    res.writeHead(404, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({
      error: 'Not found',
      available: ['/health', '/metrics', '/ready']
    }))
  }
  
  private handleError(res: http.ServerResponse, error: any): void {
    res.writeHead(500, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({
      error: 'Internal server error',
      message: error.message
    }))
  }
}