import { useState, useRef, useEffect } from "react";
import * as Papa from "papaparse";

const THEME = {
  bg: "#0a0a0a",
  surface: "#111111",
  surfaceHover: "#1a1a1a",
  border: "#222222",
  borderActive: "#333333",
  text: "#e5e5e5",
  textMuted: "#888888",
  textDim: "#555555",
  accent: "#c8ff00",
  accentDim: "#6b8700",
  kill: "#ff3b3b",
  killBg: "rgba(255,59,59,0.08)",
  iterate: "#ffaa00",
  iterateBg: "rgba(255,170,0,0.08)",
  scale: "#00e676",
  scaleBg: "rgba(0,230,118,0.08)",
  watch: "#5c8aff",
  watchBg: "rgba(92,138,255,0.08)",
};

const fontStack = `'IBM Plex Mono', 'SF Mono', 'Fira Code', monospace`;
const fontBody = `'IBM Plex Sans', -apple-system, BlinkMacSystemFont, sans-serif`;

const SAMPLE_CSV = `Ad Name,Spend,Revenue,ROAS,CTR,CPC,CPM,Hook Rate,Hold Rate,Impressions,Purchases
"Summer Sale - UGC Testimonial v1",4520,18080,4.0,2.8,1.12,31.36,42,28,144230,361
"Problem Aware - Back Pain Hook",8900,31150,3.5,3.1,0.95,29.45,55,35,302200,623
"Product Demo - Features v2",1200,1080,0.9,0.8,2.50,20.00,15,8,60000,22
"Founder Story - Why I Started",6200,24800,4.0,2.5,1.24,31.00,38,32,200000,496
"Static - Before/After",950,475,0.5,0.6,3.17,19.00,0,0,50000,10
"UGC Review - Customer Jane",3800,13300,3.5,2.2,1.36,29.92,48,22,127000,266
"Competitor Callout - Why We Win",2100,4200,2.0,1.8,1.56,28.08,32,18,74800,84
"Unaware - Lifestyle Hook",5500,7150,1.3,1.5,1.47,22.05,25,12,249400,143
"Solution Aware - Mechanism v1",7800,35100,4.5,3.4,0.88,29.92,58,38,260700,702
"Retargeting - Offer Stack",3200,16000,5.0,4.1,0.78,31.98,0,0,100062,320
"Broad - Trending Audio v1",1800,1260,0.7,0.9,2.00,18.00,20,10,100000,25
"DPA - Dynamic Carousel",4100,10250,2.5,1.9,1.37,26.03,0,0,157500,205
"Testimonial Mashup - 3 Reviews",6700,30150,4.5,2.9,1.03,29.87,52,34,224300,603
"Pain Point - Sleep Issues",3400,5100,1.5,1.4,1.62,22.68,28,14,149900,102
"Flash Sale - 48hr Urgency",2900,11600,4.0,3.6,0.81,29.16,35,20,99450,232`;

function classifyAd(ad) {
  const roas = parseFloat(ad.ROAS) || 0;
  const spend = parseFloat(ad.Spend) || 0;
  const ctr = parseFloat(ad.CTR) || 0;
  const hookRate = parseFloat(ad["Hook Rate"]) || 0;
  const holdRate = parseFloat(ad["Hold Rate"]) || 0;

  let score = 0;
  let reasons = [];

  if (roas >= 3.5) { score += 3; reasons.push("Strong ROAS"); }
  else if (roas >= 2.0) { score += 1; reasons.push("Moderate ROAS"); }
  else if (roas < 1.0) { score -= 3; reasons.push("Negative ROAS"); }
  else { score -= 1; reasons.push("Below-target ROAS"); }

  if (ctr >= 2.5) { score += 2; reasons.push("High CTR"); }
  else if (ctr >= 1.5) { score += 1; }
  else { score -= 1; reasons.push("Low CTR"); }

  if (hookRate >= 40) { score += 2; reasons.push("Strong hook"); }
  else if (hookRate >= 25) { score += 1; }
  else if (hookRate > 0 && hookRate < 20) { score -= 1; reasons.push("Weak hook"); }

  if (holdRate >= 30) { score += 1; reasons.push("Good retention"); }
  else if (holdRate > 0 && holdRate < 15) { score -= 1; reasons.push("Poor retention"); }

  if (spend >= 5000 && roas >= 3.0) { score += 1; reasons.push("Proven at spend"); }
  if (spend < 1500 && roas < 1.5) { score -= 1; reasons.push("Low spend, poor signal"); }

  let status, color, bgColor;
  if (score >= 5) { status = "SCALE"; color = THEME.scale; bgColor = THEME.scaleBg; }
  else if (score >= 2) { status = "ITERATE"; color = THEME.iterate; bgColor = THEME.iterateBg; }
  else if (score >= 0) { status = "WATCH"; color = THEME.watch; bgColor = THEME.watchBg; }
  else { status = "KILL"; color = THEME.kill; bgColor = THEME.killBg; }

  return { status, color, bgColor, score, reasons };
}

