const fs = require("node:fs");
const USER = "House-yuyu";
const COLLECTION = "leonmakise/Awesome-All-in-one-Image-Restoration-Methods";
const token = process.env.GH_TOKEN;
if (!token) throw new Error("GH_TOKEN is required");

async function json(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      "Accept": "application/vnd.github+json",
      "Authorization": `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "House-yuyu-profile-stats",
      ...options.headers
    }
  });
  if (!res.ok) throw new Error(`GitHub API ${res.status} at ${url}: ${await res.text()}`);
  return res.json();
}
function escapeXml(v) {
  return String(v).replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;"
  })[c]);
}
function svg(stats, date) {
  const labels = [
    ["Total Stars Earned:", stats.stars],
    ["Total Commits (last year):", stats.commits],
    ["Total PRs:", stats.prs],
    ["Total Issues:", stats.issues],
    ["Contributed to (last year):", stats.contributed]
  ];
  const icons = [
    '<path d="m31 68 2.6 5.7 6.2.7-4.6 4.2 1.3 6-5.5-3-5.5 3 1.3-6-4.6-4.2 6.2-.7z"/>',
    '<path d="M31 94a7 7 0 1 1-5.4 2.6M25 92v5.5h5.5M31 99v4l3 1.8"/>',
    '<circle cx="27" cy="124" r="2"/><circle cx="36" cy="132" r="2"/><circle cx="27" cy="141" r="2"/><path d="M27 126v13M27 126c0 5 9 1 9 6"/>',
    '<circle cx="31" cy="152" r="7"/><path d="M31 148v5M31 156v.5"/>',
    '<rect x="26" y="170" width="10" height="12" rx="1.3"/><path d="M27 178h8M30 182v2.5"/>'
  ];
  const lines = labels.map(([label, value], i) => {
    const y = 78 + 26*i;
    return `<g><g fill="none" stroke="#127ac1" stroke-width="1.65" stroke-linejoin="round" stroke-linecap="round">${icons[i]}</g><text x="52" y="${y}" font-size="13.5" font-weight="600" fill="#438497">${escapeXml(label)}</text><text x="300" y="${y}" font-size="13.5" font-weight="700" fill="#438497">${escapeXml(value)}</text></g>`;
  }).join("\n");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="206" viewBox="0 0 480 206" role="img" aria-label="Xu Zhang's GitHub stats">
<title>Xu Zhang's GitHub Stats</title>
<desc>Updated ${escapeXml(date)} UTC. Stars include House-yuyu public repositories and the separately co-maintained all-in-one restoration collection.</desc>
<rect x="0.5" y="0.5" width="479" height="205" rx="6" fill="#fff" stroke="#ddd"/>
<text x="24" y="37" font-family="Segoe UI,Arial,sans-serif" font-size="18" font-weight="700" fill="#147fff">Xu Zhang's GitHub Stats</text>
<g font-family="Segoe UI,Arial,sans-serif">
${lines}
<circle cx="421" cy="115" r="40" fill="none" stroke="#cfe1fb" stroke-width="7"/>
<circle cx="421" cy="115" r="40" fill="none" stroke="#348cff" stroke-width="7" stroke-linecap="round" stroke-dasharray="80 251.33" transform="rotate(-90 421 115)"/>
<text x="421" y="125" font-size="27" font-weight="700" fill="#42869a" text-anchor="middle">B</text>
</g></svg>\n`;
}

async function main() {
  const now = new Date();
  const from = new Date(now);
  from.setUTCFullYear(from.getUTCFullYear() - 1);
  const date = now.toISOString().slice(0, 10);
  let ownedStars = 0;
  for (let page=1; ; page++) {
    const repos = await json(`https://api.github.com/users/${USER}/repos?type=owner&per_page=100&page=${page}`);
    for (const repo of repos) if (!repo.private && repo.owner.login.toLowerCase() === USER.toLowerCase()) ownedStars += repo.stargazers_count;
    if (repos.length < 100) break;
  }
  const collection = await json(`https://api.github.com/repos/${COLLECTION}`);
  const prs = await json(`https://api.github.com/search/issues?q=${encodeURIComponent("author:" + USER + " type:pr")}&per_page=1`);
  const issues = await json(`https://api.github.com/search/issues?q=${encodeURIComponent("author:" + USER + " type:issue")}&per_page=1`);
  const query = `query ($login: String!, $from: DateTime!, $to: DateTime!) {
    user(login: $login) {
      contributionsCollection(from: $from, to: $to) {
        totalCommitContributions
        commitContributionsByRepository(maxRepositories: 100) { repository { nameWithOwner } }
        pullRequestContributionsByRepository(maxRepositories: 100) { repository { nameWithOwner } }
        issueContributionsByRepository(maxRepositories: 100) { repository { nameWithOwner } }
      }
    }
  }`;
  const graph = await json("https://api.github.com/graphql", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({query, variables: {login: USER, from: from.toISOString(), to: now.toISOString()}})
  });
  if (graph.errors?.length) throw new Error(JSON.stringify(graph.errors));
  const contributions = graph.data?.user?.contributionsCollection;
  if (!contributions) throw new Error("GitHub contributions collection is unavailable");
  const contributed = new Set([
    ...contributions.commitContributionsByRepository,
    ...contributions.pullRequestContributionsByRepository,
    ...contributions.issueContributionsByRepository
  ].map(entry => entry.repository.nameWithOwner)
   .filter(name => name.split("/")[0].toLowerCase() !== USER.toLowerCase())).size;
  const stats = {
    stars: ownedStars + collection.stargazers_count,
    commits: contributions.totalCommitContributions,
    prs: prs.total_count,
    issues: issues.total_count,
    contributed
  };
  fs.mkdirSync("assets", {recursive:true});
  fs.writeFileSync("assets/github-stats.svg", svg(stats, date));
  let readme = fs.readFileSync("README.md", "utf8");
  const src = `https://raw.githubusercontent.com/House-yuyu/House-yuyu/main/assets/github-stats.svg?v=${date}`;
  const current = /https:\/\/raw\.githubusercontent\.com\/House-yuyu\/House-yuyu\/main\/assets\/github-stats\.svg\?v=[^"]*/;
  const previous = /https:\/\/github-stats-extended\.vercel\.app\/api\?username=House-yuyu&show_icons=true[^"]*/;
  if (current.test(readme)) readme = readme.replace(current, src);
  else if (previous.test(readme)) readme = readme.replace(previous, src);
  else throw new Error("Statistics image URL not found in README");
  fs.writeFileSync("README.md", readme);
  console.log(JSON.stringify({date, ownedStars, collectionStars: collection.stargazers_count, ...stats}));
}
main().catch(e => { console.error(e); process.exitCode = 1; });
