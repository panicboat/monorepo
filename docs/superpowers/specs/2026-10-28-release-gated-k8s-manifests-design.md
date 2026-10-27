# Release Gated Kubernetes Manifests Design

## Context

### Why

monorepo の各サービスは、release-please の release PR を merge するとイメージがリリースされる。
一方で kubernetes のマニフェストは、`main` に merge した時点で本番に入る。
次のアプリバージョンに備えて k8s リソースをリファクタリングすると、マニフェストだけが先に本番へ入り、古いイメージと組み合わさってしまう（#1748）。
1 つのサービスのリリースが、イメージとマニフェストで別々のタイミングに分かれていること自体を解消したい。

### Current state

- Flux の root（`flux-system` Kustomization）は panicboat/platform にあり、Kustomization `monorepo-cluster` が monorepo の `main` の `clusters/production/` を適用している（`platform/kubernetes/clusters/production/repositories/monorepo.yaml`）
- サービスごとに `clusters/production/<product>/<service>/` があり、次のファイルを持つ
  - `service.yaml`: Kustomization `<service>`。GitRepository `monorepo`（`main`）から `<product>/<service>/kubernetes/overlays/production` を適用する
  - `image-repository.yaml`・`image-policy.yaml`: ghcr の `vX.Y.Z` タグから最新を選ぶ
  - `image-automation.yaml`: 最新のタグを overlay の `image:` 行（`$imagepolicy` の目印付き）に書き込み、`main` に直接 push する
- 対象のサービスは monolith・frontend（`dystopia/`）と pennyworth（`system-components/`）
  - overlay の `image:` 行は monolith に 3 行（`deployment.yaml`・`migrate-job.yaml`・`purge-deactivated-cronjob.yaml`）、frontend に 1 行（`deployment.yaml`）、pennyworth に 2 行（`deployment.yaml`）ある
- release-please はサービスごとの `release-please-config.json` で動き、リリースタグは `<service>-vX.Y.Z`、release PR は squash merge される（リポジトリは squash merge のみ許可）
- Release - Build（panicboat/.github の `reusable--release--build.yaml`）はリリースタグからイメージを作り、`vX.Y.Z` のタグを付けて ghcr に push する
  - この shared workflow を呼んでいるのは monorepo だけ（VERIFIED: panicboat の全リポジトリの `.github/workflows` を確認）
- Release - Deploy は同じ release の publish で動くが、適用するのは terragrunt の `apply_trigger: release` の環境だけで、k8s と Lambda には触らない（README の Mechanics）
- Lambda のデプロイは `deploy-dystopia-lambda.yaml` が `main` への push で行い、この設計とは独立している
- ImageUpdateAutomation の commit は overlay（各 release-please パッケージの中）に入るので、次のリリースの対象に混ざる（例: `deec94d7` が `monolith-v0.7.1..monolith-v0.8.0` に入っている）
- リリースタグの snapshot の overlay は、そのリリースのイメージを指していない（VERIFIED: `monolith-v0.8.0` の `deployment.yaml` は `monolith:v0.7.1`）
- production アカウントに EKS cluster は今ない（VERIFIED: `aws eks list-clusters` が `[]`）。dystopia は Lambda で動いている
- Flux は v2.9.6（platform の `gotk-components.yaml`）

## Goals

- サービスの release PR を merge したときに、そのサービスのマニフェストとイメージが一緒に本番に入る
- 通常の PR を merge しても、サービスの overlay は本番に入らない
- リリースタグの snapshot だけで、本番に入るマニフェストとイメージのバージョンが決まる
- EKS に戻したときに、そのまま使える状態にする

## Non-goals

- platform の `kubernetes/`（helmfile の component）を release で反映すること
  - platform では、マニフェストとイメージのタイミングがずれる痛みがない
- `clusters/production/` 自体の変更（サービスの追加・Flux の設定変更）を release で反映すること。今と同じく `main` の merge で反映する
- `deploy-dystopia-lambda.yaml` と Lambda の構成を変えること
- `clusters/production/tools/meeting-translation/` を整理すること（参照先の `tools/meeting-translation/` が monorepo にない）
- マニフェストを OCI artifact として配ること（案 B。今回は採らない）
- workflow-config の `kustomize` stack に `apply_trigger` を足すこと
  - リリースで反映するかは Flux の `ref.tag` で決まり、CI はこの値を読まない
  - `apply_trigger` を外して「production はリリース、それ以外は merge」の規則に揃える件は、[Release Environment Rule Design](2026-10-28-release-environment-rule-design.md) で扱う

## Anti-goals

