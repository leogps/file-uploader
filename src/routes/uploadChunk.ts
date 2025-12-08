import { Router, Request, Response } from "express";
import formidable, { File } from "formidable";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import {
    uploadsProgressMap,
    getUploadsDir,
    throttledBroadcaster
} from "../globals";
import { FileTransferProgress } from "../model/progress";

export const router = Router();

router.post("/", (req: Request, res: Response) => {
    (async () => {
        const fileId = req.query.fileId as string;
        const chunkIndex = Number(req.query.chunkIndex);
        const clientHash = req.query.hash as string;

        if (!fileId || !uploadsProgressMap.has(fileId)) {
            return res.status(400).json({ msg: "Invalid or unknown fileId" });
        }
        if (isNaN(chunkIndex) || chunkIndex < 0) {
            return res.status(400).json({ msg: "Invalid chunk index" });
        }
        if (!clientHash) {
            return res.status(400).json({ msg: "Missing SHA-1 hash for chunk" });
        }

        const progress = uploadsProgressMap.get(fileId)! as FileTransferProgress;

        const uploadDir = getUploadsDir();
        await fs.mkdir(uploadDir, { recursive: true });

        const form = formidable({
            multiples: false,
            keepExtensions: true,
            uploadDir
        });

        let receivedFile: File | null = null;
        let errorDuringFileWrite: any = null;

        form.on("file", (_: string, file: File) => {
            (async () => {
                receivedFile = file;

                try {
                    const finalPath = path.join(uploadDir, progress.fileName!);

                    // Sparse file creation
                    try {
                        await fs.access(finalPath);
                    } catch {
                        const fh = await fs.open(finalPath, "w");
                        await fh.truncate(progress.bytesExpected);
                        await fh.close();
                    }

                    const chunkBuffer = await fs.readFile(file.filepath);
                    const offset = chunkIndex * progress.chunkSize!;

                    const fd = await fs.open(finalPath, "r+");
                    await fd.write(chunkBuffer, 0, chunkBuffer.length, offset);

                    const verifyBuffer = Buffer.alloc(chunkBuffer.length);
                    await fd.read(verifyBuffer, 0, chunkBuffer.length, offset);
                    await fd.close();

                    const hash = crypto.createHash("sha1").update(verifyBuffer).digest("hex");
                    if (hash !== clientHash) {
                        errorDuringFileWrite = {
                            status: 400,
                            body: {
                                msg: "Chunk hash mismatch",
                                expected: clientHash,
                                got: hash
                            }
                        };
                    } else {
                        progress.uploadingChunks.delete(chunkIndex);
                        progress.addUploadedChunk(chunkIndex);
                        progress.markSample();
                    }
                    throttledBroadcaster();

                    await fs.unlink(file.filepath);
                } catch (err) {
                    console.error("Chunk write error:", err);
                    errorDuringFileWrite = {
                        status: 500,
                        body: { msg: "Internal write error", error: err }
                    };
                }
            })()
        });

        form.parse(req, (err) => {
            if (err) {
                console.error("Form parse error:", err);
                return res.status(500).json({ msg: "Error receiving chunk", error: err });
            }

            if (errorDuringFileWrite) {
                return res.status(errorDuringFileWrite.status).json(errorDuringFileWrite.body);
            }

            if (!receivedFile) {
                return res.status(400).json({ msg: "No chunk received" });
            }

            console.log(`uploaded-chunk: ${chunkIndex} for ${progress.fileName}`);
            return res.json({
                msg: "Chunk uploaded successfully",
                fileId,
                chunkIndex,
                hashMatches: true,
                bytesReceived: progress.bytesReceived,
                bytesExpected: progress.bytesExpected,
                uploadedChunks: Array.from(progress.uploadedChunks)
            });
        });
    })()
});