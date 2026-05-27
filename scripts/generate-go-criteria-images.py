#!/usr/bin/env python3
# G2 spike S1 GO 判定基準の OK/NG 視覚サンプル PNG を生成。
# spike s1-tiles.ts の 3 パターン (A 境界線 / B グラデ / C 大型タイポ) を計算的に再現し、
# 合成成功 (OK) と合成失敗 (NG) のそれぞれを 576×288 サイズで PNG 化する。
# 出力先: docs/v0.5/spike-results/images/
#
# G2 ディスプレイは 4-bit gray 16 階調緑なので、spike コードの「白」=発光緑、「黒」=非発光に対応。
# 緑系パレットで実機の見え方を近似する。

from PIL import Image, ImageDraw, ImageFont
import os

W, H = 576, 288
HALF_W, HALF_H = 288, 144

# G2 4-bit gray 近似カラー
GREEN_ON = (139, 195, 74)   # 発光（spike の白に対応）
GREEN_OFF = (8, 16, 8)       # 非発光（spike の黒に対応、純黒だと印刷で潰れるのでわずかに緑寄せ）

OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "docs", "v0.5", "spike-results", "images")
OUT_DIR = os.path.abspath(OUT_DIR)
os.makedirs(OUT_DIR, exist_ok=True)

FONT_PATH = "/System/Library/Fonts/Supplemental/Courier New Bold.ttf"
FONT_LARGE = ImageFont.truetype(FONT_PATH, 160)
FONT_MID = ImageFont.truetype(FONT_PATH, 64)


def save(img: Image.Image, name: str) -> None:
    path = os.path.join(OUT_DIR, name)
    img.save(path, optimize=True)
    print(f"saved {path} ({os.path.getsize(path)} bytes)")


# === A 境界線 ===
def a_ok() -> None:
    """合成成功: 田の字の黒枠が連続して見える"""
    img = Image.new("RGB", (W, H), GREEN_ON)
    d = ImageDraw.Draw(img)
    for tx in (0, HALF_W):
        for ty in (0, HALF_H):
            d.rectangle(
                [tx, ty, tx + HALF_W - 1, ty + HALF_H - 1],
                outline=GREEN_OFF,
                width=1,
            )
    labels = [
        ("TL", HALF_W / 2, HALF_H / 2),
        ("TR", HALF_W + HALF_W / 2, HALF_H / 2),
        ("BL", HALF_W / 2, HALF_H + HALF_H / 2),
        ("BR", HALF_W + HALF_W / 2, HALF_H + HALF_H / 2),
    ]
    for label, x, y in labels:
        d.text((x, y), label, font=FONT_MID, fill=GREEN_OFF, anchor="mm")
    save(img, "a-ok.png")


def a_ng() -> None:
    """合成失敗: タイル境界の中央十字に隙間/段差"""
    img = Image.new("RGB", (W, H), GREEN_ON)
    d = ImageDraw.Draw(img)
    # 各タイル外周を外向きに 3px ずらすことで、中央線が太く + 中央十字に隙間が見える
    offsets = [(-3, -3), (3, -3), (-3, 3), (3, 3)]
    tiles = [(0, 0), (HALF_W, 0), (0, HALF_H), (HALF_W, HALF_H)]
    labels_text = ["TL", "TR", "BL", "BR"]
    for (tx, ty), (ox, oy), label in zip(tiles, offsets, labels_text):
        d.rectangle(
            [tx + ox, ty + oy, tx + HALF_W - 1 + ox, ty + HALF_H - 1 + oy],
            outline=GREEN_OFF,
            width=1,
        )
        d.text(
            (tx + HALF_W / 2 + ox, ty + HALF_H / 2 + oy),
            label,
            font=FONT_MID,
            fill=GREEN_OFF,
            anchor="mm",
        )
    save(img, "a-ng.png")


# === B グラデーション ===
def _lerp_color(c0: tuple[int, int, int], c1: tuple[int, int, int], t: float) -> tuple[int, int, int]:
    return (
        int(c0[0] + (c1[0] - c0[0]) * t),
        int(c0[1] + (c1[1] - c0[1]) * t),
        int(c0[2] + (c1[2] - c0[2]) * t),
    )


def _gradient_image() -> Image.Image:
    """黒→緑→黒の横方向グラデ"""
    img = Image.new("RGB", (W, H))
    px = img.load()
    for x in range(W):
        t = x / (W - 1)
        intensity = 1 - abs(2 * t - 1)  # 0..0.5..1 で 0..1..0
        color = _lerp_color(GREEN_OFF, GREEN_ON, intensity)
        for y in range(H):
            px[x, y] = color
    return img


def b_ok() -> None:
    """合成成功: 中央 x=288 で段差なくなめらか"""
    save(_gradient_image(), "b-ok.png")


def b_ng() -> None:
    """合成失敗: 中央 x=288 で輝度ジャンプ"""
    img = _gradient_image()
    px = img.load()
    drop = 36  # 右半分の輝度を落とす（タイル合成失敗による段差を模倣）
    for x in range(HALF_W, W):
        for y in range(H):
            r, g, b = px[x, y]
            px[x, y] = (max(0, r - drop), max(0, g - drop), max(0, b - drop))
    save(img, "b-ng.png")


# === C 大型タイポ ===
def _typo_image() -> Image.Image:
    img = Image.new("RGB", (W, H), GREEN_ON)
    d = ImageDraw.Draw(img)
    d.text((W / 2, H / 2), "12:34", font=FONT_LARGE, fill=GREEN_OFF, anchor="mm")
    return img


def c_ok() -> None:
    """合成成功: 境界をまたぐ 12:34 が 1 文字として読める"""
    save(_typo_image(), "c-ok.png")


def c_ng() -> None:
    """合成失敗: 右半分が 8px 下にずれて、中央で字が割れる"""
    full = _typo_image()
    img = Image.new("RGB", (W, H), GREEN_ON)
    img.paste(full.crop((0, 0, HALF_W, H)), (0, 0))
    right = full.crop((HALF_W, 0, W, H))
    shifted = Image.new("RGB", (HALF_W, H), GREEN_ON)
    shifted.paste(right, (0, 8))
    img.paste(shifted, (HALF_W, 0))
    save(img, "c-ng.png")


if __name__ == "__main__":
    a_ok()
    a_ng()
    b_ok()
    b_ng()
    c_ok()
    c_ng()
    print("done")
