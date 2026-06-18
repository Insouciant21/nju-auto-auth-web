(function () {
  "use strict";

  var DEFAULT_SETTINGS = {
    studentId: "",
    password: "",
    autoFill: true,
    autoCaptcha: true
  };

  var form = document.querySelector("#settings-form");
  var status = document.querySelector("#save-status");
  var fields = {
    studentId: document.querySelector("#student-id"),
    password: document.querySelector("#password"),
    autoFill: document.querySelector("#auto-fill"),
    autoCaptcha: document.querySelector("#auto-captcha")
  };

  function setStatus(text) {
    status.textContent = text;
    window.setTimeout(function () {
      if (status.textContent === text) status.textContent = "";
    }, 2600);
  }

  function readForm() {
    return {
      studentId: fields.studentId.value.trim(),
      password: fields.password.value,
      autoFill: fields.autoFill.checked,
      autoCaptcha: fields.autoCaptcha.checked
    };
  }

  function fillForm(settings) {
    fields.studentId.value = settings.studentId || "";
    fields.password.value = settings.password || "";
    fields.autoFill.checked = Boolean(settings.autoFill);
    fields.autoCaptcha.checked = Boolean(settings.autoCaptcha);
  }

  chrome.storage.local.get(DEFAULT_SETTINGS, fillForm);

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    chrome.storage.local.set(readForm(), function () {
      setStatus("已保存");
    });
  });

  document.querySelector("#open-login").addEventListener("click", function () {
    chrome.tabs.create({ url: "https://authserver.nju.edu.cn/authserver/login" });
  });
})();
