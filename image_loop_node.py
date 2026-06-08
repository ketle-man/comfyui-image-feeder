import os
import io
import json
import torch
import numpy as np
from PIL import Image, ImageOps
import random
import re
import folder_paths

# Decompression Bomb 上限を明示（デフォルト値と同じ約178Mpx）
Image.MAX_IMAGE_PIXELS = 178_956_970

# デバッグ出力フラグ（本番はFalseのまま運用してください）
DEBUG = False


def _debug(*args):
    if DEBUG:
        print("[ImageFeeder]", *args)


def get_allowed_base() -> str:
    """許可されたベースディレクトリ（ComfyUI/user/default/image-loop-data）を返す"""
    return os.path.join(folder_paths.base_path, "user", "default", "image-loop-data")


def resolve_safe_path(subdirectory: str) -> str:
    """
    ユーザー入力のサブディレクトリ名を受け取り、
    許可ベース配下の絶対パスを返す。パストラバーサルを防ぐ。
    """
    allowed_base = os.path.realpath(get_allowed_base())
    if not subdirectory:
        return allowed_base
    candidate = os.path.realpath(os.path.join(allowed_base, subdirectory))
    if candidate != allowed_base and not candidate.startswith(allowed_base + os.sep):
        raise ValueError("Access denied: directory must be within the image-loop-data folder")
    return candidate


def natural_sort_key(s):
    """ファイル名を自然順序（1, 2, 10...）でソートするためのキー"""
    return [int(text) if text.isdigit() else text.lower()
            for text in re.split('([0-9]+)', s)]


# ----------------------------------------------------------------
# プリセット保存ヘルパー
# ----------------------------------------------------------------
def _get_presets_file() -> str:
    return os.path.join(folder_paths.base_path, "user", "default", "image-feeder-presets.json")


