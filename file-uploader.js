var express = require('express');
var favicon = require('serve-favicon');
var path = require('path');

var app = express();
var http = require('http').createServer(app);
const formidable = require('formidable');
const port = 8082;
//const uploadsDir = "/home/pi/Downloads/uploads/";
const uploadsDir = "/home/leogps/Downloads/uploads/";
const fs = require('fs');
var io = require('socket.io')(http);
const MAX_FILE_SIZE = 10 * 1024 * 1024 * 1024; //10Gb
const prettyBytes = require('pretty-bytes');
const { v4: uuidv4 } = require('uuid');

const progresses = [];

var ProgressWriter = function (socket) {
  this.socket = socket;
  this.writeProgress = function (progresses) {
    io.emit('progresses', progresses);
  };
};
var progressWriter = undefined;

app.post('/upload', (req, res) => {
  // parse a file upload
  const form = formidable({
    multiples: true,
    maxFileSize: MAX_FILE_SIZE
  });
  const timestamp = new Date();
  const uuid = uuidv4();

  form.on('progress', (bytesReceived, bytesExpected) => {
    console.log("Progress: (" + bytesReceived + "/" + bytesExpected + ")");
    var progress = {
      uuid: uuid,
      type: 'progress',
      timestamp: timestamp,
      bytesReceived: bytesReceived,
      bytesExpected: bytesExpected,
      bytesReceivedPretty: prettyBytes(bytesReceived),
      bytesExpectedPretty: prettyBytes(bytesExpected)
    };
    progresses.push(progress);
    if (progressWriter) {
      progressWriter.writeProgress(progresses);
    }
  });

  form.on('file', (name, file) => {
    console.log('File recieved: ' + file);
    if (file.name) {
      console.log("file name: " + file.name);
    } else {
      return
    }
    var oldpath = file.path;
    var newpath = uploadsDir + file.name;
    fs.rename(oldpath, newpath, function (err) {
      if (err) {
        console.error(err);
      }
      console.log("File moved to: " + newpath);
    });
  });

  form.parse(req, (err, fields, files) => {
    res.writeHead(200, { 'content-type': 'application/json' });
    console.log(files);
    var success = {
      "msg": 'File uploaded and moved!'
    };
    res.write(JSON.stringify(success));
    res.end();
  });

  return;
});


app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

app.get('/progresses', (req, res) => {
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

io.on('connection', (socket) => {
  socket.on('message', (msg) => {
    console.log('message: ' + msg);
  });

  progressWriter = new ProgressWriter(socket);
});

app.use('/assets', [
  express.static(__dirname + '/node_modules/jquery/dist/'),
  express.static(__dirname + '/node_modules/jquery-blockui/'),
  express.static(__dirname + '/node_modules/bulma/'),
  express.static(__dirname + '/node_modules/moment/')
]);
app.use(favicon(path.join(__dirname, 'favicon.ico')));

http.listen(port, () => {
  console.log('Server listening on ' + port + ' ...');
});
