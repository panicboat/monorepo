export function GuestHeroArt() {
  return (
    <div aria-label="フォローしたキャストの投稿と出勤予定をまとめて見る体験のイメージ" className="hero-art guest-hero-art">
      <div className="orbit" />
      <div className="moon guest-moon" />
      <div aria-hidden="true" className="city">
        <b style={{ left: "2%", height: "135px" }} />
        <b style={{ left: "14%", height: "95px" }} />
        <b style={{ left: "29%", height: "220px" }} />
        <b style={{ left: "44%", height: "140px" }} />
        <b style={{ left: "58%", height: "181px" }} />
        <b style={{ left: "75%", height: "112px" }} />
        <b style={{ left: "90%", height: "192px" }} />
      </div>
      <div className="phone guest-phone">
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
              <span className="followed">フォロー中 ♡</span>
            </div>
            <p>
              今夜は20:00からいます 🌙
              <br />
              いつもの街で待ってます。
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
              今日は少し寄り道。
              <br />
              日常も、ここでお話しするね。
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
      <div className="float-card shift guest-float-shift">
        <div className="float-label">TONIGHT · 出勤予定</div>
        <div className="float-title">
          {"Rin · 10.11 SUN "}
          <span className="tiny-heart">●</span>
        </div>
        <div className="float-data">
          20:00 – 02:00
          <br />
          出勤予定をプロフィールで確認
        </div>
        <div className="float-days">
          <span>11 日</span>
          <span>12 月</span>
          <span>13 火</span>
        </div>
      </div>
      <div className="float-card profile guest-float-profile">
        <div className="float-label">FOLLOWING</div>
        <div className="mini-profile">
          <div className="avatar">✦</div>
          <div>
            <div className="float-title" style={{ margin: "0" }}>
              {"Rin "}
              <span style={{ color: "#be9ce9" }}>@rin_night</span>
            </div>
            <div className="float-data">日常も、今夜の予定も。</div>
          </div>
        </div>
        <span className="smallchip">フォローで見逃さない</span>
      </div>
    </div>
  );
}

export function GuestValues() {
  return (
    <section className="section manifesto guest-manifesto" id="guest-values">
      <div className="wrap">
        <div className="section-intro">
          <p className="eyebrow">OUR BELIEF / この街が大切にすること</p>
          <h2>
            選ぶのは、お店だけじゃない。
            <br />
            その人を、もっと知ることから。
          </h2>
          <p>
            出勤の情報だけでなく、何気ない日常や言葉も。
            <br />
            会いに行く前の時間だって、あなたの楽しみになる。
          </p>
        </div>
        <p className="quote">
          会える夜だけじゃない。
          <br />
          <mark>その人を知る時間も、楽しもう。</mark>
        </p>
        <div className="values">
          <article className="value" data-num="01">
            <div aria-hidden="true" className="value-icon">✦</div>
            <h3>お店より先に、人を見つける。</h3>
            <p>気になる投稿から、ひとりのキャストに出会う。お店の情報だけでは分からない、その人らしさを知る場所。</p>
          </article>
          <article className="value" data-num="02">
            <div aria-hidden="true" className="value-icon">☾</div>
            <h3>会う前の時間も、つながっている。</h3>
            <p>今日のひと言も、次の出勤予定も。同じタイムラインとプロフィールから見つけられる。</p>
          </article>
          <article className="value" data-num="03">
            <div aria-hidden="true" className="value-icon">♡</div>
            <h3>心地よい距離で、つながる。</h3>
            <p>相手のペースを大切にしながら、会話を楽しむ。会ったあとは、感謝や思い出をレビューに残せる。</p>
          </article>
        </div>
      </div>
    </section>
  );
}

