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
  completed?: number
}