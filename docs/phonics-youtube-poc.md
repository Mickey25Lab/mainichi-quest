# フォニックス動画 技術PoC — パート2（G〜K）

このPoCは、YouTube IFrame Player API で子ども向けのフォニックス動画を再生し、リズム単位を**通常音量で2回**聞けるかを確認するためのものです。

## 対象と再生方法

- 動画: `ChqnN3cKzXQ` — ABC Phonics Chant for Children
- 画面: モード選択の「フォニックス（動画）」
- レッスン: フォニックス パート2（G〜K）
- 対象フレーム: G-1、G-2、H-1、H-2、I-1、I-2、J-1、J-2、K-1、K-2

各フレームは、最初にフレーム開始から「ジャンプ時終了」まで再生し、指定した「ジャンプ時開始」へ戻ってもう一度フレーム末尾まで再生します。2回目の末尾から次フレームの1回目へは、**停止・pause・seekをせず**連続再生します。K-2の2回目が終わると「おわる」を表示します。

保存済みのフレーム値は [part2-g-k-timing.json](part2-g-k-timing.json) に残しています。A-1だけは冒頭用の個別調整があり、パート2では利用しません。

YouTube プレーヤーの上には要素を重ねません。モード選択表示中にプレーヤーを先行準備し、準備完了後のモード選択タップで再生を開始します。ブラウザ側が再生を拒否した場合だけ「再生する」を表示します。PWAのバックグラウンド化・復帰後は自動再開しません。

## 明示的に含めないもの

視聴に結びつく星、エネルギー、ポイント、コレクション、保存、完了報酬、または解放要素はありません。最後は「おわる」または「もどる」でモード選択へ戻ります。

## 子ども向け self-designation

実装は `youtube-nocookie.com` を使いますが、これは self-designation の代替ではありません。本番公開前に、運用者が YouTube の child-directed API client 向け手順で、このサイト/アプリを child-directed として Google に通知する必要があります。

- [YouTube: Embed videos & playlists](https://support.google.com/youtube/answer/171780)
- [YouTube Developer Policies: Child-Directed API Clients](https://developers.google.com/youtube/terms/developer-policies#j-child-directed-api-clients)

## 確認方法

1. モード選択から「フォニックス（動画）」を開く。
2. G-1からK-2まで、各フレームが通常音量で2回聞こえることを確認する。
3. 各フレームの1回目の末尾で、設定済みのジャンプ時開始へ戻ることを確認する。
4. 2回目の末尾から次フレームへ、音を止めずに連続することを確認する。
5. K-2後に「おわる」を押すとモード選択へ戻ることを確認する。

自動確認は `node --test tests/phonics-youtube-poc.test.cjs` で行えます。iPad相当の834×1112・タッチ有効viewportで、G〜Kの全10フレーム、各リピート時のseek、フレーム間のシームレス接続、終了、再入時のPlayer再準備をモックしたIFrame Player APIで確認します。
