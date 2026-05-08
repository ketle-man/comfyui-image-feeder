/**
 * Image Loop Library - 3ペインモーダル
 * 左: フォルダツリー / 中: 画像グリッド / 右: ファイル情報
 */

import { t } from "./i18n.js";

export function openImageLibrary(node) {
    if (document.getElementById("iloop-lib-modal")) return;
    document.body.appendChild(buildModal(node));
}

// ----------------------------------------------------------------
// モーダル本体
// ----------------------------------------------------------------
function buildModal(node) {
    const overlay = el("div", {
        id: "iloop-lib-modal",
        style: "position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:99999;" +
               "display:flex;align-items:center;justify-content:center;",
    });
    overlay.addEventListener("keydown", e => { if (e.key === "Escape") overlay.remove(); });
    overlay.addEventListener("click",   e => { if (e.target === overlay) overlay.remove(); });

    const dialog = el("div", {
        style: "background:#1e1e2e;color:#ccc;border-radius:10px;" +
               "width:min(96vw,1100px);height:min(92vh,720px);display:flex;flex-direction:column;" +
               "box-shadow:0 8px 40px rgba(0,0,0,0.9);overflow:hidden;font-family:sans-serif;",
    });

    // ---- ヘッダー ----
    const header = el("div", {
        style: "display:flex;align-items:center;gap:8px;padding:10px 14px;" +
               "background:#16213e;border-bottom:1px solid #333;flex-shrink:0;",
    });
    const titleEl  = el("span", { style: "font-size:15px;font-weight:bold;color:#e0e0ff;flex:1;" }, t("lib.title"));
    const reloadBtn = mkBtn("↺", "#2a4a7a", t("lib.reload_tooltip"));
    reloadBtn.style.padding = "3px 9px";
    const closeBtn  = el("button", {
        style: "background:none;border:none;color:#aaa;font-size:18px;cursor:pointer;padding:4px 8px;",
    }, "✕");
    closeBtn.onclick = () => overlay.remove();
    header.append(titleEl, reloadBtn, closeBtn);

    // ---- 3ペイン ----
    const body = el("div", {
        style: "display:flex;flex:1;overflow:hidden;",
    });

    // 左ペイン
    const leftPane = el("div", {
        style: "width:200px;flex-shrink:0;border-right:1px solid #333;" +
               "display:flex;flex-direction:column;overflow:hidden;",
    });
    const leftHeader = el("div", {
        style: "padding:8px 10px;font-size:11px;font-weight:bold;color:#7a8aaa;" +
               "background:#16213e;border-bottom:1px solid #2a2a4a;flex-shrink:0;",
    }, t("lib.folders_header"));
    const treeScroll = el("div", {
        style: "flex:1;overflow-y:auto;padding:6px 4px;",
    });
    leftPane.append(leftHeader, treeScroll);

    // 中ペイン
    const midPane = el("div", {
        style: "flex:1;display:flex;flex-direction:column;overflow:hidden;",
    });
    const midHeader = el("div", {
        style: "display:flex;align-items:center;gap:6px;padding:6px 10px;" +
               "background:#16213e;border-bottom:1px solid #2a2a4a;flex-shrink:0;",
    });
    const selAllBtn   = mkBtn(t("lib.select_all"),   "#2a5a3a", t("lib.select_all_tooltip"));
    const deselAllBtn = mkBtn(t("lib.deselect_all"), "#5a3a3a", t("lib.deselect_all_tooltip"));
    selAllBtn.style.padding   = "3px 8px";
    deselAllBtn.style.padding = "3px 8px";
    const midTitle = el("span", { style: "font-size:11px;color:#888;flex:1;" }, t("lib.folder_placeholder"));
    midHeader.append(midTitle, selAllBtn, deselAllBtn);

    const gridScroll = el("div", { style: "flex:1;overflow-y:auto;padding:8px;" });
    const grid = el("div", {
        style: "display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:8px;",
    });
    gridScroll.appendChild(grid);
    midPane.append(midHeader, gridScroll);

    // 右ペイン
    const rightPane = el("div", {
        style: "width:180px;flex-shrink:0;border-left:1px solid #333;" +
               "display:flex;flex-direction:column;overflow:hidden;",
    });
    const rightHeader = el("div", {
        style: "padding:8px 10px;font-size:11px;font-weight:bold;color:#7a8aaa;" +
               "background:#16213e;border-bottom:1px solid #2a2a4a;flex-shrink:0;",
    }, t("lib.info_header"));
    const infoArea = el("div", { style: "flex:1;overflow-y:auto;padding:10px 8px;" });
    const previewImg = el("img", {
        style: "width:100%;border-radius:4px;display:none;margin-bottom:8px;" +
               "box-shadow:0 2px 8px rgba(0,0,0,0.6);",
    });
    const infoName = el("div", {
        style: "font-size:11px;color:#ccc;word-break:break-all;margin-bottom:4px;",
    }, "—");
    const infoSize = el("div", {
        style: "font-size:11px;color:#7a9aaa;",
    }, "");
    const infoBytes = el("div", {
        style: "font-size:10px;color:#556;margin-top:2px;",
    }, "");
    infoArea.append(previewImg, infoName, infoSize, infoBytes);
    rightPane.append(rightHeader, infoArea);

    body.append(leftPane, midPane, rightPane);

    // ---- フッター ----
    const footer = el("div", {
        style: "display:flex;align-items:center;gap:8px;padding:8px 14px;" +
               "background:#111;border-top:1px solid #2a2a3a;flex-shrink:0;",
    });
    const statusMsg = el("span", { style: "flex:1;font-size:11px;color:#556;" }, "");
    const applyBtn  = mkBtn(t("lib.apply"),  "#2a6a4a", t("lib.apply_tooltip"));
    const cancelBtn = mkBtn(t("lib.close"),  "#555");
    cancelBtn.onclick = () => overlay.remove();
    footer.append(statusMsg, applyBtn, cancelBtn);

    // ---- プリセットバー ----
    const presetBar = el("div", {
        style: "display:flex;align-items:center;gap:6px;padding:6px 14px;" +
               "background:#13172a;border-bottom:1px solid #2a2a4a;flex-shrink:0;flex-wrap:wrap;",
    });
    const presetLabel = el("span", { style: "font-size:11px;color:#7a8aaa;white-space:nowrap;" }, t("lib.preset_label"));
    const presetSelect = el("select", {
        style: "flex:1;min-width:120px;max-width:200px;background:#1a1a2e;color:#ccc;" +
               "border:1px solid #3a3a5a;border-radius:4px;padding:3px 6px;font-size:11px;",
    });
    const loadPresetBtn = mkBtn(t("lib.preset_load"),   "#2a4a7a", t("lib.preset_load_tooltip"));
    const delPresetBtn  = mkBtn(t("lib.preset_delete"), "#5a2a2a", t("lib.preset_delete_tooltip"));
    loadPresetBtn.style.padding = "3px 10px";
    delPresetBtn.style.padding  = "3px 10px";
    const barDivider = el("div", { style: "width:1px;height:18px;background:#333;flex-shrink:0;" });
    const presetNameInput = el("input");
    presetNameInput.type = "text";
    presetNameInput.placeholder = t("lib.preset_name_ph");
    presetNameInput.style.cssText = "background:#1a1a2e;color:#ccc;border:1px solid #3a3a5a;" +
        "border-radius:4px;padding:3px 8px;font-size:11px;width:130px;";
    const savePresetBtn = mkBtn(t("lib.preset_save"), "#2a6a2a", t("lib.preset_save_tooltip"));
    savePresetBtn.style.padding = "3px 10px";
    presetBar.append(presetLabel, presetSelect, loadPresetBtn, delPresetBtn, barDivider, presetNameInput, savePresetBtn);

    dialog.append(header, presetBar, body, footer);
    overlay.appendChild(dialog);

    // ----------------------------------------------------------------
    // 状態
    // ----------------------------------------------------------------
    let currentDir = "";            // 選択中フォルダの相対パス
    let currentImages = [];         // 現在フォルダの全画像ファイル名
    const checkedFiles = new Set(); // チェック中のファイル名

    function updateStatus() {
        const total = currentImages.length;
        const sel   = [...checkedFiles].filter(f => currentImages.includes(f)).length;
        const dir   = currentDir || t("lib.root_label");
        statusMsg.textContent = t("lib.status", sel, total, dir);
    }

    // ----------------------------------------------------------------
    // フォルダツリー描画
    // ----------------------------------------------------------------
    function buildTreeNode(item, depth) {
        const row = el("div", {
            style: `display:flex;align-items:center;gap:4px;padding:3px 4px;` +
                   `padding-left:${6 + depth * 14}px;border-radius:4px;cursor:pointer;` +
                   `transition:background 0.1s;`,
        });
        row.addEventListener("mouseenter", () => row.style.background = "#2a2a4a");
        row.addEventListener("mouseleave", () => {
            row.style.background = currentDir === item.path ? "#1e3a5a" : "";
        });

        const radio = el("input");
        radio.type = "radio";
        radio.name = "iloop-folder-sel";
        radio.style.cssText = "accent-color:#4a90d9;cursor:pointer;flex-shrink:0;";
        radio.dataset.path = item.path;

        const icon = el("span", {
            style: "font-size:13px;flex-shrink:0;",
        }, item.children.length > 0 ? "📂" : "📁");
        const name = el("span", {
            style: "font-size:11px;color:#ccc;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;",
        }, item.name);

        row.append(radio, icon, name);

        // 子ツリー
        const children = el("div");
        for (const child of item.children) {
            children.appendChild(buildTreeNode(child, depth + 1));
        }

        const wrap = el("div");
        wrap.append(row, children);

        radio.addEventListener("change", () => {
            if (radio.checked) selectFolder(item.path);
        });
        row.addEventListener("click", e => {
            if (e.target !== radio) { radio.checked = true; selectFolder(item.path); }
        });

        return wrap;
    }

    // ルート行
    function buildRootRow() {
        const row = el("div", {
            style: "display:flex;align-items:center;gap:4px;padding:3px 6px;" +
                   "border-radius:4px;cursor:pointer;transition:background 0.1s;",
        });
        row.addEventListener("mouseenter", () => row.style.background = "#2a2a4a");
        row.addEventListener("mouseleave", () => {
            row.style.background = currentDir === "" ? "#1e3a5a" : "";
        });
        const radio = el("input");
        radio.type = "radio";
        radio.name = "iloop-folder-sel";
        radio.style.cssText = "accent-color:#4a90d9;cursor:pointer;flex-shrink:0;";
        radio.dataset.path = "";
        const icon = el("span", { style: "font-size:13px;" }, "🏠");
        const name = el("span", { style: "font-size:11px;color:#ccc;" }, t("lib.root_label"));
        row.append(radio, icon, name);
        row.addEventListener("click", e => {
            if (e.target !== radio) { radio.checked = true; selectFolder(""); }
        });
        radio.addEventListener("change", () => { if (radio.checked) selectFolder(""); });
        return row;
    }

    async function loadTree() {
        treeScroll.innerHTML = "";
        try {
            const res  = await fetch("/image_loop/tree");
            const data = await res.json();
            treeScroll.appendChild(buildRootRow());
            for (const item of data.tree ?? []) {
                treeScroll.appendChild(buildTreeNode(item, 0));
            }
        } catch (e) {
            treeScroll.textContent = t("lib.tree_error");
            console.warn("[ImageLibrary] tree load failed:", e);
        }
    }

    // ----------------------------------------------------------------
    // フォルダ選択 → 画像一覧読み込み
    // ----------------------------------------------------------------
    async function selectFolder(dirPath) {
        if (currentDir !== dirPath) {
            checkedFiles.clear();
        }
        currentDir = dirPath;
        grid.innerHTML = "";
        midTitle.textContent = t("lib.loading");

        try {
            const param = dirPath ? `?dir=${encodeURIComponent(dirPath)}` : "";
            const res   = await fetch("/image_loop/images" + param);
            const data  = await res.json();
            currentImages = data.images ?? [];
        } catch (e) {
            currentImages = [];
            console.warn("[ImageLibrary] images load failed:", e);
        }

        midTitle.textContent = dirPath ? `📂 ${dirPath}` : `📂 ${t("lib.root_label")}`;
        renderGrid();
        updateStatus();
    }

    // ----------------------------------------------------------------
    // 画像グリッド描画
    // ----------------------------------------------------------------
    function renderGrid() {
        grid.innerHTML = "";
        if (currentImages.length === 0) {
            const empty = el("div", {
                style: "color:#555;font-size:12px;padding:20px;grid-column:1/-1;text-align:center;",
            }, t("lib.no_images"));
            grid.appendChild(empty);
            return;
        }
        for (const fname of currentImages) {
            grid.appendChild(buildCard(fname));
        }
    }

    function buildCard(fname) {
        const relPath = currentDir ? `${currentDir}/${fname}` : fname;
        const checked = checkedFiles.has(fname);

        const card = el("div", {
            style: "position:relative;background:#252540;border-radius:6px;overflow:hidden;" +
                   `border:2px solid ${checked ? "#4a90d9" : "transparent"};` +
                   "cursor:pointer;transition:border-color 0.12s;",
        });
        card.addEventListener("mouseenter", () => {
            if (!checkedFiles.has(fname)) card.style.borderColor = "#4a5a7a";
        });
        card.addEventListener("mouseleave", () => {
            card.style.borderColor = checkedFiles.has(fname) ? "#4a90d9" : "transparent";
        });

        // サムネイル
        const thumb = el("div", {
            style: "width:100%;aspect-ratio:1;background:#1a1a30;display:flex;" +
                   "align-items:center;justify-content:center;overflow:hidden;",
        });
        const img = el("img");
        img.style.cssText = "width:100%;height:100%;object-fit:cover;";
        img.src = `/image_loop/thumbnail?path=${encodeURIComponent(relPath)}`;
        img.onerror = () => { thumb.innerHTML = "🖼"; thumb.style.fontSize = "28px"; };
        thumb.appendChild(img);

        // チェックボックス
        const cb = el("input");
        cb.type = "checkbox";
        cb.checked = checked;
        cb.style.cssText = "position:absolute;top:4px;left:4px;width:16px;height:16px;" +
                           "accent-color:#4a90d9;cursor:pointer;z-index:2;";
        cb.addEventListener("change", e => {
            e.stopPropagation();
            if (cb.checked) checkedFiles.add(fname);
            else            checkedFiles.delete(fname);
            card.style.borderColor = cb.checked ? "#4a90d9" : "transparent";
            updateStatus();
        });

        // ファイル名
        const label = el("div", {
            style: "padding:3px 5px;font-size:9px;color:#aaa;overflow:hidden;" +
                   "text-overflow:ellipsis;white-space:nowrap;",
            title: fname,
        }, fname);

        card.append(thumb, cb, label);

        // クリックで右ペインに情報表示
        card.addEventListener("click", () => showInfo(relPath, fname));

        return card;
    }

    // ----------------------------------------------------------------
    // 右ペイン：ファイル情報表示
    // ----------------------------------------------------------------
    async function showInfo(relPath, fname) {
        infoName.textContent = fname;
        infoSize.textContent = t("lib.loading");
        infoBytes.textContent = "";
        previewImg.style.display = "none";

        try {
            const res  = await fetch(`/image_loop/image_info?path=${encodeURIComponent(relPath)}`);
            const data = await res.json();
            infoName.textContent  = data.name ?? fname;
            infoSize.textContent  = `${data.width} × ${data.height} px`;
            const kb = data.size_bytes ? (data.size_bytes / 1024).toFixed(1) + " KB" : "";
            infoBytes.textContent = kb;
        } catch (e) {
            infoSize.textContent = t("lib.info_error");
        }

        previewImg.src = `/image_loop/thumbnail?path=${encodeURIComponent(relPath)}`;
        previewImg.style.display = "block";
    }

    // ----------------------------------------------------------------
    // 全選択 / 全解除
    // ----------------------------------------------------------------
    selAllBtn.addEventListener("click", () => {
        for (const f of currentImages) checkedFiles.add(f);
        renderGrid();
        updateStatus();
    });
    deselAllBtn.addEventListener("click", () => {
        for (const f of currentImages) checkedFiles.delete(f);
        renderGrid();
        updateStatus();
    });

    // ----------------------------------------------------------------
    // ノードに適用
    // ----------------------------------------------------------------
    applyBtn.addEventListener("click", () => {
        const dirWidget = node.widgets?.find(w => w.name === "directory");
        if (dirWidget) {
            dirWidget.value = currentDir;
            if (dirWidget.callback) dirWidget.callback(dirWidget.value);
        }

        const selWidget = node.widgets?.find(w => w.name === "selected_files");
        if (selWidget) {
            const inCurrent = [...checkedFiles].filter(f => currentImages.includes(f));
            selWidget.value = JSON.stringify(inCurrent);
            if (selWidget.callback) selWidget.callback(selWidget.value);
        }

        // インデックスをリセット
        const idxWidget = node.widgets?.find(w => w.name === "index");
        if (idxWidget) {
            idxWidget.value = 0;
            if (idxWidget.callback) idxWidget.callback(idxWidget.value);
        }

        if (app.graph && node) {
            app.graph.setDirtyCanvas(true, true);
        }

        overlay.remove();
    });

    // ----------------------------------------------------------------
    // 初期化：既存ウィジェット値を復元
    // ----------------------------------------------------------------
    function initFromNode() {
        const dirWidget = node.widgets?.find(w => w.name === "directory");
        if (dirWidget?.value) currentDir = dirWidget.value;

        const selWidget = node.widgets?.find(w => w.name === "selected_files");
        if (selWidget?.value) {
            try {
                const arr = JSON.parse(selWidget.value);
                for (const f of arr) checkedFiles.add(f);
            } catch (_) {}
        }
    }

    // ---- プリセット管理 ----
    let allPresets = {};

    async function refreshPresetSelect() {
        try {
            const res = await fetch("/image_feeder/presets");
            allPresets = await res.json();
        } catch {
            allPresets = {};
        }
        const defaultOpt = document.createElement("option");
        defaultOpt.value = "";
        defaultOpt.textContent = t("lib.preset_placeholder");
        presetSelect.innerHTML = "";
        presetSelect.appendChild(defaultOpt);
        for (const name of Object.keys(allPresets).sort()) {
            const opt = document.createElement("option");
            opt.value = name;
            opt.textContent = name;
            presetSelect.appendChild(opt);
        }
    }

    loadPresetBtn.addEventListener("click", async () => {
        const name = presetSelect.value;
        if (!name || !allPresets[name]) return;
        const preset = allPresets[name];
        const targetDir = preset.directory ?? "";
        // selectFolder が checkedFiles.clear() するので、先にフォルダを切り替える
        await selectFolder(targetDir);
        // フォルダ読み込み完了後にチェック状態を設定して再描画
        checkedFiles.clear();
        for (const f of (preset.selected_files ?? [])) checkedFiles.add(f);
        renderGrid();
        updateStatus();
        const radios = treeScroll.querySelectorAll("input[type=radio][name='iloop-folder-sel']");
        for (const r of radios) {
            if (r.dataset.path === targetDir) { r.checked = true; break; }
        }
    });

    savePresetBtn.addEventListener("click", async () => {
        const name = presetNameInput.value.trim();
        if (!name) { alert(t("lib.alert_preset_name")); return; }
        if (allPresets[name] && !confirm(t("lib.confirm_overwrite", name))) return;
        const sel = [...checkedFiles].filter(f => currentImages.includes(f));
        try {
            await fetch("/image_feeder/presets", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name, directory: currentDir, selected_files: sel }),
            });
            presetNameInput.value = "";
            await refreshPresetSelect();
            presetSelect.value = name;
            statusMsg.textContent = t("lib.status_saved", name);
        } catch {
            alert(t("lib.alert_save_error"));
        }
    });

    delPresetBtn.addEventListener("click", async () => {
        const name = presetSelect.value;
        if (!name) return;
        if (!confirm(t("lib.confirm_delete", name))) return;
        try {
            await fetch(`/image_feeder/presets/${encodeURIComponent(name)}`, { method: "DELETE" });
            await refreshPresetSelect();
            statusMsg.textContent = t("lib.status_deleted", name);
        } catch {
            alert(t("lib.alert_delete_error"));
        }
    });

    reloadBtn.addEventListener("click", loadTree);

    initFromNode();
    refreshPresetSelect();
    loadTree().then(() => {
        if (currentDir !== "") selectFolder(currentDir);
    });

    return overlay;
}

// ----------------------------------------------------------------
// ヘルパー
// ----------------------------------------------------------------
function el(tag, attrs = {}, text) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
        if (k === "style") e.style.cssText = v;
        else e[k] = v;
    }
    if (text !== undefined) e.textContent = text;
    return e;
}

function mkBtn(label, bg, title = "") {
    const btn = el("button", {
        style: `padding:5px 11px;background:${bg};color:#fff;border:none;` +
               "border-radius:4px;cursor:pointer;font-size:12px;font-weight:bold;" +
               "white-space:nowrap;transition:opacity 0.15s;",
    }, label);
    if (title) btn.title = title;
    btn.addEventListener("mouseenter", () => btn.style.opacity = "0.8");
    btn.addEventListener("mouseleave", () => btn.style.opacity = "1");
    return btn;
}
