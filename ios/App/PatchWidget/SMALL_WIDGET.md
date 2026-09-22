# Small Widget checkpoint

基点: `origin/Dev` / `5768c6b`（2026-09-22 fetchで確認）。

## 構成

Smallだけを専用Viewに分離。上段にSF Symbol `flame.fill` + authoritative snapshotのstreak、直下に短文、背景に大きなイラストを配置。内部のブランド見出し「Patch」と横並びの小さなサムネイルを撤去。

SIGNED_OUT / STALEでは現在のstreakを確認できないため「—」。他はsnapshotの値をそのまま使用。既存8状態の判定・優先順位・timeline・snapshot schema・App Group・Due・通知・認証・署名・Production設定は変更しない。

Mediumの既存View式はそのまま `mediumBody` に移動。既存の文字、画像、余白、色、フォント、URLは変更なし。configuration全体の `contentMarginsDisabled()` は使わず、Smallの画像のみ `containerBackground` に置くことでMediumへの共有設定変更を避けている。

## 状態と画像

| Domain state | Visual variant / asset | 日本語 | English |
| --- | --- | --- | --- |
| NORMAL | NORMAL / widget-normal | その調子！ | Keep it going! |
| AT_RISK | RISK / widget-risk | そろそろ学ぼう！ | Time to practice! |
| LAST_CHANCE | URGENT / widget-urgent | 今がチャンス！ | Last chance! |
| COMPLETED | COMPLETE / widget-complete | 今日は達成！ | Done for today! |
| BROKEN | RESTART / widget-restart | また始めよう！ | Let’s start again! |
| SIGNED_OUT | NORMAL / widget-normal | ログインしよう | Sign in to start |
| NEW_USER | NORMAL / widget-normal | 最初のPatchを | Create a Patch |
| STALE | NORMAL / widget-normal | 開いて更新 | Open to refresh |

Widgetのlocaleが日本語なら日本語、それ以外は英語。画像未登録時は5種類すべて既存 `companion.jpeg` を再利用。白背景の元JPEGを改変・複製せず、下側に大きく配置して端でクリップする。色違いの仮イラストは作成していない。

## 最終画像の納品仕様

- `widget-normal.png`
- `widget-risk.png`
- `widget-urgent.png`
- `widget-complete.png`
- `widget-restart.png`

共通仕様: **1024 × 1024 px、PNG、sRGB、不透明な背景込みの正方形**。文字・数字・炎アイコン・角丸・外側余白は焼き込まない。キャラクターの主役部分は中央〜下部へ。上部約42%は文字用に静かな領域を取り、目など重要なパーツを置かない。表示時には上部を薄い白のグラデーションで補助し、58%位置までに透明化する。背景の色設計自体は画像に委ねる。

格納先は各画像に対して:

`ios/App/PatchWidget/Assets.xcassets/<asset-name>.imageset/<asset-name>.png`

例: `ios/App/PatchWidget/Assets.xcassets/widget-normal.imageset/widget-normal.png`

Asset Catalog方式に統一。`Assets.xcassets` は **PatchWidget targetのみ**のCopy Bundle Resourcesへ登録済み。Main AppのAsset Catalogへ追加しない。現在の5 imagesetは意図的に空。

受領時はXcodeで対応imagesetのUniversal / Single Scale枠にPNGを配置する。手動配置する場合は、既存 `Contents.json` の `images[0]` に `"filename": "widget-normal.png"` のように同名ファイルを指定する。他の4種類も同様。新たなPBXファイル登録やレイアウト変更は不要。未登録・読込失敗の画像だけcompanionへフォールバックする。

既存companionはMediumも使うため、従来の直接リソースを一つだけ維持。最終5画像を直接リソースにも二重登録しない。

## フォント

アプリは `mobile/fonts.css` のFontsource WOFF/WOFF2をWebViewで使用しており、Widgetにはネイティブフォントがなかった。既存 `@fontsource/*` **5.3.0** のWOFFをFontTools **4.60.2**でTTFに展開。アウトライン・名前・weightは変更なし。

| 用途 | 日本語 | 英語 |
| --- | --- | --- |
| 数字 20pt / Bold | M PLUS Rounded 1c 700 | Nunito Sans 700 |
| 短文 14pt / Regular | Noto Sans JP 400 | Inter 400 |

追加した4 TTFと各OFLライセンスは `PatchWidget/Fonts/`。フォルダ参照をWidgetのResourcesへ一度だけ追加し、Widgetの `Info.plist` / `UIAppFonts` で登録。合計約2.5MB。日本語本文は文字変更にも耐える既存のJapaneseサブセット、数字用のM PLUSは数字を含むLatinサブセットのみ。WebフォントやMain App設定には変更なし。

Noto Sans JP 400の実際のPostScript名は `NotoSansJPThin-Regular`。名前にThinが含まれるがOS/2 weightは400で、シミュレータでこの名前の登録を確認済み。M PLUSは `RoundedMplus1c-Bold`。

SwiftUIの単位はCSS pxではなくpt。20/14ptの固定サイズを使用し、最小サイズのWidgetで必要な場合のみ単行テキストを縮小する（数字80%、短文85%まで）。Widgetの限られた固定領域のため本文のDynamic Type拡大は行わず、VoiceOver用には日数を含むラベルを付けた。SF Symbolのみシステムフォント16pt。

再生成（通常のXcodeビルドには不要）:

```sh
python3 -m venv /tmp/patch-widget-fontenv
/tmp/patch-widget-fontenv/bin/pip install fonttools==4.60.2
/tmp/patch-widget-fontenv/bin/python scripts/prepare-widget-fonts.py
```

## QA

```sh
node --test tests/retention.test.mjs tests/ios-release.test.mjs
python3 scripts/check-small-widget.py <booted-iOS-simulator-UUID>
xcodebuild -project ios/App/App.xcodeproj -target PatchWidget \
  -configuration Debug -sdk iphoneos CODE_SIGNING_ALLOWED=NO \
  SYMROOT=/tmp/patch-small-widget-device OBJROOT=/tmp/patch-small-widget-obj build
```

QAハーネスは実際のSmall View部品をSwiftUI ImageRendererで描画する独立したSimulatorアプリ。製品ターゲットには含めず、実App Groupへアクセスしない。8状態×2言語×2appearance×4サイズ（141/155/170/180pt）の128描画を確認。streak 0/3/12/123/1234、フォントの実名登録、最小サイズでの短文幅、fallback画像のピクセルも検証。結果と日英light/darkの一覧PNGを一時ディレクトリへ保存する。

関連テスト13件成功。arm64実機SDKのWidget単体ビルド成功、バンドル内4フォントとJPEGの存在を確認。署名・プロビジョニング設定は変更せず、署名を省略したビルドなので実機インストールの確認ではない。

このQAでは代表的な16pt余白を再現しており、SpringBoard上のWidgetKitホストや実機での見た目、iOSのホーム画面Tintedモードは未確認。実装はシステムのWidget余白を維持している。最終5画像到着後は画像上部のコントラスト・トリミングを追加で確認する。

背景・余白APIの根拠: [Apple: Bring widgets to new places](https://developer.apple.com/videos/play/wwdc2023/10027/)。
