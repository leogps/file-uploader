import { Progress } from './model/progress';
import { ProgressWriter } from './service/progress_writer';
import _ from "lodash";
import os from "os";
import path from "path";

// version:start
export const APP_VERSION = '2.0.2';
// version:end

export interface ServerConfig {
    readonly uploadsDir: string;
    readonly uploadChunkSize: number;
    readonly maxParallelFileUploads: number;
    readonly maxParallelChunkUploads: number;
    readonly enableCompression: boolean;
    readonly serverPort: number;
    readonly maxFileSize: number;
    readonly throttleWaitTimeInMillis: number;
    readonly progressWriter?: ProgressWriter;
    readonly version: string;
}
export type ServerConfigJson = Omit<ServerConfig, "progressWriter">;

export const DEFAULT_SERVER_CONFIG: ServerConfig = Object.freeze({
    uploadsDir: `${os.homedir()}${path.sep}uploads/`,
    uploadChunkSize: 512 * 1024,
    maxParallelFileUploads: 3,
    maxParallelChunkUploads: 10,
    enableCompression: true,
    serverPort: 8082,
    maxFileSize: 100 * 1024 * 1024 * 1024, // 100GB
    throttleWaitTimeInMillis: 250,
    version: APP_VERSION
});

const currentConfig: ServerConfig = { ...DEFAULT_SERVER_CONFIG };

export const getServerConfig = (): ServerConfig => currentConfig;

export const updateServerConfig = (overrides: Partial<ServerConfig>) => {
    Object.assign(currentConfig, overrides);
    return currentConfig;
};

export const progresses: Progress[] = [];
export const uploadsProgressMap: Map<string, Progress> = new Map();

export const getProgressWriter = (): ProgressWriter => {
    const writer = getServerConfig().progressWriter;
    if (!writer) {
        throw new Error('ProgressWriter not configured');
    }
    return writer;
};

export let throttledBroadcaster: _.DebouncedFunc<() => void> =
    _.throttle(() => {
        // noop.
    }, 0);
export const createThrottledBroadcaster = (): void => {
    throttledBroadcaster?.cancel?.();

    throttledBroadcaster = _.throttle(
        () => {
            getProgressWriter().writeProgress(progresses);
        },
        getServerConfig().throttleWaitTimeInMillis
    )
};