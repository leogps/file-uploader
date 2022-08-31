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


const app: Express = express();
const httpServer: Server = createServer(app)
const port = 8082;
// const uploadsDir = "/home/pi/Downloads/uploads/"
const uploadsDir = "/home/leogps/Downloads/uploads/"
const io: socketio.Server = new socketio.Server(httpServer);
const MAX_FILE_SIZE = 10 * 1024 * 1024 * 1024; // 10Gb

const progresses: Progress[] = [];
const progressWriter: ProgressWriter = new ProgressWriter(io);

app.post('/upload', (req: any, res: any) => {
  // parse a file upload
  const form = formidable({
    multiples: true,
    maxFileSize: MAX_FILE_SIZE
  });
  const timestamp = new Date();
  const uuid = uuidv4();

  form.on('progress', (bytesReceived, bytesExpected) => {
    console.log("Progress: (" + bytesReceived + "/" + bytesExpected + ")");
    const progress: Progress = {
      uuid,
      type: 'progress',
      timestamp,
      bytesReceived,
      bytesExpected,
      bytesReceivedPretty: prettyBytes(bytesReceived),
      bytesExpectedPretty: prettyBytes(bytesExpected)
    };
    progresses.push(progress);
    if (progressWriter) {
      progressWriter.writeProgress(progresses);
    }
  });

  form.on('file', (formName: string, file: File) => {
    console.log('File received: ' + file);
    if (file.name) {
      console.log("file name: " + file.name);
    } else {
      return
    }
    const oldPath = file.path;
    const newPath = uploadsDir + file.name;
    fs.rename(oldPath, newPath, (err) => {
      if (err) {
        console.error(err);
      }
      console.log("File moved to: " + newPath);
    });
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

io.on('connection', (socket) => {
  console.log('a user connected');
  socket.emit('progresses', progresses);
  socket.on('disconnect', () => {
    console.log('user disconnected');
  });
});

io.on('connection', (socket: socketio.Socket) => {
  socket.on('message', (msg) => {
    console.log('message: ' + msg);
  });
});

app.use('/assets', [
  express.static(__dirname + '/node_modules/jquery/dist/'),
  express.static(__dirname + '/node_modules/jquery-blockui/'),
  express.static(__dirname + '/node_modules/bulma/'),
  express.static(__dirname + '/node_modules/moment/')
]);
app.use(favicon(path.join(__dirname, '/public/favicon.ico')));

httpServer.listen(port, () => {
  console.log('Server listening on ' + port + ' ...');
});
