# フォニックス動画 — パート1〜5

このPoCは、YouTube IFrame Player API で子ども向けのフォニックス動画を再生し、リズム単位を**通常音量で2回**聞けるかを確認するためのものです。

## 対象と再生方法

- 動画: `ChqnN3cKzXQ` — ABC Phonics Chant for Children
- 画面: モード選択の「フォニックス」→ パートをえらぶ
- レッスン: パート1（A〜F）/ パート2（G〜K）/ パート3（L〜P）/ パート4（Q〜U）/ パート5（V〜Z）
- 対象フレーム: A-1〜Z-2（全52フレーム）

各フレームは、最初にフレーム開始から「ジャンプ時終了」まで再生し、指定した「ジャンプ時開始」へ戻ってもう一度フレーム末尾まで再生します。2回目の末尾から次フレームの1回目へは、**停止・pause・seekをせず**連続再生します。選択したパートの最後の2回目が終わると「動画を見たよ」を表示します。

保存済みのPart 2実測値は [part2-g-k-timing.json](part2-g-k-timing.json) に残しています。A-1だけは冒頭用の個別調整（レビュー値: -0.40 / 4.84 / 0.00 / 4.84）があり、YouTube再生では開始時刻を0.00秒に丸めます。ほかの51フレームは、A-2以降5.05秒・ジャンプ開始+0.39秒の共有ルールから機械的に生成します。

YouTube プレーヤーの上には要素を重ねません。モード選択表示中にプレーヤーを先行準備し、準備完了後のモード選択タップで再生を開始します。ブラウザ側が再生を拒否した場合だけ「再生する」を表示します。PWAのバックグラウンド化・復帰後は自動再開しません。

## 明示的に含めないもの

視聴に結びつく星、エネルギー、ポイント、コレクション、保存、完了報酬、または解放要素はありません。最後は「おわる」または「もどる」でモード選択へ戻ります。

## 子ども向け self-designation

実装は `youtube-nocookie.com` を使いますが、これは self-designation の代替ではありません。本番公開前に、運用者が YouTube の child-directed API client 向け手順で、このサイト/アプリを child-directed として Google に通知する必要があります。

- [YouTube: Embed videos & playlists](https://support.google.com/youtube/answer/171780)
- [YouTube Developer Policies: Child-Directed API Clients](https://developers.google.com/youtube/terms/developer-policies#j-child-directed-api-clients)

## 確認方法

1. モード選択から「フォニックス」を開き、パート1〜5のいずれかを選ぶ。
2. 選択したパートの各フレームが通常音量で2回聞こえることを確認する。
3. 各フレームの1回目の末尾で、設定済みのジャンプ時開始へ戻ることを確認する。
4. 2回目の末尾から次フレームへ、音を止めずに連続することを確認する。
5. 各パートの最後に「動画を見たよ」を押すとモード選択へ戻ることを確認する。

自動確認は `node --test tests/phonics-youtube-poc.test.cjs` で行えます。iPad相当の834×1112・タッチ有効viewportで、Part 2の全10フレームと、Part 1〜5の区間割り当て、各リピート時のseek、フレーム間のシームレス接続、終了、再入時のPlayer再準備をモックしたIFrame Player APIで確認します。