def _load_presets() -> dict:
    path = _get_presets_file()
    if os.path.exists(path):
        try:
            with open(path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return {}
    return {}


def _save_presets(presets: dict):
    path = _get_presets_file()
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(presets, f, ensure_ascii=False, indent=2)


# ----------------------------------------------------------------
# サーバー API ルート登録
# ----------------------------------------------------------------
def _setup_routes():
    try:
        from server import PromptServer
        from aiohttp import web

        routes = PromptServer.instance.routes

        @routes.get("/image_loop/tree")
        async def api_tree(request):
            base = get_allowed_base()
            os.makedirs(base, exist_ok=True)

            def _scan(path, rel="", depth=0):
                if depth > 20:
                    return []
                items = []
                try:
                    for entry in sorted(os.scandir(path), key=lambda e: e.name.lower()):
                        if entry.is_dir(follow_symlinks=False):
                            rel_path = (rel + "/" + entry.name) if rel else entry.name
                            items.append({
                                "name": entry.name,
                                "path": rel_path,
                                "children": _scan(entry.path, rel_path, depth + 1),
                            })
                except PermissionError:
                    pass
                return items

            return web.json_response({"tree": _scan(base)})

        @routes.get("/image_loop/images")
        async def api_images(request):
            subdir = request.query.get("dir", "")
            try:
                target_dir = resolve_safe_path(subdir)
            except ValueError:
                return web.json_response({"error": "Access denied"}, status=403)

            if not os.path.isdir(target_dir):
                return web.json_response({"images": []})

            valid_ext = ('.png', '.jpg', '.jpeg', '.webp', '.bmp', '.tif', '.tiff')
            images = sorted(
                [f for f in os.listdir(target_dir)
                 if f.lower().endswith(valid_ext)
                 and os.path.isfile(os.path.join(target_dir, f))
                 and not os.path.islink(os.path.join(target_dir, f))],
                key=natural_sort_key
            )
            return web.json_response({"images": images})

        @routes.get("/image_loop/thumbnail")
        async def api_thumbnail(request):
            rel = request.query.get("path", "")
            try:
                base = os.path.realpath(get_allowed_base())
                full = os.path.realpath(os.path.join(base, rel))
                if not (full == base or full.startswith(base + os.sep)):
                    return web.Response(status=403)
                if not os.path.isfile(full) or os.path.islink(full):
                    return web.Response(status=404)
            except Exception:
                return web.Response(status=400)
            try:
                img = Image.open(full)
                img = ImageOps.exif_transpose(img)
                img = img.convert("RGB")
                img.thumbnail((160, 160), Image.LANCZOS)
                buf = io.BytesIO()
                img.save(buf, format="WEBP", quality=75)
                return web.Response(
                    body=buf.getvalue(),
                    content_type="image/webp",
                    headers={"Cache-Control": "max-age=300"},
                )
            except Exception:
                return web.Response(status=500)

        @routes.get("/image_loop/image_info")
        async def api_image_info(request):
            rel = request.query.get("path", "")
            try:
                base = os.path.realpath(get_allowed_base())
                full = os.path.realpath(os.path.join(base, rel))
                if not (full == base or full.startswith(base + os.sep)):
                    return web.json_response({"error": "Access denied"}, status=403)
                if not os.path.isfile(full) or os.path.islink(full):
                    return web.json_response({"error": "Not found"}, status=404)
            except Exception:
                return web.json_response({"error": "Bad request"}, status=400)
            try:
                img = Image.open(full)
                w, h = img.size
                size_bytes = os.path.getsize(full)
                return web.json_response({
                    "name": os.path.basename(full),
                    "width": w,
                    "height": h,
                    "size_bytes": size_bytes,
                })
            except Exception:
                return web.json_response({"error": "Could not read image"}, status=500)

        @routes.get("/image_feeder/presets")
        async def api_get_presets(request):
            return web.json_response(_load_presets())

        @routes.post("/image_feeder/presets")
        async def api_save_preset(request):
            try:
                body = await request.json()
            except Exception:
                return web.json_response({"error": "Invalid JSON"}, status=400)
            name = (body.get("name") or "").strip()
            if not name:
                return web.json_response({"error": "name is required"}, status=400)
            if len(name) > 256:
                return web.json_response({"error": "name too long"}, status=400)
            raw_files = body.get("selected_files", [])
            if not isinstance(raw_files, list) or len(raw_files) > 10000:
                return web.json_response({"error": "selected_files must be an array of at most 10000 items"}, status=400)
            sel_files = [f for f in raw_files if isinstance(f, str)]
            directory = str(body.get("directory", ""))[:1024]
            presets = _load_presets()
            presets[name] = {
                "directory": directory,
                "selected_files": sel_files,
            }
            _save_presets(presets)
            return web.json_response({"ok": True})

        @routes.delete("/image_feeder/presets/{name}")
        async def api_delete_preset(request):
            name = request.match_info["name"]
            presets = _load_presets()
            if name in presets:
                del presets[name]
                _save_presets(presets)
            return web.json_response({"ok": True})

    except Exception as e:
        print(f"[ImageFeeder] Failed to register routes: {e}")


_setup_routes()


# ----------------------------------------------------------------
# ノード定義
# ----------------------------------------------------------------
class ImageFeeder:
    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "directory": ("STRING", {
                    "default": "",
                    "tooltip": "Subfolder name within the image-loop-data folder. Leave empty to use the root directory."
                }),
                "sort_mode": (["ascending", "descending", "random"],),
                "index": ("INT", {"default": 0, "min": 0, "max": 0xffffffffffffffff}),
                "start_index": ("INT", {"default": 0, "min": 0, "max": 0xffffffffffffffff}),
                "end_index": ("INT", {"default": 0, "min": 0, "max": 0xffffffffffffffff}),
                "batch_size": ("INT", {"default": 1, "min": 1, "max": 4096}),
                "seed": ("INT", {"default": 0, "min": 0, "max": 0xffffffffffffffff}),
                "use_selection": ("BOOLEAN", {"default": True}),
                "selected_files": ("STRING", {"default": "[]"}),
            },
            "hidden": {
                "unique_id": "UNIQUE_ID",
            }
        }

    RETURN_TYPES = ("IMAGE",)
    FUNCTION = "load_images"
    CATEGORY = "image"
    # send_sync を使用するため常に実行が必要
    OUTPUT_NODE = True

    def load_images(self, directory, sort_mode, index, start_index, end_index,
                    batch_size, seed, use_selection=True, unique_id=None, selected_files="[]"):
        from server import PromptServer

        # パスの解決と検証
        target_dir = resolve_safe_path(directory)
        _debug(f"target_dir={target_dir}")

        if not os.path.isdir(target_dir):
            raise FileNotFoundError("Specified directory was not found in image-loop-data")

        valid_extensions = ('.png', '.jpg', '.jpeg', '.webp', '.bmp', '.tif', '.tiff')

        # シンボリックリンクを除外
        all_files = [
            f for f in os.listdir(target_dir)
            if f.lower().endswith(valid_extensions)
            and os.path.isfile(os.path.join(target_dir, f))
            and not os.path.islink(os.path.join(target_dir, f))
        ]

        # selected_files フィルタリング
        try:
            sel = json.loads(selected_files) if selected_files else []
        except (json.JSONDecodeError, TypeError):
            sel = []

        if use_selection and sel:
            sel_set = set(sel)
            files = [f for f in all_files if f in sel_set]
            # selected の順序（natural sort）を維持
            files.sort(key=natural_sort_key)
        else:
            # もし選択が無効、またはリストが空なら、すべてのファイルを対象にする
            files = all_files
            files.sort(key=natural_sort_key)

        if not files:
            raise FileNotFoundError("No images found in the specified directory")

        if sort_mode == "descending":
            files.reverse()
        elif sort_mode == "random":
            random.Random(seed).shuffle(files)

        # 範囲指定の適用
        if end_index == 0 or end_index >= len(files):
            files = files[start_index:]
        else:
            files = files[start_index:end_index + 1]

        if not files:
            raise ValueError("No images left after applying index range")

        total_in_range = len(files)
        output_images = []

        def load_single_image(filename):
            img_path = os.path.join(target_dir, filename)
            img = Image.open(img_path)
            img = ImageOps.exif_transpose(img)
            img = img.convert("RGB")
            img = np.array(img).astype(np.float32) / 255.0
            return torch.from_numpy(img)[None,]

        for i in range(batch_size):
            actual_index = min(index + i, total_in_range - 1)
            file_to_load = files[actual_index]
            _debug(f"Loading: {file_to_load} (index={actual_index})")
            img_tensor = load_single_image(file_to_load)
            output_images.append(img_tensor)

        next_index = index + batch_size
        has_next = next_index < total_in_range

        PromptServer.instance.send_sync("image_loop_node_sync", {
            "node_id": unique_id,
            "next_index": next_index if has_next else 0,
            "has_next": has_next,
        })

        first_img = output_images[0]
        h, w = first_img.shape[1], first_img.shape[2]
        processed_images = []
        for img in output_images:
            if img.shape[1] != h or img.shape[2] != w:
                img_r = img.permute(0, 3, 1, 2)
                img_r = torch.nn.functional.interpolate(img_r, size=(h, w), mode="bilinear", align_corners=False)
                img_r = img_r.permute(0, 2, 3, 1)
                processed_images.append(img_r)
            else:
                processed_images.append(img)

        return (torch.cat(processed_images, dim=0),)


NODE_CLASS_MAPPINGS = {
    "ImageFeeder": ImageFeeder
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "ImageFeeder": "Image Feeder"
}
