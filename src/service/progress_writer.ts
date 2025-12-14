import {FileTransferProgress, Progress, TransferSample, RATE_WINDOW_MS} from "../model/progress";
import { Server } from "socket.io";

export class ProgressWriter {
    io: Server;

    constructor(io: Server) {
        this.io = io;
    }

    private getWindowedSamples(
        samples?: TransferSample[]
    ): TransferSample[] {
        if (!samples || samples.length < 2) {
            return [];
        }

        const last = samples[samples.length - 1];
        const windowStart = last.timestamp - RATE_WINDOW_MS;

        const windowed: TransferSample[] = [];

        for (let i = samples.length - 1; i >= 0; i--) {
            const s = samples[i];
            windowed.push(s);

            if (s.timestamp <= windowStart) {
                break;
            }
        }

        return windowed.reverse(); // chronological order
    }

    public writeProgress(progresses: Progress[]) {
        // Clone progresses to safely emit without sending full transferSamples
        const progressesEmittable: FileTransferProgress[] = progresses.map(p => p as FileTransferProgress).map(p => {
            const cloned = this.cloneObjectExceptField(p, "transferSamples") as any;

            // Send only sliding-window samples
            cloned.transferSamples = this.getWindowedSamples(p.transferSamples);

            cloned.uploadedChunks =
                p.uploadedChunks instanceof Set
                    ? Array.from(p.uploadedChunks)
                    : Array.isArray(p.uploadedChunks)
                        ? p.uploadedChunks
                        : [];

            cloned.uploadingChunks =
                p.uploadingChunks instanceof Set
                    ? Array.from(p.uploadingChunks)
                    : Array.isArray(p.uploadingChunks)
                        ? p.uploadingChunks
                        : [];

            return cloned as FileTransferProgress;
        });

        // Emit to all connected clients
        this.io.emit("progresses", progressesEmittable);
    }

    private cloneObjectExceptField<T extends Record<string, any>, K extends keyof T>(
        obj: T,
        fieldToExclude: Extract<keyof T, string>
    ): Omit<T, K> {
        const clonedObject = {} as Omit<T, K>;

        for (const key in obj) {
            if (obj.hasOwnProperty(key) && key !== fieldToExclude) {
                const c: Record<string, any> = clonedObject;
                c[key.toString()] = obj[key];
            }
        }

        return clonedObject;
    }
}