export function GuestStories() {
  return (
    <section className="story guest-story" id="guest-experience">
      <div className="wrap">
        <div className="story-head">
          <div>
            <p className="eyebrow">FOR GUEST / この街でできること</p>
            <h2>
              気になる人の今夜が、
              <br />
              もっと身近になる。
            </h2>
          </div>
          <p>
            見つけて、フォローして、今夜の予定を知る。
            <br />
            その一歩先の「また会いたい」まで。
          </p>
        </div>
        <article className="story-row">
          <div className="story-visual">
            <div aria-label="キャストを投稿から見つけてフォローするイメージ" className="discover-ui">
              <div className="discover-top">
                <span>✦ Discover</span>
                <span className="discover-filter">キャスト · エリア</span>
              </div>
              <div className="discover-person">
                <div className="avatar">✦</div>
                <div className="discover-info">
                  <strong>Rin</strong>
                  <small>@rin_night · 今日のひと言</small>
                  <p>今夜も、自分らしく 🌙</p>
                </div>
                <span className="discover-follow">♡ フォロー</span>
              </div>
              <div className="discover-person">
                <div className="avatar alt">☾</div>
                <div className="discover-info">
                  <strong>Mio</strong>
                  <small>@mio_24 · 30分前</small>
                  <p>おすすめのカフェを見つけたよ。</p>
                </div>
                <span className="discover-follow subdued">フォロー中</span>
              </div>
              <div className="discover-bottom">投稿から知る → 気になる人をフォローする</div>
            </div>
          </div>
          <div className="story-copy">
            <span className="count">01 / DISCOVER</span>
            <h3>
              気になる人を、
              <br />
              投稿から見つけよう。
            </h3>
            <p>お店の紹介ページだけでは分からない、キャストの日常や言葉。タイムラインから気になる人を見つけて、フォローできます。</p>
            <p className="fine">※ 画面は架空のイメージです。検索・投稿・フォロー機能を表しています。</p>
          </div>
        </article>
        <article className="story-row reverse">
          <div className="story-visual">
            <div className="shift-ui guest-shift-ui">
              <div className="bar">
                <h4>Rin の出勤予定</h4>
                <small>プロフィールから ↗</small>
              </div>
              <div className="dates">
                <div className="date on">
                  <b>11</b>
                  <small>20:00〜</small>
                </div>
                <div className="date">
                  <b>12</b>
                  <small>お休み</small>
                </div>
                <div className="date on">
                  <b>13</b>
                  <small>21:00〜</small>
                </div>
                <div className="date">
                  <b>14</b>
                  <small>未登録</small>
                </div>
              </div>
              <div className="shift-msg">♡ 好きな人の予定が、日常の投稿と同じ場所に。</div>
            </div>
          </div>
          <div className="story-copy">
            <span className="count">02 / TONIGHT</span>
            <h3>
              今夜の予定が、
              <br />
              ひと目で分かる。
            </h3>
            <p>フォローしたキャストのプロフィールで、出勤スケジュールを確認。あちこち探し回らず、会いに行きたい夜を考えられます。</p>
            <p className="fine">※ 出勤予定は予約可能な時間を保証するものではありません。</p>
          </div>
        </article>
        <article className="story-row">
          <div className="story-visual">
            <div aria-label="キャストとのメッセージ画面イメージ" className="chat-ui">
              <div className="chat-head">
                <div className="avatar">✦</div>
                <div>
                  <strong>Rin</strong>
                  <small>@rin_night · メッセージ</small>
                </div>
                <span className="chat-more">···</span>
              </div>
              <div className="chat-bubble other">こんばんは。出勤予定、更新しました 🌙</div>
              <div className="chat-bubble mine">ありがとう！今度の予定を相談したいです。</div>
              <div className="chat-input">
                {"メッセージを入力… "}
                <span>↗</span>
              </div>
            </div>
          </div>
          <div className="story-copy">
            <span className="count">03 / MESSAGE</span>
            <h3>
              会う前から、
              <br />
              言葉を交わせる。
            </h3>
            <p>気になるキャストと、メッセージでつながる。出勤についての相談も、次に会う日の話も、相手のペースを大切にしながら。</p>
            <p className="fine">※ 画面は架空のイメージです。連絡できる相手や送受信の条件はサービスの設定によります。予約確定を表すものではありません。</p>
          </div>
        </article>
        <article className="story-row reverse">
          <div className="story-visual">
            <div aria-label="キャストへのレビュー入力イメージ" className="review-ui">
              <div className="review-top">
                <span>♡</span>
                <div>
                  <strong>会った夜のことを、言葉に。</strong>
                  <small>Rinへのレビュー</small>
                </div>
              </div>
              <div className="review-stars">★★★★★</div>
              <div className="review-writing">
                今日もありがとうございました。
                <br />
                また会える日を楽しみにしています。
              </div>
              <div className="review-footer">
                <span>気持ちを伝える</span>
                <b>レビューを確認 ↗</b>
              </div>
            </div>
          </div>
          <div className="story-copy">
            <span className="count">04 / REVIEW</span>
            <h3>
              その夜のことを、
              <br />
              言葉で残す。
            </h3>
            <p>会ったキャストへ、感謝や感想をレビューで届ける。一度きりの出会いを、あなたの言葉で残せる場所です。</p>
            <p className="fine">※ 公開・承認などの条件は実際のレビュー運用に従います。画面はコンセプトイメージです。</p>
          </div>
        </article>
      </div>
    </section>
  );
}
