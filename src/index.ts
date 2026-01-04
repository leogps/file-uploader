import express, { Express, Request, Response } from 'express';
import compression from 'compression';
import {createServer, Server} from "http"
import {router as uploadInitRouter} from "./routes/uploadInit";
import {router as uploadChunkRouter} from "./routes/uploadChunk";
import {router as uploadCompleteRouter} from "./routes/uploadComplete";
import {router as uploadStatusRouter} from "./routes/uploadStatus";
import {router as uploadRouter} from "./routes/upload";
import {router as configRouter} from "./routes/config";
import {ProgressWriter} from "./service/progress_writer";
import * as socketio from "socket.io";
import yargs from "yargs";
import {hideBin} from "yargs/helpers";

import {
  createThrottledBroadcaster,
  getServerConfig, progresses, throttledBroadcaster, updateServerConfig,
} from "./globals";
import prettyBytes from "pretty-bytes";
import path from "path";

const serverConfig = getServerConfig();
console.log(`🚀file-uploader ${serverConfig.version}\n`);
const argv: any = yargs(hideBin(process.argv))
  .option('upload-location', {
    alias: 'l',
    type: 'string',
    description: 'upload location',
    default: serverConfig.uploadsDir,
  })
  .option('port', {
    alias: 'p',
    type: 'number',
    default: serverConfig.serverPort,
    description: 'server port'
  })
  .option('chunk-size', {
    alias: 's',
    type: 'number',
    description: 'chunk size in bytes',
    default: serverConfig.uploadChunkSize,
    defaultDescription: prettyBytes(serverConfig.uploadChunkSize, {binary: true}),
  })
  .option('parallel-file-uploads', {
    alias: 'N',
    type: 'number',
    description: 'number of simultaneous parallel file uploads',
    default: serverConfig.maxParallelFileUploads
  })
  .option('parallel-chunk-uploads', {
    alias: 'n',
    type: 'number',
    description: 'number of simultaneous parallel chunk uploads (per file)',
    default: serverConfig.maxParallelChunkUploads
  })
  .option('enable-compression', {
    alias: 'c',
    type: 'boolean',
    description: 'enable gzip compression (server to client responses)',
    default: serverConfig.enableCompression
  })
  .option('max-file-size', {
    alias: 'm',
    type: 'number',
    description: 'maximum file size in bytes',
    default: serverConfig.maxFileSize,
    defaultDescription: prettyBytes(serverConfig.maxFileSize, {binary: true}),
  })
  .help()
  .argv

const uploadLocationArg = argv["upload-location"]
let uploadsDir: string = serverConfig.uploadsDir
if (uploadLocationArg) {
  uploadsDir = uploadLocationArg.endsWith('/') ? uploadLocationArg: uploadLocationArg + '/'
}
updateServerConfig({
  uploadsDir,
  uploadChunkSize: argv["chunk-size"],
  maxParallelFileUploads: argv["parallel-file-uploads"],
  maxParallelChunkUploads: argv["parallel-chunk-uploads"],
  enableCompression: argv["enable-compression"],
  serverPort: argv.port,
  maxFileSize: argv["max-file-size"],
})
console.log(`Upload location: ${serverConfig.uploadsDir}`)
console.log(`Max Parallel file uploads: ${serverConfig.maxParallelFileUploads}`)
console.log(`Max Parallel (chunk) uploads per file: ${serverConfig.maxParallelChunkUploads}`)
console.log(`Parallel upload chunk size: ${prettyBytes(serverConfig.uploadChunkSize, {binary: true})}`)
console.log(`Compression: ${serverConfig.enableCompression ? "Enabled" : "Disabled"}`)
console.log(`Server port: ${serverConfig.serverPort}`)
console.log(`\n`)

console.info("Starting application server...")
const app: Express = express();
const httpServer: Server = createServer(app)
const io: socketio.Server = new socketio.Server(httpServer);
if (serverConfig.enableCompression) {
  console.debug("enabling compression...")
  app.use(
      compression({
        threshold: 10 * 1024,
        level: 4
      })
  )
}
updateServerConfig({
  progressWriter: new ProgressWriter(io)
})
createThrottledBroadcaster();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/upload/init', uploadInitRouter);
app.use('/upload/chunk', uploadChunkRouter);
app.use('/upload/complete', uploadCompleteRouter);
app.use('/upload/status', uploadStatusRouter);
app.use('/upload', uploadRouter);
app.use('/config', configRouter);

const isDev = process.env.NODE_ENV !== 'production';

const clientDir = isDev
    ? path.resolve(__dirname, "../dist/client")  // dev: server in src/, client in dist/
    : path.resolve(__dirname, "client");        // prod: server in dist/, client in dist/client

app.get('/', (_, res) => {
  res.sendFile(path.join(clientDir, 'index.html'));
});
app.use('/', [
  express.static(clientDir)
]);

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

httpServer.listen(serverConfig.serverPort, () => {
  console.log('Server listening on ' + serverConfig.serverPort + ' ...');
});
