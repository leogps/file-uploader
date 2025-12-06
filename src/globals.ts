import { Progress } from './model/progress';
import { ProgressWriter } from './service/progress_writer';
import _ from "lodash";

export const MAX_CHUNK_SIZE = 2 * 1024 * 1024;
export const MAX_PARALLEL_CHUNK_UPLOADS = 10;
export let uploadsDir: string;
export const progresses: Progress[] = [];
export const uploadsProgressMap: Map<string, Progress> = new Map();
let progressWriter: ProgressWriter;
export const throttleWaitTimeInMillis = 250;

export function setUploadsDir(dir: string) { uploadsDir = dir; }
export function getUploadsDir() { return uploadsDir; }

export const setProgressWriter = (writer: ProgressWriter) => {
    progressWriter = writer;
};
export const getProgressWriter = (): ProgressWriter => progressWriter;

export const throttledBroadcaster = _.throttle(() => {
    getProgressWriter().writeProgress(progresses);
}, throttleWaitTimeInMillis);
