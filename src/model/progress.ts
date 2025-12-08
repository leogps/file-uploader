import prettyBytes from 'pretty-bytes'

const TRANSFER_SAMPLE_FREQ = 1000; // 1second
const MIN_SAMPLE_FREQ = TRANSFER_SAMPLE_FREQ / 4;

export enum UploadStatus {
    INITIATED = "INITIATED",
    UPLOADING = "UPLOADING",
    FINISHING = "FINISHING",
    COMPLETE = "COMPLETE",
    FAILED = "FAILED"
}

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
  lastState: UploadStatus,
  transferSamples?: TransferSample[]

  markSample(): void
}

export interface TransferSample {
    bytesReceived: number;      // total bytes received at this sample
    timestamp: number;          // timestamp in ms
    chunkIndex?: number;        // optional: index of chunk this sample refers to
    chunkBytes?: number;        // optional: bytes in this chunk
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
  lastState: UploadStatus = UploadStatus.INITIATED;
  transferSamples: TransferSample[] = []

  chunkSize?: number;            // size of each chunk
  totalChunks?: number;          // total number of chunks
  chunkVerificationCount = 0;
  uploadedChunks: Set<number> = new Set(); // track uploaded chunk indices
  uploadingChunks: Set<number> = new Set();

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
    const timestampInMillis = new Date().getTime();
    if (!this.shouldSample(timestampInMillis)) {
      return;
    }

    const bytesReceived = this.bytesReceived as number;
    this.transferSamples.push(
      {
        bytesReceived,
        timestamp: timestampInMillis
      }
    );

    this.cleanupSamples();
  }

  private shouldSample(millis: number): boolean {
    if (this.transferSamples.length < 1) {
      return true;
    }
    const lastSample = this.transferSamples[this.transferSamples.length - 1];
    return (millis - lastSample.timestamp > MIN_SAMPLE_FREQ);
  }

  private cleanupSamples(): void {
    if (this.transferSamples.length < 1) {
      return;
    }
    const firstSample = this.transferSamples[0];
    if (!firstSample) {
      return;
    }
    const firstSampleTimestamp: number = firstSample.timestamp;
    const nowInMillis = new Date().getTime();
    if (firstSampleTimestamp - nowInMillis > TRANSFER_SAMPLE_FREQ) {
      this.transferSamples.shift();
    }
  }
}