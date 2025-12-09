import { io } from "socket.io-client";
import {FileTransferProgress} from "../src/model/progress";
import { ProgressUtils } from "../src/model/progress_utils";
import moment from "moment";
import prettyBytes from "pretty-bytes";

const _progressDivCache: Map<string, JQuery<HTMLElement>> = new Map();
const stateColorMap: Record<"COMPLETE" | "FAILED", string> = {
    COMPLETE: "is-success",
    FAILED: "is-danger",
};

export class ProgressHandler {

    private addToDomCache(progressId: string, $panel: JQuery):void {
        _progressDivCache.set(progressId, $panel);
        this.updateCollapseAllVisibility();
    }

    private getFromDomCache(progressId: string): JQuery | undefined {
        return _progressDivCache.get(progressId);
    }

    private domCacheSize(): number {
        return _progressDivCache.size;
    }

    public registerHandler(): void {
        console.log("Registering Progress Handler...");
        const socket = io();
        socket.emit("message", "Connected.");

        socket.on("progresses", (progresses: FileTransferProgress[]) => {
            this.handleProgresses(progresses);
        });

        this.registerAllDetailToggleEventHandler();
        console.log("Progress handler registration complete.");
    }

    private updateCollapseAllVisibility(): void {
        const $control = $(".all-progress-detail-control");
        if (this.domCacheSize() > 0) {
            $control.removeClass("is-hidden");
        } else {
            $control.addClass("is-hidden");
        }
        const $parentElem = jQuery(".single-progress-container");
        const $btn = jQuery(".all-progress-detail-control button");
        const $progressDetailElems = $parentElem
            .find("[id^='progressTableContainer-']");
        const $hiddenProgressDetailElems = $parentElem
            .find("[id^='progressTableContainer-'].is-hidden");
        const allHidden = $hiddenProgressDetailElems.length === $progressDetailElems.length;
        const buttonLabel = allHidden ? "Expand All" : "Collapse All";
        $btn.text(buttonLabel);
    }

    private registerAllDetailToggleEventHandler(): void {
        const $btn = jQuery(".all-progress-detail-control button");

        $btn.on("click", () => {
            const collapseAll = $btn.text().trim() === "Collapse All";
            const newLabel = collapseAll ? "Expand All" : "Collapse All";
            $btn.text(newLabel);

            // Loop through every progress panel
            jQuery(".single-progress-container").each((_, panel) => {
                const $panel = jQuery(panel);
                const $toggle = $panel.find(".progress-detail-control");
                const $icon = $toggle.find("i");

                // table container selector
                const panelId = $panel.attr("id")!;
                const tableContainerId = `progressTableContainer-${panelId}`;
                const $tableContainer = jQuery(`#${tableContainerId}`);

                if (collapseAll) {
                    // collapse everything
                    $toggle.removeClass("is-active");
                    $tableContainer.addClass("is-hidden");
                    $icon.removeClass("fa-minus-circle").addClass("fa-plus-circle")
                        .attr("title", "expand");
                } else {
                    // expand everything
                    $toggle.addClass("is-active");
                    $tableContainer.removeClass("is-hidden");
                    $icon.removeClass("fa-plus-circle").addClass("fa-minus-circle")
                        .attr("title", "collapse");
                }
            });
        });
    }

    private registerDetailToggleEventHandler($panel: JQuery, tableContainerId: string) {
        $panel.on("click", ".progress-detail-control", (event) => {
            const $btn = jQuery(event.currentTarget);

            const $tableContainer = jQuery(`#${tableContainerId}`);

            // toggle active class
            const isActive: boolean = $btn.toggleClass("is-active").hasClass("is-active");

            // toggle content visibility
            if (isActive) {
                $tableContainer.removeClass("is-hidden");
            } else {
                $tableContainer.addClass("is-hidden");
            }

            // toggle icon
            const $icon = $btn.find("i");

            if (isActive) {
                // expanded → show minus
                $icon.removeClass("fa-plus-circle").addClass("fa-minus-circle");
                $icon.attr("title", "collapse");
            } else {
                // collapsed → show plus
                $icon.removeClass("fa-minus-circle").addClass("fa-plus-circle");
                $icon.attr("title", "expand");
            }

            // no need for _this alias
            this.updateCollapseAllVisibility();
        });
    }

    private handleProgresses(progresses: FileTransferProgress[]): void {
        const $progressContainer = jQuery("div#progress-container");

        progresses.forEach(progress => {
            const progressId = `progress-${progress.uuid}`;
            const uploaded = (progress.uploadedChunks as any)?.length ?? 0;
            const uploading = (progress.uploadingChunks as any)?.length ?? 0;
            const totalChunks = progress.totalChunks ?? 1;

            const colorKey = progress.lastState as keyof typeof stateColorMap;
            const stateColor = stateColorMap[colorKey] || "";

            // Container box
            let $panel = this.getFromDomCache(progressId);
            const tableContainerId = `progressTableContainer-${progressId}`;
            if (!$panel) {
                $panel = jQuery(`<article id="${progressId}" class="progress-panel panel is-bordered single-progress-container mb-4"></article>`);
                $progressContainer.prepend($panel);
                this.addToDomCache(progressId, $panel);
                this.registerDetailToggleEventHandler($panel, tableContainerId);
            }
            // Remove existing progress colors
            $panel.removeClass("is-success is-danger is-info is-warning");
            $panel.addClass(stateColor || "is-info");

            // Add file name as a heading above the table
            const panelHeadingId = `panelHeading-${progressId}`;
            let $panelHeading = $panel.find(`#${panelHeadingId}`);
            if (!$panelHeading.length) {
                $panelHeading = jQuery(`<div id="${panelHeadingId}" class="panel-heading wrap-text is-flex-wrap-wrap p-2 has-text-weight-normal is-size-6 mb-1">
                    <a class="progress-detail-control is-active ml-1 mr-1">
                        <span class="panel-icon m-0 p-0">
                          <i class="fas fa-minus-circle m-0 p-0" aria-hidden="true" title="collapse"></i>
                        </span>
                    </a>
                    <span class="ml-0 pl-0">
                        ${progress.fileName}
                    </span>
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


            let $tableContainer = $panel.find(`#${tableContainerId}`);
            if (!$tableContainer.length) {
                $tableContainer = jQuery(`<div id="${tableContainerId}" class="panel-block table-container m-0 p-0"></div>`);
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
                ["Status", `${progress.lastState || "-"}`],
            ];

            if (progress.completed) {
                const timeTaken = ((progress.completed - (progress.timestamp || 0)) / 1000).toFixed(2);
                rows.push(["Completed in", `${timeTaken} sec`]);
            }

            // Append rows
            for (const [key, value] of rows) {
                $table.append(`<tr><th class="is-narrow">${key}</th><td>${value}</td></tr>`);
            }

            const horizontalRulerId = `horizontalRuler-${progressId}`;
            let $horizontalRuler = $panel.find(`#${horizontalRulerId}`);
            if (!$horizontalRuler.length) {
                $horizontalRuler = jQuery(`<hr id="${horizontalRulerId}" class="is-one-third mt-3 mb-1">`);
                $panel.append($horizontalRuler);
            }

            this.updateCollapseAllVisibility();
        });
    }
}