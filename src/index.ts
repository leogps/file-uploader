import express, { Express, Request, Response } from 'express';
import favicon from 'serve-favicon'
import * as path from 'path'
import {createServer, Server} from "http"
import formidable, {File} from "formidable"
import * as fs from "fs"
import prettyBytes from 'pretty-bytes'
import {Progress} from "./model/progress";
import {ProgressWriter} from "./service/progress_writer";
import * as socketio from "socket.io";
import { v4 as uuidv4 } from 'uuid';
import * as _ from "lodash";
import yargs from "yargs";
import {hideBin} from "yargs/helpers";
import * as os from 'os';

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
  uploadsDir = argv.upload_location
}

console.log("Upload location: " + uploadsDir)
console.log("Server port: " + port)

const app: Express = express();
const httpServer: Server = createServer(app)
const io: socketio.Server = new socketio.Server(httpServer);
const MAX_FILE_SIZE = 10 * 1024 * 1024 * 1024; // 10Gb

const progresses: Progress[] = [];
const uploadsProgressMap: Map<string, Progress> = new Map<string, Progress>();
const progressWriter: ProgressWriter = new ProgressWriter(io);
const throttleWaitTimeInMillis = 250;

app.post('/upload', (req: any, res: any) => {
  // parse a file upload
  const form = formidable({
    multiples: true,
    maxFileSize: MAX_FILE_SIZE
  });
  const timestamp = new Date();
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
    const completed = new Date();
    const oldPath = file.path;
    const newPath = uploadsDir + file.name;
    fs.rename(oldPath, newPath, (err) => {
      if (err) {
        console.error(err);
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
  res.sendFile(__dirname + '/public/index.html');
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

app.use('/assets', [
  express.static(__dirname + '/node_modules/jquery/dist/'),
  express.static(__dirname + '/node_modules/jquery-blockui/'),
  express.static(__dirname + '/node_modules/bulma/'),
  express.static(__dirname + '/node_modules/moment/'),
  express.static(__dirname + '/node_modules/throttle-debounce/'),
  express.static(__dirname + '/js/')
]);
app.use(favicon(path.join(__dirname, '/public/favicon.ico')));

httpServer.listen(port, () => {
  console.log('Server listening on ' + port + ' ...');
});
