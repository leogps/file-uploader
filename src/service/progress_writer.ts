import {FileTransferProgress, Progress, TransferSample} from "../model/progress";
import { Server } from "socket.io";

export class ProgressWriter {
    io: Server;

    constructor(io: Server) {
        this.io = io;
    }

    public writeProgress(progresses: Progress[]) {
        // Clone progresses to safely emit without sending full transferSamples
        const progressesEmittable: FileTransferProgress[] = progresses.map(p => p as FileTransferProgress).map(p => {
            const cloned = this.cloneObjectExceptField(p, "transferSamples") as any;

            // Only include first and last sample for minimal data
            cloned.transferSamples = [] as TransferSample[];
            if (p.transferSamples && p.transferSamples.length >= 2) {
                cloned.transferSamples.push(p.transferSamples[0]);
                cloned.transferSamples.push(p.transferSamples[p.transferSamples.length - 1]);
            }

            // Ensure uploadedChunks, verifyingChunks, and uploadingChunks are serialized as arrays
            cloned.uploadedChunks = p.uploadedChunks instanceof Set ? Array.from(p.uploadedChunks)
                : Array.isArray(p.uploadedChunks) ? p.uploadedChunks : [];

            cloned.uploadingChunks = p.uploadingChunks instanceof Set ? Array.from(p.uploadingChunks)
                : Array.isArray(p.uploadingChunks) ? p.uploadingChunks : [];

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