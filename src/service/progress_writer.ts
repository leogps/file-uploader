import {Progress, TransferSample} from "../model/progress";
import {Server} from "socket.io";

export class ProgressWriter {
  io: Server;

  constructor(io: Server) {
    this.io = io
  }

  public writeProgress(progresses: Progress[]) {
    const progressesEmittable = [] as Progress[];
    progresses.forEach(p => {
      const cloned = this.cloneObjectExceptField(p, 'transferSamples') as Progress;
      cloned.transferSamples = [] as TransferSample[];
      if (p.transferSamples && p.transferSamples.length >= 2) {
        cloned.transferSamples.push(p.transferSamples[0]);
        cloned.transferSamples.push(p.transferSamples[p.transferSamples.length - 1]);
      }
      progressesEmittable.push(cloned);
    });

    this.io.emit('progresses', progressesEmittable)
  }

  cloneObjectExceptField<T extends Record<string, any>, K extends keyof T>(
    obj: T,
    fieldToExclude: Extract<keyof T, string>
  ): Omit<T, K> {
    const clonedObject = {} as Omit<T, K>;

    for (const key in obj) {
      if (obj.hasOwnProperty(key) && key !== fieldToExclude) {
        const c: Record<string, any> = clonedObject;
        c[key.toString()] = obj[key];
      }
    }

    return clonedObject;
  }
}