import { MetricsSnapshot } from '../types'

export class Metrics {
  private startTime = Date.now()
  private counters = {
    offersReceived: 0,
    offersAccepted: 0,
    offersCompleted: 0,
    offersFailed: 0,
    heartbeats: 0,
    heartbeatErrors: 0
  }
  
  private executionTimes: number[] = []
  private totalEarnings = 0
  
  recordOfferReceived(): void {
    this.counters.offersReceived++
  }
  
  recordOfferAccepted(): void {
    this.counters.offersAccepted++
  }
  
  recordOfferCompleted(executionTimeMs: number): void {
    this.counters.offersCompleted++
    this.executionTimes.push(executionTimeMs)
    
    // Keep only last 100 execution times for average calculation
    if (this.executionTimes.length > 100) {
      this.executionTimes.shift()
    }
  }
  
  recordOfferFailed(): void {
    this.counters.offersFailed++
  }
  
  recordEarnings(solAmount: number): void {
    this.totalEarnings += solAmount
  }
  
  recordHeartbeat(): void {
    this.counters.heartbeats++
  }
  
  recordHeartbeatError(): void {
    this.counters.heartbeatErrors++
  }
  
  getSnapshot(): MetricsSnapshot {
    const avgExecutionTime = this.executionTimes.length > 0
      ? this.executionTimes.reduce((sum, time) => sum + time, 0) / this.executionTimes.length
      : 0
    
    return {
      offersReceived: this.counters.offersReceived,
      offersAccepted: this.counters.offersAccepted,
      offersCompleted: this.counters.offersCompleted,
      offersFailed: this.counters.offersFailed,
      avgExecutionTime: Math.round(avgExecutionTime),
      totalEarnings: this.totalEarnings,
      uptime: Date.now() - this.startTime
    }
  }
  
  getPrometheusMetrics(): string {
    const snapshot = this.getSnapshot()
    
    return [
      `# HELP shh_node_offers_total Total number of offers processed`,
      `# TYPE shh_node_offers_total counter`,
      `shh_node_offers_received_total ${snapshot.offersReceived}`,
      `shh_node_offers_accepted_total ${snapshot.offersAccepted}`,
      `shh_node_offers_completed_total ${snapshot.offersCompleted}`,
      `shh_node_offers_failed_total ${snapshot.offersFailed}`,
      ``,
      `# HELP shh_node_execution_time_avg Average execution time in milliseconds`,
      `# TYPE shh_node_execution_time_avg gauge`,
      `shh_node_execution_time_avg ${snapshot.avgExecutionTime}`,
      ``,
      `# HELP shh_node_earnings_total Total SOL earnings`,
      `# TYPE shh_node_earnings_total counter`,
      `shh_node_earnings_total ${snapshot.totalEarnings}`,
      ``,
      `# HELP shh_node_uptime_seconds Node uptime in seconds`,
      `# TYPE shh_node_uptime_seconds gauge`,
      `shh_node_uptime_seconds ${Math.floor(snapshot.uptime / 1000)}`,
      ``,
      `# HELP shh_node_heartbeats_total Total heartbeats sent`,
      `# TYPE shh_node_heartbeats_total counter`,
      `shh_node_heartbeats_total ${this.counters.heartbeats}`,
      `shh_node_heartbeat_errors_total ${this.counters.heartbeatErrors}`
    ].join('\n')
  }
}