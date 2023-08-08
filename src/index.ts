/* eslint-disable @typescript-eslint/naming-convention */

import express, { Express, Request, Response } from 'express';
import {createServer, Server} from "http"
import formidable, {File} from "formidable"
import prettyBytes from 'pretty-bytes'
import {Progress} from "./model/progress";
import {ProgressWriter} from "./service/progress_writer";
import * as socketio from "socket.io";
import { v4 as uuidv4 } from 'uuid';
import * as _ from "lodash";
import yargs from "yargs";
import {hideBin} from "yargs/helpers";
import * as os from 'os';
import mv from 'mv';

const homedir = os.homedir();
let port = 8082;
let uploadsDir = homedir + "/Downloads/uploads/"
const argv: any = yargs(hideBin(process.argv))
  .option('upload_location', {
    alias: 'l',
    type: 'string',
    description: 'upload location',
    default: uploadsDir
  })
  .option('port', {
    alias: 'p',
    type: 'number',
    description: 'server port'
  })
  .help()
  .argv

if (argv.port) {
  port = argv.port
}
if (argv.upload_location) {
  uploadsDir = argv.upload_location.endsWith('/') ? argv.upload_location: argv.upload_location + '/'
}

console.log("Upload location: " + uploadsDir)
console.log("Server port: " + port)

const app: Express = express();
const httpServer: Server = createServer(app)
const io: socketio.Server = new socketio.Server(httpServer);
const MAX_FILE_SIZE = 100 * 1024 * 1024 * 1024; // 100Gb

const progresses: Progress[] = [];
const uploadsProgressMap: Map<string, Progress> = new Map<string, Progress>();
const progressWriter: ProgressWriter = new ProgressWriter(io);
const throttleWaitTimeInMillis = 250;

app.post('/upload', (req: any, res: any) => {
  // parse a file upload
  const form = formidable({
    multiples: true,
    maxFileSize: MAX_FILE_SIZE,
    uploadDir: uploadsDir
  });
  const timestamp: number = new Date().getTime();
  const uuid = uuidv4();
  const progress: Progress = {
    uuid,
    type: 'progress',
    timestamp,
    bytesReceived: 0,
    bytesExpected: 0,
    bytesReceivedPretty: prettyBytes(0),
    bytesExpectedPretty: prettyBytes(0)
  };
  uploadsProgressMap.set(uuid, progress);
  progresses.push(progress);

  const throttledBroadcaster = _.throttle(() => {
    console.log("Broadcasting progresses...");
    progressWriter.writeProgress(progresses);
  }, throttleWaitTimeInMillis, {
    leading: true
  });

  form.on('progress', (bytesReceived, bytesExpected) => {
    console.log("Progress: (" + bytesReceived + "/" + bytesExpected + ")");
    if (uploadsProgressMap.has(uuid)) {
      const existingProgress = uploadsProgressMap.get(uuid);
      if (existingProgress) {
        existingProgress.bytesReceived = bytesReceived;
        existingProgress.bytesExpected = bytesExpected;
        existingProgress.bytesReceivedPretty = prettyBytes(bytesReceived);
        existingProgress.bytesExpectedPretty = prettyBytes(bytesExpected);
      }
    } else {
      // This can't be.
      console.warn("Progress not found in the map for uuid: " + uuid);
      return;
    }

    if (progressWriter) {
      throttledBroadcaster();
    }
  });

  form.on('file', (formName: string, file: File) => {
    console.log('File received: ' + file);
    if (file.name) {
      console.log("file name: " + file.name);
    } else {
      return
    }
    const completed = new Date().getTime();
    const oldPath = file.path;
    const newPath = uploadsDir + file.name;
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
        existingProgress.fileName = file.name;
        existingProgress.savedLocation = newPath;
        existingProgress.completed = completed;
      }
    }
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


app.get('/', (req, res) => {
  res.sendFile(__dirname + '/client/index.html');
});

app.get('/progresses', (req: Request, res: Response) => {
  console.log("Progresses requested...");
  res.writeHead(200, { 'content-type': 'application/json' });
  res.write(JSON.stringify(progresses));
  res.end();
});

io.on('connection', (socket: socketio.Socket) => {
  console.log('a user connected');
  socket.emit('progresses', progresses);
  socket.on('disconnect', () => {
    console.log('user disconnected');
  });
  socket.on('message', (msg) => {
    console.log('message: ' + msg);
  });
});

app.use('/', [
  express.static(__dirname + '/client/')
]);

httpServer.listen(port, () => {
  console.log('Server listening on ' + port + ' ...');
});
