import { ProgressHandler } from "./progress-handler";
import "jquery-blockui/jquery.blockUI.js";
import "./style.scss";
import Toastify from "toastify-js";
import {computeSHA1} from "./sha1";

const MAX_COMPLETE_CHECK_RETRIES = 20;
const COMPLETE_CHECK_RETRY_DELAY_MS = 1000;

jQuery(() => {
    const progressHandler = new ProgressHandler();
    progressHandler.registerHandler();

    const formRegistrar = new FormEventRegistrar();
    formRegistrar.registerEvents();
});

class FormEventRegistrar {
    public registerEvents(): void {
        this.registerFileInputEventHandler();
        this.registerFormSubmissionEventHandler();
    }

    private registerFileInputEventHandler() {
        const $fileDiv = jQuery("#file-div");
        const $fileNameDiv = $fileDiv.find("#file-name");
        const $fileInput = jQuery("form#uploadForm input[name='multipleFiles']");
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
                const formElement: any = $('input[name="multipleFiles"]')[0];
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
                    message: '<h1>Uploading...</h1>',
                    css: { border: '3px solid #a00' }
                });

                try {
                    // Upload all files sequentially
                    for (const file of Array.from(files)) {
                        await this.uploadFile(file);
                    }
                } finally {
                    // Unblock and reset form after all files finish
                    $uploadForm.trigger("reset");

                    const $fileDiv = jQuery("#file-div");
                    const $fileNameDiv = $fileDiv.find("#file-name");
                    const $fileInput = jQuery("form#uploadForm input[name='multipleFiles']");
                    this.onFilesChange($fileNameDiv, $fileInput);

                    $uploadForm.unblock();
                }
            })().catch(err => {
                console.error("Error during upload:", err);
                Toastify({
                    text: `Upload error: ${err}`,
                    duration: -1,
                    close: true,
                    style: { background: "linear-gradient(to right, #F39454, #FF6600)" }
                }).showToast();
            });
        });
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
            const maxParallel: number = initData.maxParallel || 3;
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
                if (pool.length >= maxParallel) {
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
}