function generateInsights(ads) {
  const classified = ads.map(ad => ({ ...ad, ...classifyAd(ad) }));
  const scale = classified.filter(a => a.status === "SCALE");
  const iterate = classified.filter(a => a.status === "ITERATE");
  const watch = classified.filter(a => a.status === "WATCH");
  const kill = classified.filter(a => a.status === "KILL");

  const totalSpend = ads.reduce((s, a) => s + (parseFloat(a.Spend) || 0), 0);
  const totalRevenue = ads.reduce((s, a) => s + (parseFloat(a.Revenue) || 0), 0);
  const wastedSpend = kill.reduce((s, a) => s + (parseFloat(a.Spend) || 0), 0);
  const avgROAS = totalSpend > 0 ? totalRevenue / totalSpend : 0;
  const topHookRates = [...classified].sort((a, b) => (parseFloat(b["Hook Rate"]) || 0) - (parseFloat(a["Hook Rate"]) || 0)).slice(0, 3);
  const topROAS = [...classified].sort((a, b) => (parseFloat(b.ROAS) || 0) - (parseFloat(a.ROAS) || 0)).slice(0, 3);

  return { classified, scale, iterate, watch, kill, totalSpend, totalRevenue, wastedSpend, avgROAS, topHookRates, topROAS };
}

