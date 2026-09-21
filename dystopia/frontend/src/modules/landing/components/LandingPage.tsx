import Link from "next/link";
import { Button } from "@/components/ui/button";

const FEATURES = [
  {
    title: "投稿でつながる",
    body: "テキストや写真で日々を発信。フォロー・いいねで、気になる相手と自然につながれます。",
  },
  {
    title: "カルテで守られる安心",
    body: "トラブルや不安な相手の記録を残せる『カルテ』機能。キャストの安全を第一に考えた仕組みです。",
  },
  {
    title: "公開も非公開も、自分で選ぶ",
    body: "投稿は公開・非公開を自由に切り替え可能。見せたい相手にだけ、見せたいものを。",
  },
] as const;

export function LandingPage() {
  return (
    <main className="flex min-h-screen justify-center bg-bg px-4 py-10">
      <div className="w-full max-w-sm">
        <header className="text-center">
          <p className="text-2xl font-bold text-text-primary">dystopia.city</p>
          <p className="mt-1 text-xs uppercase tracking-widest text-text-muted">
            The Ritual of Sovereign Love
          </p>
          <h1 className="mt-6 text-xl font-bold text-text-primary">
            誰にも縛られない、自分だけの物語を。
          </h1>
          <p className="mt-3 text-sm text-text-secondary">
            dystopia.cityは、キャストとゲストが本当の自分で繋がるためのSNSです。凍結の不安に怯えることなく、日々の投稿やカルテによる安全な記録で、あなたらしさを守りながら発信できます。
          </p>
        </header>

        <section className="mt-8 space-y-3">
          {FEATURES.map((feature) => (
            <div
              key={feature.title}
              className="rounded-md border border-border bg-bg-secondary p-4"
            >
              <p className="font-bold text-text-primary">{feature.title}</p>
              <p className="mt-1 text-sm text-text-secondary">{feature.body}</p>
            </div>
          ))}
        </section>

        <section className="mt-8">
          <p className="mb-2 text-xs text-text-muted">こんな投稿が届きます</p>
          <article className="rounded-md border border-divider px-4 py-3">
            <div className="flex items-center gap-1 text-sm">
              <span className="font-bold text-text-primary">Rin</span>
              <span className="text-text-secondary">@rin</span>
              <span className="text-text-muted">· 3分前</span>
            </div>
            <p className="mt-1 text-text-primary">
              今日はゆっくりお散歩日和。読みかけの本を続きから。📖
            </p>
            <div className="mt-3 flex items-center gap-1 text-sm text-text-secondary">
              <span aria-hidden="true">♡</span>
              <span>24</span>
            </div>
          </article>
        </section>

        <section className="mt-10 space-y-3 text-center">
          <Button asChild size="md" className="w-full">
            <Link href="/signup">18歳以上なので入室します →</Link>
          </Button>
          <a
            href="https://www.google.com"
            className="block text-sm text-text-muted hover:underline"
          >
            18歳未満の方はこちら
          </a>
        </section>

        <p className="mt-6 text-center text-sm text-text-secondary">
          すでにアカウントをお持ちの方は{" "}
          <Link href="/login" className="text-accent hover:underline">
            ログイン
          </Link>
        </p>

        <footer className="mt-10 text-center text-xs text-text-muted">
          © 2026 dystopia.city
        </footer>
      </div>
    </main>
  );
}
