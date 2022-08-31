import {Progress} from "../model/progress";
import {Server} from "socket.io";

export class ProgressWriter {
  io: Server;

  constructor(io: Server) {
    this.io = io
  }

  public writeProgress(progresses: Progress[]) {
    this.io.emit('progresses', progresses)
  }
}