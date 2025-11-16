// @ts-nocheck
import fs from "fs";
import fetch from "node-fetch";

const CACHE_PATH = "/tmp/cache.json"; // temporary cache for Vercel serverless

function readCache() {
  try {
    const raw = fs.readFileSync(CACHE_PATH, "utf8");
    return JSON.parse(raw || "{}");
  } catch {
    return {};
  }
}

function writeCache(obj) {
  try {
    fs.writeFileSync(CACHE_PATH, JSON.stringify(obj));
  } catch {
    // ignore write errors
  }
}

function fmtBatsman(b) {
  const fours = b.fours || 0;
  const sixes = b.sixes || 0;
  const sr =
    b.strike ||
    (b.runs && b.balls ? ((b.runs / b.balls) * 100).toFixed(1) : "N/A");

  return `• ${b.name} – ${b.runs}(${b.balls}) [${fours}x4, ${sixes}x6] (SR: ${sr})`;
}

function fmtBowler(bl) {
  return `• ${bl.name} – ${bl.overs}-${bl.maidens || 0}-${bl.runs}-${
    bl.wkts
  } (Eco ${bl.eco})`;
}

export default async function handler(req, res) {
  const WEBHOOK = process.env.WEBHOOK;

  if (!WEBHOOK) {
    return res.status(400).json({ error: "WEBHOOK environment variable not set" });
  }

  const url = "https://m.cricbuzz.com/api/cricket-match/live";

  let data;
  try {
    const r = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
    });
    data = await r.json();
  } catch {
    return res.status(500).json({ error: "Failed to fetch live data" });
  }

  const matches = data.matches || [];

  // Find India match
  const match = matches.find((m) => {
    const teams = (m.teams || []).map((t) => (t.name || "").toLowerCase());
    return teams.includes("india");
  });

  if (!match) {
    return res.status(200).json({ message: "No India match live" });
  }

  const matchId = match.match_id || "india-match";
  const title = match.header?.match_desc || "India Match";
  const status = match.header?.status || "";

  const innings = match.score?.innings || [];
  if (!innings.length) {
    return res.status(200).json({ message: "Innings not available yet" });
  }

  const inn = innings[innings.length - 1];

  const batTeam = inn.bat_team_name || "Team";
  const runs = inn.score || 0;
  const wkts = inn.wkts || 0;
  const overs = inn.overs || "0.0";
  const rr = inn.rr || "N/A";

  const batsmen = inn.batsman || [];
  const bowlers = inn.bowler || [];
  const partnership = inn.partnership || {};

  const scoreText = `🇮🇳 ${batTeam} ${runs}/${wkts} (${overs} ov, RR: ${rr})`;

  const cache = readCache();
  const old = cache[matchId] || {};

  const payloads = [];

  // Wicket Alert
  if (old.wkts !== undefined && wkts > old.wkts) {
    payloads.push(`⚠️ **WICKET!**\n${scoreText}`);
  }

  // Boundary Alert
  if (old.runs !== undefined && runs > old.runs) {
    const diff = runs - old.runs;
    if (diff >= 4) {
      payloads.push(`🔥 **Boundary! +${diff} runs**\n${scoreText}`);
    }
  }

  // Partnership milestone every 10 runs
  if (partnership.runs && partnership.runs !== old.partnership_runs) {
    if (partnership.runs % 10 === 0) {
      payloads.push(
        `🤝 **Partnership: ${partnership.runs} (${partnership.balls || "N/A"} balls)**`
      );
    }
  }

  // Status update (Rain, Innings break, Result)
  if (status && status !== old.status) {
    payloads.push(`📢 **Status Update:** ${status}`);
  }

  // Full Score Update
  if (scoreText !== old.scoreText) {
    let msg = `📊 Score Update:\n${scoreText}\n\n`;

    // Batsmen
    if (batsmen.length) {
      msg += `🧢 Batsmen:\n`;
      msg += batsmen.slice(0, 2).map((b) => fmtBatsman(b)).join("\n") + "\n\n";
    }

    // Current bowler (only the first one)
    if (bowlers.length) {
      msg += `🎯 Bowler:\n`;
      msg += fmtBowler(bowlers[0]) + "\n\n";
    }

    // Partnership
    if (partnership.runs) {
      msg += `🤝 Partnership: ${partnership.runs} (${partnership.balls || "N/A"})\n`;
    }

    payloads.push(msg);
  }

  // Send every update to Discord
  for (const p of payloads) {
    try {
      await fetch(WEBHOOK, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: p }),
      });
    } catch {
      // ignore failures for individual messages
    }
  }

  // Update cache
  cache[matchId] = {
    runs,
    wkts,
    overs,
    rr,
    status,
    partnership_runs: partnership.runs,
    scoreText,
  };

  writeCache(cache);

  return res.status(200).json({
    message: "Processed OK",
    updatesSent: payloads.length,
    score: scoreText,
  });
}
