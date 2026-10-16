# TAINAN: A Little Journey｜台南散策

**Version 1.0** — 2D pixel art cozy exploration；一段短短的府城旅行（神農街 → 安平水岸）。

## 技術棧

- Vite + TypeScript（ESM）
- Canvas 2D（邏輯解析度 400×225，pixel-perfect）
- Phaser（dependency；授權見 `node_modules/phaser`）

## 啟動

```bash
npm install
npm run dev
```

```bash
npm run build
npm run preview
```

需求：Node.js 18+（建議 LTS）、現代瀏覽器（Web Audio / Canvas 2D）。

## 專案結構

```
public/assets/     # 場景與角色像素圖
public/audio/      # 共用 BGM（府城漫步循環）
src/main.ts        # 進入點
src/scenes/        # 選單 / 探索 / 結局
src/systems/       # 玩家、碰撞、音訊等
src/data/          # 景點與收集品資料
src/ui/            # 紀念冊等 UI
```

## 音訊

- 全場景共用同一首 BGM：`public/audio/bgm_fucheng_stroll.mp3`
- 切換場景不得重播；僅呼叫 `AudioManager.ensureSharedBgm()`
- 音效（腳步、互動、收集）可獨立播放，不影響 BGM 時間軸

## 第三方授權與出處

| 項目 | 說明 |
|------|------|
| Phaser / Vite / TypeScript 等 | 僅適用各套件自身授權，不改變本專案 All Rights Reserved |
| 字型（若線上載入） | 依 Google Fonts／字型作者條款 |
| 地名與文化指涉 | 虛構互動娛樂用途；無官方背書 |

## License / 權限

Copyright (c) ReiKama414. All rights reserved.

本專案僅供個人瀏覽與學習。未經著作權人書面同意，
不得使用、複製、修改、散布或併入其他專案（含非商業用途）。

- [GitHub](https://github.com/ReiKama414/tainan-little-journey)
- [個人網站](https://reikama414.vercel.app/)
- 全文見 [LICENSE](./LICENSE)
