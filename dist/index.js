"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.transformToVideo = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const child_process_1 = require("child_process");
const puppeteer_1 = __importDefault(require("puppeteer"));
const rrwebScriptPath = path.resolve(require.resolve("rrweb-player"), "../../dist/index.js");
const rrwebStylePath = path.resolve(rrwebScriptPath, "../style.css");
const rrwebRaw = fs.readFileSync(rrwebScriptPath, "utf-8");
const rrwebStyle = fs.readFileSync(rrwebStylePath, "utf-8");
function getHtml(events, config) {
    return `
<html>
  <head>
  <style>${rrwebStyle}</style>
  </head>
  <body>
    <script>
      ${rrwebRaw};
      /*<!--*/
      const events = ${JSON.stringify(events).replace(/<\/script>/g, "<\\/script>")};
      /*-->*/
      const userConfig = ${config ? JSON.stringify(config) : {}};
      window.replayer = new rrwebPlayer({
        target: document.body,
        props: {
          events,
          showController: false,
          autoPlay: false, // autoPlay off by default
          ...userConfig
        },
      }); 
      
      window.replayer.addEventListener('finish', () => window.onReplayFinish());
      let time = userConfig.startDelayTime || 1000 // start playback delay time, default 1000ms
      let start = fn => {
        setTimeout(() => {
          fn()
        }, time)
      }
      // It is recommended not to play auto by default. If the speed is not 1, the page block in the early stage of autoPlay will be blank
      if (userConfig.autoPlay) {
        start = fn => {
          fn()
        };
      }
      start(() => {
        window.onReplayStart();
        window.replayer.play();
      })
    </script>
  </body>
</html>
`;
}
const defaultConfig = {
    fps: 15,
    headless: true,
    input: "",
    cb: () => { },
    output: "rrvideo-output.mp4",
    rrwebPlayer: {},
};
class RRvideo {
    constructor(config) {
        this.state = "idle";
        this.config = {
            fps: (config === null || config === void 0 ? void 0 : config.fps) || defaultConfig.fps,
            headless: (config === null || config === void 0 ? void 0 : config.headless) || defaultConfig.headless,
            input: (config === null || config === void 0 ? void 0 : config.input) || defaultConfig.input,
            cb: (config === null || config === void 0 ? void 0 : config.cb) || defaultConfig.cb,
            output: (config === null || config === void 0 ? void 0 : config.output) || defaultConfig.output,
            rrwebPlayer: (config === null || config === void 0 ? void 0 : config.rrwebPlayer) || defaultConfig.rrwebPlayer,
        };
    }
    init() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                this.browser = yield puppeteer_1.default.launch({
                    headless: this.config.headless,
                });
                this.page = yield this.browser.newPage();
                yield this.page.goto("about:blank");
                yield this.page.exposeFunction("onReplayStart", () => {
                    this.startRecording();
                });
                yield this.page.exposeFunction("onReplayFinish", () => {
                    this.finishRecording();
                });
                const eventsPath = path.isAbsolute(this.config.input)
                    ? this.config.input
                    : path.resolve(process.cwd(), this.config.input);
                const events = JSON.parse(fs.readFileSync(eventsPath, "utf-8"));
                yield this.page.setContent(getHtml(events, this.config.rrwebPlayer));
            }
            catch (error) {
                // this.config.cb("", error);
            }
        });
    }
    startRecording() {
        return __awaiter(this, void 0, void 0, function* () {
            this.state = "recording";
            let wrapperSelector = ".replayer-wrapper";
            if (this.config.rrwebPlayer.width && this.config.rrwebPlayer.height) {
                wrapperSelector = ".rr-player";
            }
            const wrapperEl = yield this.page.$(wrapperSelector);
            if (!wrapperEl) {
                throw new Error("failed to get replayer element");
            }
            // start ffmpeg
            const args = [
                // fps
                "-framerate",
                this.config.fps.toString(),
                // input
                "-f",
                "image2pipe",
                "-i",
                "-",
                // output
                "-y",
                this.config.output,
            ];
            const ffmpegProcess = (0, child_process_1.spawn)("ffmpeg", args);
            ffmpegProcess.stderr.setEncoding("utf-8");
            ffmpegProcess.stderr.on("data", console.log);
            let processError = null;
            const timer = setInterval(() => __awaiter(this, void 0, void 0, function* () {
                if (this.state === "recording" && !processError) {
                    try {
                        const buffer = yield wrapperEl.screenshot({
                            encoding: "binary",
                        });
                        ffmpegProcess.stdin.write(buffer);
                    }
                    catch (error) {
                        // ignore
                    }
                }
                else {
                    clearInterval(timer);
                    if (this.state === "closed" && !processError) {
                        ffmpegProcess.stdin.end();
                    }
                }
            }), 1000 / this.config.fps);
            const outputPath = path.isAbsolute(this.config.output)
                ? this.config.output
                : path.resolve(process.cwd(), this.config.output);
            ffmpegProcess.on("close", () => {
                if (processError) {
                    return;
                }
                this.config.cb(outputPath, null);
            });
            ffmpegProcess.on("error", (error) => {
                if (processError) {
                    return;
                }
                processError = error;
                this.config.cb(outputPath, error);
            });
            ffmpegProcess.stdin.on("error", (error) => {
                if (processError) {
                    return;
                }
                processError = error;
                this.config.cb(outputPath, error);
            });
        });
    }
    finishRecording() {
        return __awaiter(this, void 0, void 0, function* () {
            this.state = "closed";
            yield this.browser.close();
        });
    }
}
function transformToVideo(config) {
    return new Promise((resolve, reject) => {
        const rrvideo = new RRvideo(Object.assign(Object.assign({}, config), { cb(file, error) {
                if (error) {
                    return reject(error);
                }
                resolve(file);
            } }));
        rrvideo.init();
    });
}
exports.transformToVideo = transformToVideo;
