"use client";

import { Fragment, useEffect, useState } from "react";
import Link from "next/link";
import { CastHeroArt, CastStories, CastValues } from "./LandingCastSections";
import { GuestHeroArt, GuestStories, GuestValues } from "./LandingGuestSections";
import "./landing.css";

type LandingRole = "cast" | "guest";

const COPY: Record<LandingRole, { hero: string[]; endTitle: string; end: string[]; cta: string }> = {
  cast: {
    hero: ["お店の名前ではなく、自分の名前で。", "発信も、つながりも、仕事のことも。", "ここは、あなたが主役になれる場所。"],
    endTitle: "この街の、最初の住人に。",
    end: ["まだ始まったばかりの場所です。", "働く人が、自分の名前でつながれる街を、一緒に育ててください。"],
    cta: "キャストとして街に入る",
  },
  guest: {
    hero: ["お店からではなく、気になる人から。", "今日のつぶやきも、出勤予定も。", "「また会いたい」が、もっと身近になる場所。"],
    endTitle: "その人を知ることから、始めよう。",
    end: ["フォローして、日常を知って、また会いたくなる。", "あなたの夜に、新しいつながりを。"],
    cta: "ゲストとして街に入る",
  },
};

const ANCHORS: Record<LandingRole, { values: string; experience: string }> = {
  cast: { values: "values", experience: "experience" },
  guest: { values: "guest-values", experience: "guest-experience" },
};

function Lines({ lines }: { lines: string[] }) {
  return lines.map((line, i) => (
    <Fragment key={line}>
      {i > 0 && <br />}
      {line}
    </Fragment>
  ));
}

function Brand() {
  return (
    <>
      <span className="brand-symbol">
        <span>✦</span>
      </span>
      dystopia.city
    </>
  );
}

function EntryLinks() {
  return (
    <span className="entry-links">
      すでにアカウントをお持ちの方は <Link href="/login">ログイン</Link>
      {" ／ "}
      <a href="https://www.google.com">18歳未満の方はこちら</a>
    </span>
  );
}

export function LandingPage() {
  const [role, setRole] = useState<LandingRole>("cast");
  const copy = COPY[role];
  const signupHref = `/signup?role=${role}`;

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("role") === "guest") setRole("guest");
  }, []);

  const choose = (next: LandingRole) => {
    setRole(next);
    const url = new URL(window.location.href);
    url.searchParams.set("role", next);
    window.history.replaceState(null, "", url);
  };

  const roleButtons = (castLabel: string, guestLabel: string) =>
    ([["cast", castLabel], ["guest", guestLabel]] as const).map(([value, label]) => (
      <button key={value} type="button" aria-pressed={role === value} onClick={() => choose(value)}>
        {label}
      </button>
    ));

  return (
    <div className="lp-root" data-audience={role}>
      <header className="header">
        <div className="wrap header-inner">
          <a aria-label="dystopia.city トップへ" className="brand" href="#top">
            <Brand />
          </a>
          <nav aria-label="ページ内ナビゲーション" className="header-links">
            <div aria-label="LPを切り替え" className="header-role-toggle" role="group">
              {roleButtons("キャスト", "ゲスト")}
            </div>
            <a href={`#${ANCHORS[role].values}`}>この街が大切にすること</a>
            <a href={`#${ANCHORS[role].experience}`}>この街でできること</a>
            <a className="login" href="#entry">
              街に入る ↗
            </a>
          </nav>
        </div>
      </header>
      <main id="top">
        <section className="hero">
          <div className="wrap hero-grid">
            <div className="hero-content">
              <div className="pill">
                <i /> 18歳以上のキャストとゲストのためのSNS · β
              </div>
              <h1>
                夜に生きる人の、
                <br />
                <em>もうひとつの街。</em>
              </h1>
              <p className="hero-description">
                <Lines lines={copy.hero} />
              </p>
              <div aria-label="サービスを利用する立場" className="hero-roles" role="group">
                {roleButtons("キャストの方", "ゲストの方")}
              </div>
              <Link className="primary" href={signupHref}>
                {copy.cta} <span aria-hidden="true">↗</span>
              </Link>
              <span className="hero-note">β版のいまは、すべて無料。18歳以上の方が対象です。</span>
              <EntryLinks />
            </div>
            {role === "cast" ? <CastHeroArt /> : <GuestHeroArt />}
          </div>
        </section>
        {role === "cast" ? <CastValues /> : <GuestValues />}
        {role === "cast" ? <CastStories /> : <GuestStories />}
        <section className="end" id="entry">
          <div className="wrap">
            <p className="eyebrow">THE CITY IS JUST BEGINNING</p>
            <h2>{copy.endTitle}</h2>
            <p className="end-desc">
              <Lines lines={copy.end} />
            </p>
            <Link className="primary" href={signupHref}>
              {copy.cta} <span aria-hidden="true">↗</span>
            </Link>
            <p className="beta-note">β版のいまは、すべて無料。18歳以上の方が対象です。</p>
            <EntryLinks />
          </div>
        </section>
      </main>
      <footer className="footer">
        <div className="wrap">
          <div>
            <a className="brand" href="#top">
              <Brand />
            </a>
            <small>夜に生きる人の、もうひとつの街。</small>
          </div>
        </div>
      </footer>
    </div>
  );
}
