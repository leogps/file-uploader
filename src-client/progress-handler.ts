import { io } from "socket.io-client";
import {Progress} from "../src/model/progress";
import moment from "moment";

export class ProgressHandler {
  public registerHandler(): void {
    console.log("Registering Progress Handler...");
    const socket = io();
    socket.emit('message', "Connected.");

    socket.on('progresses', (progresses) => {
      this.handleProgresses(progresses);
    });
    console.log("Registration complete.");
  }

  private handleProgresses(progresses: Progress[]): void {
    console.log("Handling progresses....: " + progresses.length);
    progresses.sort((a, b) => {
      const bTimestamp: any = b.timestamp;
      const aTimestamp: any = a.timestamp;
      return bTimestamp - aTimestamp;
    });

    const $progressContainer = jQuery("div#progress-container");
    jQuery.each(progresses, (index, progress) => {

      const progressId = 'progress-' + progress.uuid;
      let $progressElem = jQuery("progress#" + progressId);
      if ($progressElem.length === 0) {
        $progressElem = jQuery("<progress id='" + progressId + "' class='progress is-success' max='100' value='0'></progress>");
        $progressContainer.prepend($progressElem);
      }

      const labelId = 'progressLabel-' + progress.uuid;
      let $progressLabelElem = jQuery("#" + labelId);
      if ($progressLabelElem.length === 0) {
        $progressLabelElem = jQuery("<label id='" + labelId + "' class='progress-label label'></label>");
        $progressContainer.prepend($progressLabelElem);
      }

      console.log("Progress: (" + progress.bytesReceived + "/" + progress.bytesExpected + ")");

      $progressElem.attr("value", String(progress.bytesReceived));
      $progressElem.attr("max", String(progress.bytesExpected));

      let progressSummary = '';
      if (progress.bytesReceivedPretty && progress.bytesExpectedPretty) {
        const transferSummary = `Progress: (${progress.bytesReceivedPretty?.toString()} / ${progress.bytesExpectedPretty?.toString()})`;
        const timestampSummary = `Started: ${moment(progress.timestamp).format('MMMM Do YYYY, h:mm:ss a')}`;
        progressSummary += `${transferSummary} | ${timestampSummary}`;
      }

      // if (progress.fileName) {
      //     var fileNameSummary = `Name: ${progress.fileName}`;
      //     progressSummary += ` | ${fileNameSummary}`;
      // }
      if (progress.savedLocation) {
        const savedLocationSummary = `Location: ${progress.savedLocation}`;
        progressSummary += ` | ${savedLocationSummary}`;
      }
      if (progress.completed) {
        const timeTaken = (moment(progress.completed)
          .diff(progress.timestamp) / 1000)
          .toFixed(2);
        const timeTakenSummary = `Time taken: ${timeTaken} sec`
        progressSummary += ` | ${timeTakenSummary}`
      }

      $progressLabelElem.text(progressSummary);
    });
  }
}