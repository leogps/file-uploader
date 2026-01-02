import { ProgressHandler } from "./progress-handler";
import "jquery-blockui/jquery.blockUI.js";
import "./style.scss";
import Toastify from "toastify-js";
import {computeSHA1} from "./sha1";
import {ServerConfigJson} from "../src/globals";

const MAX_COMPLETE_CHECK_RETRIES = 20;
const COMPLETE_CHECK_RETRY_DELAY_MS = 1000;

jQuery(() => {
    const progressHandler = new ProgressHandler();
    progressHandler.registerHandler();

    const pageEventRegistrar = new PageEventRegistrar();
    pageEventRegistrar.registerEvents();
});

const asyncPool = async <T>(
    poolLimit: number,
    array: T[],
    iteratorFn: (item: T) => Promise<void>
): Promise<void> => {
    const executing = new Set<Promise<void>>();

    for (const item of array) {
        const p = Promise.resolve().then(() => iteratorFn(item));
        executing.add(p);

        const clean = () => executing.delete(p);
        p.then(clean).catch(clean);

        if (executing.size >= poolLimit) {
            await Promise.race(executing);
        }
    }

    await Promise.all(executing);
};

class PageEventRegistrar {
    public registerEvents(): void {
        this.registerThemeSelectionEventHandler();
        this.registerFileInputEventHandler();
        this.registerFormSubmissionEventHandler();
    }

    private registerThemeSelectionEventHandler() {
        const $themeToggle = $('#themeToggle');
        const $themeIcon = $('#themeIcon');
        const $htmlEl = $('html');

        const applyTheme = (theme: string) => {
            $htmlEl.attr('data-theme', theme);
            localStorage.setItem('theme', theme);
            $themeIcon.removeClass('fa-sun fa-moon');
            $themeIcon.addClass(theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon');
        };

        // Detect saved theme or system preference
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme) {
            applyTheme(savedTheme);
        } else {
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            applyTheme(prefersDark ? 'dark' : 'light');
        }

        // Toggle on click
        $themeToggle.on('click', () => {
            const currentTheme = $htmlEl.attr('data-theme');
            const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
            applyTheme(newTheme);
        });
    }

    private registerFileInputEventHandler() {
        const $fileDiv = jQuery("#file-div");
        const $fileNameDiv = $fileDiv.find("#file-name");
        const $fileInput = jQuery("form#uploadForm input[name='file']");
        $fileInput.on("change", () => {
            this.onFilesChange($fileNameDiv, $fileInput);
        });
    }

    private onFilesChange($fileNameDiv: JQuery<HTMLElement>, $fileInput: JQuery<HTMLElement>) {
        $fileNameDiv.html("");
        const files: FileList = $fileInput.prop("files");
        if (files && files.length > 0) {
            const ul = document.createElement("ul");
            for (const file of Array.from(files)) {
                const li = document.createElement("li");
                li.textContent = file.name;
                ul.appendChild(li);
            }
            $fileNameDiv.append(ul);
        } else {
            $fileNameDiv.html("No files selected.");
        }
    }

    private registerFormSubmissionEventHandler() {
        const $uploadForm = jQuery("form#uploadForm");
        $uploadForm.on("submit", (event) => {
            event.preventDefault();

            // wrap async logic in an IIFE
            (async () => {
                const formElement: any = $('input[name="file"]')[0];
                const files: FileList = formElement.files;

                if (!files || files.length === 0) {
                    Toastify({
                        text: "Please select files",
                        duration: 3000,
                        close: true
                    }).showToast();
                    return;
                }

                // Block form before uploading
                $uploadForm.block({
                    message: '<h1 class="upload-block-modal p-2 m-0">Uploading...</h1>'
                });

                const disableChunked = (jQuery("#disableChunkedUpload").prop("checked") === true);
                console.log("disableChunked?", disableChunked);

                const serverConfigResponse = await this.retrieveConfig();
                const errorMessage = serverConfigResponse.error
                if (errorMessage) {
                    let errorText = errorMessage;
                    const errorObject = serverConfigResponse.errorObject;
                    const errorObjectMessage = errorObject instanceof Error ? errorObject.message : String(errorObject);
                    if (serverConfigResponse.errorObject) {
                        errorText = `${errorText}. ${errorObjectMessage}`;
                    }
                    console.error(errorText);
                    Toastify({
                        text: errorText,
                        duration: -1,
                        close: true,
                        style: { background: "linear-gradient(to right, #F39454, #FF6600)" }
                    }).showToast();
                }
                const serverConfigJson = serverConfigResponse.response;
                await this.doUpload(files, {
                    $uploadForm,
                    serverConfig: serverConfigJson,
                    disableChunkedUpload: disableChunked,
                });
            })().catch(err => {
                const message = err instanceof Error ? err.message : String(err);
                console.error("Error during upload:", err);
                Toastify({
                    text: `Upload failed: ${message}`,
                    duration: -1,
                    close: true,
                    style: { background: "linear-gradient(to right, #F39454, #FF6600)" }
                }).showToast();
            });
        });
    }

