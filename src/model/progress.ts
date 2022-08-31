export interface Progress {
  uuid?: any,
  type?: string,
  timestamp?: Date,
  bytesReceived?: number,
  bytesExpected?: number,
  bytesReceivedPretty?: string,
  bytesExpectedPretty?: string
}