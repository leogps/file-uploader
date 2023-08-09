import prettyBytes from 'pretty-bytes'

const TRANSFER_SAMPLE_FREQ = 1000; // 1second

export interface Progress {
  uuid?: any,
  type?: string,
  timestamp?: number,
  bytesReceived?: number,
  bytesExpected?: number,
  bytesReceivedPretty?: string,
  bytesExpectedPretty?: string,
  fileName?: string,
  savedLocation?: string,
  completed?: number,
  transferSamples?: TransferSample[]

  markSample(): void
}

export interface TransferSample {
  bytesReceived: number,
  timestamp: number
}

export class FileTransferProgress implements Progress {
  uuid?: any
  type?: string | undefined
  timestamp?: number | undefined
  bytesReceived?: number | undefined
  bytesExpected?: number | undefined
  bytesReceivedPretty?: string | undefined
  bytesExpectedPretty?: string | undefined
  fileName?: string | undefined
  savedLocation?: string | undefined
  completed?: number | undefined
  transferSamples: TransferSample[] = []

  constructor(uuid: string, timestamp: number) {
    this.uuid = uuid;
    this.type = 'progress';
    this.timestamp = timestamp;
    this.bytesReceived = 0;
    this.bytesExpected = 0;
    this.bytesReceivedPretty = prettyBytes(0);
    this.bytesExpectedPretty = prettyBytes(0);
  }

  markSample(): void {
    const timestamp = new Date();
    const bytesReceived = this.bytesReceived as number;
    this.transferSamples.push(
      {
        bytesReceived,
        timestamp: timestamp.getTime()
      }
    );

    this.cleanupSamples();
  }

  private cleanupSamples(): void {
    if (this.transferSamples.length < 1) {
      return;
    }
    const firstSample = this.transferSamples[0];
    if (!firstSample) {
      return;
    }
    const firstSampleTimestamp: number = firstSample.timestamp as unknown as number;
    const nowInMillis = new Date().getTime();
    if (firstSampleTimestamp - nowInMillis > TRANSFER_SAMPLE_FREQ) {
      this.transferSamples.shift();
    }
  }

}