    private async doUpload(files: FileList, {
        disableChunkedUpload = false,
        serverConfig,
        $uploadForm,
    }: {
        disableChunkedUpload: boolean,
        serverConfig?: ServerConfigJson,
        $uploadForm: JQuery<HTMLElement>
    }):Promise<void> {
        try {
            let maxParallelFileUploads = 1;
            if (serverConfig != null) {
                maxParallelFileUploads = serverConfig.maxParallelFileUploads;
            }
            console.log(`Max parallel file uploads: ${maxParallelFileUploads}`);
            await asyncPool(
                maxParallelFileUploads,
                Array.from(files),
                async (file) => {
                    if (disableChunkedUpload) {
                        await this.uploadFileNonChunked(file);
                    } else {
                        await this.uploadFile(file);
                    }
                }
            ).catch(err => {
                console.error("Error during upload:", err);
                Toastify({
                    text: `Upload failed: ${err}`,
                    duration: -1,
                    close: true,
                    style: { background: "linear-gradient(to right, #F39454, #FF6600)" }
                }).showToast();
            });
        } finally {
            // Unblock and reset form after all files finish
            $uploadForm.trigger("reset");

            const $fileDiv = jQuery("#file-div");
            const $fileNameDiv = $fileDiv.find("#file-name");
            const $fileInput = jQuery("form#uploadForm input[name='file']");
            this.onFilesChange($fileNameDiv, $fileInput);

            $uploadForm.unblock();
        }
    }

    private async uploadFileNonChunked(file: File): Promise<void> {
        const formData = new FormData();
        // Server-side uses formidable({ multiples: true }) so using the same field name is fine
        formData.append("file", file, file.name);

        const resp = await fetch("/upload", {
            method: "POST",
            body: formData
        });

        let data: any;
        const contentType = resp.headers.get("content-type") || "";
        if (contentType.includes("application/json")) {
            data = await resp.json();
        } else {
            data = await resp.text();
        }

        if (!resp.ok) {
            throw new Error(typeof data === "string" ? data : (data?.msg || "Upload failed"));
        }

        Toastify({
            text: `Upload complete: ${file.name}`,
            duration: -1,
            close: true,
            style: { background: "linear-gradient(to right, #00b09b, #96c93d)" }
        }).showToast();
    }

