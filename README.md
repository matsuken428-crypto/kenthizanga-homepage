# kentshizanga homepage

- `public/index.html` — サイト本体（Netlifyが公開）
- `netlify/functions/latest.mjs` — `/api/latest`。Jリーグ公式の今季スタッツと、noteの最新記事・ラジオ各3件、Podcastの最新エピソード3件を返す（CDNで30分キャッシュ）。ページ読み込み時にこれで表示を差し替える
- `scripts/update_site.py` — HTML内の初期値（API取得失敗時に表示される値）を書き換えるスクリプト

ラジオ判定：タイトルが「42Radio」で始まる、または「ラジオ」を含む投稿。表示時は先頭の「42Radio」を省く。
