import { Router } from 'express';
import formidable, { File } from "formidable";
import { v4 as uuidv4 } from 'uuid';
import {
    getServerConfig,
    progresses, ServerConfig,
    throttledBroadcaster,
    uploadsProgressMap
} from "../globals";
import {FileTransferProgress, Progress, UploadStatus} from "../model/progress";
import _ from "lodash";
import prettyBytes from "pretty-bytes";
import mv from "mv";

const serverConfig: ServerConfig = getServerConfig();
export const router = Router();

router.post('/', (req: any, res: any) => {
    const maxFileSize = serverConfig.maxFileSize;
    const uploadsDir = serverConfig.uploadsDir;
    // parse a file upload
    const form = formidable({
        multiples: true,
        maxFileSize,
        uploadDir: uploadsDir
    });
    const timestamp: number = new Date().getTime();
    const uuid = uuidv4();
    const progress: Progress = new FileTransferProgress(uuid, timestamp);
    uploadsProgressMap.set(uuid, progress);
    progresses.push(progress);

    const progressProcessorThrottled = _.throttle((bytesReceived, bytesExpected) => {
        console.log("Progress: (" + bytesReceived + "/" + bytesExpected + ")");
        if (uploadsProgressMap.has(uuid)) {
            const existingProgress = uploadsProgressMap.get(uuid);
            if (existingProgress) {
                existingProgress.bytesReceived = bytesReceived;
                existingProgress.bytesExpected = bytesExpected;
                existingProgress.bytesReceivedPretty = prettyBytes(bytesReceived);
                existingProgress.bytesExpectedPretty = prettyBytes(bytesExpected);
                existingProgress.markSample();
            }
        } else {
            // This can't be.
            console.warn("Progress not found in the map for uuid: " + uuid);
            return;
        }
    }, serverConfig.throttleWaitTimeInMillis, {
        leading: true
    });

    form.on('progress', (bytesReceived, bytesExpected) => {
        progressProcessorThrottled(bytesReceived, bytesExpected);
        throttledBroadcaster();
    });

    form.on('fileBegin', (formName: string, file: File) => {
        console.log('File Begin: ' + JSON.stringify(file));
        if (!file.originalFilename) {
            return;
        }

        const existingProgress = uploadsProgressMap.get(uuid);
        console.log('File Begin progress: ' + JSON.stringify(existingProgress));
        if (existingProgress) {
            existingProgress.fileName = file.originalFilename;
        }
        console.log('File Begin progress after: ' + JSON.stringify(existingProgress));
    });

    form.on('file', (formName: string, file: File) => {
        console.log('File received: ' + JSON.stringify(file));
        if (file.originalFilename) {
            console.log("file name: " + file.originalFilename);
        } else {
            return
        }
        const completed = new Date().getTime();
        const oldPath = file.filepath;
        const newPath = uploadsDir + file.originalFilename;
        mv(oldPath, newPath, {mkdirp: true}, (err) => {
            // done. it first created all the necessary directories, and then
            // tried fs.rename, then falls back to using ncp to copy the dir
            // to dest and then rimraf to remove the source dir
            if (err) {
                console.error(err);
                return;
            }
            console.log("File moved to: " + newPath);
        });

        if (uploadsProgressMap.has(uuid)) {
            const existingProgress = uploadsProgressMap.get(uuid);
            if (existingProgress) {
                existingProgress.savedLocation = newPath;
                existingProgress.completed = completed
                existingProgress.lastState = UploadStatus.COMPLETE;
            }
        }
        throttledBroadcaster();
    });

    form.parse(req, (err, fields, files) => {
        res.writeHead(200, { 'content-type': 'application/json' });
        console.log(files);
        const success = {
            "msg": 'File uploaded and moved!'
        };
        res.write(JSON.stringify(success));
        res.end();
    });

    return;
});