from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image

SOURCE = Path(
    r"C:\Users\Lenovo\.cursor\projects\e-WorkSpace-aidr\assets"
    r"\c__Users_Lenovo_AppData_Roaming_Cursor_User_workspaceStorage_3ec4f62ede9afd4e0a153cd282177cf3_images_image-c5748046-c53a-4899-a007-1091c82eb5e0.png"
)

TARGETS = [
    Path(r"e:\WorkSpace\aidr\aidr-fe\public\theme\images\aidr-logo-header.png"),
    Path(r"e:\WorkSpace\aidr\aidr-fe\public\theme\images\aidr-logo.png"),
    Path(r"e:\WorkSpace\aidr\aidr-fe\public\admin-theme\images\aidr-logo.png"),
    Path(r"e:\WorkSpace\aidr\aidr-fe\public\admin-theme\images\logo-dark.png"),
    Path(r"e:\WorkSpace\aidr\aidr-fe\public\admin-theme\images\logo-light.png"),
    Path(r"e:\WorkSpace\aidr\aidr-fe\public\admin-theme\images\logo-sm.png"),
    Path(r"e:\WorkSpace\aidr\theme-for-aidr-admin-fe\admin\assets\images\logo-dark.png"),
    Path(r"e:\WorkSpace\aidr\theme-for-aidr-admin-fe\admin\assets\images\logo-light.png"),
    Path(r"e:\WorkSpace\aidr\theme-for-aidr-admin-fe\admin\assets\images\logo-sm.png"),
]


def remove_checkerboard_background(image: Image.Image) -> Image.Image:
    rgba = image.convert("RGBA")
    arr = np.array(rgba)
    red = arr[:, :, 0].astype(np.int16)
    green = arr[:, :, 1].astype(np.int16)
    blue = arr[:, :, 2].astype(np.int16)
    avg = (red + green + blue) / 3

    # Remove every checkerboard tile, including enclosed regions inside letters.
    neutral = (np.abs(red - green) <= 18) & (np.abs(green - blue) <= 18)
    checkerboard = neutral & (avg >= 155) & (avg <= 238)

    result = arr.copy()
    result[checkerboard, 3] = 0
    return Image.fromarray(result)


def write_favicons(transparent_logo: Image.Image) -> None:
    public = Path(r"e:\WorkSpace\aidr\aidr-fe\public")
    for size, name in ((32, "favicon-32.png"), (16, "favicon-16.png")):
        thumb = transparent_logo.copy()
        thumb.thumbnail((size, size), Image.Resampling.LANCZOS)
        canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        offset_x = (size - thumb.width) // 2
        offset_y = (size - thumb.height) // 2
        canvas.paste(thumb, (offset_x, offset_y), thumb)
        canvas.save(public / name)

    ico = transparent_logo.copy()
    ico.thumbnail((32, 32), Image.Resampling.LANCZOS)
    ico.save(public / "favicon.ico", sizes=[(ico.width, ico.height)])
    ico.save(public / "admin-theme" / "images" / "favicon.ico", sizes=[(ico.width, ico.height)])


def main() -> None:
    transparent = remove_checkerboard_background(Image.open(SOURCE))
    for target in TARGETS:
        target.parent.mkdir(parents=True, exist_ok=True)
        transparent.save(target)
        print(f"saved {target}")
    write_favicons(transparent)
    print("favicons updated")


if __name__ == "__main__":
    main()
