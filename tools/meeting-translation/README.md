# Meeting Translation

Zoom 会議と並行して使う、最大 3 人向けの日英双方向翻訳字幕サービスです。Zoom とは連携せず、各参加者がこのサービスの共有リンクを自分のブラウザで開き、自分のマイクの利用を許可します。本番 URL は `https://dystopia.city/translate/` です。

AWS SDK の標準 credential provider chain を使います。ブラウザへ AWS credentials を渡さず、必要な権限を持つ開発者用 identity を server process 側だけに設定します。

## Environment Variables

| Variable | Required | Application Default | Purpose |
| --- | --- | --- | --- |
| `AWS_REGION` | Yes | なし | Transcribe と Bedrock を呼び出すリージョン |
| `BEDROCK_MODEL_ID` | Yes | なし | 翻訳に使う Bedrock model ID |
| `MEETING_BASE_PATH` | Yes | なし | HTTP、WebSocket、静的ページの基底 path |
| `TRANSLATION_GLOSSARY` | No | 空 | 1 行 1 項目の用語集 |
| `PORT` | No | `3001` | server の listen port |

Required の 3 変数は空文字も許可されません。AWS access key などの credentials はこのサービスの環境変数へ追加しません。

## Running Locally

Node.js 24 を使用します。サービスディレクトリで依存関係を導入し、必須設定を与えて開発 server を起動します。

```bash
cd tools/meeting-translation
pnpm install

export AWS_REGION=ap-northeast-1
export BEDROCK_MODEL_ID=amazon.nova-lite-v1:0
export MEETING_BASE_PATH=/translate
export TRANSLATION_GLOSSARY=""

pnpm dev
```

Web UI は `http://localhost:5173/translate/`、API と WebSocket server は `localhost:3001` で起動します。実際の音声認識と翻訳を試す場合は、server process が AWS SDK の標準 credential provider chain から必要な権限を取得できる状態にします。

テストと production build は同じディレクトリで実行します。

```bash
pnpm test
pnpm build
```

## Meeting Operation

作成者は `/translate` を開き、表示名、話す言語、表示言語、外部 AI 処理への同意を設定して会議を作成します。生成された fragment 付き共有リンクを参加者へ渡し、作成者自身もその会議へ参加します。各参加者は共有リンクを自分のブラウザで開いて設定と同意を完了し、自分のマイクを開始してブラウザの許可を与えます。Zoom の参加とマイク設定は本サービスとは別に行います。

マイクを利用できない場合は、会議画面の手入力を使います。字幕の原文を展開して意味を照合し、必要な字幕では確認要求を送ります。

共有リンクの `#` 以降は join token です。bearer credential として扱い、ログ、issue、PR、画面録画へ記録しないでください。

## Connection Behavior

予期しない WebSocket 切断では、最後の参加者が切断した後も room を 5 秒間だけ保持し、その間の再接続を受け付けます。5 秒を過ぎると空の room を破棄します。利用者が送る明示的な `leave` はこの猶予を使わず即時処理され、最後の参加者の退出なら room を直ちに破棄します。再参加者へ過去の caption は再送しません。

room と caption は service process 内だけにあり、process の終了や再起動で失われます。永続化や履歴復元はありません。

## Logging and Privacy

アプリケーションは音声、source transcript、translated caption、join token を永続保存しません。AWS credentials、音声、source transcript、caption、join token をログへ出力しないでください。運用ログは event code と非機密 ID に限定します。

受入結果を PR に残す場合も、記録するのは成否、翻訳に要した時間、error code だけです。発話内容、transcript、caption、join token、AWS credentials は記録しません。
