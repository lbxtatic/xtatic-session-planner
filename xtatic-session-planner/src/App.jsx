import React, { useEffect, useMemo, useState } from "react";

/**
 * Xtatic Session-by-Session Teaching Plan Generator
 * - Collect class profile + per-student details
 * - Generate Next Session Plan
 * - Record feedback after each session
 * - Adapt following plan based on feedback
 * - Export markdown / print; localStorage persistence
 */

// Types (JSDoc for clarity)
/** @typedef {{age?: string, gender?: string, interest?: string, passion?: string, energy?: string, notes?: string, name?: string}} StudentDetail */
/** @typedef {{subject: string, expectation: string, totalSessions: number, sessionLengthHours: number, numStudents: number, ageRange: string, students: StudentDetail[]}} ClassProfile */
/** @typedef {{ excitedCount: number|null, digestible: "yes"|"some"|"no"|null, otherInterests: string, notGoodEnough: string }} SessionFeedback */
/** @typedef {{ sessionNumber: number, generatedAt: string, planMd: string, feedback?: SessionFeedback }} SessionRecord */
/** @typedef {{ id: string, profile?: ClassProfile, sessions: SessionRecord[] }} ClassRun */

const STORAGE_KEY = "xtatic-curriculum-runs-v1";

function loadRuns() { try { return JSON.parse(localStorage.getItem(STORAGE_KEY)||"[]")||[] } catch { return [] } }
function saveRuns(runs) { localStorage.setItem(STORAGE_KEY, JSON.stringify(runs)); }

function newEmptyProfile() { return { subject: "", expectation: "", totalSessions: 8, sessionLengthHours: 1, numStudents: 8, ageRange: "10–13", students: [emptyStudent()] }; }
function emptyStudent() { return { name: "", age: "", gender: "", interest: "", passion: "", energy: "", notes: "" }; }
function defaultFeedback() { return { excitedCount: null, digestible: null, otherInterests: "", notGoodEnough: "" }; }

function markdownEscape(s) { return (s || "").replaceAll("<", "&lt;").replaceAll(">", "&gt;"); }
function formatDate(ts = new Date()) { return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(ts); }

function deriveSignals(profile, feedback, sessionNumber) {
  const groupSize = profile?.numStudents || 0;
  const excitement = (feedback?.excitedCount ?? 0) / Math.max(1, groupSize);
  const digest = feedback?.digestible || null;
  return {
    needsMoreEngagement: excitement < 0.5,
    needsMoreScaffold: digest === "no" || digest === "some",
    sessionTheme: profile?.subject || "General Learning",
    mentionInterests: (feedback?.otherInterests || profile?.students?.map(s=>s.interest).filter(Boolean).join(", ") || "").slice(0, 200),
    levelNote: `Ages ${profile?.ageRange || "—"} | ${groupSize} students | Session ${sessionNumber}`,
  };
}

function makePlanMarkdown(profile, feedback, sessionNumber) {
  const s = deriveSignals(profile, feedback, sessionNumber);
  const len = profile.sessionLengthHours || 1;
  const block = (title, items) => `### ${title}\n` + items.map(i => `- ${i}`).join("\n") + "\n\n";

  const warmup = s.needsMoreEngagement
    ? ["Energy check-in: fist-to-five excitement poll","2–3 min icebreaker tied to interests","Movement mini-game or quick quiz"]
    : ["Quick recap from last session","Pair share: goal for today"];

  const teach = s.needsMoreScaffold
    ? [
        `Micro-lesson: ${s.sessionTheme} (5–7 min, concrete examples)`,
        "Guided demo with think-aloud; provide starter template",
        "Check for understanding: thumbs + 2 diagnostic questions",
      ]
    : [
        `Concept spotlight: ${s.sessionTheme} (interactive)`,
        "Student discovery task in pairs; teacher circulates",
      ];

  const practice = [
    "Team task: small groups tackle a bite-sized challenge",
    s.needsMoreScaffold ? "Provide scaffolded steps & exemplars" : "Allow open-ended approaches; encourage creativity",
    "Midpoint pause: share strategies; highlight good moves",
  ];

  const apply = [
    "Independent or pair build: mini-project applying today’s concept",
    s.needsMoreEngagement ? "Gamify with milestones/badges" : "Stretch goal for early finishers",
  ];

  const reflect = [
    "2-minute exit ticket: one learning, one question, one improvement",
    "Student self-rating on confidence (1–5); teacher notes pacing",
  ];

  const homework = [
    "Optional: short practice or reflection journal (photo/upload ok)",
    "Bring one real-world example or question next session",
  ];

  const timing = [
    `Warm-up & Engagement — ${Math.round(len*10)} min`,
    `Mini-Lesson — ${Math.round(len*15)} min`,
    `Guided Practice — ${Math.round(len*15)} min`,
    `Project/Application — ${Math.round(len*15)} min`,
    `Share & Reflect — ${Math.round(len*5)} min`,
  ];

  const header = `# Session ${sessionNumber}: ${markdownEscape(profile.subject)}\n` +
                 `**${s.levelNote}**\n\n` +
                 `**Session Objective:** Build toward ${markdownEscape(profile.expectation || "the class goals")} using age-appropriate, high-engagement activities.\n\n`;

  return (
    header +
    block("Agenda (Suggested Timing)", timing) +
    block("Warm-up & Engagement", warmup) +
    block("Teach (Mini-Lesson)", teach) +
    block("Guided Practice", practice) +
    block("Apply & Create", apply) +
    block("Reflect & Close", reflect) +
    block("Optional Extension / Home Connection", homework)
  );
}

