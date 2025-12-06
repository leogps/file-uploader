import { io } from "socket.io-client";
import {FileTransferProgress} from "../src/model/progress";
import { ProgressUtils } from "../src/model/progress_utils";
import moment from "moment";
import prettyBytes from "pretty-bytes";

const progressDivCache: Map<string, JQuery<HTMLElement>> = new Map();

export class ProgressHandler {

    public registerHandler(): void {
        console.log("Registering Progress Handler...");
        const socket = io();
        socket.emit("message", "Connected.");

        socket.on("progresses", (progresses: FileTransferProgress[]) => {
            this.handleProgresses(progresses);
        });

        console.log("Progress handler registration complete.");
    }

    private handleProgresses(progresses: FileTransferProgress[]): void {
        const $progressContainer = jQuery("div#progress-container");

        progresses.forEach(progress => {
            const progressId = `progress-${progress.uuid}`;
            const uploaded = (progress.uploadedChunks as any)?.length ?? 0;
            const uploading = (progress.uploadingChunks as any)?.length ?? 0;
            const totalChunks = progress.totalChunks ?? 1;

            // Container box
            let $box = progressDivCache.get(progressId);
            if (!$box) {
                $box = jQuery(`<div id="${progressId}" class="box single-progress-container"></div>`);
                $progressContainer.prepend($box);
                progressDivCache.set(progressId, $box);
            }

            // Main progress bar (bytes)
            let $progressElem = $box.find(`progress#${progressId}`);
            if (!$progressElem.length) {
                $progressElem = jQuery(`<progress id="${progressId}" class="progress is-info is-small"></progress>`);
                $box.prepend($progressElem);
            }
            $progressElem.attr("max", progress.bytesExpected!);
            $progressElem.attr("value", progress.bytesReceived!);

            // Add file name as a heading above the table
            const labelId = `labelContainer-${progressId}`;
            let $labelContainer = $box.find(`#${labelId}`);
            if (!$labelContainer.length) {
                $labelContainer = jQuery(`<div id="${labelId}" class="has-text-weight-bold" style="margin-top:5px;">
                    ${progress.fileName}
                </div>`);
                $box.append($labelContainer);
            }

            const containerId = `progressTableContainer-${progressId}`;
            let $tableContainer = $box.find(`#${containerId}`);
            if (!$tableContainer.length) {
                $tableContainer = jQuery(`<div id="${containerId}" class="table-container" style="margin-top:5px;"></div>`);
                $box.append($tableContainer);
            }

            const tableId = `progressTable-${progressId}`;
            let $table = $tableContainer.find(`#${tableId}`);
            if (!$table.length) {
                $table = jQuery(`<table id="${tableId}" class="table is-fullwidth is-bordered is-striped"></table>`);
                $tableContainer.append($table);
            }

            // Clear previous rows
            $table.empty();

            // Define table rows
            const rows: [string, string][] = [
                // ["File Name", progress.fileName || "-"],
                // ["Location", progress.savedLocation || "-"],
                ["Started", moment(progress.timestamp).format("MMMM Do YYYY, h:mm:ss a")],
                ["Bytes Received", `${prettyBytes(progress.bytesReceived || 0)} / ${prettyBytes(progress.bytesExpected || 0)}`],
                ["Chunks Uploaded", `${uploaded}/${totalChunks}`],
                ["Chunks Verified", `${progress.chunkVerificationCount || 0}`],
                ["Chunks Uploading", `${uploading}`],
                ["Speed", `${prettyBytes(ProgressUtils.calculateTransferRate(progress))}/s`],
                ["Last State", `${progress.lastState || "-"}`],
            ];

            if (progress.completed) {
                const timeTaken = ((progress.completed - (progress.timestamp || 0)) / 1000).toFixed(2);
                rows.push(["Completed in", `${timeTaken} sec`]);
            }

            // Append rows
            for (const [key, value] of rows) {
                $table.append(`<tr><th class="is-narrow">${key}</th><td>${value}</td></tr>`);
            }
        });
    }
}