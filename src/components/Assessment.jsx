"use client";

import { useState, useRef, useEffect } from "react";

const GPA_SCALE = [
  { gpa: 7, label: "High Distinction", min: 85 },
  { gpa: 6, label: "Distinction",      min: 75 },
  { gpa: 5, label: "Credit",           min: 65 },
  { gpa: 4, label: "Pass",             min: 50 },
];

const initialAssessments = [
  {
    id: 1, name: "Participation", weight: 30, due: "Thu, 5 Mar 2026",
    bestOf: { count: 8, total: 13 },
    parts: [
      { id: 1,  name: "Week 2",  weight: 1.8, mark: null },
      { id: 2,  name: "Week 3",  weight: 1.8, mark: null },
      { id: 3,  name: "Week 5",  weight: 1.8, mark: null },
      { id: 4,  name: "Week 6",  weight: 1.8, mark: null },
      { id: 5,  name: "Week 7",  weight: 1.8, mark: 72   },
      { id: 6,  name: "Week 8",  weight: 1.8, mark: 85   },
      { id: 7,  name: "Week 9",  weight: 1.7, mark: 91   },
      { id: 8,  name: "Week 10", weight: 1.7, mark: 78   },
      { id: 9,  name: "Week 11", weight: 1.7, mark: null },
      { id: 10, name: "Week 12", weight: 1.7, mark: null },
      { id: 11, name: "Week 13", weight: 1.7, mark: null },
      { id: 12, name: "Week 14", weight: 1.7, mark: null },
      { id: 13, name: "Week 15", weight: 1.7, mark: null },
    ],
    mark: null,
  },
  { id: 2, name: "Research Essay",   weight: 30, due: "Fri, 17 Apr 2026", bestOf: null, parts: [], mark: 85   },
  { id: 3, name: "Group Performance",weight: 40, due: "Thu, 21 May 2026", bestOf: null, parts: [], mark: null },
];

let _uid = 200;
const uid = () => ++_uid;

