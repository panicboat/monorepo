export function CastHeroArt() {
  return (
    <div aria-label="SNSのタイムラインと予定を組み合わせたサービスのイメージ" className="hero-art">
      <div className="orbit" />
      <div className="moon" />
      <div aria-hidden="true" className="city">
        <b style={{ left: "2%", height: "135px" }} />
        <b style={{ left: "14%", height: "95px" }} />
        <b style={{ left: "29%", height: "220px" }} />
        <b style={{ left: "44%", height: "140px" }} />
        <b style={{ left: "58%", height: "181px" }} />
        <b style={{ left: "75%", height: "112px" }} />
        <b style={{ left: "90%", height: "192px" }} />
      </div>
      <div className="phone">
        <div className="phone-screen">
          <div className="phone-notch" />
          <div className="phone-top">
            <span>21:08</span>
            <span>▂▃▅ ◕</span>
          </div>
          <div className="app-head">
            dystopia
            <span>✦</span>
          </div>
          <div className="mini-tabs">
            <span className="selected">フォロー中</span>
            <span>全国</span>
            <span>エリア</span>
          </div>
          <div className="post">
            <div className="post-user">
              <div className="avatar">✦</div>
              <div className="post-names">
                <strong>
                  {"Rin "}
                  <span style={{ color: "#d9a6ff" }}>✧</span>
                </strong>
                <small>@rin_night · 12分前</small>
              </div>
            </div>
            <p>
              今日も街のどこかで。
              <br />
              今夜は20:00からいます 🌙
            </p>
            <div className="scene">
              <div className="scene-moon" />
              <div className="scene-floor" />
            </div>
            <div className="post-icons">
              <span>♡ 28</span>
              <span>◌ 3</span>
              <span>♧ 8</span>
              <span>↗</span>
            </div>
          </div>
          <div className="post">
            <div className="post-user">
              <div className="avatar alt">☾</div>
              <div className="post-names">
                <strong>Mio</strong>
                <small>@mio_24 · 30分前</small>
              </div>
            </div>
            <p>
              少しずつ、自分のペースで。
              <br />
              今日もよろしくね。
            </p>
            <div className="post-icons">
              <span>♡ 16</span>
              <span>◌ 2</span>
              <span>♧ 4</span>
              <span>↗</span>
            </div>
          </div>
          <div className="phone-nav">
            <span>⌂</span>
            <span>⌕</span>
            <span>⊕</span>
            <span>♡</span>
            <span>◉</span>
          </div>
        </div>
      </div>
      <div className="float-card schedule">
        <div className="float-label">SCHEDULE · 予定</div>
        <div className="float-title">
          {"10.11 SUN "}
          <span className="tiny-heart">●</span>
        </div>
        <div className="float-data">
          20:00 – 02:00
          <br />
          プロフィールから確認
        </div>
        <div className="float-days">
          <span>11 日</span>
          <span>12 月</span>
          <span>13 火</span>
        </div>
      </div>
      <div className="float-card profile">
        <div className="float-label">MY PROFILE</div>
        <div className="mini-profile">
          <div className="avatar">✦</div>
          <div>
            <div className="float-title" style={{ margin: "0" }}>
              {"Rin "}
              <span style={{ color: "#be9ce9" }}>@rin_night</span>
            </div>
            <div className="float-data">フォロワーと投稿を、自分に。</div>
          </div>
        </div>
        <span className="smallchip">自分自身を発信できる</span>
      </div>
    </div>
  );
}

export function CastValues() {
  return (
    <section className="section manifesto" id="values">
      <div className="wrap">
        <div className="section-intro">
          <p className="eyebrow">OUR BELIEF / この街が大切にすること</p>
          <h2>
            夜の仕事をしていることが、
            <br />
            あなたの可能性を狭めないように。
          </h2>
          <p>
            仕事の名前も、働く場所も、人とのつながり方も。
            <br />
            決めるのは、誰かではなくあなた自身であってほしい。
          </p>
        </div>
        <p className="quote">
          「夜に働く」というだけで、
          <br />
          <mark>自分の居場所をあきらめなくていい。</mark>
        </p>
        <div className="values">
          <article className="value" data-num="01">
            <div aria-hidden="true" className="value-icon">✦</div>
            <h3>主役は、お店ではなくあなた。</h3>
            <p>お店が変わっても、働き方が変わっても、自分の名前で発信できる。あなた自身のつながりを育てられる場所に。</p>
          </article>
          <article className="value" data-num="02">
            <div aria-hidden="true" className="value-icon">☾</div>
            <h3>仕事を、隠さなくていい。</h3>
            <p>夜職であることを理由に排除しない。働く人が安心して言葉を届けられる街を目指します。</p>
          </article>
          <article className="value" data-num="03">
            <div aria-hidden="true" className="value-icon">♡</div>
            <h3>ひとりで、抱え込まない。</h3>
            <p>接客で得た経験を、必要な範囲で記録・共有する。互いを守るための仕組みを、プライバシーにも配慮しながら育てます。</p>
          </article>
        </div>
      </div>
    </section>
  );
}

