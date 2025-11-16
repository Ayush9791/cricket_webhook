import fetch from "node-fetch";
import dotenv from "dotenv";
dotenv.config();

const WEBHOOK = process.env.WEBHOOK;
if (!WEBHOOK) {
  console.error("❌ No WEBHOOK found in environment variables");
  process.exit(1);
}

let last = {}; // in-memory cache
const API_URL = "https://m.cricbuzz.com/api/cricket-match/live";

async function getLiveData() {
  try {
    const res = await fetch(API_URL, {
      headers: { "User-Agent": "Mozilla/5.0" },
    });
    return await res.json();
  } catch (e) {
    console.error("Fetch error:", e);
    return null;
  }
}

function fmtBatsman(b) {
  const sr =
    b.strike ||
    (b.runs && b.balls ? ((b.runs / b.balls) * 100).toFixed(1) : "N/A");
  return `• ${b.name} – ${b.runs}(${b.balls}) [${b.fours || 0}x4, ${
    b.sixes || 0
  }x6] (SR: ${sr})`;
}

function fmtBowler(bl) {
  return `• ${bl.name} – ${bl.overs}-${bl.maidens || 0}-${bl.runs}-${
    bl.wkts
  } (Eco ${bl.eco})`;
}

async function send(msg) {
  try {
    await fetch(WEBHOOK, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: msg }),
    });
  } catch (e) {
    console.error("Webhook error:", e);
  }
}

async function loop() {
  const data = await getLiveData();
  if (!data || !data.matches) return;

  const matches = data.matches;

  // Find India match
  const match = matches.find((m) => {
    const t = (m.teams || []).map((x) => x.name.toLowerCase());
    return t.includes("india");
  });

  if (!match) return;

  const matchId = match.match_id;
  const header = match.header;
  const status = header?.status || "";
  const innings = match.score?.innings || [];
  if (!innings.length) return;

  const inn = innings[innings.length - 1];

  const batTeam = inn.bat_team_name;
  const runs = inn.score;
  const wkts = inn.wkts;
  const overs = inn.overs;
  const rr = inn.rr;

  const scoreText = `🇮🇳 ${batTeam} ${runs}/${wkts} (${overs} ov, RR: ${rr})`;

  const batsmen = inn.batsman || [];
  const bowler = inn.bowler?.[0];
  const partnership = inn.partnership || {};

  const prev = last[matchId] || {};
  const updates = [];

  // Wicket
  if (prev.wkts !== undefined && wkts > prev.wkts) {
    updates.push(`⚠️ **WICKET!**\n${scoreText}`);
  }

  // Boundary
  if (prev.runs !== undefined) {
    const diff = runs - prev.runs;
    if (diff >= 4) {
      updates.push(`🔥 **Boundary! +${diff} runs**\n${scoreText}`);
    }
  }

  // Partnership every 10 runs
  if (
    partnership.runs &&
    partnership.runs !== prev.partnership_runs &&
    partnership.runs % 10 === 0
  ) {
    updates.push(
      `🤝 **Partnership: ${partnership.runs} (${partnership.balls || "N/A"})**`
    );
  }

  // Status change
  if (status && status !== prev.status) {
    updates.push(`📢 **Status Update:** ${status}`);
  }

  // Main score update
  if (scoreText !== prev.scoreText) {
    let msg = `📊 Score Update:\n${scoreText}\n\n`;

    if (batsmen.length) {
      msg += `🧢 Batsmen:\n`;
      msg += batsmen.slice(0, 2).map((b) => fmtBatsman(b)).join("\n") + "\n\n";
    }

    if (bowler) {
      msg += `🎯 Bowler:\n${fmtBowler(bowler)}\n\n`;
    }

    if (partnership.runs) {
      msg += `🤝 Partnership: ${partnership.runs} (${partnership.balls || "N/A"})`;
    }

    updates.push(msg);
  }

  for (const u of updates) await send(u);

  // Update cache
  last[matchId] = {
    runs,
    wkts,
    status,
    partnership_runs: partnership.runs,
    scoreText,
  };
}

console.log("🔥 Cricket webhook bot started on Koyeb!");

setInterval(loop, 15000); // every 15 seconds
