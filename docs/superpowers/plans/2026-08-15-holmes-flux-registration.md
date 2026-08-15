# holmes Flux Registration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Register `system-components/holmes/` in Flux's cluster reconciliation tree so it actually gets deployed — it has never been deployed despite 3 merged PRs, because no Flux `Kustomization`/`ImageRepository`/`ImagePolicy`/`ImageUpdateAutomation` resources reference it, and `clusters/production/kustomization.yaml` only ever pointed at `services/`.

**Architecture:** Mirror `clusters/production/services/monolith/`'s five files exactly, under a new `clusters/production/system-components/holmes/` directory, with `monolith`→`holmes` and the `services/monolith`→`system-components/holmes` path substituted. Add a `system-components/kustomization.yaml` (mirroring `services/kustomization.yaml`) and register it in the parent `clusters/production/kustomization.yaml`.

**Tech Stack:** Flux CD (`kustomize.toolkit.fluxcd.io/v1` `Kustomization`, `image.toolkit.fluxcd.io/v1` `ImageRepository`/`ImagePolicy`/`ImageUpdateAutomation`), Kustomize.

## Global Constraints

- Pure mirroring of the existing `clusters/production/services/monolith/` pattern — no new design decisions. Every field not explicitly called out as substituted (`monolith`→`holmes`, the path) must match monolith's files verbatim.
- Design doc: `docs/superpowers/specs/2026-08-15-holmes-flux-registration-design.md`.

---

## Task 1: Register holmes under clusters/production/system-components/

**Files:**
- Create: `clusters/production/system-components/kustomization.yaml`
- Create: `clusters/production/system-components/holmes/kustomization.yaml`
- Create: `clusters/production/system-components/holmes/service.yaml`
- Create: `clusters/production/system-components/holmes/image-repository.yaml`
- Create: `clusters/production/system-components/holmes/image-policy.yaml`
- Create: `clusters/production/system-components/holmes/image-automation.yaml`
- Modify: `clusters/production/kustomization.yaml`

**Interfaces:**
- Produces: Flux `Kustomization` named `holmes` reconciling `system-components/holmes/kubernetes/overlays/production`, an `ImageRepository`/`ImagePolicy`/`ImageUpdateAutomation` trio watching `ghcr.io/panicboat/monorepo/holmes` for `vX.Y.Z` tags and auto-bumping the overlay's `deployment.yaml` — the same mechanism already running for `monolith`/`frontend`.

- [ ] **Step 1: Write clusters/production/system-components/holmes/service.yaml**

```yaml
---
apiVersion: kustomize.toolkit.fluxcd.io/v1
kind: Kustomization
metadata:
  name: holmes
  namespace: flux-system
spec:
  interval: 5m0s
  path: "./system-components/holmes/kubernetes/overlays/production"
  prune: true
  sourceRef:
    kind: GitRepository
    name: monorepo
  targetNamespace: default
  postBuild:
    substitute:
      service_name: holmes
```

- [ ] **Step 2: Write clusters/production/system-components/holmes/image-repository.yaml**

```yaml
apiVersion: image.toolkit.fluxcd.io/v1
kind: ImageRepository
metadata:
  name: holmes
  namespace: flux-system
spec:
  image: ghcr.io/panicboat/monorepo/holmes
  interval: 5m
```

- [ ] **Step 3: Write clusters/production/system-components/holmes/image-policy.yaml**

```yaml
# =============================================================================
# ImagePolicy for holmes (= semver tag pattern)
# =============================================================================
# release tag (holmes-vX.Y.Z) を起点に build される ghcr semver tag (vX.Y.Z) を
# Flux が pickup する。main push 由来の latest / sha tag は filterTags pattern
# で除外される (= Flux が見るのは semver のみ)。
# =============================================================================
apiVersion: image.toolkit.fluxcd.io/v1
kind: ImagePolicy
metadata:
  name: holmes
  namespace: flux-system
  labels:
    service: holmes
spec:
  imageRepositoryRef:
    name: holmes
  filterTags:
    pattern: '^v(?P<version>\d+\.\d+\.\d+)$'
    extract: '$version'
  policy:
    semver:
      range: '>=0.0.0'
```

