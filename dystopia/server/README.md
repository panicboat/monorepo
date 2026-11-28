# dystopia server

## What

`media.v1.MediaService` を提供する Rust の gRPC サーバー。
利用者から見た挙動は monolith の media slice と同じで、`media.files` の表と S3 バケットを共有する。

- monolith は media slice を残している。
  - post・profile・review の各 slice とアカウントの削除処理は、今までどおり同じプロセスの中で media slice を呼ぶ。
- frontend は `MEDIA_SERVICE_URL` で media の向き先を選ぶ。
  - 設定すればこのサーバーに向き、無ければ monolith に向く。
- DB の migration はこのサーバーが持たない。
  - 表は monolith（Hanami）が作る。

機能の仕様は [メディア](../docs/features/media.md) にある。

## Why

monolith を Rust に移すかを決めるために、media slice だけを Rust で作り、Ruby と並べて動かして測る。
設計と測る項目は [Dystopia Rust Media Pilot Design](../../docs/superpowers/specs/2026-11-28-dystopia-rust-media-pilot-design.md) にある。

## Configuration

環境変数で設定する。

| 変数 | 既定値 | 意味 |
|---|---|---|
| `SERVER_BIND_ADDRESS` | `127.0.0.1:9002` | gRPC の待ち受けアドレス |
| `DATABASE_URL` | なし（必須） | PostgreSQL の接続 URL |
| `MEDIA_STORAGE` | `local` | `local` か `s3`。<br>`local` は S3 を使わず、`APP_URL` 配下の URL を返す |
| `APP_URL` | `http://localhost:3000` | `local` のとき、アップロード URL と配信 URL に使う origin |
| `LOCAL_UPLOADS_DIR` | `../monolith/public/uploads` | `local` のとき、ファイルの有無の確認と削除をするディレクトリ。<br>受け取りと配信は monolith が行うため、monolith の `public/uploads` を指す |
| `MEDIA_BUCKET_NAME` | なし（`s3` のとき必須） | media の S3 バケット名 |
| `MEDIA_BUCKET_REGION` | `ap-northeast-1` | `s3` のとき、バケットのリージョン |

## Development

`proto/dystopia/media` から `src/stub` の Rust のコードを生成する。
buf が必要で、生成したコードは commit する。

```bash
./bin/codegen
```

テストは Postgres を使う。
monolith の migration を済ませた `monolith_test` に接続するので、先に `HANAMI_ENV=test` で `hanami db migrate` を実行しておく。
接続先は `TEST_DATABASE_URL` で変えられる。

```bash
cargo test
```
