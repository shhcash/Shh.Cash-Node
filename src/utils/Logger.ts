export class Logger {
  private prefix: string

  constructor(component: string) {
    this.prefix = `[${component}]`
  }

  private formatMessage(level: string, message: string, ...args: any[]): string {
    const timestamp = new Date().toISOString()
    const formatted = args.length > 0 ? `${message} ${args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
    ).join(' ')}` : message
    
    return `${timestamp} ${level} ${this.prefix} ${formatted}`
  }

  info(message: string, ...args: any[]): void {
    console.log(this.formatMessage('INFO', message, ...args))
  }

  warn(message: string, ...args: any[]): void {
    console.warn(this.formatMessage('WARN', message, ...args))
  }

  error(message: string, ...args: any[]): void {
    console.error(this.formatMessage('ERROR', message, ...args))
  }

  debug(message: string, ...args: any[]): void {
    if (process.env.LOG_LEVEL === 'debug') {
      console.log(this.formatMessage('DEBUG', message, ...args))
    }
  }
}