- [ ] **Step 4: Write clusters/production/system-components/holmes/image-automation.yaml**

```yaml
apiVersion: image.toolkit.fluxcd.io/v1
kind: ImageUpdateAutomation
metadata:
  name: holmes
  namespace: flux-system
spec:
  interval: 30m
  sourceRef:
    kind: GitRepository
    name: monorepo
  git:
    checkout:
      ref:
        branch: main
    commit:
      author:
        email: panicboat@gmail.com
        name: panicboat
      messageTemplate: |
        chore(holmes): bump image to {{range .Changed.Changes}}{{ println .NewValue }}{{end}}
    push:
      branch: main
  update:
    path: ./system-components/holmes/kubernetes/overlays/production
    strategy: Setters
```

- [ ] **Step 5: Write clusters/production/system-components/holmes/kustomization.yaml**

```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
resources:
  - service.yaml
  - image-repository.yaml
  - image-policy.yaml
  - image-automation.yaml
```

- [ ] **Step 6: Write clusters/production/system-components/kustomization.yaml**

```yaml
---
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
resources:
  - holmes
```

- [ ] **Step 7: Register system-components/ in the parent kustomization**

Replace `clusters/production/kustomization.yaml`:

```yaml
---
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
resources:
  - services
```

with:

```yaml
---
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
resources:
  - services
  - system-components
```

- [ ] **Step 8: Validate the whole cluster tree builds**

Run: `kustomize build clusters/production`
Expected: valid YAML output containing the existing `monolith`/`frontend` Flux resources unchanged, plus 4 new resources (`Kustomization/holmes`, `ImageRepository/holmes`, `ImagePolicy/holmes`, `ImageUpdateAutomation/holmes`) all in namespace `flux-system`.

- [ ] **Step 9: Commit**

```bash
git add clusters/production
git commit -s -m "feat(holmes): register in Flux under clusters/production/system-components"
```

---

## Task 2: Open Draft PR

**Files:** none (git/GitHub operations only)

- [ ] **Step 1: Push the branch**

```bash
git push -u origin feat/holmes-flux-registration
```

- [ ] **Step 2: Open a Draft PR**

```bash
gh pr create --draft --title "feat(holmes): register in Flux under clusters/production/system-components" --body "$(cat <<'EOF'
## Summary
- holmes (system-components/holmes/) has never been deployed despite 3 merged PRs: no Flux resources referenced it, and clusters/production/kustomization.yaml only ever pointed at services/.
- Mirror the existing monolith/frontend clusters/production/services/<name>/ pattern under a new clusters/production/system-components/holmes/, and register system-components/ in the parent kustomization.

## Manual follow-up after merge (cannot be automated)
- Cut a GitHub Release tagged `holmes-v0.1.0` (or the next appropriate version) to trigger the first `auto-release--trigger.yaml` image build — Flux's ImagePolicy has nothing to pick up until an image with a `vX.Y.Z` tag exists in ghcr.io/panicboat/monorepo/holmes.
- After the image builds and Flux reconciles, verify: `kubectl -n default get deployment holmes`, `kubectl -n default get httproute holmes`, `kubectl -n default get certificate` (for holmes.dystopia.city).

## Test plan
- [ ] `kustomize build clusters/production` succeeds, includes the 4 new holmes Flux resources (verified locally)

Design: docs/superpowers/specs/2026-08-15-holmes-flux-registration-design.md
EOF
)"
```

- [ ] **Step 3: Report the PR URL back to the user.**

---

## Self-Review Notes

- **Spec coverage**: `clusters/production/system-components/holmes/` (Task 1 Steps 1-5), `system-components/kustomization.yaml` + parent registration (Task 1 Steps 6-7), manual release-cutting step documented in the Draft PR body (Task 2) — all covered.
- **Placeholder scan**: none; all five Flux resource files and both kustomization files are complete, copied field-for-field from monolith's real files with only the name/path substitutions the spec calls for.
- **Type consistency**: not applicable (no code, only Kubernetes/Flux YAML manifests mirroring an existing, working pattern).
