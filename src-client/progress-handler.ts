import { io } from "socket.io-client";
import {FileTransferProgress} from "../src/model/progress";
import { ProgressUtils } from "../src/model/progress_utils";
import moment from "moment";
import prettyBytes from "pretty-bytes";

const progressDivCache: Map<string, JQuery<HTMLElement>> = new Map();
const stateColorMap: Record<"COMPLETE" | "FAILED", string> = {
    COMPLETE: "is-success",
    FAILED: "is-danger",
};

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

            const key = progress.lastState as keyof typeof stateColorMap;
            const stateColor = stateColorMap[key] || "";

            // Container box
            let $panel = progressDivCache.get(progressId);
            if (!$panel) {
                $panel = jQuery(`<article id="${progressId}" class="progress-panel panel is-bordered single-progress-container mb-4"></article>`);
                $progressContainer.prepend($panel);
                progressDivCache.set(progressId, $panel);
            }
            // Remove existing progress colors
            $panel.removeClass("is-success is-danger is-info is-warning");
            $panel.addClass(stateColor || "is-info");

            // Add file name as a heading above the table
            const panelHeadingId = `panelHeading-${progressId}`;
            let $panelHeading = $panel.find(`#${panelHeadingId}`);
            if (!$panelHeading.length) {
                $panelHeading = jQuery(`<div id="${panelHeadingId}" class="panel-heading wrap-text is-flex-wrap-wrap p-2 has-text-weight-normal is-size-6 mb-1">
                    ${progress.fileName}
                </div>`);
                $panel.append($panelHeading);
            }

            // Main progress bar (bytes)
            let $progressElem = $panel.find(`progress#${progressId}`);
            if (!$progressElem.length) {
                $progressElem = jQuery(`<progress id="${progressId}" class="progress is-info is-small">`);
                $panel.append($progressElem);
            }
            $progressElem.attr("max", (progress.bytesExpected || 100));
            $progressElem.attr("value", (progress.bytesReceived || 0));
            // Remove existing progress colors
            $progressElem.removeClass("is-success is-danger is-info is-warning");
            $progressElem.addClass(stateColor || "is-info");

            const containerId = `progressTableContainer-${progressId}`;
            let $tableContainer = $panel.find(`#${containerId}`);
            if (!$tableContainer.length) {
                $tableContainer = jQuery(`<div id="${containerId}" class="panel-block table-container m-0 p-0"></div>`);
                $panel.append($tableContainer);
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
                ["Transferred", `${prettyBytes(progress.bytesReceived || 0)} / ${prettyBytes(progress.bytesExpected || 0)}`],
                ["Chunks", `Verified ${progress.chunkVerificationCount || 0} 
                    <b>|</b> Uploading: ${uploading} 
                    <b>|</b> Uploaded: ${uploaded}/${totalChunks}`],
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