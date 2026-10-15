// Gera assets/neofetch-{dark,light}.svg com dados públicos do GitHub (roda na Action diária).
// Uso: GITHUB_TOKEN=... node .github/scripts/neofetch.mjs
import { writeFileSync } from 'node:fs';

const LOGIN = 'gustavolimav';
const token = process.env.GITHUB_TOKEN;
if (!token) throw new Error('GITHUB_TOKEN ausente');

async function gql(query, variables = {}) {
  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: { Authorization: `bearer ${token}`, 'Content-Type': 'application/json', 'User-Agent': LOGIN },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors) throw new Error(JSON.stringify(json.errors));
  return json.data;
}

async function count(q) {
  const res = await fetch(`https://api.github.com/search/issues?q=${encodeURIComponent(q)}&per_page=1`, {
    headers: { Authorization: `bearer ${token}`, Accept: 'application/vnd.github+json', 'User-Agent': LOGIN },
  });
  return (await res.json()).total_count ?? 0;
}

const { user } = await gql(
  `query($login: String!) {
    user(login: $login) {
      createdAt
      followers { totalCount }
      contributionsCollection { contributionCalendar { totalContributions } }
      repositories(ownerAffiliations: OWNER, privacy: PUBLIC, isFork: false, first: 100) {
        totalCount
        nodes { stargazerCount languages(first: 6, orderBy: { field: SIZE, direction: DESC }) { edges { size node { name color } } } }
      }
    }
  }`,
  { login: LOGIN },
);

const prsTotal = await count(`author:${LOGIN} type:pr`);
// PRs em repositórios de outras pessoas: na prática, o Liferay Portal e os forks dos times dele
const prsLiferay = await count(`author:${LOGIN} type:pr -user:${LOGIN}`);

const langs = new Map();
let stars = 0;
for (const r of user.repositories.nodes) {
  stars += r.stargazerCount;
  for (const e of r.languages.edges) {
    const cur = langs.get(e.node.name) ?? { size: 0, color: e.node.color ?? '#8b949e' };
    cur.size += e.size;
    langs.set(e.node.name, cur);
  }
}
const ignore = new Set(['HTML', 'CSS', 'Shell', 'Dockerfile', 'Makefile', 'PLpgSQL', 'Roff', 'Perl', 'Ruby', 'Jupyter Notebook']);
const top = [...langs.entries()].filter(([n]) => !ignore.has(n)).sort((a, b) => b[1].size - a[1].size).slice(0, 5);
const topTotal = top.reduce((a, [, v]) => a + v.size, 0) || 1;

const since = new Date(user.createdAt);
const years = ((Date.now() - since.getTime()) / (365.25 * 24 * 3600 * 1000)).toFixed(1);
const fmt = (n) => n.toLocaleString('en-US');

const rows = [
  ['OS', 'Recife, Brazil (UTC−3)'],
  ['Host', 'Bradesco · digital token · security'],
  ['Uptime', `${years} years on GitHub`],
  ['Shell', 'zsh + Claude Code'],
  ['Repos', `${fmt(user.repositories.totalCount)} public · ${fmt(stars)} stars`],
  ['PRs', `${fmt(prsTotal)} opened · ${fmt(prsLiferay)} to Liferay Portal`],
  ['Commits', `${fmt(user.contributionsCollection.contributionCalendar.totalContributions)} contributions last year`],
  ['Followers', fmt(user.followers.totalCount)],
];

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function svg(theme) {
  const c =
    theme === 'dark'
      ? { bg: '#0d1117', bar: '#161b22', line: '#30363d', text: '#c9d1d9', dim: '#8b949e', key: '#d2a8ff', title: '#7ee787', logo: '#79c0ff', track: '#21262d' }
      : { bg: '#ffffff', bar: '#f6f8fa', line: '#d0d7de', text: '#1f2328', dim: '#59636e', key: '#8250df', title: '#1a7f37', logo: '#0969da', track: '#eaeef2' };
  const logo = [
    '   ______   ',
    '  / ____/   ',
    ' / / __     ',
    '/ /_/ /     ',
    '\\____/  __  ',
    '       / /  ',
    '      / /   ',
    '     / /___ ',
    '    /_____/ ',
  ];
  const lx = 28;
  const tx = 230;
  const y0 = 84;
  const lh = 24;
  let barX = tx;
  const bars = top
    .map(([name, v]) => {
      const w = Math.max(6, (v.size / topTotal) * 560);
      const r = `<rect x="${barX.toFixed(1)}" y="${y0 + lh * rows.length + 22}" width="${w.toFixed(1)}" height="10" fill="${v.color}"/>`;
      barX += w;
      return r;
    })
    .join('');
  let legendX = tx;
  const legend = top
    .map(([name, v]) => {
      const pct = Math.round((v.size / topTotal) * 100);
      const label = `${name} ${pct}%`;
      const el = `<circle cx="${legendX + 5}" cy="${y0 + lh * rows.length + 52}" r="5" fill="${v.color}"/><text x="${legendX + 15}" y="${y0 + lh * rows.length + 57}" class="d">${esc(label)}</text>`;
      legendX += 15 + label.length * 8.4 + 18;
      return el;
    })
    .join('');
  const height = y0 + lh * rows.length + 84;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="860" height="${height}" viewBox="0 0 860 ${height}" role="img" aria-labelledby="t d">
  <title id="t">gustavo@github — neofetch</title>
  <desc id="d">${esc(rows.map(([k, v]) => `${k}: ${v}`).join('; '))}; top languages: ${esc(top.map(([n, v]) => `${n} ${Math.round((v.size / topTotal) * 100)}%`).join(', '))}</desc>
  <style>
    text { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace; font-size: 15px; fill: ${c.text}; }
    .k { fill: ${c.key}; font-weight: 700; }
    .d { fill: ${c.dim}; font-size: 13px; }
    .h { fill: ${c.title}; font-weight: 700; }
    .logo { fill: ${c.logo}; font-weight: 700; white-space: pre; }
    .bar { font-size: 12.5px; fill: ${c.dim}; }
  </style>
  <rect x="0.5" y="0.5" width="859" height="${height - 1}" rx="12" fill="${c.bg}" stroke="${c.line}"/>
  <path d="M12.5 .5h835a12 12 0 0 1 12 12V40H.5V12.5a12 12 0 0 1 12-12z" fill="${c.bar}"/>
  <circle cx="24" cy="20" r="6" fill="#ff5f57"/><circle cx="44" cy="20" r="6" fill="#febc2e"/><circle cx="64" cy="20" r="6" fill="#28c840"/>
  <text class="bar" x="430" y="24.5" text-anchor="middle">neofetch</text>
  ${logo.map((l, i) => `<text class="logo" x="${lx}" y="${y0 + 8 + i * 22}" xml:space="preserve">${esc(l)}</text>`).join('\n  ')}
  <text x="${tx}" y="${y0 - 24}"><tspan class="h">gustavo</tspan>@<tspan class="h">github</tspan></text>
  ${rows.map(([k, v], i) => `<text x="${tx}" y="${y0 + 4 + i * lh}"><tspan class="k">${esc(k)}</tspan>: ${esc(v)}</text>`).join('\n  ')}
  <rect x="${tx}" y="${y0 + lh * rows.length + 22}" width="560" height="10" rx="5" fill="${c.track}"/>
  ${bars}
  ${legend}
</svg>
`;
}

writeFileSync('assets/neofetch-dark.svg', svg('dark'));
writeFileSync('assets/neofetch-light.svg', svg('light'));
console.log('ok', rows.map((r) => r.join(': ')).join(' | '));