// ─── Target Picker ────────────────────────────────────────────────────────────
function TargetPicker({ target, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef();
  useEffect(() => {
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);
  const current = GPA_SCALE.find(g => g.gpa === target);
  return (
    <div style={{ position: "relative", marginLeft: "auto" }} ref={ref}>
      <button className="target-btn" onClick={() => setOpen(v => !v)}>
        <span className="target-label">target</span>
        <span className="target-value">GPA {target}</span>
        <span className="target-chevron">▾</span>
      </button>
      {open && (
        <div className="target-dropdown">
          {GPA_SCALE.map(g => (
            <button
              key={g.gpa}
              className={`target-option${g.gpa === target ? " active" : ""}`}
              onClick={() => { onChange(g.gpa); setOpen(false); }}
            >
              <span className="to-gpa">GPA {g.gpa}</span>
              <span className="to-name">{g.label}</span>
              <span className="to-min">≥{g.min}%</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Best-of Editor ───────────────────────────────────────────────────────────
function BestOfEditor({ bestOf, totalParts, onChange }) {
  return (
    <div className="bestof-editor">
      <span className="be-label">Best</span>
      <input
        className="be-num"
        type="number" min="1" max={totalParts}
        value={Math.min(bestOf.count, totalParts)}
        onChange={e => {
          const v = Math.max(1, Math.min(totalParts, parseInt(e.target.value) || 1));
          onChange({ count: v, total: totalParts });
        }}
      />
      <span className="be-label">of {totalParts} sessions count toward your grade</span>
    </div>
  );
}

// ─── Part Row ─────────────────────────────────────────────────────────────────
function PartRow({ part, isTop, neededPh, onChange, onDelete }) {
  const isGhost = part.mark === null && neededPh && neededPh !== "—";
  return (
    <div className={`part-row${isTop ? " part-top" : ""}`}>
      {isTop && <span className="top-dot" title="In your best" />}
      <input
        className="pi-name"
        value={part.name}
        placeholder="Session name"
        onChange={e => onChange(part.id, "name", e.target.value)}
      />
      <div className="pi-wt-cell">
        <input
          className="pi-num"
          type="number" min="0" max="100" step="0.1"
          value={part.weight ?? ""}
          placeholder="wt"
          onChange={e => onChange(part.id, "weight", e.target.value === "" ? null : parseFloat(e.target.value))}
        />
        <span className="pi-pct">%</span>
      </div>
      <input
        className={`pi-num pi-mark${isGhost ? " ghost" : ""}${isTop && part.mark !== null ? " top-mark" : ""}`}
        type="number" min="0" max="100"
        placeholder={part.mark === null ? neededPh ?? "—" : "—"}
        value={part.mark ?? ""}
        onChange={e => onChange(part.id, "mark", e.target.value === "" ? null : Number(e.target.value))}
      />
      <button className="pi-del" onClick={() => onDelete(part.id)}>×</button>
    </div>
  );
}

// ─── Assessment Card ──────────────────────────────────────────────────────────
function AssessmentCard({ a, onUpdate, neededMark }) {
  const [open, setOpen] = useState(false);
  const isBestOf = !!a.bestOf;
  const parts = a.parts ?? [];
  const completed = parts.filter(p => p.mark !== null).length;

  // Contribution calc
  let contrib = null;
  if (isBestOf) {
    const entered = parts.filter(p => p.mark !== null);
    const topN = [...entered].sort((x, y) => y.mark - x.mark).slice(0, a.bestOf.count);
    if (topN.length) {
      const avg = topN.reduce((s, p) => s + p.mark, 0) / topN.length;
      contrib = ((avg / 100) * a.weight).toFixed(1);
    }
  } else if (a.mark !== null) {
    contrib = ((a.mark / 100) * a.weight).toFixed(1);
  }

  const isDue = a.due && new Date(a.due) <= new Date();
  const inPh = !isBestOf && a.mark === null && neededMark !== null ? String(neededMark) : "—";
  const partPh = neededMark !== null ? String(neededMark) : "—";

  // Top-N set
  const topIds = new Set();
  if (isBestOf) {
    const entered = parts.filter(p => p.mark !== null);
    [...entered].sort((x, y) => y.mark - x.mark).slice(0, a.bestOf.count).forEach(p => topIds.add(p.id));
  }

  const upd = (patch) => onUpdate({ ...a, ...patch });

  const updatePart = (partId, field, val) => {
    const newParts = parts.map(p => p.id === partId ? { ...p, [field]: val } : p);
    upd({ parts: newParts, bestOf: isBestOf ? { count: Math.min(a.bestOf.count, newParts.length), total: newParts.length } : null });
  };

  const deletePart = (partId) => {
    const newParts = parts.filter(p => p.id !== partId);
    upd({ parts: newParts, bestOf: isBestOf ? { count: Math.min(a.bestOf.count, newParts.length), total: newParts.length } : null });
  };

  const addPart = () => {
    const newParts = [...parts, { id: uid(), name: "", weight: null, mark: null }];
    upd({ parts: newParts, bestOf: isBestOf ? { ...a.bestOf, total: newParts.length } : null });
  };

  return (
    <div className={`card${open ? " card-open" : ""}`}>
      {/* Header */}
      <div className="card-header" onClick={() => isBestOf && setOpen(v => !v)} style={{ cursor: isBestOf ? "pointer" : "default" }}>
        <div className="card-left">
          <div className="card-name-row">
            <span className="card-name">{a.name}</span>
            {isBestOf && (
              <span className="bestof-pill">
                best {Math.min(a.bestOf.count, parts.length)} of {parts.length} · {completed} done
              </span>
            )}
          </div>
          <div className="card-meta">
            <span className="card-wt">{a.weight}%</span>
            <span className="sep">·</span>
            <span className={`card-due${isDue ? " overdue" : ""}`}>{a.due}</span>
          </div>
        </div>
        <div className="card-right">
          {isBestOf ? (
            <div className="dots">
              {parts.map(p => <span key={p.id} className={`dot${p.mark !== null ? " dot-on" : ""}`} />)}
            </div>
          ) : (
            <input
              className={`mark-in${a.mark === null && neededMark !== null ? " ghost" : ""}`}
              type="number" min="0" max="100"
              placeholder={inPh}
              value={a.mark ?? ""}
              onClick={e => e.stopPropagation()}
              onChange={e => upd({ mark: e.target.value === "" ? null : Number(e.target.value) })}
            />
          )}
          <div className="contrib">
            {contrib !== null
              ? <span className="contrib-val">{contrib}%</span>
              : <span className="contrib-nil">—</span>}
            <span className="contrib-of">of {a.weight}%</span>
          </div>
          {isBestOf && <span className={`chevron${open ? " chevron-open" : ""}`}>›</span>}
        </div>
      </div>

      {/* Expanded parts */}
      {isBestOf && open && (
        <div className="parts-panel">
          <BestOfEditor
            bestOf={a.bestOf}
            totalParts={parts.length}
            onChange={newBo => upd({ bestOf: newBo })}
          />
          <div className="parts-head">
            <span>Session</span>
            <span>Weight</span>
            <span>Mark</span>
            <span />
          </div>
          {parts.map(p => (
            <PartRow
              key={p.id}
              part={p}
              isTop={topIds.has(p.id)}
              neededPh={partPh}
              onChange={updatePart}
              onDelete={deletePart}
            />
          ))}
          <button className="add-btn" onClick={addPart}>+ Add session</button>
          {parts.length > 0 && (
            <p className="parts-hint">
              Green rows are in your best {Math.min(a.bestOf.count, parts.length)} · ghost marks show what you need for GPA {neededMark !== null ? "" : "target"}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Root ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [assessments, setAssessments] = useState(initialAssessments);
  const [targetGpa, setTargetGpa] = useState(7);

  const targetPct = GPA_SCALE.find(g => g.gpa === targetGpa)?.min ?? 85;

  const handleUpdate = (updated) =>
    setAssessments(prev => prev.map(a => a.id === updated.id ? updated : a));

  // Compute grades
  let earned = 0, wtEntered = 0;
  assessments.forEach(a => {
    if (a.bestOf) {
      const entered = (a.parts ?? []).filter(p => p.mark !== null);
      const topN = [...entered].sort((x, y) => y.mark - x.mark).slice(0, a.bestOf.count);
      if (topN.length) { earned += (topN.reduce((s, p) => s + p.mark, 0) / topN.length / 100) * a.weight; wtEntered += a.weight; }
    } else if (a.mark !== null) {
      earned += (a.mark / 100) * a.weight; wtEntered += a.weight;
    }
  });

  const currentGrade = wtEntered > 0 ? (earned / wtEntered * 100).toFixed(1) : null;
  const wtAll = assessments.reduce((s, a) => s + a.weight, 0);
  const wtRemaining = wtAll - wtEntered;
  const neededMark = wtRemaining > 0
    ? Math.max(0, Math.min(100, Math.round((targetPct * wtAll / 100 - earned) / (wtRemaining / 100))))
    : null;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Mono:wght@400;500&family=DM+Sans:wght@300;400;500&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        body{background:#0d0d0d;color:#e8e4dc;font-family:'DM Sans',sans-serif;min-height:100vh}
        input[type=number]{-moz-appearance:textfield}
        input[type=number]::-webkit-inner-spin-button,input[type=number]::-webkit-outer-spin-button{-webkit-appearance:none}

        .wrap{max-width:680px;margin:0 auto;padding:48px 24px 80px}

        /* Header */
        .course-code{font-family:'DM Mono',monospace;font-size:11px;letter-spacing:.12em;color:#5a5a5a;text-transform:uppercase;margin-bottom:8px}
        .course-title{font-family:'DM Serif Display',serif;font-size:28px;font-weight:400;color:#e8e4dc;line-height:1.2;margin-bottom:20px}

        /* Grade bar */
        .grade-bar{display:flex;align-items:center;padding:16px 20px;background:#111;border:1px solid #1e1e1e;border-radius:10px;gap:20px;margin-bottom:36px}
        .grade-num{font-family:'DM Serif Display',serif;font-size:36px;color:#4ade80;line-height:1}
        .grade-lbl{font-size:12px;color:#555;font-weight:300;margin-top:2px}
        .grade-div{width:1px;height:36px;background:#222;flex-shrink:0}

        /* Target picker */
        .target-btn{display:flex;align-items:center;gap:8px;background:#1a1a1a;border:1px solid #2a2a2a;border-radius:8px;padding:8px 12px;cursor:pointer;color:#e0dbd2;font-family:'DM Sans',sans-serif;font-size:13px;transition:border-color .15s}
        .target-btn:hover{border-color:#3a3a3a}
        .target-label{font-size:11px;color:#555}
        .target-value{font-family:'DM Mono',monospace;font-size:14px;color:#4ade80}
        .target-chevron{color:#444;font-size:10px}
        .target-dropdown{position:absolute;right:0;top:calc(100% + 6px);background:#161616;border:1px solid #2a2a2a;border-radius:10px;overflow:hidden;z-index:100;min-width:230px;box-shadow:0 8px 32px rgba(0,0,0,.6)}
        .target-option{display:flex;align-items:center;gap:10px;width:100%;padding:10px 14px;background:none;border:none;border-bottom:1px solid #1e1e1e;cursor:pointer;color:#777;font-family:'DM Sans',sans-serif;font-size:13px;text-align:left;transition:background .1s}
        .target-option:last-child{border-bottom:none}
        .target-option:hover{background:#1e1e1e;color:#e0dbd2}
        .target-option.active{color:#4ade80}
        .to-gpa{font-family:'DM Mono',monospace;font-size:13px;min-width:44px}
        .to-name{flex:1}
        .to-min{font-family:'DM Mono',monospace;font-size:11px;color:#444}
        .target-option.active .to-min{color:#2a4a2a}

        /* Section */
        .sec-label{font-family:'DM Mono',monospace;font-size:10px;letter-spacing:.14em;color:#3a3a3a;text-transform:uppercase;margin-bottom:12px}
        .cards{display:flex;flex-direction:column;gap:2px}

        /* Card */
        .card{background:#111;border:1px solid #1e1e1e;border-radius:10px;overflow:hidden;transition:border-color .15s}
        .card:hover{border-color:#2a2a2a}
        .card-open{border-color:#2a2a2a}
        .card-header{display:flex;align-items:center;justify-content:space-between;padding:16px 20px;gap:16px}
        .card-left{flex:1;min-width:0}
        .card-name-row{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:5px}
        .card-name{font-size:15px;font-weight:500;color:#e0dbd2;white-space:nowrap}
        .bestof-pill{font-family:'DM Mono',monospace;font-size:10px;color:#888;background:#1a1a1a;border:1px solid #2a2a2a;padding:2px 8px;border-radius:20px;white-space:nowrap}
        .card-meta{display:flex;align-items:center;gap:6px}
        .card-wt{font-family:'DM Mono',monospace;font-size:12px;color:#555}
        .sep{color:#2a2a2a;font-size:12px}
        .card-due{font-size:12px;color:#555;font-weight:300}
        .card-due.overdue{color:#f87171}
        .card-right{display:flex;align-items:center;gap:12px;flex-shrink:0}
        .dots{display:flex;gap:4px;flex-wrap:wrap;max-width:120px}
        .dot{width:7px;height:7px;border-radius:50%;background:#222;border:1px solid #333;transition:all .15s}
        .dot-on{background:#4ade80;border-color:#4ade80}

        /* Mark input */
        .mark-in{width:64px;background:#1a1a1a;border:1px solid #282828;border-radius:6px;color:#e0dbd2;font-family:'DM Mono',monospace;font-size:14px;padding:6px 10px;text-align:right;outline:none;transition:border-color .15s}
        .mark-in:focus{border-color:#4ade80}
        .mark-in::placeholder{color:#333}
        .mark-in.ghost::placeholder{color:#3d5c3d;font-style:italic}

        /* Contrib */
        .contrib{display:flex;flex-direction:column;align-items:flex-end;min-width:56px}
        .contrib-val{font-family:'DM Mono',monospace;font-size:14px;color:#4ade80;line-height:1.2}
        .contrib-nil{font-family:'DM Mono',monospace;font-size:14px;color:#333;line-height:1.2}
        .contrib-of{font-size:10px;color:#333;font-family:'DM Mono',monospace}
        .chevron{font-size:18px;color:#444;display:inline-block;transform:rotate(90deg);transition:transform .2s,color .15s;line-height:1;margin-left:4px}
        .chevron-open{transform:rotate(270deg);color:#4ade80}

        /* Parts panel */
        .parts-panel{border-top:1px solid #1a1a1a;padding:0 16px 14px}

        /* Best-of editor */
        .bestof-editor{display:flex;align-items:center;gap:8px;padding:12px 4px 10px;border-bottom:1px solid #1a1a1a;margin-bottom:6px}
        .be-label{font-family:'DM Mono',monospace;font-size:11px;color:#555}
        .be-num{width:52px;background:#1a1a1a;border:1px solid #2a2a2a;border-radius:5px;color:#4ade80;font-family:'DM Mono',monospace;font-size:14px;padding:4px 8px;text-align:center;outline:none}
        .be-num:focus{border-color:#4ade80}

        /* Parts table */
        .parts-head{display:grid;grid-template-columns:1fr 76px 66px 22px;gap:6px;padding:8px 4px 6px;font-family:'DM Mono',monospace;font-size:10px;color:#2e2e2e;letter-spacing:.08em;text-transform:uppercase;border-bottom:1px solid #181818;margin-bottom:2px}
        .part-row{display:grid;grid-template-columns:1fr 76px 66px 22px;gap:6px;align-items:center;padding:5px 4px;border-bottom:1px solid #141414;border-radius:4px;transition:background .1s;position:relative}
        .part-row:last-of-type{border-bottom:none}
        .part-top{background:rgba(74,222,128,.035)}
        .top-dot{position:absolute;left:-8px;top:50%;transform:translateY(-50%);width:3px;height:16px;background:#4ade80;border-radius:2px;opacity:.6}

        /* Part inputs */
        .pi-name{background:none;border:none;outline:none;font-family:'DM Sans',sans-serif;font-size:13px;color:#999;padding:3px 4px;border-radius:4px;transition:background .1s,color .1s;width:100%}
        .pi-name:focus{background:#1a1a1a;color:#e0dbd2}
        .pi-name::placeholder{color:#2e2e2e}
        .pi-wt-cell{display:flex;align-items:center;gap:2px}
        .pi-pct{font-family:'DM Mono',monospace;font-size:11px;color:#2e2e2e}
        .pi-num{background:#161616;border:1px solid #1e1e1e;border-radius:4px;color:#777;font-family:'DM Mono',monospace;font-size:12px;padding:3px 6px;text-align:right;outline:none;transition:border-color .15s,color .15s;width:100%}
        .pi-num:focus{border-color:#4ade80;color:#e0dbd2}
        .pi-num::placeholder{color:#252525}
        .pi-num.ghost::placeholder{color:#3d5c3d;font-style:italic}
        .pi-num.top-mark{color:#4ade80;border-color:#1e3a1e}
        .pi-mark{width:100%}
        .pi-del{background:none;border:none;color:#2e2e2e;font-size:16px;line-height:1;cursor:pointer;padding:0 2px;transition:color .15s;display:flex;align-items:center;justify-content:center}
        .pi-del:hover{color:#f87171}

        .add-btn{display:block;width:100%;margin-top:8px;background:none;border:1px dashed #222;border-radius:6px;color:#3a3a3a;font-family:'DM Mono',monospace;font-size:11px;padding:7px;cursor:pointer;transition:border-color .15s,color .15s;letter-spacing:.06em}
        .add-btn:hover{border-color:#4ade80;color:#4ade80}
        .parts-hint{font-size:11px;color:#2a2a2a;margin-top:8px;font-style:italic;font-weight:300;padding:0 4px}
      `}</style>

      <div className="wrap">
        <div className="course-code">DRAM1100</div>
        <h1 className="course-title">The Theatre Experience</h1>

        <div className="grade-bar">
          <div>
            <div className="grade-num">{currentGrade !== null ? `${currentGrade}%` : "—"}</div>
            <div className="grade-lbl">current grade</div>
          </div>
          <div className="grade-div" />
          <TargetPicker target={targetGpa} onChange={setTargetGpa} />
        </div>

        <div className="sec-label">Assessments</div>
        <div className="cards">
          {assessments.map(a => (
            <AssessmentCard
              key={a.id}
              a={a}
              neededMark={
                (a.bestOf ? (a.parts ?? []).every(p => p.mark !== null) : a.mark !== null)
                  ? null : neededMark
              }
              onUpdate={handleUpdate}
            />
          ))}
        </div>
      </div>
    </>
  );
}
