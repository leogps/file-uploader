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

    /** Calculate size of last chunk */
    public lastChunkSize(): number {
        if (!this.bytesExpected || !this.chunkSize || !this.totalChunks) {
            return 0;
        }
        const remainder = this.bytesExpected % this.chunkSize;
        return remainder > 0 ? remainder : this.chunkSize;
    }

    /** Calculate bytesReceived based on uploadedChunks */
    public calculateBytesReceived(): number {
        if (!this.chunkSize || !this.totalChunks) {
            return this.bytesReceived || 0;
        }

        const lastChunkIndex = (this.totalChunks - 1);
        const hasLastChunk = this.uploadedChunks.has(lastChunkIndex);
        const chunksCount = this.uploadedChunks.size;

        if (hasLastChunk) {
            return ((chunksCount - 1) * this.chunkSize) + this.lastChunkSize();
        }
        return chunksCount * this.chunkSize;
    }

    /** Update bytesReceived and its pretty representation */
    private updateBytesReceived(): void {
        this.bytesReceived = this.calculateBytesReceived();
        this.bytesReceivedPretty = prettyBytes(this.bytesReceived || 0);
        this.bytesExpectedPretty = prettyBytes(this.bytesExpected || 0);
    }

    public addUploadedChunk(chunkIndex: number): void {
        if (chunkIndex < 0) {
            console.warn(`Invalid chunkIndex ${chunkIndex}. Must be >= 0.`);
            return;
        }
        if (!this.totalChunks) {
            console.warn(`Total chunks not set yet. Cannot add chunk ${chunkIndex}.`);
            return;
        }
        if (chunkIndex >= this.totalChunks) {
            console.warn(`Chunk index ${chunkIndex} exceeds totalChunks (${this.totalChunks - 1}).`);
            return;
        }
        if (this.uploadedChunks.has(chunkIndex)) {
            console.warn(`Chunk index ${chunkIndex} already marked as uploaded for ${this.fileName}.`);
            return;
        }

        this.uploadedChunks.add(chunkIndex);
        this.updateBytesReceived();
    }

    public resetUploadedChunks(): void {
        this.uploadedChunks = new Set();
    }

    public chunkVerified(chunkIndex: number): void {
        this.chunkVerificationCount++;
        console.debug(`chunk ${chunkIndex} verified. Total verified: ${this.chunkVerificationCount} for ${this.fileName}.`)
    }

    /** Optional: reset */
    public resetVerificationCount(): void {
        this.chunkVerificationCount = 0;
    }
}