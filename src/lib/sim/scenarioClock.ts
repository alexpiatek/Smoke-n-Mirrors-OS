export class ScenarioClock {
  private readonly startTimestampMs: number
  private elapsedSecondsValue = 0
  private tickIndexValue = 0

  constructor(startTimestamp: string) {
    this.startTimestampMs = Date.parse(startTimestamp)
  }

  get elapsedSeconds() {
    return this.elapsedSecondsValue
  }

  get tickIndex() {
    return this.tickIndexValue
  }

  get timestamp() {
    return formatScenarioTimestamp(this.startTimestampMs, this.elapsedSecondsValue)
  }

  advance(seconds: number) {
    this.elapsedSecondsValue += seconds
    this.tickIndexValue += 1
  }

  reset() {
    this.elapsedSecondsValue = 0
    this.tickIndexValue = 0
  }
}

export function formatScenarioTimestamp(startTimestampMs: number, elapsedSeconds: number) {
  return new Date(startTimestampMs + elapsedSeconds * 1000).toISOString()
}
