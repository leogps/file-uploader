import {Request, Response, Router} from 'express';
import fs from 'fs';
import crypto from 'crypto';
import {throttledBroadcaster, uploadsProgressMap} from '../globals';
import {FileTransferProgress, UploadStatus} from "../model/progress";
import prettyBytes from "pretty-bytes";

export const router = Router();

// GET /upload/status?fileId=UUID&chunkIndex=N&chunkSize=BYTES&hash=SHA1
router.get('/', (req: Request, res: Response) => {
    // Cast query params to string explicitly
    const fileId = (req.query.fileId as string | undefined);
    const chunkIdxStr = req.query.chunkIndex as string | undefined;
    const chunkSizeStr = req.query.chunkSize as string | undefined;
    const clientHash = req.query.hash as string | undefined;

    if (!fileId) {
        return res.status(400).json({ msg: `Missing query parameter fileId`});
    }
    if (!chunkIdxStr) {
        return res.status(400).json({ msg: `Missing query parameter chunkIndex`});
    }
    if (!chunkSizeStr) {
        return res.status(400).json({ msg: `Missing query parameter chunkSize`});
    }
    if (!clientHash) {
        return res.status(400).json({ msg: `Missing query parameter hash`});
    }

    const chunkIndex = parseInt(chunkIdxStr, 10);
    const chunkSize = parseInt(chunkSizeStr, 10);

    if (!uploadsProgressMap.has(fileId)) {
        return res.status(400).json({ msg: 'Invalid or unknown fileId' });
    }

    const progress = uploadsProgressMap.get(fileId)! as FileTransferProgress;
    progress.lastState = UploadStatus.UPLOADING;
    throttledBroadcaster();

    if (!chunkSize || chunkSize <= 0 || !progress.bytesExpected) {
        return res.status(400).json({ msg: 'Invalid chunk size' });
    }

    const totalChunks = Math.ceil(progress.bytesExpected / chunkSize);
    if (isNaN(chunkIndex) || chunkIndex < 0 || chunkIndex >= totalChunks) {
        return res.status(400).json({ msg: 'Invalid chunk index' });
    }

    const filePath = progress.savedLocation;
    if (!filePath || !fs.existsSync(filePath)) {
        return res.status(404).json({ msg: 'File not found' });
    }

    // Calculate byte range for this chunk
    const start = chunkIndex * chunkSize;
    const end = Math.min(start + chunkSize, progress.bytesExpected);
    const length = end - start;

    const buffer = Buffer.alloc(length);
    const fd = fs.openSync(filePath, 'r');
    fs.readSync(fd, buffer, 0, length, start);
    fs.closeSync(fd);

    const hash = crypto.createHash('sha1').update(buffer).digest('hex');
    const match = hash === clientHash;
    if (match) {
        if (!progress.uploadedChunks) {
            progress.uploadedChunks = new Set<number>();
        }
        progress.uploadedChunks.add(chunkIndex);
        progress.bytesReceived = progress.uploadedChunks.size * progress.chunkSize!;// account for last chunk size?
        progress.bytesReceivedPretty = prettyBytes(progress.bytesReceived || 0);
        progress.bytesExpectedPretty = prettyBytes(progress.bytesExpected || 0);
        console.log(`✅Hash match for chunk ${chunkIndex} of file ${fileId} ${filePath}`);
    } else {
        progress.uploadingChunks.add(chunkIndex);
        console.log(`❌Hash mismatch for chunk ${chunkIndex} of file ${fileId} ${filePath}`);
    }
    progress.chunkVerificationCount++;
    throttledBroadcaster();

    res.json({
        fileId: fileId,
        chunkIndex: chunkIndex,
        hashMatches: match,
        bytesReceived: progress.bytesReceived,
        bytesExpected: progress.bytesExpected
    });
});