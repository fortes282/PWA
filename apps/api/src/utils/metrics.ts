/**
 * Lightweight Prometheus-compatible metrics collector.
 * No external dependencies — just in-memory counters + histograms.
 */

interface HistogramBucket {
  le: number;
  count: number;
}

const HTTP_DURATION_BUCKETS = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10];

class MetricsCollector {
  // Request counters: method:status → count
  private requestCounter = new Map<string, number>();

  // Duration histogram per route: method:route → { sum, count, buckets }
  private durationHistogram = new Map<
    string,
    { sum: number; count: number; buckets: HistogramBucket[] }
  >();

  // Active connections
  private _activeRequests = 0;

  // Errors by type
  private errorCounter = new Map<string, number>();

  // Start time
  private readonly startTime = Date.now();

  get activeRequests() {
    return this._activeRequests;
  }

  incrementRequest(method: string, statusCode: number) {
    const key = `${method}:${statusCode}`;
    this.requestCounter.set(key, (this.requestCounter.get(key) ?? 0) + 1);
  }

  recordDuration(method: string, route: string, durationSec: number) {
    const key = `${method}:${route}`;
    let entry = this.durationHistogram.get(key);
    if (!entry) {
      entry = {
        sum: 0,
        count: 0,
        buckets: HTTP_DURATION_BUCKETS.map((le) => ({ le, count: 0 })),
      };
      this.durationHistogram.set(key, entry);
    }
    entry.sum += durationSec;
    entry.count++;
    for (const bucket of entry.buckets) {
      if (durationSec <= bucket.le) bucket.count++;
    }
  }

  requestStart() {
    this._activeRequests++;
  }

  requestEnd() {
    this._activeRequests = Math.max(0, this._activeRequests - 1);
  }

  incrementError(type: string) {
    this.errorCounter.set(type, (this.errorCounter.get(type) ?? 0) + 1);
  }

  /** Export as Prometheus text format */
  toPrometheus(): string {
    const lines: string[] = [];

    // Uptime
    lines.push("# HELP pristav_uptime_seconds Server uptime in seconds");
    lines.push("# TYPE pristav_uptime_seconds gauge");
    lines.push(`pristav_uptime_seconds ${((Date.now() - this.startTime) / 1000).toFixed(0)}`);

    // Active requests
    lines.push("# HELP pristav_active_requests Current in-flight requests");
    lines.push("# TYPE pristav_active_requests gauge");
    lines.push(`pristav_active_requests ${this._activeRequests}`);

    // Request total
    lines.push("# HELP pristav_http_requests_total Total HTTP requests");
    lines.push("# TYPE pristav_http_requests_total counter");
    for (const [key, count] of this.requestCounter) {
      const [method, status] = key.split(":");
      lines.push(`pristav_http_requests_total{method="${method}",status="${status}"} ${count}`);
    }

    // Duration histogram
    lines.push("# HELP pristav_http_duration_seconds HTTP request duration in seconds");
    lines.push("# TYPE pristav_http_duration_seconds histogram");
    for (const [key, entry] of this.durationHistogram) {
      const [method, route] = key.split(":");
      const labels = `method="${method}",route="${route}"`;
      for (const bucket of entry.buckets) {
        lines.push(`pristav_http_duration_seconds_bucket{${labels},le="${bucket.le}"} ${bucket.count}`);
      }
      lines.push(`pristav_http_duration_seconds_bucket{${labels},le="+Inf"} ${entry.count}`);
      lines.push(`pristav_http_duration_seconds_sum{${labels}} ${entry.sum.toFixed(6)}`);
      lines.push(`pristav_http_duration_seconds_count{${labels}} ${entry.count}`);
    }

    // Errors
    if (this.errorCounter.size > 0) {
      lines.push("# HELP pristav_errors_total Total errors by type");
      lines.push("# TYPE pristav_errors_total counter");
      for (const [type, count] of this.errorCounter) {
        lines.push(`pristav_errors_total{type="${type}"} ${count}`);
      }
    }

    // Memory usage
    const mem = process.memoryUsage();
    lines.push("# HELP pristav_memory_rss_bytes Resident set size");
    lines.push("# TYPE pristav_memory_rss_bytes gauge");
    lines.push(`pristav_memory_rss_bytes ${mem.rss}`);
    lines.push("# HELP pristav_memory_heap_used_bytes Heap used bytes");
    lines.push("# TYPE pristav_memory_heap_used_bytes gauge");
    lines.push(`pristav_memory_heap_used_bytes ${mem.heapUsed}`);

    return lines.join("\n") + "\n";
  }

  /** Export as JSON summary (for /health/metrics) */
  toJSON() {
    const totalRequests = Array.from(this.requestCounter.values()).reduce((a, b) => a + b, 0);
    const totalErrors = Array.from(this.errorCounter.values()).reduce((a, b) => a + b, 0);
    const mem = process.memoryUsage();

    return {
      uptimeSeconds: Math.floor((Date.now() - this.startTime) / 1000),
      activeRequests: this._activeRequests,
      totalRequests,
      totalErrors,
      memory: {
        rss: Math.round(mem.rss / 1024 / 1024),
        heapUsed: Math.round(mem.heapUsed / 1024 / 1024),
        heapTotal: Math.round(mem.heapTotal / 1024 / 1024),
      },
      topRoutes: this.getTopRoutes(10),
    };
  }

  private getTopRoutes(n: number) {
    return Array.from(this.durationHistogram.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, n)
      .map(([key, entry]) => {
        const [method, route] = key.split(":");
        return {
          method,
          route,
          count: entry.count,
          avgMs: Math.round((entry.sum / entry.count) * 1000),
        };
      });
  }

  reset() {
    this.requestCounter.clear();
    this.durationHistogram.clear();
    this.errorCounter.clear();
    this._activeRequests = 0;
  }
}

export const metrics = new MetricsCollector();
