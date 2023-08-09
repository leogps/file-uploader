import {Progress} from './progress';

export class ProgressUtils {
    public static calculateTransferRate(progress: Progress): number {
      const transferSamples = progress.transferSamples;
      if (!transferSamples || transferSamples.length < 2) {
        return 0;
      }
      const first = transferSamples[0];
      const last = transferSamples[transferSamples.length - 1];

      const dataSize = last.bytesReceived - first.bytesReceived;
      const timeIntervalSeconds = (last.timestamp - first.timestamp) / 1000;

      return dataSize / timeIntervalSeconds;
    }
  }