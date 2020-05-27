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

var ProgressWriter = function (socket) {
  this.socket = socket;
  this.writeProgress = function (progress) {
    socket.emit('progress', progress);
  };
};
var progressWriter = undefined;

app.post('/upload', (req, res) => {
  // parse a file upload
  const form = formidable({
    multiples: true,
    maxFileSize: MAX_FILE_SIZE
  });

  form.on('progress', (bytesReceived, bytesExpected) => {
    console.log("Progress: (" + bytesReceived + "/" + bytesExpected + ")");
    var progress = {
      type: 'progress',
      bytesReceived: bytesReceived,
      bytesExpected: bytesExpected,
      bytesReceivedPretty: prettyBytes(bytesReceived),
      bytesExpectedPretty: prettyBytes(bytesExpected)
    };
    if (progressWriter) {
      progressWriter.writeProgress(progress);
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
        throw err;
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

io.on('connection', (socket) => {
  console.log('a user connected');
  socket.on('disconnect', () => {
    console.log('user disconnected');
  });
});

io.on('connection', (socket) => {
  socket.on('message', (msg) => {
    console.log('message: ' + msg);
  });

  progressWriter = new ProgressWriter(socket);

  // (function showProgress(val, max) {

  //   socket.emit('progress', {
  //     type: 'progress',
  //     bytesReceived: val,
  //     bytesExpected: max
  //   });

  //   if (val < max) {
  //     setTimeout(function() {showProgress(++val, max);}, 100);
  //   }

  // })(0, 100);
});

app.use('/assets', [
  express.static(__dirname + '/node_modules/jquery/dist/'),
  express.static(__dirname + '/node_modules/jquery-blockui/'),
  express.static(__dirname + '/node_modules/bulma/')
]);
app.use(favicon(path.join(__dirname, 'favicon.ico')));

http.listen(port, () => {
  console.log('Server listening on ' + port + ' ...');
});
