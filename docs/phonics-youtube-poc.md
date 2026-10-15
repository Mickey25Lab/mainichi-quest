# フォニックス動画 技術PoC

このPoCは、YouTube IFrame Player API を利用して、子どもが自分で再生を開始した動画を指定位置で止め、短い発話時間の後に再開できるかを確認するためのものです。

## 対象

- 動画: `ChqnN3cKzXQ` — ABC Phonics Chant for Children
- 画面: モード選択の「フォニックス（動画）」
- 再生区間: 0:10 から 1:00 まで
- 停止位置: 0:20 / 0:30 / 0:40 / 0:50 / 1:00
- 各停止時間: 3秒
- 停止中はステータス欄を強調し、「一時停止 n / 5：3秒間、まねして言ってみよう！」と表示
- 1:00 の停止後は再開せず、そのままPoC終了

YouTube プレーヤーの上には要素を重ねません。再生開始は「はじめる」のユーザー操作からだけです。手動停止、バックグラウンド化、PWA の復帰後は自動再開しません。シークで既に通過した停止位置へ戻っても、同じ位置を二重に停止しません。

## 明示的に含めないもの

視聴に結びつく星、エネルギー、ポイント、コレクション、保存、完了報酬、または解放要素はありません。最後は「おわる」でモード選択へ戻ります。

## 子ども向け self-designation

実装は `youtube-nocookie.com` を使いますが、これは self-designation の代替ではありません。本番公開前に、運用者が YouTube の child-directed API client 向け手順で、このサイト/アプリを child-directed として Google に通知する必要があります。埋め込み先が子ども向けの場合は、Privacy Enhanced Mode を使っていても self-designation が必要です。

- [YouTube: Embed videos & playlists](https://support.google.com/youtube/answer/171780)
- [YouTube Developer Policies: Child-Directed API Clients](https://developers.google.com/youtube/terms/developer-policies#j-child-directed-api-clients)

この通知に必要なアカウント設定はリポジトリのコードから自動化せず、公開責任者が本番ドメインと法的な対象年齢を確認して行います。

## 確認方法

1. モード選択から「フォニックス（動画）」を開く。
2. 「はじめる」を押す。
3. 0:10 から再生が始まることを確認する。
4. 0:20 / 0:30 / 0:40 / 0:50 で3秒停止して再開することを確認する。
5. 1:00 で3秒停止したあと、再開せず「おわる」が表示されることを確認する。
6. プレーヤーで手動停止し、勝手に再開しないことを確認する。
7. アプリをバックグラウンドへ切り替えて戻り、勝手に再開しないことを確認する。
8. 最後は「おわる」でモード選択へ戻る。

自動確認は `node --test tests/phonics-youtube-poc.test.cjs` で行えます。iPad相当の 834×1112・タッチ有効 viewport で、開始、停止/再開、手動操作、シークの重複防止、pagehide、終了/破棄をモックした IFrame Player API で確認します。
