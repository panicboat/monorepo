# Meeting Translation

Zoom 会議と並行して使う、最大 3 人向けの日英双方向翻訳字幕サービスです。Zoom とは連携せず、各参加者がこのサービスの共有リンクを自分のブラウザで開き、自分のマイクの利用を許可します。本番 URL は `https://dystopia.city/translate/` です。

## AWS Prerequisites

本番適用前に、AWS アカウントの `ap-northeast-1` で `amazon.nova-lite-v1:0` を利用できることを確認します。Bedrock 側で model access の有効化または利用申請が必要なアカウントでは、先に完了させてください。サービスの実行 role には `transcribe:StartStreamTranscription` と、設定した model に対する `bedrock:InvokeModel` が必要です。

Pod Identity と workload は次の順序で適用します。

1. PR で `dystopia/infrastructure/aws/production/` の Terragrunt plan と Kubernetes 差分をレビューする。
2. merge 後の既存 deployment workflow で Terraform apply が完了し、`dystopia` namespace の `meeting-translation` ServiceAccount を対象とする IAM role、policy、EKS Pod Identity association が作成されたことを確認する。
3. その後、Flux に `dystopia/meeting-translation/kubernetes/overlays/production` を reconcile させる。Pod Identity association が確認できる前に Deployment の稼働確認へ進まない。

ブラウザへ AWS credentials を渡しません。ローカル実行では AWS SDK の標準 credential provider chain を使い、必要な権限を持つ開発者用 identity をプロセス側だけに設定します。

## Environment Variables

| Variable | Required | Application Default | Production Value | Purpose |
| --- | --- | --- | --- | --- |
| `AWS_REGION` | Yes | なし | `ap-northeast-1` | Transcribe と Bedrock を呼び出すリージョン |
| `BEDROCK_MODEL_ID` | Yes | なし | `amazon.nova-lite-v1:0` | 翻訳に使う Bedrock model ID |
| `MEETING_BASE_PATH` | Yes | なし | `/translate` | HTTP、WebSocket、静的ページの基底 path |
| `TRANSLATION_GLOSSARY` | No | 空 | 空 | 1 行 1 項目の用語集 |
| `PORT` | No | `3001` | `3000` | server の listen port |

Required の 3 変数は空文字も許可されません。本番値は `kubernetes/base/configmap.yaml` と Deployment に定義されています。AWS access key などの credentials はこのサービスの環境変数や ConfigMap に追加しません。

## Running Locally

Node.js 24 を使用します。サービスディレクトリで依存関係を導入し、必須設定を与えて開発 server を起動します。

```bash
cd dystopia/meeting-translation
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

## Connection and Deployment Behavior

予期しない WebSocket 切断では、最後の参加者が切断した後も room を 5 秒間だけ保持し、その間の再接続を受け付けます。5 秒を過ぎると空の room を破棄します。利用者が送る明示的な `leave` はこの猶予を使わず即時処理され、最後の参加者の退出なら room を直ちに破棄します。再参加者へ過去の caption は再送しません。

Deployment は single replica の `Recreate` strategy です。更新中は停止時間が発生します。room と caption は service process 内だけにあり、Pod の終了、再起動、更新で失われます。永続化や履歴復元はありません。

## Logging and Privacy

アプリケーションは音声、source transcript、translated caption、join token を永続保存しません。AWS credentials、音声、source transcript、caption、join token をログへ出力しないでください。運用ログは event code と非機密 ID に限定します。

受入結果を PR に残す場合も、記録するのは成否、翻訳に要した時間、error code だけです。発話内容、transcript、caption、join token、AWS credentials は記録しません。

## Post-PR Acceptance

**Status: POST-PR UNVERIFIED**

実 AWS、EKS、production URL、3 人の Zoom 会議を使う以下の受入確認は、PR 後の deployment が完了してから人手で実施します。現時点では未実施であり、3 秒目標または翻訳品質を達成したとは判定していません。

1. 1 つの Zoom 会議と、`/translate` を開いた 3 つのブラウザを用意する。
2. room を作成し、コピーされた fragment 付きリンクを共有して、日本語話者 1 人と英語話者 2 人として参加する。
3. 全員が自分のマイクを開始し、日付、数値、名前、否定を含む日本語と英語の文を発話する。
4. 発話と異なる言語の subtitle が 3 秒目標内に表示されることを確認し、その source text を展開する。
5. 1 つの caption で確認要求を送り、元の話者に localized prompt が届くことを確認する。
6. 1 人のマイクを停止して手入力翻訳を使い、その参加者の tab を閉じてから同じリンクで再参加する。
7. 残る 2 人への caption 配信が継続し、再参加者には再参加後の新しい caption だけが届くことを確認する。
8. 全 tab を閉じ、同じ room URL を開き直して、caption が再生されず `room_not_found` が返ることを確認する。
