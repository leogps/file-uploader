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
    console.log("Registering Form Event Handler...");
    jQuery("form#uploadForm").on('submit',  (event) => {

      event.stopPropagation();
      event.preventDefault();

      console.log("Form submitting...");

      const data = new FormData();
      const formElement: any = $('input[name="multipleFiles"]')[0];
      $.each(formElement['files'], function (i, file) {
        data.append('file-' + String(i), file);
      });

      const action = jQuery("form#uploadForm").attr('action');
      $.ajax({
        url: action,
        data: data,
        cache: false,
        contentType: false,
        processData: false,
        method: 'POST',
        type: 'POST', // For jQuery < 1.9
        beforeSend: function () {
          jQuery("form#uploadForm").block({
            message: '<h1>Processing</h1>',
            css: { border: '3px solid #a00' }
          });
        },
        success: function (data) {
          //alert(JSON.stringify(data));
          // new Toast({
          //   message: JSON.stringify(data),
          //   type: 'success'
          // });
          Toastify({
            text: JSON.stringify(data),
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
        error: function (err, s) {
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
        complete: function () {
          jQuery("form#uploadForm").trigger('reset');
          jQuery("form#uploadForm").unblock();
        }
      });
    });
  }
}