export function CastStories() {
  return (
    <section className="story" id="experience">
      <div className="wrap">
        <div className="story-head">
          <div>
            <p className="eyebrow">FOR CAST / この街でできること</p>
            <h2>
              名前も、つながりも。
              <br />
              あなたのペースで。
            </h2>
          </div>
          <p>SNSとして出会いを育てながら、夜の仕事に必要なことも、ひとつの場所で。</p>
        </div>
        <article className="story-row">
          <div className="story-visual">
            <div className="identities">
              <div className="identity active">
                <span className="avatar">✦</span>
                <div>
                  <strong>Rin</strong>
                  <p>@rin_night · プロフィールA</p>
                </div>
                <span className="check">✓</span>
              </div>
              <div className="identity">
                <span className="avatar alt">☾</span>
                <div>
                  <strong>Mio</strong>
                  <p>@mio_24 · プロフィールB</p>
                </div>
              </div>
              <div className="identity-meta">ひとつのログインでプロフィールを切り替える</div>
            </div>
          </div>
          <div className="story-copy">
            <span className="count">01 / IDENTITY</span>
            <h3>
              見せたい顔の数だけ、
              <br />
              名前を持てる。
            </h3>
            <p>プロフィールを使い分ける。誰かの看板ではなく、あなた自身を発信できます。</p>
            <p className="fine">※ プロフィール同士の関連は画面上で表示しない設計です。同一人物と推測されないことを保証するものではありません。</p>
          </div>
        </article>
        <article className="story-row reverse">
          <div className="story-visual">
            <div className="schedule-ui">
              <div className="schedule-post">
                <div className="post-user">
                  <div className="avatar">✦</div>
                  <div className="post-names">
                    <strong>Rin</strong>
                    <small>@rin_night · 12分前</small>
                  </div>
                </div>
                <p>今日は気分がいいので、今夜少しだけ 🌙</p>
                <div className="schedule-summary">
                  <small>予定</small>
                  <b>21:30〜</b>
                </div>
              </div>
              <div className="schedule-msg">✦ 「今夜会えるよ」を、投稿とプロフィールで。</div>
            </div>
          </div>
          <div className="story-copy">
            <span className="count">02 / CONNECTION</span>
            <h3>
              「今夜会えるよ」が、
              <br />
              ちゃんと見つかる。
            </h3>
            <p>日々の投稿からあなたを知った人が、プロフィールで予定を確認できる。会える日も、会えない日も、つながりは続きます。</p>
            <p className="fine">※ 予定の表示例です。空き枠確認や自動通知を表すものではありません。お店を通さない約束や取引には使えません。</p>
          </div>
        </article>
        <article className="story-row">
          <div className="story-visual">
            <div className="karte-ui">
              <div className="karte-head">
                <div>
                  <h4>ゲストのカルテ</h4>
                  <small>接客の経験を、次の対応に。</small>
                </div>
                <span className="privacy-chip">閲覧範囲を確認</span>
              </div>
              <div className="karte-row">
                <span>予約について</span>
                <b>記録する</b>
                <div className="karte-bar" />
              </div>
              <div className="karte-row">
                <span>接客時のメモ</span>
                <b>必要な情報だけ</b>
              </div>
              <div className="karte-row">
                <span>ほかのキャストの記録</span>
                <b>共有範囲に応じて</b>
              </div>
            </div>
          </div>
          <div className="story-copy">
            <span className="count">03 / CARE</span>
            <h3>
              初めてのお客様を、
              <br />
              初めてにしない。
            </h3>
            <p>接客したゲストについての経験を記録する「カルテ」。自分のためのメモから、キャスト同士で支え合う仕組みへ。安心を、個人の努力だけに任せません。</p>
            <p className="fine">※ 画面はコンセプトイメージ。共有範囲・訂正手続きなどは公開前に整備する予定です。</p>
          </div>
        </article>
      </div>
    </section>
  );
}
