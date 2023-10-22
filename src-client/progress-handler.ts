import { io } from "socket.io-client";
import {Progress} from "../src/model/progress";
import {ProgressUtils} from "../src/model/progress_utils";
import moment from "moment";
import prettyBytes from 'pretty-bytes'

const progressDivCache: Map<string, JQuery<HTMLElement>> = new Map<string, JQuery<HTMLElement>>();

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
      let $singleProgressContainer = progressDivCache.get(progressId);
      if ($singleProgressContainer === undefined) {
        $singleProgressContainer = jQuery(`
          <div id="${progressId}" class="box single-progress-container"></div>
        `);
        $progressContainer.prepend($singleProgressContainer);
        progressDivCache.set(progressId, $singleProgressContainer);
      }

      let $progressElem = $singleProgressContainer.find("progress#" + progressId);
      if ($progressElem.length === 0) {
        $progressElem = jQuery(`
            <progress id='${progressId}' class='progress is-info is-small'
              max='${String(progress.bytesExpected)}' value='${String(progress.bytesReceived)}'></progress>
        `);
        $singleProgressContainer.prepend($progressElem);
      }

      const labelId = `progressLabel-${progressId}`;
      let $progressLabelElem = $singleProgressContainer.find(`#${labelId}`);
      if ($progressLabelElem.length === 0) {
        $progressLabelElem = jQuery(`
          <label id='${labelId}' class='progress-label label'></label>
        `);
        $singleProgressContainer.prepend($progressLabelElem);
      }

      // console.log("Progress: (" + progress.bytesReceived + "/" + progress.bytesExpected + ")");

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
      } else {
        const transferRate = ProgressUtils.calculateTransferRate(progress);
        const transferRateMsg = `Speed: ${prettyBytes(transferRate)}/sec`;
        progressSummary += ` | ${transferRateMsg}`;
      }

      $progressLabelElem.text(progressSummary);
    });
  }
}