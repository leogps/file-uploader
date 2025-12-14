import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import {
    uploadsProgressMap,
    progresses,
    getUploadsDir,
    getUploadChunkSize, getMaxParallelChunkUploads
} from '../globals';
import { FileTransferProgress } from '../model/progress';
import path from "path";
import fs from "fs";

export const router = Router();

/**
 * POST /upload/init
 * Accepts fileName and fileSize either in JSON body or query parameters.
 * Returns a fileId to be used for chunked uploads.
 */
router.post('/', (req: Request, res: Response) => {
    console.log("Req body: " + JSON.stringify(req.body));
    let fileName: string | undefined = req.body?.fileName;
    let fileSize: number | undefined = req.body?.fileSize;

    // Fallback to query params
    if (!fileName || !fileSize) {
        fileName = req.query.fileName as string;
        fileSize = parseInt(req.query.fileSize as string, 10);
    }

    console.log("File name: " + fileName);
    console.log("File size: " + fileSize);
    if (!fileName || !fileSize || isNaN(fileSize)) {
        return res.status(400).json({ msg: 'Missing or invalid fileName/fileSize' });
    }

    const finalPath = path.join(getUploadsDir(), fileName);
    let progress: FileTransferProgress;
    let fileId: string;

    // Check if file already exists
    if (fs.existsSync(finalPath)) {
        // Try to find existing progress in memory
        const existingProgress = Array.from(uploadsProgressMap.values())
            .find(p => p.fileName === fileName && p.bytesExpected === fileSize) as FileTransferProgress | undefined;

        if (existingProgress) {
            progress = existingProgress;
            fileId = progress.uuid!;
        } else {
            // File exists but no memory entry (server restarted)
            fileId = uuidv4();
            progress = new FileTransferProgress(fileId, Date.now());
            progress.fileName = fileName;
            progress.bytesExpected = fileSize;
            progress.chunkSize = getUploadChunkSize();
            progress.totalChunks = Math.ceil(fileSize / progress.chunkSize);
            progress.bytesReceived = fs.statSync(finalPath).size; // resume
            progress.resetUploadedChunks();
            uploadsProgressMap.set(fileId, progress);
            progresses.push(progress);
        }
    } else {
        // File does not exist, create new progress
        console.log(`creating file ${finalPath}`);
        fs.writeFileSync(finalPath, Buffer.alloc(0));
        fileId = uuidv4();
        progress = new FileTransferProgress(fileId, Date.now());
        progress.fileName = fileName;
        progress.bytesExpected = fileSize;
        progress.chunkSize = getUploadChunkSize();
        progress.totalChunks = Math.ceil(fileSize / progress.chunkSize);
        progress.resetUploadedChunks();
        uploadsProgressMap.set(fileId, progress);
        progresses.push(progress);
    }
    progress.savedLocation = finalPath;

    progress.resetVerificationCount();
    progress.uploadingChunks = new Set<number>();
    res.json({
        fileId,
        chunkSize: progress.chunkSize,
        totalChunks: progress.totalChunks,
        maxParallel: getMaxParallelChunkUploads(),
        bytesReceived: progress.bytesReceived || 0 // client can skip uploaded chunks
    });
});