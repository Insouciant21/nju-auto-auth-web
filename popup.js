(function () {
  "use strict";

  var DEFAULTS = { studentId: "", password: "", autoFill: true, autoCaptcha: true };

  var sid = document.querySelector("#sid");
  var pw  = document.querySelector("#pw");
  var af  = document.querySelector("#af");
  var ac  = document.querySelector("#ac");
  var msg = document.querySelector("#msg");

  function show(text, isErr) {
    msg.textContent = text;
    msg.className = isErr ? "err" : "";
    window.setTimeout(function () {
      if (msg.textContent === text) { msg.textContent = ""; msg.className = ""; }
    }, 2200);
  }

  function load() {
    chrome.storage.local.get(DEFAULTS, function (s) {
      sid.value = s.studentId || "";
      pw.value = s.password || "";
      af.checked = s.autoFill !== false;
      ac.checked = s.autoCaptcha !== false;
    });
  }

  function read() {
    return {
      studentId: sid.value.trim(),
      password: pw.value,
      autoFill: af.checked,
      autoCaptcha: ac.checked
    };
  }

  load();

  document.querySelector("#save").addEventListener("click", function () {
    chrome.storage.local.set(read(), function () { show("已保存"); });
  });

  document.querySelector("#open").addEventListener("click", function () {
    chrome.tabs.create({ url: "https://authserver.nju.edu.cn/authserver/login" });
  });

  // Save on Enter in password field
  pw.addEventListener("keydown", function (e) {
    if (e.key === "Enter") {
      chrome.storage.local.set(read(), function () { show("已保存"); });
    }
  });
})();