function StatCard({ label, value, sub, accent }) {
  return (
    <div style={{
      background: THEME.surface,
      border: `1px solid ${THEME.border}`,
      padding: "20px 24px",
      flex: 1,
      minWidth: 180,
    }}>
      <div style={{ fontFamily: fontStack, fontSize: 11, color: THEME.textMuted, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>{label}</div>
      <div style={{ fontFamily: fontStack, fontSize: 28, fontWeight: 700, color: accent || THEME.text, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontFamily: fontStack, fontSize: 11, color: THEME.textDim, marginTop: 6 }}>{sub}</div>}
    </div>
  );
}

function AdRow({ ad, index }) {
  const { status, color, bgColor, reasons } = classifyAd(ad);
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      onClick={() => setExpanded(!expanded)}
      style={{
        background: expanded ? bgColor : index % 2 === 0 ? THEME.surface : THEME.bg,
        borderLeft: `3px solid ${color}`,
        padding: "14px 20px",
        cursor: "pointer",
        transition: "background 0.15s",
      }}
      onMouseEnter={e => { if (!expanded) e.currentTarget.style.background = THEME.surfaceHover; }}
      onMouseLeave={e => { if (!expanded) e.currentTarget.style.background = index % 2 === 0 ? THEME.surface : THEME.bg; }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <div style={{
          fontFamily: fontStack, fontSize: 10, fontWeight: 700, color: color,
          background: bgColor, padding: "3px 8px", letterSpacing: "0.1em",
          border: `1px solid ${color}30`, minWidth: 65, textAlign: "center",
        }}>{status}</div>
        <div style={{ fontFamily: fontBody, fontSize: 14, color: THEME.text, flex: 1, minWidth: 200 }}>{ad["Ad Name"] || ad.ad_name || Object.values(ad)[0]}</div>
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
          <MiniStat label="Spend" value={`$${Number(ad.Spend || 0).toLocaleString()}`} />
          <MiniStat label="ROAS" value={`${parseFloat(ad.ROAS || 0).toFixed(1)}x`} accent={parseFloat(ad.ROAS) >= 3 ? THEME.scale : parseFloat(ad.ROAS) < 1.5 ? THEME.kill : THEME.text} />
          <MiniStat label="CTR" value={`${parseFloat(ad.CTR || 0).toFixed(1)}%`} />
          <MiniStat label="Hook" value={parseFloat(ad["Hook Rate"]) > 0 ? `${ad["Hook Rate"]}%` : "—"} />
          <MiniStat label="Hold" value={parseFloat(ad["Hold Rate"]) > 0 ? `${ad["Hold Rate"]}%` : "—"} />
        </div>
        <div style={{ fontFamily: fontStack, fontSize: 14, color: THEME.textDim }}>{expanded ? "−" : "+"}</div>
      </div>
      {expanded && (
        <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${THEME.border}`, display: "flex", gap: 32, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontFamily: fontStack, fontSize: 10, color: THEME.textMuted, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>Signals</div>
            {reasons.map((r, i) => (
              <div key={i} style={{ fontFamily: fontBody, fontSize: 13, color: THEME.textMuted, marginBottom: 4 }}>{"→ " + r}</div>
            ))}
          </div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontFamily: fontStack, fontSize: 10, color: THEME.textMuted, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>Action</div>
            <div style={{ fontFamily: fontBody, fontSize: 13, color: THEME.text, lineHeight: 1.5 }}>
              {status === "SCALE" && "Increase budget 20% every 48 hours. Duplicate into new ad sets. Begin creating variations of this concept immediately."}
              {status === "ITERATE" && "This has signal. Test new hooks against the same body. Try different opening 3 seconds. Adjust CTA. Don't kill — optimize."}
              {status === "WATCH" && "Not enough data or mixed signals. Let it run 48 more hours at current spend before making a decision."}
              {status === "KILL" && "Cut spend immediately. Reallocate budget to top performers. Analyze what failed — hook, offer, or audience mismatch."}
            </div>
          </div>
          <div style={{ minWidth: 140 }}>
            <div style={{ fontFamily: fontStack, fontSize: 10, color: THEME.textMuted, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>Full Metrics</div>
            <div style={{ fontFamily: fontStack, fontSize: 12, color: THEME.textMuted, lineHeight: 1.8 }}>
              {ad.CPC && <div>CPC: ${parseFloat(ad.CPC).toFixed(2)}</div>}
              {ad.CPM && <div>CPM: ${parseFloat(ad.CPM).toFixed(2)}</div>}
              {ad.Impressions && <div>Impr: {Number(ad.Impressions).toLocaleString()}</div>}
              {ad.Purchases && <div>Purchases: {Number(ad.Purchases).toLocaleString()}</div>}
              {ad.Revenue && <div>Revenue: ${Number(ad.Revenue).toLocaleString()}</div>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MiniStat({ label, value, accent }) {
  return (
    <div style={{ textAlign: "right", minWidth: 50 }}>
      <div style={{ fontFamily: fontStack, fontSize: 9, color: THEME.textDim, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
      <div style={{ fontFamily: fontStack, fontSize: 13, color: accent || THEME.text, fontWeight: 600 }}>{value}</div>
    </div>
  );
}

function AIAnalysis({ insights, csvData }) {
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const runAnalysis = async () => {
    setLoading(true);
    setError(null);
    try {
      const summaryData = insights.classified.map(ad => ({
        name: ad["Ad Name"] || ad.ad_name || Object.values(ad)[0],
        status: ad.status,
        spend: ad.Spend,
        roas: ad.ROAS,
        ctr: ad.CTR,
        hookRate: ad["Hook Rate"],
        holdRate: ad["Hold Rate"],
        revenue: ad.Revenue,
      }));

      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          messages: [{
            role: "user",
            content: `You are a senior media buyer and creative strategist analyzing ad performance data. Be direct, specific, and actionable. No fluff.

Here is the ad performance data:
${JSON.stringify(summaryData, null, 2)}

Account summary:
- Total ads: ${insights.classified.length}
- Scale: ${insights.scale.length}, Iterate: ${insights.iterate.length}, Watch: ${insights.watch.length}, Kill: ${insights.kill.length}
- Total spend: $${insights.totalSpend.toLocaleString()}
- Total revenue: $${insights.totalRevenue.toLocaleString()}
- Blended ROAS: ${insights.avgROAS.toFixed(2)}x
- Wasted spend (on kill-tier ads): $${insights.wastedSpend.toLocaleString()}

Respond ONLY with a JSON object (no markdown, no backticks, no preamble). Structure:
{
  "verdict": "One-sentence account health verdict",
  "top_pattern": "The #1 pattern you see in winning ads",
  "biggest_leak": "The #1 area bleeding money",
  "three_moves": ["Move 1", "Move 2", "Move 3"],
  "reallocation": "Specific budget reallocation recommendation with dollar amounts"
}`
          }],
        }),
      });

      const data = await response.json();
      const text = data.content.map(i => i.text || "").join("\n");
      const clean = text.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(clean);
      setAnalysis(parsed);
    } catch (err) {
      setError("Analysis failed. Check your connection and try again.");
      console.error(err);
    }
    setLoading(false);
  };

  if (!analysis && !loading && !error) {
    return (
      <div style={{ background: THEME.surface, border: `1px solid ${THEME.border}`, padding: 32, textAlign: "center" }}>
        <div style={{ fontFamily: fontStack, fontSize: 12, color: THEME.textMuted, marginBottom: 16 }}>AI-powered deep analysis available</div>
        <button
          onClick={runAnalysis}
          style={{
            fontFamily: fontStack, fontSize: 12, fontWeight: 700, color: THEME.bg,
            background: THEME.accent, border: "none", padding: "12px 32px",
            cursor: "pointer", letterSpacing: "0.05em", textTransform: "uppercase",
          }}
        >
          Run Deep Analysis
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ background: THEME.surface, border: `1px solid ${THEME.border}`, padding: 40, textAlign: "center" }}>
        <div style={{ fontFamily: fontStack, fontSize: 13, color: THEME.accent }}>
          Analyzing patterns across {insights.classified.length} ads...
        </div>
        <div style={{
          width: 200, height: 2, background: THEME.border, margin: "16px auto", overflow: "hidden", position: "relative",
        }}>
          <div style={{
            width: "40%", height: "100%", background: THEME.accent, position: "absolute",
            animation: "slide 1.5s ease-in-out infinite",
          }} />
        </div>
        <style>{`@keyframes slide { 0% { left: -40%; } 100% { left: 100%; } }`}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ background: THEME.surface, border: `1px solid ${THEME.kill}30`, padding: 24 }}>
        <div style={{ fontFamily: fontBody, fontSize: 13, color: THEME.kill, marginBottom: 12 }}>{error}</div>
        <button onClick={runAnalysis} style={{
          fontFamily: fontStack, fontSize: 11, color: THEME.accent, background: "none",
          border: `1px solid ${THEME.accent}40`, padding: "8px 16px", cursor: "pointer",
        }}>Retry</button>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <div style={{ background: THEME.surface, border: `1px solid ${THEME.border}`, padding: "20px 24px" }}>
        <div style={{ fontFamily: fontStack, fontSize: 10, color: THEME.accent, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>Verdict</div>
        <div style={{ fontFamily: fontBody, fontSize: 15, color: THEME.text, lineHeight: 1.5 }}>{analysis.verdict}</div>
      </div>
      <div style={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
        <div style={{ background: THEME.surface, border: `1px solid ${THEME.border}`, padding: "20px 24px", flex: 1, minWidth: 250 }}>
          <div style={{ fontFamily: fontStack, fontSize: 10, color: THEME.scale, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>Winning Pattern</div>
          <div style={{ fontFamily: fontBody, fontSize: 13, color: THEME.text, lineHeight: 1.5 }}>{analysis.top_pattern}</div>
        </div>
        <div style={{ background: THEME.surface, border: `1px solid ${THEME.border}`, padding: "20px 24px", flex: 1, minWidth: 250 }}>
          <div style={{ fontFamily: fontStack, fontSize: 10, color: THEME.kill, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>Biggest Leak</div>
          <div style={{ fontFamily: fontBody, fontSize: 13, color: THEME.text, lineHeight: 1.5 }}>{analysis.biggest_leak}</div>
        </div>
      </div>
      <div style={{ background: THEME.surface, border: `1px solid ${THEME.border}`, padding: "20px 24px" }}>
        <div style={{ fontFamily: fontStack, fontSize: 10, color: THEME.iterate, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>Three Moves to Make This Week</div>
        {analysis.three_moves.map((move, i) => (
          <div key={i} style={{ fontFamily: fontBody, fontSize: 13, color: THEME.text, lineHeight: 1.5, marginBottom: 8, paddingLeft: 16, borderLeft: `2px solid ${THEME.iterate}30` }}>
            <span style={{ fontFamily: fontStack, color: THEME.iterate, marginRight: 8 }}>0{i + 1}</span>{move}
          </div>
        ))}
      </div>
      <div style={{ background: THEME.surface, border: `1px solid ${THEME.border}`, padding: "20px 24px" }}>
        <div style={{ fontFamily: fontStack, fontSize: 10, color: THEME.accent, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>Budget Reallocation</div>
        <div style={{ fontFamily: fontBody, fontSize: 13, color: THEME.text, lineHeight: 1.5 }}>{analysis.reallocation}</div>
      </div>
    </div>
  );
}

export default function CreativePerformanceAuditor() {
  const [csvData, setCsvData] = useState(null);
  const [insights, setInsights] = useState(null);
  const [filter, setFilter] = useState("ALL");
  const [sortBy, setSortBy] = useState("score");
  const fileRef = useRef();

  const handleFile = (file) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        setCsvData(results.data);
        setInsights(generateInsights(results.data));
      },
    });
  };

  const loadSample = () => {
    Papa.parse(SAMPLE_CSV, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        setCsvData(results.data);
        setInsights(generateInsights(results.data));
      },
    });
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const filtered = insights?.classified
    ?.filter(a => filter === "ALL" || a.status === filter)
    ?.sort((a, b) => {
      if (sortBy === "score") return b.score - a.score;
      if (sortBy === "spend") return (parseFloat(b.Spend) || 0) - (parseFloat(a.Spend) || 0);
      if (sortBy === "roas") return (parseFloat(b.ROAS) || 0) - (parseFloat(a.ROAS) || 0);
      return 0;
    });

  const reset = () => { setCsvData(null); setInsights(null); setFilter("ALL"); };

  return (
    <div style={{ background: THEME.bg, minHeight: "100vh", color: THEME.text, fontFamily: fontBody }}>
      <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;700&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />

      {/* Header */}
      <div style={{ borderBottom: `1px solid ${THEME.border}`, padding: "20px 32px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ fontFamily: fontStack, fontSize: 10, color: THEME.accent, textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: 4 }}>D-DOUBLEU MEDIA</div>
          <div style={{ fontFamily: fontBody, fontSize: 20, fontWeight: 700, color: THEME.text, letterSpacing: "-0.02em" }}>Creative Performance Auditor</div>
        </div>
        {csvData && (
          <button onClick={reset} style={{
            fontFamily: fontStack, fontSize: 11, color: THEME.textMuted, background: "none",
            border: `1px solid ${THEME.border}`, padding: "8px 16px", cursor: "pointer",
          }}>
            New Audit
          </button>
        )}
      </div>

      {/* Upload State */}
      {!csvData && (
        <div style={{ maxWidth: 640, margin: "80px auto", padding: "0 32px" }}>
          <div
            onDrop={handleDrop}
            onDragOver={e => e.preventDefault()}
            onClick={() => fileRef.current?.click()}
            style={{
              border: `2px dashed ${THEME.border}`,
              padding: "64px 40px",
              textAlign: "center",
              cursor: "pointer",
              transition: "border-color 0.2s",
            }}
            onMouseEnter={e => e.currentTarget.style.borderColor = THEME.accent}
            onMouseLeave={e => e.currentTarget.style.borderColor = THEME.border}
          >
            <div style={{ fontFamily: fontStack, fontSize: 32, color: THEME.textDim, marginBottom: 16 }}>+</div>
            <div style={{ fontFamily: fontBody, fontSize: 16, fontWeight: 600, color: THEME.text, marginBottom: 8 }}>Drop your ad account CSV here</div>
            <div style={{ fontFamily: fontStack, fontSize: 11, color: THEME.textMuted, lineHeight: 1.6 }}>
              Export from Meta, TikTok, or Google Ads Manager.<br />
              Columns needed: Ad Name, Spend, Revenue, ROAS, CTR.<br />
              Optional: Hook Rate, Hold Rate, CPC, CPM, Impressions.
            </div>
            <input ref={fileRef} type="file" accept=".csv" style={{ display: "none" }} onChange={e => e.target.files[0] && handleFile(e.target.files[0])} />
          </div>
          <div style={{ textAlign: "center", marginTop: 24 }}>
            <button onClick={loadSample} style={{
              fontFamily: fontStack, fontSize: 11, color: THEME.accent, background: "none",
              border: `1px solid ${THEME.accent}30`, padding: "10px 24px", cursor: "pointer",
              letterSpacing: "0.05em",
            }}>
              Load Sample Data
            </button>
            <div style={{ fontFamily: fontStack, fontSize: 10, color: THEME.textDim, marginTop: 10 }}>15 sample ads to see how it works</div>
          </div>
        </div>
      )}

      {/* Results */}
      {insights && (
        <div style={{ padding: "24px 32px", maxWidth: 1200, margin: "0 auto" }}>
          {/* Stats Row */}
          <div style={{ display: "flex", gap: 2, flexWrap: "wrap", marginBottom: 24 }}>
            <StatCard label="Total Ads" value={insights.classified.length} />
            <StatCard label="Total Spend" value={`$${insights.totalSpend.toLocaleString()}`} />
            <StatCard label="Total Revenue" value={`$${insights.totalRevenue.toLocaleString()}`} accent={THEME.scale} />
            <StatCard label="Blended ROAS" value={`${insights.avgROAS.toFixed(2)}x`} accent={insights.avgROAS >= 3 ? THEME.scale : insights.avgROAS >= 2 ? THEME.iterate : THEME.kill} />
            <StatCard label="Wasted Spend" value={`$${insights.wastedSpend.toLocaleString()}`} sub={`${((insights.wastedSpend / insights.totalSpend) * 100).toFixed(0)}% of total`} accent={THEME.kill} />
          </div>

          {/* Category Counts */}
          <div style={{ display: "flex", gap: 2, marginBottom: 24, flexWrap: "wrap" }}>
            {[
              { label: "Scale", count: insights.scale.length, color: THEME.scale, bg: THEME.scaleBg, key: "SCALE" },
              { label: "Iterate", count: insights.iterate.length, color: THEME.iterate, bg: THEME.iterateBg, key: "ITERATE" },
              { label: "Watch", count: insights.watch.length, color: THEME.watch, bg: THEME.watchBg, key: "WATCH" },
              { label: "Kill", count: insights.kill.length, color: THEME.kill, bg: THEME.killBg, key: "KILL" },
            ].map(cat => (
              <div
                key={cat.key}
                onClick={() => setFilter(filter === cat.key ? "ALL" : cat.key)}
                style={{
                  background: filter === cat.key ? cat.bg : THEME.surface,
                  border: `1px solid ${filter === cat.key ? cat.color + "40" : THEME.border}`,
                  padding: "14px 24px",
                  flex: 1,
                  minWidth: 120,
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
              >
                <div style={{ fontFamily: fontStack, fontSize: 24, fontWeight: 700, color: cat.color }}>{cat.count}</div>
                <div style={{ fontFamily: fontStack, fontSize: 10, color: THEME.textMuted, textTransform: "uppercase", letterSpacing: "0.1em" }}>{cat.label}</div>
              </div>
            ))}
          </div>

          {/* AI Analysis Section */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontFamily: fontStack, fontSize: 10, color: THEME.textMuted, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>Deep Analysis</div>
            <AIAnalysis insights={insights} csvData={csvData} />
          </div>

          {/* Sort Controls */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
            <div style={{ fontFamily: fontStack, fontSize: 10, color: THEME.textDim, textTransform: "uppercase", letterSpacing: "0.1em" }}>Sort:</div>
            {[
              { key: "score", label: "Priority" },
              { key: "spend", label: "Spend" },
              { key: "roas", label: "ROAS" },
            ].map(s => (
              <button
                key={s.key}
                onClick={() => setSortBy(s.key)}
                style={{
                  fontFamily: fontStack, fontSize: 10, color: sortBy === s.key ? THEME.accent : THEME.textMuted,
                  background: sortBy === s.key ? THEME.accent + "10" : "none",
                  border: `1px solid ${sortBy === s.key ? THEME.accent + "30" : THEME.border}`,
                  padding: "5px 12px", cursor: "pointer",
                }}
              >{s.label}</button>
            ))}
            {filter !== "ALL" && (
              <button onClick={() => setFilter("ALL")} style={{
                fontFamily: fontStack, fontSize: 10, color: THEME.textMuted, background: "none",
                border: `1px solid ${THEME.border}`, padding: "5px 12px", cursor: "pointer", marginLeft: "auto",
              }}>Clear Filter</button>
            )}
          </div>

          {/* Ad List */}
          <div style={{ border: `1px solid ${THEME.border}`, overflow: "hidden" }}>
            <div style={{
              background: THEME.surface, padding: "10px 20px", borderBottom: `1px solid ${THEME.border}`,
              fontFamily: fontStack, fontSize: 10, color: THEME.textDim, textTransform: "uppercase", letterSpacing: "0.1em",
            }}>
              {filter === "ALL" ? `All Ads (${filtered?.length})` : `${filter} (${filtered?.length})`} — Click any row to expand
            </div>
            {filtered?.map((ad, i) => <AdRow key={i} ad={ad} index={i} />)}
          </div>

          {/* Footer */}
          <div style={{
            marginTop: 32, paddingTop: 16, borderTop: `1px solid ${THEME.border}`,
            fontFamily: fontStack, fontSize: 10, color: THEME.textDim, textAlign: "center",
          }}>
            D-DOUBLEU MEDIA — Creative Performance Auditor v1.0
          </div>
        </div>
      )}
    </div>
  );
}