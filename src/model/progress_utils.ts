import {Progress} from './progress';

export class ProgressUtils {
  public static calculateTransferRate(progress: Progress): number {
    const samples = progress.transferSamples;
    if (!samples || samples.length < 2) {
      return 0;
    }

    let totalBytes = 0;
    let totalTimeMs = 0;

    //Case vs Reason for skipping
    // bytes === 0	idle / waiting / verification
    // bytes < 0	possibly corrupted or reset counter
    // timeMs === 0	divide-by-zero risk
    // timeMs < 0	invalid timestamp
    // To prevent idle gaps from dragging the rate down artificially.
    for (let i = 1; i < samples.length; i++) {
      const prev = samples[i - 1];
      const curr = samples[i];

      const bytes = curr.bytesReceived - prev.bytesReceived;
      const timeMs = curr.timestamp - prev.timestamp;

      if (bytes > 0 && timeMs > 0) {
        totalBytes += bytes;
        totalTimeMs += timeMs;
      }
    }

    if (totalTimeMs === 0) {
      return 0;
    }

    return totalBytes / (totalTimeMs / 1000);
  }
}