- `main` への merge だけで、サービスの overlay が本番に入る経路が残ること
- ghcr にまだないイメージを Flux が適用しようとすること
- Flux の commit が、次のリリースの対象に混ざること

## Decisions

ユーザーと合意した事項。

- **サービスごとにリリースタグを読ませる（案 A）**: 各サービスに専用の GitRepository を置き、`ref.tag` で指定したリリースタグの snapshot から overlay を適用する
- **イメージのバージョンは overlay に置く**: release PR の中で release-please が overlay の `image:` 行を書き換える。`service.yaml` の `spec.images` には置かない
- **`ref.tag` は Flux の ImageUpdateAutomation が書き換える**: GitHub Actions には書かせない
  - Flux はイメージが ghcr に push された後にしかタグに気付かないので、「build の後に切り替える」順番が自然に守られる
- **イメージに `<service>-vX.Y.Z` のタグも付ける**: ImagePolicy はこのタグを選び、ImageUpdateAutomation はその値を `ref.tag` にそのまま書く
  - VERIFIED: ImagePolicy の `filterTags.extract` は並べ替えにだけ使われ、書き込まれるのは元のタグ（image-reflector-controller `docs/spec/v1/imagepolicies.md`）
- **対象は monorepo のサービス（monolith・frontend・pennyworth）**
- **実装を終えたら、一時的に EKS cluster を作って確認する**: そのとき Lambda 側は壊して作り直してよい

## Design

### Flux sources

`clusters/production/<product>/<service>/service.yaml` に GitRepository を足し、Kustomization の参照先を変える。

```yaml
apiVersion: source.toolkit.fluxcd.io/v1
kind: GitRepository
metadata:
  name: monorepo-<service>
  namespace: flux-system
spec:
  interval: 5m
  url: https://github.com/panicboat/monorepo.git
  ref:
    tag: <service>-vX.Y.Z # {"$imagepolicy": "flux-system:<service>:tag"}
  provider: github
  secretRef:
    name: panicboat-github-app
---
apiVersion: kustomize.toolkit.fluxcd.io/v1
kind: Kustomization
metadata:
  name: <service>
  ...
spec:
  sourceRef:
    kind: GitRepository
    name: monorepo-<service>
  ...（path・prune・targetNamespace・postBuild は今のまま）
```

- `url`・`provider`・`secretRef` は platform の GitRepository `monorepo` と同じにする。`panicboat-github-app` は platform が `flux-system` に作っている

### Image automation

- `image-policy.yaml`: `filterTags.pattern` を `^<service>-v(?P<version>\d+\.\d+\.\d+)$`、`extract` を `$version` にする（semver で最新を選ぶのは今のまま）
- `image-automation.yaml`: `update.path` を `./clusters/production/<product>/<service>` にする
  - commit 先がパッケージの外になるので、Flux の commit は次のリリースの対象に混ざらない
  - commit message は、どのリリースに切り替えたかが分かる文言にする（例: `chore(<service>): deploy {{ .NewValue }}`）
- `image-repository.yaml` は今のまま

### Overlay and release-please

- overlay の `image:` 行の目印を `# {"$imagepolicy": "flux-system:<service>"}` から `# x-release-please-version` に変える
- 各サービスの `release-please-config.json` の package に `extra-files` を足し、上の overlay のファイルを `{"type": "generic", "path": "kubernetes/overlays/production/<file>"}` の形で並べる（パスは package からの相対）
  - VERIFIED: generic updater は目印のある行の `\d+\.\d+\.\d+` だけを置き換えるので、`v` とレジストリのパスは残る（release-please `src/updaters/generic.ts`）
  - `"type": "generic"` を明示し、YAML の `$.version` を探す updater を使わせない（文字列で `.yaml` を渡すと両方が使われる。`src/strategies/base.ts`）

### Image tags

- panicboat/.github の `reusable--release--build.yaml`（と `internal--image-builder.yaml`）で、リリースのイメージに `vX.Y.Z` に加えてリリースタグそのもの（`<service>-vX.Y.Z`）のタグも付ける
- panicboat/.github をリリースし、monorepo の参照を更新する（Renovate で追従）

### Release flow

1. 開発者が overlay・base を変える PR を merge する。Flux はタグの snapshot を読んでいるので、本番は変わらない
2. release-please が release PR を更新する（`CHANGELOG.md`・`release-please-manifest.json`・overlay の `image:` 行）
3. release PR を merge すると、squash の commit にタグ `<service>-vX.Y.Z` が付き、release が publish される
4. Release - Build がイメージを作り、`vX.Y.Z` と `<service>-vX.Y.Z` のタグで ghcr に push する
5. ImageRepository が `<service>-vX.Y.Z` を見つけ、ImageUpdateAutomation が `service.yaml` の `ref.tag` を書き換えて `main` に push する
6. `monorepo-cluster` が `service.yaml` を適用し、GitRepository `monorepo-<service>` がタグを fetch し、Kustomization `<service>` がその snapshot の overlay を適用する

