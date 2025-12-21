import express, { Express, Request, Response } from 'express';
import compression from 'compression';
import {createServer, Server} from "http"
import {router as uploadInitRouter} from "./routes/uploadInit";
import {router as uploadChunkRouter} from "./routes/uploadChunk";
import {router as uploadCompleteRouter} from "./routes/uploadComplete";
import {router as uploadStatusRouter} from "./routes/uploadStatus";
import {router as uploadRouter} from "./routes/upload";
import {ProgressWriter} from "./service/progress_writer";
import * as socketio from "socket.io";
import yargs from "yargs";
import {hideBin} from "yargs/helpers";
import * as os from 'os';
import {
  getEnableCompression, getMaxFileSize,
  getMaxParallelChunkUploads, getServerPort, getUploadChunkSize,
  progresses, setEnableCompression, setMaxFileSize,
  setMaxParallelChunkUploads, setProgressWriter, setServerPort, setUploadChunkSize, setUploadsDir, throttledBroadcaster
} from "./globals";
import prettyBytes from "pretty-bytes";

const homedir = os.homedir();
let uploadsDir = homedir + "/uploads/"
const argv: any = yargs(hideBin(process.argv))
  .option('upload-location', {
    alias: 'l',
    type: 'string',
    description: 'upload location',
    default: uploadsDir
  })
  .option('port', {
    alias: 'p',
    type: 'number',
    default: getServerPort(),
    description: 'server port'
  })
  .option('chunk-size', {
    alias: 's',
    type: 'number',
    description: 'chunk size in bytes',
    default: 512 * 1024
  })
  .option('parallel-uploads', {
    alias: 'n',
    type: 'number',
    description: 'number of simultaneous parallel chunk uploads (per file)',
    default: 10
  })
  .option('enable-compression', {
    alias: 'c',
    type: 'boolean',
    description: 'enable gzip compression (server to client responses)',
    default: true
  })
  .option('max-file-size', {
    alias: 'm',
    type: 'number',
    description: 'maximum file size in bytes',
    default: getMaxFileSize()
  })
  .help()
  .argv

const uploadLocationArg = argv["upload-location"]
if (uploadLocationArg) {
  uploadsDir = uploadLocationArg.endsWith('/') ? uploadLocationArg: uploadLocationArg + '/'
}
setUploadsDir(uploadsDir)
setUploadChunkSize(argv["chunk-size"])
setMaxParallelChunkUploads(argv["parallel-uploads"])
setEnableCompression(argv["enable-compression"])
setServerPort(argv.port)
setMaxFileSize(argv["max-file-size"])
const port = getServerPort()

console.log(`Upload location: ${uploadsDir}`)
console.log(`Max Parallel uploads per file: ${getMaxParallelChunkUploads()}`)
console.log(`Parallel upload chunk size: ${prettyBytes(getUploadChunkSize())}`)
console.log(`Compression: ${getEnableCompression() ? "Enabled" : "Disabled"}`)
console.log(`Server port: ${port}`)

const app: Express = express();
const httpServer: Server = createServer(app)
const io: socketio.Server = new socketio.Server(httpServer);
if (getEnableCompression()) {
  app.use(
      compression({
        threshold: 10 * 1024,
        level: 4
      })
  )
}

setProgressWriter(new ProgressWriter(io));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/upload/init', uploadInitRouter);
app.use('/upload/chunk', uploadChunkRouter);
app.use('/upload/complete', uploadCompleteRouter);
app.use('/upload/status', uploadStatusRouter);
app.use('/upload', uploadRouter);

app.get('/', (_, res) => {
  res.sendFile(__dirname + '/client/index.html');
});

app.get('/progresses', (_: Request, res: Response) => {
  console.log("Progresses requested...");
  res.writeHead(200, { 'content-type': 'application/json' });
  res.write(JSON.stringify(progresses));
  res.end();
});

io.on('connection', (socket: socketio.Socket) => {
  console.log('a user connected');
  // socket.emit('progresses', progresses);
  throttledBroadcaster();
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
