import { Progress } from './model/progress';
import { ProgressWriter } from './service/progress_writer';
import _ from "lodash";

let uploadChunkSize = 512 * 1024;
let maxParallelChunkUploads = 10;
let uploadsDir: string;
let enableCompression = true;
let serverPort = 8082;

export const progresses: Progress[] = [];
export const uploadsProgressMap: Map<string, Progress> = new Map();
let progressWriter: ProgressWriter;
export const throttleWaitTimeInMillis = 250;

export const setUploadsDir = (dir: string) => { uploadsDir = dir; };
export const getUploadsDir = () => uploadsDir;

export const setUploadChunkSize = (size: number) => { uploadChunkSize = size; };
export const getUploadChunkSize = () => uploadChunkSize;

export const setMaxParallelChunkUploads = (count: number) => { maxParallelChunkUploads = count; };
export const getMaxParallelChunkUploads = () => maxParallelChunkUploads;

export const setEnableCompression = (enable: boolean) => { enableCompression = enable; };
export const getEnableCompression = () => enableCompression;

export const setServerPort = (port: number) => { serverPort = port; };
export const getServerPort = () => serverPort;

export const setProgressWriter = (writer: ProgressWriter) => {
    progressWriter = writer;
};
export const getProgressWriter = (): ProgressWriter => progressWriter;

export const throttledBroadcaster = _.throttle(() => {
    getProgressWriter().writeProgress(progresses);
}, throttleWaitTimeInMillis);
