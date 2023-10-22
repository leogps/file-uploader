import {ProgressHandler} from "./progress-handler";
import "jquery-blockui/jquery.blockUI.js";
import "./style.scss";
import Toastify from 'toastify-js';

jQuery(() => {
  const progressHandler = new ProgressHandler();
  progressHandler.registerHandler();

  const formEventRegistrar = new FormEventRegistrar();
  formEventRegistrar.registerEvents();
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
    $fileInput.on('change', () => {
      this.onFilesChange($fileNameDiv, $fileInput);
    });
  }

  private onFilesChange($fileNameDiv: JQuery<HTMLElement>, $fileInput: JQuery<HTMLElement>) {
    $fileNameDiv.html('');
    const files = $fileInput.prop('files');

    if (files.length > 0) {
      for (const file of files) {
        const listItem = document.createElement("li");
        listItem.textContent = file.name;
        $fileNameDiv.append(listItem);
      }
    } else {
      $fileNameDiv.html('No files selected.');
    }
  }

  private registerFormSubmissionEventHandler() {
    console.log("Registering Form Event Handler...");
    jQuery("form#uploadForm").on('submit',  (event) => {

      event.stopPropagation();
      event.preventDefault();

      console.log("Form submitting...");

      const data = new FormData();
      const formElement: any = $('input[name="multipleFiles"]')[0];
      if (formElement.files.length < 1) {
        Toastify({
          text: "Please select files to upload.",
          duration: 3*1000, // toast forever.
          close: true,
          gravity: "top", // `top` or `bottom`
          position: "right", // `left`, `center` or `right`
          stopOnFocus: true, // Prevents dismissing of toast on hover
          style: {
            background: "linear-gradient(to right, #F39454, #FF6600)"
          }
        }).showToast();
        return;
      }
      $.each(formElement.files, (i, file) => {
        data.append('file-' + String(i), file);
      });

      const action = jQuery("form#uploadForm").attr('action');
      $.ajax({
        url: action,
        data,
        cache: false,
        contentType: false,
        processData: false,
        method: 'POST',
        type: 'POST', // For jQuery < 1.9
        beforeSend: () => {
          jQuery("form#uploadForm").block({
            message: '<h1>Processing</h1>',
            css: {border: '3px solid #a00'}
          });
        },
        success: (responseData) => {
          // alert(JSON.stringify(data));
          // new Toast({
          //   message: JSON.stringify(data),
          //   type: 'success'
          // });
          Toastify({
            text: JSON.stringify(responseData),
            duration: 10000,
            close: true,
            gravity: "top", // `top` or `bottom`
            position: "right", // `left`, `center` or `right`
            stopOnFocus: true, // Prevents dismissing of toast on hover
            style: {
              background: "linear-gradient(to right, #00b09b, #96c93d)"
            }
          }).showToast();
        },
        error: (err, s) => {
          Toastify({
            text: "Error occurred: " + JSON.stringify(err) + ";; s: " + s,
            duration: -1, // toast forever.
            close: true,
            gravity: "top", // `top` or `bottom`
            position: "right", // `left`, `center` or `right`
            stopOnFocus: true, // Prevents dismissing of toast on hover
            style: {
              background: "linear-gradient(to right, #F39454, #FF6600)"
            }
          }).showToast();
        },
        complete: () => {
          jQuery("form#uploadForm").trigger('reset');

          const $fileDiv = jQuery("#file-div");
          const $fileNameDiv = $fileDiv.find("#file-name");
          const $fileInput = jQuery("form#uploadForm input[name='multipleFiles']");
          this.onFilesChange($fileNameDiv, $fileInput);

          jQuery("form#uploadForm").unblock();
        }
      }).catch(() => {
        console.error("Request failed!");
      });
    });
  }
}
