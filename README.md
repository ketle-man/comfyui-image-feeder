# ComfyUI Image Feeder

A ComfyUI custom node for looping through images in a folder with a visual library UI and playback controls.

**Language / 言語 / 语言:** [日本語](README_ja.md) | [中文](README_zh.md)

## Screenshots

### Node

![Image Feeder Node](docs/screenshot_node.png)

### Image Library

![Image Library](docs/screenshot_library.png)

## Features

- **Image Library (Lib)**:
  - Open the library via the 📂 **Lib** button to preview images and select loop targets individually using checkboxes.
  - 3-pane UI (folder tree / image grid / file info) for efficient image management. Sub-folders are supported.
  - Preset support to save and reload folder + selection state.

- **Playback Controls**:
  - ▶ **Run**: Resets the index and starts the automatic loop.
  - ⏹ **Stop**: Stops the automatic loop.
  - 🔗 **Sel ON/OFF**: Toggles between using only library-selected images or all images in the folder.

- **Flexible Sorting & Range**:
  - Sort modes: `ascending` / `descending` / `random`.
  - Range control via `start_index` / `end_index`.

- **Batch Output & Auto-Resize**:
  - Outputs multiple images at once according to `batch_size`.
  - Automatically resizes images to match the first image's resolution when sizes differ.

- **i18n Support**:
  - UI language is automatically detected from the browser's language setting.
  - Supported: **English** / **日本語** / **中文（简体）**

## Installation

1. Clone or copy this folder into ComfyUI's `custom_nodes` directory.
2. Start (or restart) ComfyUI. The `Image Feeder` node will appear under the `image` category.

## Image Placement

Place images in the following directory structure:

```
ComfyUI/
└── user/
    └── default/
        └── image-loop-data/        ← root folder
            ├── pose_collection/    ← subfolders supported
            │   ├── img001.png
            │   └── img002.png
            └── sample.png
```

- Enter the relative path from `image-loop-data` in the node's `directory` field.
- Leave blank to use the root of `image-loop-data`.
- **Security**: Access outside the `image-loop-data` folder is blocked to prevent path traversal.

## Parameters

| Parameter | Description |
|---|---|
| `directory` | Subfolder name under `image-loop-data`. Leave blank for root. |
| `sort_mode` | `ascending` (natural order) / `descending` / `random` |
| `index` | Current load position. Updated automatically during loop. |
| `start_index` | Start of the load range. |
| `end_index` | End of the load range (0 = until last). |
| `batch_size` | Number of images to output at once. |
| `seed` | Seed for reproducible random sorting. |
| `use_selection` | Whether to use library selection (toggle via node button). |

## Notes

- Filenames with numbers (e.g. `img1.png`, `img10.png`) are sorted correctly using natural sort.
- Symbolic links are excluded for security.
- After selecting images in the library, press **Apply to Node** to apply the selection.
- Supported formats: `.png` / `.jpg` / `.jpeg` / `.webp` / `.bmp` / `.tif` / `.tiff`