    private async uploadFile(file: File): Promise<void> {
        try {
            // Initialize upload
            const initResp = await fetch("/upload/init", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ fileName: file.name, fileSize: file.size })
            });
            const initData = await initResp.json();
            const fileId: string = initData.fileId;
            const chunkSize: number = initData.chunkSize;
            const maxParallelChunkUploads: number = initData.maxParallelChunkUploads || 3;
            const totalChunks: number = Math.ceil(file.size / chunkSize);

            // Active upload pool
            const pool: Promise<void>[] = [];

            // Function to handle one chunk
            const uploadChunkTask = async (chunkIndex: number) => {
                const start = chunkIndex * chunkSize;
                const end = Math.min(start + chunkSize, file.size);
                const chunk = file.slice(start, end);

                // Compute SHA-1 for just this chunk
                const chunkHash = await computeSHA1(chunk);

                // Check if chunk already exists on server
                const statusResp = await fetch(
                    `/upload/status?fileId=${fileId}&chunkIndex=${chunkIndex}&chunkSize=${chunkSize}&hash=${chunkHash}`
                );
                const statusData = await statusResp.json();
                console.log(`chunk-status for index ${chunkIndex}: hash-matches? ${statusData.hashMatches}`);

                if (statusData.hashMatches) {
                    // already uploaded
                    return;
                }

                // Upload chunk
                const formData = new FormData();
                formData.append("chunk", chunk, file.name);
                await this.uploadChunk(fileId, chunkIndex, chunkHash, formData);
            };

            // Loop through chunks and dynamically manage pool
            for (let i = 0; i < totalChunks; i++) {
                const taskPromise: Promise<void> = uploadChunkTask(i)
                    .finally(() => {
                        const index = pool.indexOf(taskPromise);
                        if (index > -1) {
                            // remove finished task
                            pool.splice(index, 1);
                        }
                    })
                    .catch(err => {
                        console.error(`Chunk ${i} failed:`, err);
                        throw err;
                    });

                pool.push(taskPromise);

                // If pool is full, wait for at least one to finish
                if (pool.length >= maxParallelChunkUploads) {
                    await Promise.race(pool).catch((err) => {
                        console.warn(`Pool full, but one task failed, err: ${err}`);
                    }); // don't block other tasks
                }
            }

            // Wait for remaining chunks
            await Promise.all(pool);

            // Complete upload
            let completeData: any = null;
            let markUploadFailed = false;
            for (let attempt = 1; attempt <= MAX_COMPLETE_CHECK_RETRIES; attempt++) {
                markUploadFailed = attempt === MAX_COMPLETE_CHECK_RETRIES;
                if (markUploadFailed) {
                    console.warn(`Marking upload as failed after ${attempt} retries...`);
                }
                const completeResp = await fetch(`/upload/complete?fileId=${fileId}&markUploadFailed=${markUploadFailed}`,
                {
                    method: "POST"
                });
                completeData = await completeResp.json();

                if (completeResp.ok && completeData.msg !== 'File incomplete') {
                    // Upload is confirmed complete
                    break;
                }

                console.log(`Attempt ${attempt}: file still incomplete, retrying in ${COMPLETE_CHECK_RETRY_DELAY_MS}ms...`);
                await new Promise(res => setTimeout(res, COMPLETE_CHECK_RETRY_DELAY_MS));
            }

            if (!completeData || completeData.msg === 'File incomplete') {
                Toastify({
                    text: `Upload failed: file incomplete after ${MAX_COMPLETE_CHECK_RETRIES} retries`,
                    duration: -1,
                    close: true,
                    style: { background: "linear-gradient(to right, #F39454, #FF6600)" }
                }).showToast();
            } else {
                Toastify({
                    text: `Upload complete: ${file.name}, saved to: ${completeData.savedLocation}`,
                    duration: -1,
                    close: true,
                    style: { background: "linear-gradient(to right, #00b09b, #96c93d)" }
                }).showToast();
            }

        } catch (err: any) {
            console.error(`Error uploading file ${file.name}:`, err);
            Toastify({
                text: `Error uploading file ${file.name}, ${err}`,
                duration: -1,
                close: true,
                style: { background: "linear-gradient(to right, #F39454, #FF6600)" }
            }).showToast();
        }
    }

    private async uploadChunk(fileId: string, chunkIndex: number, hash: string, formData: FormData) {
        let uploaded = false;
        while (!uploaded) {
            try {
                const chunkResp = await fetch(`/upload/chunk?fileId=${fileId}&chunkIndex=${chunkIndex}&hash=${hash}`, {
                    method: "POST",
                    body: formData
                });
                if (chunkResp.ok) {
                    uploaded = true;
                } else {
                    console.warn(`Retrying chunk ${chunkIndex}...`);
                    await new Promise(res => setTimeout(res, 500));
                }
            } catch (err) {
                console.error(`Chunk ${chunkIndex} upload error:`, err);
                await new Promise(res => setTimeout(res, 500));
            }
        }
    }

    private async retrieveConfig(): Promise<ResponseOrError<ServerConfigJson>> {
        try {
            const response = await fetch(`/config`)
            if (response.ok) {
                const serverConfigJson = await response.json();
                return {
                    response: serverConfigJson as ServerConfigJson
                };
            }
            return {
                "error": `Could not retrieve config: ${response.status}`
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error(`Could not retrieve config: ${errorMessage}`);
            return {
                error: `Failed to retrieve config: ${errorMessage}`,
                errorObject: error,
            };
        }

    }
}

interface ResponseOrError<T> {
    response?: T;
    error?: string,
    errorObject?: any
}