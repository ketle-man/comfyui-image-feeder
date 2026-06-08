import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";
import { openImageLibrary } from "./image_library.js";
import { t } from "./i18n.js";

// デバッグ出力フラグ（本番はfalseのまま運用してください）
const DEBUG = false;

function debugLog(...args) {
	if (DEBUG) console.log("[ImageFeeder]", ...args);
}

// ノードごとの実行状態 Map<nodeId(string), { running: boolean, setRunning: fn }>
const _nodeStates = new Map();
// ノードごとの遅延タイマー ID Map<nodeId(string), timerId>
const _nodeTimers = new Map();
let _setupDone = false;

app.registerExtension({
	name: "Antigravity.ImageFeeder",

	// ---- ノード定義フック ----
	async beforeRegisterNodeDef(nodeType, nodeData) {
		if (nodeData.name !== "ImageFeeder") return;

		const onNodeCreated = nodeType.prototype.onNodeCreated;
		nodeType.prototype.onNodeCreated = function () {
			const ret = onNodeCreated?.apply(this, arguments);
			const node = this;

			// ---- コンテナ ----
			const container = document.createElement("div");
			container.style.cssText =
				"display:flex;align-items:center;justify-content:center;gap:4px;" +
				"padding:5px;margin-top:5px;box-sizing:border-box;width:100%;";

			// ---- ボタン生成 ----
			const runBtn  = makeBtn(t("node.run"),    "#2a7a3a", t("node.run_title"));
			const stopBtn = makeBtn(t("node.stop"),   "#7a2a2a", t("node.stop_title"));
			const libBtn  = makeBtn(t("node.lib"),    "#3a3a8a", t("node.lib_title"));
			const selBtn  = makeBtn(t("node.sel_on"), "#4a708b", t("node.sel_title"));

			// 停止状態で初期化
			stopBtn.disabled = true;
			stopBtn.style.opacity = "0.4";

			// ---- 状態管理 ----
			function setRunning(running) {
				_nodeStates.set(String(node.id), { running, setRunning });
				runBtn.disabled  = running;
				runBtn.style.opacity  = running ? "0.4" : "1";
				stopBtn.disabled = !running;
				stopBtn.style.opacity = running ? "1" : "0.4";
			}

			function updateSelBtn(val) {
				selBtn.textContent = val ? t("node.sel_on") : t("node.sel_off");
				selBtn.style.background = val ? "#4a708b" : "#444";
				selBtn.style.color = val ? "#fff" : "#aaa";
			}

			// 初期登録
			setRunning(false);

			// ---- ボタン動作 ----
			runBtn.onclick = async () => {
				const idxW = node.widgets?.find(w => w.name === "index");
				if (idxW) idxW.value = 0;
				setRunning(true);
				try {
					await app.queuePrompt(0, 1);
				} catch (e) {
					console.error("[ImageFeeder] queuePrompt failed:", e);
					setRunning(false);
				}
			};

			stopBtn.onclick = () => setRunning(false);
			libBtn.onclick  = () => openImageLibrary(node);
			selBtn.onclick  = () => {
				const w = node.widgets?.find(w => w.name === "use_selection");
				if (w) {
					w.value = !w.value;
					updateSelBtn(w.value);
					if (w.callback) w.callback(w.value);
					node.setDirtyCanvas(true, true);
				}
			};

			container.append(runBtn, stopBtn, libBtn, selBtn);

			// ---- DOM ウィジェット登録 ----
			const domWidget = node.addDOMWidget(
				"image_loop_controls",
				"image_loop_controls",
				container,
				{ getValue() { return ""; }, setValue() {} }
			);

			// ウィジェットの隠蔽と初期化
			const hideWidget = (name) => {
				const w = node.widgets?.find(w => w.name === name);
				if (w) {
					w.type = "hidden";
					w.hidden = true;
					w.computeSize = () => [0, -4]; // LiteGraphの隠しウィジェットの慣習
					if (w.element) w.element.style.display = "none";
				}
				return w;
			};

			setTimeout(() => {
				hideWidget("selected_files");
				const useW = hideWidget("use_selection");
				if (useW) updateSelBtn(useW.value);
				
				// ノードのサイズを再計算させて、隠したウィジェットのスペースを詰める
				node.setSize(node.computeSize());
				node.setDirtyCanvas(true, true);
			}, 20);
			
			domWidget.computeSize = function(width) {
				return [width, 46];
			};

			node.onRemoved = function () {
				const id = String(node.id);
				clearTimeout(_nodeTimers.get(id));
				_nodeTimers.delete(id);
				_nodeStates.delete(id);
			};

			return ret;
		};
	},

	// ---- グローバル同期イベント ----
	async setup() {
		if (_setupDone) return;
		_setupDone = true;

		api.addEventListener("image_loop_node_sync", ({ detail }) => {
			const { node_id, next_index, has_next } = detail;
			if (node_id == null) return;
			const node = app.graph.getNodeById(Number(node_id));
			if (!node) return;

			const indexWidget = node.widgets?.find(w => w.name === "index");
			if (!indexWidget) return;

			const state   = _nodeStates.get(String(node.id));
			const running = state?.running ?? false;

			if (has_next && running) {
				indexWidget.value = next_index;
				const capturedNodeId = String(node.id);
				clearTimeout(_nodeTimers.get(capturedNodeId));
				const timerId = setTimeout(async () => {
					_nodeTimers.delete(capturedNodeId);
					// Stop が押された場合はキューに追加しない
					const currentState = _nodeStates.get(capturedNodeId);
					if (!currentState?.running) return;
					try {
						await app.queuePrompt(0, 1);
					} catch (e) {
						console.error("[ImageFeeder] queuePrompt failed:", e);
						if (currentState?.setRunning) currentState.setRunning(false);
					}
				}, 500);
				_nodeTimers.set(capturedNodeId, timerId);
			} else {
				indexWidget.value = 0;
				if (state?.setRunning) state.setRunning(false);
			}
		});

		// ComfyUI がワークフローをキャンセル・エラー終了した際に running フラグをリセット
		const stopAll = () => {
			Array.from(_nodeStates.values()).forEach((state) => {
				if (state.running && state.setRunning) state.setRunning(false);
			});
		};
		api.addEventListener("execution_error",       stopAll);
		api.addEventListener("execution_interrupted", stopAll);
	}
});

// ---- ボタン生成ヘルパー ----
function makeBtn(label, bg, title = "") {
	const btn = document.createElement("button");
	btn.textContent = label;
	if (title) btn.title = title;
	btn.style.cssText =
		`padding:6px 4px;flex:1;background:${bg};color:#fff;border:none;` +
		"border-radius:4px;cursor:pointer;font-size:10px;font-weight:bold;" +
		"transition:all 0.15s;white-space:nowrap;box-shadow: 0 1px 2px rgba(0,0,0,0.3);";
	btn.addEventListener("mouseover", () => { if (!btn.disabled) btn.style.opacity = "0.8"; });
	btn.addEventListener("mouseout",  () => { if (!btn.disabled) btn.style.opacity = "1"; });
	return btn;
}
