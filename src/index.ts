

import express, { Express, Request, Response } from 'express';
import {createServer, Server} from "http"
import {router as uploadInitRouter} from "./routes/uploadInit";
import {router as uploadChunkRouter} from "./routes/uploadChunk";
import {router as uploadCompleteRouter} from "./routes/uploadComplete";
import {router as uploadStatusRouter} from "./routes/uploadStatus";
import {ProgressWriter} from "./service/progress_writer";
import * as socketio from "socket.io";
import yargs from "yargs";
import {hideBin} from "yargs/helpers";
import * as os from 'os';
import {getProgressWriter, progresses, setProgressWriter, setUploadsDir} from "./globals";

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
setUploadsDir(uploadsDir)

console.log("Upload location: " + uploadsDir)
console.log("Server port: " + port)

const app: Express = express();
const httpServer: Server = createServer(app)
const io: socketio.Server = new socketio.Server(httpServer);

setProgressWriter(new ProgressWriter(io));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/upload/init', uploadInitRouter);
app.use('/upload/chunk', uploadChunkRouter);
app.use('/upload/complete', uploadCompleteRouter);
app.use('/upload/status', uploadStatusRouter);

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
  getProgressWriter().writeProgress(progresses);
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
