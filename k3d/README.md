# k3d Local Environment

Deploy monorepo's frontend and monolith to a local k3d cluster and verify
Cilium Gateway's JWT verification with trusted-header injection into the echo
service.

## Prerequisites

| Tool | Purpose |
|------|---------|
| colima | Container runtime (macOS) |
| k3d | Local Kubernetes cluster via Docker |
| kubectl | Cluster access |
| helm | Cilium install |
| jq | JSON parsing in scripts |
| openssl | RSA key generation |
| python3 | JWKS rewrite in `up.sh` |

## Usage

**Start cluster:**
```bash
k3d/bin/up.sh
```
Sequence: colima start → k3d cluster create → Gateway API CRDs → Cilium (Helm)
→ Gateway → apps (postgres / monolith / frontend / echo) → JWT keypair + CiliumEnvoyConfig.

**Verify gateway JWT behavior:**
```bash
k3d/bin/verify-gateway.sh
```
Runs three cases against the echo service via in-cluster curl:
- valid JWT → 200 + `x-user-id` header
- expired JWT → 401
- no JWT → 401

Prints `ALL PASS` and exits 0 on success.

**Verify frontend reachability (in-cluster):**

The gateway Service is selector-less (eBPF-managed), so `kubectl port-forward`
does not work. Use an in-cluster curl pod instead:

```bash
GW_IP=$(kubectl get svc -n default cilium-gateway-cilium-gateway \
  -o jsonpath='{.spec.clusterIP}')
kubectl run gw-check --rm -i --restart=Never --image=curlimages/curl:8.11.0 -- \
  -s -o /dev/null -w "%{http_code}\n" -H "Host: dystopia.city" "http://$GW_IP/"
# expect 200
```

**Tear down:**
```bash
k3d/bin/down.sh
```

## Structure

```
k3d/
├── bin/
│   ├── up.sh              # Full cluster bootstrap
│   ├── down.sh            # Cluster teardown
│   ├── gen-keys.sh        # RSA keypair + jwks.json generation
│   ├── sign-jwt.sh        # Issue a test JWT
│   └── verify-gateway.sh  # 3-case gateway verification
├── cluster/
│   └── k3d-config.yaml    # k3d cluster definition
├── infra/
│   ├── cilium/values.yaml # Cilium Helm values
│   ├── gateway/           # LB IP pool, GatewayClass, Gateway
│   └── jwt/               # CiliumEnvoyConfig + JWKS
└── apps/                  # postgres / monolith / frontend / echo manifests
```

## JWT Mechanism

The `CiliumEnvoyConfig` (`infra/jwt/cilium-envoy-config.yaml`) intercepts traffic
to the echo service via a service-redirect listener. It uses Envoy's `jwt_authn`
filter with `claimToHeaders` to copy the verified JWT `sub` claim into `x-user-id`,
and sets `forward: false` to drop the token before it reaches the upstream.
Because `x-user-id` is overwritten from the verified JWT, a client cannot forge it
by sending the header directly.

Lua filter is not used — Cilium's Envoy build does not include the Lua filter.

## Keys

`priv.pem` is gitignored and never committed. `jwks.json` (public key) is committed.

`up.sh` runs `gen-keys.sh` only when `priv.pem` is absent (e.g. fresh clone),
regenerating the RSA keypair and rewriting `jwks.json` plus the CEC's embedded
modulus to keep them consistent. If you run `gen-keys.sh` manually, the updated
`jwks.json` must be re-committed so the cluster and repository stay in sync.

## Cluster Networking

Cilium provides CNI and Gateway API with `kubeProxyReplacement: true`,
`l7Proxy: true`, and Gateway API enabled. k3s's built-in kube-proxy continues
to run alongside Cilium. The Gateway receives a ClusterIP/LoadBalancer IP via
Cilium's LB IPAM with L2 announcements. k3s's built-in Flannel, network policy,
Traefik, and servicelb are all disabled so that Cilium owns networking exclusively.

## Limitations

Host browser and host `curl` access to the gateway are **not available** with the
current cluster configuration. The k3d cluster is created without a host port
mapping (e.g. `--port "80:80@loadbalancer"`), and the k3d Docker-bridge IP is not
routable from the macOS host. Adding host port access requires that mapping at
cluster-creation time, which is explicitly out of scope for this environment.
Use the in-cluster curl approach described under "Verify frontend reachability"
above.