- ロールバックは、`ref.tag` を前のリリースタグに戻す PR を merge して行う（`clusters/production/` は merge で反映される）
  - ImagePolicy は semver の最新を選ぶので、そのままでは ImageUpdateAutomation が次の実行で最新のタグに戻す。同じ PR で `image-automation.yaml` に `spec.suspend: true` を入れ、次のリリースを出す PR で外す
  - DB migration を含むリリースを戻せるかは、今の運用（`main` の revert）と変わらない。この設計では扱わない

### Cutover

既存のリリースタグの snapshot は、`$imagepolicy` の目印と古いイメージを持っている（Current state 参照）。
既存のイメージには `<service>-vX.Y.Z` のタグもない。
そのため、次の順で進める。

1. panicboat/.github の変更（Image tags）を merge・リリースし、monorepo の参照を更新する
2. monorepo の変更を merge する。`ref.tag` には仮に各サービスの今の最新のリリースタグを書いておく（cluster がないので適用されない）
   - この変更で各サービスの release PR が作られるようにする（3 サービスとも package の中のファイルを変え、release-please がリリース対象と判断する type で commit する）
3. 3 サービスの release PR を merge し、`<service>-vX.Y.Z` のタグ付きのイメージを作る
4. `ref.tag` を 3 のリリースタグに書き換える PR を merge する（cluster がない間は ImageUpdateAutomation が動かないため、手で合わせる）
5. 一時 cluster を作る

### README

- ルートの `README.md` の Deployment（Pipeline Flow の図・Versioning・Stacks・GitOps）を、この流れに合わせて書き換える
  - 特に GitOps の「image-automation が overlay に commit する」記述と、Stacks の `kustomize` 行

## Constraints

- GitHub Actions は SHA 固定（`lint-actions.yml`）
- monorepo の shared workflow は panicboat/.github の SHA 固定の参照で呼ぶ。panicboat/.github の変更は、そのリリースと monorepo 側の参照更新の 2 段になる
- ImageUpdateAutomation は今も `main` に直接 push している。同じ権限で `clusters/production/` に push する

## Left to the builder

- `internal--image-builder.yaml` にリリースタグのイメージタグを足す方法（入力を足すか、`reusable--release--build.yaml` で `semver-tag` とは別に渡すか）
- ImageUpdateAutomation の commit message の文言
- Cutover で release PR を作るための commit の分け方と type

## Calls made without the user

- 案 A を選んだ理由（案 B との比較）は design doc に残さず、#1748 のコメントに任せる
- GitRepository は platform の `monorepo` を参照せず、サービスごとに monorepo 側で定義する（`clusters/production/` は monorepo の管理なので）
- ImageRepository の scan 間隔（5 分）と ImageUpdateAutomation の間隔（30 分）は今のまま。反映までの時間が問題になったら短くする
- リリースタグのイメージタグは、入力で有効にする形にせず常に付ける。呼んでいるのは monorepo だけで、既存の `vX.Y.Z` のタグは変わらないため
- panicboat/.github の変更とリリースは、この作業の範囲に含める
- ロールバックは `main` への直接 push ではなく PR で行う
- 一時 cluster の作り方（platform の terragrunt の production の扱いなど）は、実装を終えて確認に入るときに決める。この設計と実装 plan には含めない

## Verification

- [ ] release-please の dry-run（またはテスト用の release PR）で、overlay の `image:` 行が次のバージョンに書き換わり、`v` とレジストリのパスが残る
- [ ] `kustomize build` で、各サービスの `clusters/production/...` と overlay が今と同じリソースを出す（GitRepository の追加と sourceRef の変更を除く）
- [ ] Release - Build が、リリースのイメージに `vX.Y.Z` と `<service>-vX.Y.Z` の両方のタグを付ける
- [ ] 一時 cluster で、次を確認する
  - [ ] Kustomization `<service>` が、`ref.tag` のタグの snapshot から overlay を適用する
  - [ ] overlay だけを変えた PR を merge しても、本番のリソースが変わらない
  - [ ] リリースを publish すると、イメージの push 後に ImageUpdateAutomation が `ref.tag` を書き換え、新しいマニフェストとイメージが一度に適用される
  - [ ] ImageUpdateAutomation の commit が、次の release PR の CHANGELOG に入らない
- [ ] 確認を終えたら、一時 cluster を壊し、Lambda を作り直して元の状態に戻す
