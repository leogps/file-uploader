import {Request, Response, Router} from 'express';
import {getProgressWriter, progresses, uploadsProgressMap} from '../globals';
import {FileTransferProgress, UploadStatus} from "../model/progress";

export const router = Router();

// POST /upload/complete?fileId=UUID
router.post('/', (req: Request, res: Response) => {
    const fileId = req.query.fileId as string;
    const markUploadFailed: boolean = req.query.markUploadFailed === "true";

    if (!fileId || !uploadsProgressMap.has(fileId)) {
        return res.status(400).json({ msg: 'Invalid or unknown fileId' });
    }

    const progress: FileTransferProgress = uploadsProgressMap.get(fileId)! as FileTransferProgress;
    progress.lastState = UploadStatus.FINISHING;

    // Ensure uploadedChunks and totalChunks exist
    if (!progress.uploadedChunks) {
        progress.uploadedChunks = new Set<number>();
    }
    if (!progress.totalChunks && progress.chunkSize && progress.bytesExpected) {
        progress.totalChunks = Math.ceil(progress.bytesExpected / progress.chunkSize);
    }

    // Check all chunks uploaded
    if (progress.uploadedChunks.size !== progress.totalChunks) {
        if (markUploadFailed) {
            console.log(`Marking upload failed for file ${progress.fileName} ${progress.uuid}`);
            progress.lastState = UploadStatus.FAILED;
        }
        getProgressWriter().writeProgress(progresses);
        return res.status(400).json({
            msg: 'File incomplete',
            uploadedChunks: Array.from(progress.uploadedChunks),
            totalChunks: progress.totalChunks
        });
    }

    progress.completed = Date.now();
    progress.lastState = UploadStatus.COMPLETE;
    getProgressWriter().writeProgress(progresses);

    res.json({
        msg: 'File upload complete',
        fileName: progress.fileName,
        savedLocation: progress.savedLocation,
        bytesReceived: progress.bytesReceived,
        totalChunks: progress.totalChunks,
        chunkSize: progress.chunkSize
    });
});