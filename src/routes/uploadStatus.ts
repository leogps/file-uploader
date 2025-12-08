import {Request, Response, Router} from 'express';
import fs from 'fs';
import crypto from 'crypto';
import {throttledBroadcaster, uploadsProgressMap} from '../globals';
import {FileTransferProgress, UploadStatus} from "../model/progress";

export const router = Router();

/* ------------------------ Helper: uniform error JSON ------------------------ */
const sendError = (res: Response, code: number, msg: string): Response =>
    res.status(code).json({ msg });

const hashMatched = (fileId: string,
                     chunkIndex: number,
                     res: Response,
                     progress: FileTransferProgress): Response => {
    console.log(`✅ Hash match for chunk ${chunkIndex} of file ${fileId}`);
    progress.addUploadedChunk(chunkIndex);
    progress.chunkVerified(chunkIndex);
    throttledBroadcaster();
    return res.json({
        fileId,
        chunkIndex,
        hashMatches: true,
        bytesReceived: progress.bytesReceived,
        bytesExpected: progress.bytesExpected
    });
}

const hashMismatched = (fileId: string,
                        chunkIndex: number,
                        res: Response,
                        progress: FileTransferProgress): Response => {
    console.log(`❌ Hash mismatch for chunk ${chunkIndex} of file ${fileId}`);
    progress.uploadingChunks.add(chunkIndex);
    progress.chunkVerified(chunkIndex);
    throttledBroadcaster();
    return res.json({
        fileId,
        chunkIndex,
        hashMatches: false,
        bytesReceived: progress.bytesReceived,
        bytesExpected: progress.bytesExpected
    });
}

/* ------------------------ Helper: read chunk from disk ---------------------- */
const readChunk = (filePath: string,
                   start: number,
                   length: number): Buffer<ArrayBuffer> | null => {
    const fd = fs.openSync(filePath, 'r');

    const stats = fs.fstatSync(fd);
    const fileSize = stats.size;

    // Chunk beyond EOF → return null (means "not written")
    if (start >= fileSize) {
        fs.closeSync(fd);
        return null;
    }

    const realEnd = Math.min(start + length, fileSize);
    const realLength = realEnd - start;

    const buffer = Buffer.allocUnsafe(realLength);
    fs.readSync(fd, buffer, 0, realLength, start);
    fs.closeSync(fd);

    return buffer;
}

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
        return sendError(res, 400, "Invalid chunk size");
    }

    const totalChunks = Math.ceil(progress.bytesExpected / chunkSize);
    if (isNaN(chunkIndex) || chunkIndex < 0 || chunkIndex >= totalChunks) {
        return sendError(res, 400, "Invalid chunk index");
    }

    const filePath = progress.savedLocation;
    if (!filePath || !fs.existsSync(filePath)) {
        return sendError(res, 404, "File not found");
    }

    // ---- Compute read boundaries ----
    const start = chunkIndex * chunkSize;
    const length = Math.min(chunkSize, progress.bytesExpected - start);

    // ---- Read chunk ----
    const buffer = readChunk(filePath, start, length);
    if (!buffer) {
        // Chunk not written yet (beyond EOF)
        return hashMismatched(fileId, chunkIndex, res, progress);
    }

    // ---- Hash verification ----
    const serverHash = crypto.createHash('sha1').update(buffer).digest('hex');
    const hashMatches = serverHash === clientHash;
    if (hashMatches) {
        return hashMatched(fileId, chunkIndex, res, progress);

    }
    return hashMismatched(fileId, chunkIndex, res, progress);
});