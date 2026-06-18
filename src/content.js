import { init as ocrInit, isReady as ocrReady, whenReady as ocrWhenReady, recognise } from "./captcha-ocr.js";

(function () {
  "use strict";

  var DEFAULT_SETTINGS = {
    studentId: "",
    password: "",
    autoFill: true,
    autoCaptcha: true
  };

  var selectors = {
    username: [
      "#username",
      "input[name='username']",
      "input[name='userName']",
      "input[type='text'][autocomplete='username']"
    ],
    password: [
      "#password",
      "input[name='password']",
      "input[type='password']"
    ],
    captchaInput: [
      "#captchaResponse",
      "#captcha",
      "input[name='captchaResponse']",
      "input[name='captcha']",
      "input[placeholder*='验证码']",
      "input[aria-label*='验证码']"
    ],
    captchaImage: [
      "#captchaImg",
      "img[id*='captcha' i]",
      "img[src*='captcha' i]"
    ]
  };

  function queryFirst(candidates) {
    for (var i = 0; i < candidates.length; i++) {
      var node = document.querySelector(candidates[i]);
      if (node) return node;
    }
    return null;
  }

  function setNativeValue(input, value) {
    var prototype = Object.getPrototypeOf(input);
    var descriptor = Object.getOwnPropertyDescriptor(prototype, "value");
    if (descriptor && descriptor.set) {
      descriptor.set.call(input, value);
    } else {
      input.value = value;
    }
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function addStatus(text, type) {
    var el = document.querySelector(".nju-autologin-status");
    if (!el) {
      el = document.createElement("div");
      el.className = "nju-autologin-status";
      document.documentElement.appendChild(el);
    }
    el.textContent = text;
    el.dataset.type = type || "info";
    window.setTimeout(function () {
      if (el && el.parentNode) el.parentNode.removeChild(el);
    }, 5000);
  }

  // ── Captcha OCR ──────────────────────────────────────────────────

  var _lastCaptchaUrl = "";

  async function tryRecogniseCaptcha(captchaImage, captchaInput, settings) {
    if (!settings.autoCaptcha) return false;
    var src = captchaImage.src;
    if (!src || src === _lastCaptchaUrl) return false;
    _lastCaptchaUrl = src;

    try { await ocrWhenReady(); } catch (err) {
      console.error("[NJU Helper] OCR init failed:", (err && err.message) || err);
      addStatus("NJU Helper: 模型加载失败，请手动输入", "warning");
      return false;
    }
    if (!ocrReady()) return false;

    captchaImage.classList.add("nju-autologin-captcha--loading");
    try {
      var result = await recognise(captchaImage);
      if (result && result.text && result.text.length >= 4) {
        setNativeValue(captchaInput, result.text);
        addStatus("NJU Helper: 已自动识别 (" + result.text + ")", "success");
        captchaImage.classList.remove("nju-autologin-captcha--loading");
        return true;
      }
    } catch (err) {
      console.error("[NJU Helper] OCR failed:", (err && err.message) || err);
    }
    captchaImage.classList.remove("nju-autologin-captcha--loading");
    return false;
  }

  function watchCaptchaRefresh(captchaImage, captchaInput, settings) {
    if (!captchaImage || captchaImage.dataset.njuOcrWatched) return;
    captchaImage.dataset.njuOcrWatched = "1";
    new MutationObserver(function () {
      _lastCaptchaUrl = "";
      window.setTimeout(function () {
        tryRecogniseCaptcha(captchaImage, captchaInput, settings);
      }, 500);
    }).observe(captchaImage, { attributes: true, attributeFilter: ["src"] });
  }

  // ── Main ─────────────────────────────────────────────────────────

  function run(settings) {
    var usernameInput = queryFirst(selectors.username);
    var passwordInput = queryFirst(selectors.password);
    var captchaInput  = queryFirst(selectors.captchaInput);
    var captchaImage  = queryFirst(selectors.captchaImage);

    if (settings.autoFill) {
      if (usernameInput && settings.studentId) {
        setNativeValue(usernameInput, settings.studentId);
      }
      if (passwordInput && settings.password) {
        setNativeValue(passwordInput, settings.password);
      }
    }

    if (settings.autoCaptcha && captchaImage && captchaInput) {
      watchCaptchaRefresh(captchaImage, captchaInput, settings);
      tryRecogniseCaptcha(captchaImage, captchaInput, settings);
    }

    if (!usernameInput || !passwordInput) {
      addStatus("NJU Helper: 未找到登录表单", "warning");
      return;
    }

    if (settings.autoCaptcha) {
      addStatus("NJU Helper: 已填充账号，识别验证码中…", "info");
    } else {
      addStatus("NJU Helper: 已填充账号密码，请手动输入验证码", "success");
    }
  }

  // ── Bootstrap ────────────────────────────────────────────────────

  function init() {
    chrome.storage.local.get(DEFAULT_SETTINGS, function (settings) {
      if (settings.autoCaptcha) {
        var modelUrl = chrome.runtime.getURL("nju_captcha.onnx");
        ocrInit(modelUrl).catch(function (err) {
          console.error("[NJU Helper] ocrInit rejected:", (err && err.message) || err);
        });
      }

      run(settings);

      var observer = new MutationObserver(function () { run(settings); });
      observer.observe(document.body || document.documentElement, { childList: true, subtree: true });
      window.setTimeout(function () { observer.disconnect(); }, 12000);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
