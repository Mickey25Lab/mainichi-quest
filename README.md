# マイクエ

repository: `mainichi-quest`

ChatGPT Sites の `warizan-robot` から初回移行した版です。

元 Site: https://warizan-robot.kimihiko-sato25.chatgpt.site/

初回移行ではリファクタリングを行わず、Sites 版のアセットもそのまま移行しています。

## バージョン運用

マイクエは [Semantic Versioning](https://semver.org/lang/ja/) 形式の `MAJOR.MINOR.PATCH` を使用します。
MVP段階では、当面 `MAJOR` は `0` とします。

- `PATCH`: バグ修正、軽微なUI・文言・favicon・演出の変更
- `MINOR`: 新しい学習モード、親管理画面、クラウド保存などの大きな新機能
- `MAJOR`: 正式サービス化や大規模な互換性変更

Sites最終版 Version 111 は `0.0.111`、GitHub移行後の初回正式基準版は `0.0.112`、現在の正式Versionは `0.0.134` です。
以後のリリースでは、version番号と必要なアプリ内表示を更新し、commit、`vX.Y.Z` Git tag、push、GitHub Pages反映確認を行います。