function downloadText(filename, content) {
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url);
}

function Section({ title, subtitle, children, right }) {
  return (
    <div className="bg-white/70 rounded-2xl shadow-sm border border-gray-200 p-6 mb-6">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
          {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
        </div>
        {right}
      </div>
      {children}
    </div>
  );
}

function LabeledInput({ label, children }) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-sm font-medium text-gray-700">{label}</span>
      {children}
    </label>
  );
}

function Pill({ children, className="" }) { return <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700 ${className}`}>{children}</span> }
function Divider() { return <hr className="my-6 border-gray-200" /> }

function StudentEditor({ student, onChange, onRemove, index }) {
  const update = (k, v) => onChange({ ...student, [k]: v });
  return (
    <div className="grid grid-cols-1 md:grid-cols-6 gap-3 bg-gray-50 rounded-xl p-4 border border-gray-200">
      <div className="md:col-span-2">
        <LabeledInput label={`Student ${index+1} Name`}>
          <input className="input" value={student.name||""} onChange={e=>update("name", e.target.value)} placeholder="Optional" />
        </LabeledInput>
      </div>
      <div>
        <LabeledInput label="Age">
          <input className="input" value={student.age||""} onChange={e=>update("age", e.target.value)} placeholder="11" />
        </LabeledInput>
      </div>
      <div>
        <LabeledInput label="Gender">
          <input className="input" value={student.gender||""} onChange={e=>update("gender", e.target.value)} placeholder="" />
        </LabeledInput>
      </div>
      <div>
        <LabeledInput label="Interest / Passion">
          <input className="input" value={student.interest||""} onChange={e=>update("interest", e.target.value)} placeholder="Robotics, Art, Soccer…" />
        </LabeledInput>
      </div>
      <div>
        <LabeledInput label="Energy Level">
          <input className="input" value={student.energy||""} onChange={e=>update("energy", e.target.value)} placeholder="High / Medium / Low" />
        </LabeledInput>
      </div>
      <div className="md:col-span-6">
        <LabeledInput label="Notes">
          <textarea className="input min-h-[60px]" value={student.notes||""} onChange={e=>update("notes", e.target.value)} placeholder="Learning needs, preferences, accommodations…" />
        </LabeledInput>
      </div>
      <div className="md:col-span-6 flex justify-end">
        <button onClick={onRemove} className="btn btn-ghost text-red-600">Remove</button>
      </div>
    </div>
  );
}

function SessionCard({ rec, onDownload }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
      <div className="px-4 py-3 flex items-center justify-between bg-gray-50 border-b">
        <div className="flex items-center gap-2">
          <Pill>Session {rec.sessionNumber}</Pill>
          <span className="text-sm text-gray-600">Generated {formatDate(new Date(rec.generatedAt))}</span>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn btn-ghost" onClick={() => onDownload(rec)}>Export .md</button>
          <button className="btn btn-ghost" onClick={() => window.print()}>Print</button>
        </div>
      </div>
      <div className="prose max-w-none p-4 whitespace-pre-wrap">
        {rec.planMd}
      </div>
      {rec.feedback && (
        <div className="p-4 bg-gray-50 border-t text-sm text-gray-700">
          <div className="font-medium mb-1">Recorded Feedback</div>
          <div>Excited: {rec.feedback.excitedCount ?? "—"}</div>
          <div>Digestible: {rec.feedback.digestible ?? "—"}</div>
          <div>Other Interests: {rec.feedback.otherInterests || "—"}</div>
          <div>Not Good Enough: {rec.feedback.notGoodEnough || "—"}</div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [runs, setRuns] = useState(loadRuns());
  const [activeId, setActiveId] = useState(runs[0]?.id || crypto.randomUUID());
  const activeRun = useMemo(() => runs.find(r => r.id === activeId) || { id: activeId, sessions: [] }, [runs, activeId]);

  const [profile, setProfile] = useState(activeRun.profile || newEmptyProfile());
  const [feedback, setFeedback] = useState(defaultFeedback());

  useEffect(() => {
    if (!runs.find(r => r.id === activeId)) {
      setRuns(prev => [{ id: activeId, profile: newEmptyProfile(), sessions: [] }, ...prev]);
    }
  }, []);

  useEffect(() => { saveRuns(runs); }, [runs]);

  function saveProfile() { setRuns(prev => prev.map(r => r.id === activeId ? { ...r, profile } : r)); }

  function makePlan(profile, lastFeedback, nextIndex) {
    const planMd = makePlanMarkdown(profile, lastFeedback, nextIndex);
    return { sessionNumber: nextIndex, generatedAt: new Date().toISOString(), planMd };
  }

  function generateNextPlan() {
    const run = runs.find(r => r.id === activeId);
    const pf = run?.profile || profile;
    if (!pf?.subject) { alert("Please enter the subject of your class."); return; }
    const nextIndex = (run?.sessions?.length || 0) + 1;
    if (nextIndex > (pf.totalSessions || 1)) { alert("All sessions have been generated. Adjust total sessions in the profile."); return; }
    const rec = makePlan(pf, run?.sessions.at(-1)?.feedback, nextIndex);
    setRuns(prev => prev.map(r => r.id === activeId ? { ...r, sessions: [...(r.sessions||[]), rec] } : r));
  }

  function submitFeedbackAndGenerate() {
    const run = runs.find(r => r.id === activeId);
    if (!run || run.sessions.length === 0) { alert("Please generate at least one session plan first."); return; }
    const lastIdx = run.sessions.length - 1;
    const updatedSessions = run.sessions.map((s, i) => i === lastIdx ? { ...s, feedback: feedback } : s);
    const updatedRun = { ...run, sessions: updatedSessions };
    setRuns(prev => prev.map(r => r.id === activeId ? updatedRun : r));
    setFeedback(defaultFeedback());
    generateNextPlan();
  }

  function onDownload(rec) { downloadText(`Session_${rec.sessionNumber}.md`, rec.planMd); }

  function newClassRun() {
    const id = crypto.randomUUID();
    const fresh = { id, profile: newEmptyProfile(), sessions: [] };
    setRuns([fresh, ...runs]);
    setActiveId(id);
    setProfile(fresh.profile);
    setFeedback(defaultFeedback());
  }

  function deleteRun(id) {
    if (!confirm("Delete this class profile and its history?")) return;
    const next = runs.filter(r => r.id !== id);
    setRuns(next);
    if (id === activeId && next[0]) { setActiveId(next[0].id); setProfile(next[0].profile || newEmptyProfile()); }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 text-gray-900">
      <div className="max-w-6xl mx-auto p-6">
        <header className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Xtatic Teaching Plan Generator</h1>
            <p className="text-sm text-gray-600">Collect class info → Generate plan → Teach → Log feedback → Auto-adapt next plan.</p>
          </div>
          <div className="flex items-center gap-2">
            <button className="btn" onClick={newClassRun}>New Class</button>
          </div>
        </header>

        <Section title="Your Classes" subtitle="Switch between saved class profiles and histories." right={<Pill>{runs.length} saved</Pill>}>
          <div className="grid md:grid-cols-3 gap-3">
            {runs.map(r => (
              <button key={r.id} onClick={() => { setActiveId(r.id); setProfile(r.profile || newEmptyProfile()); }} className={`text-left rounded-xl border p-4 transition ${activeId===r.id?"border-blue-500 bg-blue-50":"border-gray-200 bg-white hover:bg-gray-50"}`}>
                <div className="font-medium">{r.profile?.subject || "(Untitled Subject)"}</div>
                <div className="text-xs text-gray-600">Sessions: {r.sessions?.length || 0} / {r.profile?.totalSessions || "—"}</div>
                <div className="text-xs text-gray-500">Age: {r.profile?.ageRange || "—"} | Students: {r.profile?.numStudents || "—"}</div>
                <div className="mt-2 flex gap-2"><button type="button" className="btn btn-ghost px-2" onClick={(e)=>{e.stopPropagation(); deleteRun(r.id);}}>Delete</button></div>
              </button>
            ))}
          </div>
        </Section>

        <Section title="Class Profile" subtitle="This sets the foundation for your session plans.">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <LabeledInput label="1) Subject of your class">
              <input className="input" value={profile.subject} onChange={e=>setProfile({...profile, subject: e.target.value})} placeholder="e.g., AI with Python, Robotics, Art" />
            </LabeledInput>
            <LabeledInput label="2) Expectation / Outcome">
              <input className="input" value={profile.expectation} onChange={e=>setProfile({...profile, expectation: e.target.value})} placeholder="e.g., Publish 2 projects, master basics" />
            </LabeledInput>
            <LabeledInput label="3) Total sessions">
              <input type="number" className="input" value={profile.totalSessions} onChange={e=>setProfile({...profile, totalSessions: Number(e.target.value||0)})} />
            </LabeledInput>
            <LabeledInput label="3b) Length (hours per session)">
              <input type="number" step="0.25" className="input" value={profile.sessionLengthHours} onChange={e=>setProfile({...profile, sessionLengthHours: Number(e.target.value||0)})} />
            </LabeledInput>
            <LabeledInput label="4) Number of students">
              <input type="number" className="input" value={profile.numStudents} onChange={e=>setProfile({...profile, numStudents: Number(e.target.value||0)})} />
            </LabeledInput>
            <LabeledInput label="5) Age of students (range)">
              <input className="input" value={profile.ageRange} onChange={e=>setProfile({...profile, ageRange: e.target.value})} placeholder="10–13" />
            </LabeledInput>
          </div>
          <hr className="my-6 border-gray-200" />
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold">6) Student-by-Student Details</h3>
            <button className="btn" onClick={()=>setProfile({...profile, students:[...profile.students, emptyStudent()]})}>Add Student</button>
          </div>
          <div className="space-y-3">
            {profile.students.map((st, i) => (
              <StudentEditor key={i} index={i} student={st}
                onChange={(upd)=>{ const arr = [...profile.students]; arr[i] = upd; setProfile({...profile, students: arr}); }}
                onRemove={()=>{ const arr = profile.students.filter((_, idx) => idx !== i); setProfile({...profile, students: arr.length?arr:[emptyStudent()]}); }}
              />
            ))}
          </div>
          <div className="mt-4 flex items-center gap-3">
            <button className="btn" onClick={()=>setRuns(prev => prev.map(r => r.id === activeId ? { ...r, profile } : r))}>Save Profile</button>
            <button className="btn btn-primary" onClick={generateNextPlan}>Generate Next Session Plan</button>
          </div>
        </Section>

        <Section title="After Each Session: Record Feedback & Generate the Next Plan" subtitle="The planner adapts pacing, engagement, and emphasis based on your inputs.">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <LabeledInput label="1) Are the kids excited? How many?">
              <input type="number" className="input" value={feedback.excitedCount ?? ""} onChange={e=>setFeedback({...feedback, excitedCount: e.target.value===""?null:Number(e.target.value)})} placeholder="e.g., 6" />
            </LabeledInput>
            <LabeledInput label="2) Able to digest the content?">
              <select className="input" value={feedback.digestible ?? ""} onChange={e=>setFeedback({...feedback, digestible: e.target.value || null})}>
                <option value="">Select…</option>
                <option value="yes">Yes</option>
                <option value="some">Some</option>
                <option value="no">No</option>
              </select>
            </LabeledInput>
            <LabeledInput label="3) Other subjects of interest">
              <input className="input" value={feedback.otherInterests} onChange={e=>setFeedback({...feedback, otherInterests: e.target.value})} placeholder="e.g., drones, math games, storytelling" />
            </LabeledInput>
            <LabeledInput label="4) What wasn’t good enough last time?">
              <input className="input" value={feedback.notGoodEnough} onChange={e=>setFeedback({...feedback, notGoodEnough: e.target.value})} placeholder="pacing, clarity, engagement, materials…" />
            </LabeledInput>
          </div>
          <div className="mt-4 flex items-center gap-3">
            <button className="btn btn-primary" onClick={submitFeedbackAndGenerate}>Save Feedback → Generate Next Plan</button>
          </div>
        </Section>

        <Section title="Generated Session Plans" subtitle="Download, print, or review past feedback.">
          {activeRun.sessions?.length ? (
            <div className="space-y-4">
              {runs.find(r=>r.id===activeId)?.sessions.map((rec, idx) => (
                <SessionCard key={idx} rec={rec} onDownload={onDownload} />
              ))}
            </div>
          ) : (
            <div className="text-sm text-gray-600">No sessions generated yet. Fill in the Class Profile and click <span className="font-medium">Generate Next Session Plan</span>.</div>
          )}
        </Section>

        <footer className="mt-10 text-center text-xs text-gray-500">
          © {new Date().getFullYear()} Xtatic — Session Planner (local-only prototype). Data is stored in your browser.
        </footer>
      </div>
    </div>
  );
}
