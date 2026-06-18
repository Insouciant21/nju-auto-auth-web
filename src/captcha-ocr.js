import * as ort from "onnxruntime-web/all";

var CHARSET = [
  "1","2","3","4","5","6","7","8","9",
  "a","b","c","d","e","f","g","h","i",
  "j","k","l","m","n","o","p","q","r",
  "s","t","u","v","w","x","y","z"
];

var IMG_W = 80, IMG_H = 30;

var MEAN_R = 0.7336, MEAN_G = 0.745, MEAN_B = 0.778;
var STD_R  = 0.3062, STD_G  = 0.31,  STD_B  = 0.3177;

var _session = null, _ready = false, _initPromise = null;

export function init(modelUrl) {
  if (_ready) return Promise.resolve();
  if (_initPromise) return _initPromise;
  _initPromise = _doInit(modelUrl);
  return _initPromise;
}

async function _doInit(modelUrl) {
  // Pre-fetch model ourselves (most reliable in content-script context)
  console.log("[CaptchaOCR] Fetching model:", modelUrl);
  var resp = await fetch(modelUrl);
  if (!resp.ok) throw new Error("Fetch " + resp.status);
  var buf = await resp.arrayBuffer();
  console.log("[CaptchaOCR] Model:", (buf.byteLength / 1024).toFixed(1) + "KB");

  // Try WebGL first (no WASM/COOP issues), fallback to default.
  // Model dim_denotations have been cleared — no more shape mismatch.
  var backends = ["webgl", "wasm"];
  for (var i = 0; i < backends.length; i++) {
    try {
      console.log("[CaptchaOCR] Trying " + backends[i] + "...");
      _session = await ort.InferenceSession.create(buf, {
        executionProviders: [backends[i]]
      });
      _ready = true;
      console.log("[CaptchaOCR] " + backends[i] + " OK");
      return;
    } catch (e) {
      console.warn("[CaptchaOCR] " + backends[i] + " failed:", e.message || e);
    }
  }
  throw new Error("All backends failed");
}

export function isReady() { return _ready; }

export function whenReady() {
  return _initPromise || Promise.reject(new Error("init never called"));
}

function imgElementToTensor(imgEl) {
  var c = document.createElement("canvas");
  c.width = IMG_W; c.height = IMG_H;
  var ctx = c.getContext("2d");
  if (ctx.imageSmoothingQuality) ctx.imageSmoothingQuality = "high";
  ctx.drawImage(imgEl, 0, 0, IMG_W, IMG_H);

  var pixels = ctx.getImageData(0, 0, IMG_W, IMG_H).data;
  var area = IMG_W * IMG_H;
  var out = new Float32Array(3 * area);

  for (var i = 0; i < area; i++) {
    var p = i * 4;
    out[0*area + i] = (pixels[p]     / 255 - MEAN_R) / STD_R;
    out[1*area + i] = (pixels[p + 1] / 255 - MEAN_G) / STD_G;
    out[2*area + i] = (pixels[p + 2] / 255 - MEAN_B) / STD_B;
  }

  return new ort.Tensor("float32", out, [1, 3, IMG_H, IMG_W]);
}

function argmaxDecode(data, numClasses) {
  var L = data.length / numClasses;
  var idx = new Array(L);
  for (var t = 0; t < L; t++) {
    var best = 0, bestV = -Infinity, base = t * numClasses;
    for (var c = 0; c < numClasses; c++) {
      if (data[base + c] > bestV) { bestV = data[base + c]; best = c; }
    }
    idx[t] = best;
  }
  return idx;
}

export async function recognise(imgEl) {
  if (!_ready) throw new Error("Model not loaded");
  var tensor = imgElementToTensor(imgEl);
  var results = await _session.run({ input: tensor });
  var output = results[Object.keys(results)[0]];
  var indices = argmaxDecode(output.data, CHARSET.length);
  var chars = [];
  for (var i = 0; i < indices.length; i++) chars.push(CHARSET[indices[i]]);
  return { text: chars.join(""), chars: chars };
}
