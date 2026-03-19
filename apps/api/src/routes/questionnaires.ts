import { FastifyInstance } from "fastify";
import { IS_POSTGRES, rawSqlite } from "../db/index.js";

// ── Runtime migration: create questionnaire tables ────────────────────────────
function ensureQuestionnaireTables() {
  // In PostgreSQL mode rawSqlite is an in-memory instance used only by legacy callers.
  // We skip FK constraints to avoid "no such table: main.users" on a fresh in-memory DB.
  const createSql = IS_POSTGRES
    ? `
    CREATE TABLE IF NOT EXISTS questionnaire_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      questions TEXT NOT NULL DEFAULT '[]',
      scoring_rules TEXT NOT NULL DEFAULT '{}',
      is_active INTEGER NOT NULL DEFAULT 1,
      created_by INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS questionnaire_assignments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      template_id INTEGER NOT NULL,
      client_id INTEGER NOT NULL,
      assigned_by INTEGER NOT NULL,
      deadline TEXT,
      status TEXT NOT NULL DEFAULT 'PENDING',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS questionnaire_responses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      assignment_id INTEGER NOT NULL,
      answers TEXT NOT NULL DEFAULT '{}',
      total_score REAL,
      interpretation TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_qa_client ON questionnaire_assignments(client_id);
    CREATE INDEX IF NOT EXISTS idx_qa_template ON questionnaire_assignments(template_id);
    CREATE INDEX IF NOT EXISTS idx_qr_assignment ON questionnaire_responses(assignment_id);
  `
    : `
    CREATE TABLE IF NOT EXISTS questionnaire_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      questions TEXT NOT NULL DEFAULT '[]',
      scoring_rules TEXT NOT NULL DEFAULT '{}',
      is_active INTEGER NOT NULL DEFAULT 1,
      created_by INTEGER REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS questionnaire_assignments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      template_id INTEGER NOT NULL REFERENCES questionnaire_templates(id) ON DELETE CASCADE,
      client_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      assigned_by INTEGER NOT NULL REFERENCES users(id),
      deadline TEXT,
      status TEXT NOT NULL DEFAULT 'PENDING',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS questionnaire_responses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      assignment_id INTEGER NOT NULL REFERENCES questionnaire_assignments(id) ON DELETE CASCADE,
      answers TEXT NOT NULL DEFAULT '{}',
      total_score REAL,
      interpretation TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_qa_client ON questionnaire_assignments(client_id);
    CREATE INDEX IF NOT EXISTS idx_qa_template ON questionnaire_assignments(template_id);
    CREATE INDEX IF NOT EXISTS idx_qr_assignment ON questionnaire_responses(assignment_id);
  `;
  rawSqlite.exec(createSql);

  // Seed predefined questionnaires if table is empty
  const cnt = (rawSqlite.prepare("SELECT COUNT(*) as n FROM questionnaire_templates").get() as any).n;
  if (cnt === 0) {
    seedPredefinedQuestionnaires();
  }
}

const PHQ9_QUESTIONS = [
  { id: 1, text: "Malý zájem nebo potěšení z věcí", type: "scale0-3", options: ["Vůbec ne", "Několik dní", "Více než polovinu dní", "Téměř každý den"] },
  { id: 2, text: "Pocity sklíčenosti, beznaděje nebo bezradnosti", type: "scale0-3", options: ["Vůbec ne", "Několik dní", "Více než polovinu dní", "Téměř každý den"] },
  { id: 3, text: "Problémy s usínáním, spánkem nebo naopak přílišná spavost", type: "scale0-3", options: ["Vůbec ne", "Několik dní", "Více než polovinu dní", "Téměř každý den"] },
  { id: 4, text: "Pocit únavy nebo nedostatku energie", type: "scale0-3", options: ["Vůbec ne", "Několik dní", "Více než polovinu dní", "Téměř každý den"] },
  { id: 5, text: "Špatná chuť k jídlu nebo přejídání", type: "scale0-3", options: ["Vůbec ne", "Několik dní", "Více než polovinu dní", "Téměř každý den"] },
  { id: 6, text: "Pocit, že jste selhal/a nebo zklamal/a sebe nebo rodinu", type: "scale0-3", options: ["Vůbec ne", "Několik dní", "Více než polovinu dní", "Téměř každý den"] },
  { id: 7, text: "Problémy se soustředěním (čtení, sledování televize)", type: "scale0-3", options: ["Vůbec ne", "Několik dní", "Více než polovinu dní", "Téměř každý den"] },
  { id: 8, text: "Pohybujete se nebo mluvíte tak pomalu, že si toho ostatní všímají; nebo jste naopak velmi nervózní, neklidný/á", type: "scale0-3", options: ["Vůbec ne", "Několik dní", "Více než polovinu dní", "Téměř každý den"] },
  { id: 9, text: "Myšlenky, že by bylo lépe být mrtvý/á nebo si ublížit", type: "scale0-3", options: ["Vůbec ne", "Několik dní", "Více než polovinu dní", "Téměř každý den"] },
];
const PHQ9_SCORING = {
  method: "sum",
  thresholds: [
    { max: 4, label: "Minimální deprese", color: "green" },
    { max: 9, label: "Mírná deprese", color: "yellow" },
    { max: 14, label: "Středně těžká deprese", color: "orange" },
    { max: 19, label: "Středně těžká až těžká deprese", color: "red" },
    { max: 27, label: "Těžká deprese", color: "darkred" },
  ],
};

const GAD7_QUESTIONS = [
  { id: 1, text: "Pocit nervozity, úzkosti nebo napětí", type: "scale0-3", options: ["Vůbec ne", "Několik dní", "Více než polovinu dní", "Téměř každý den"] },
  { id: 2, text: "Neschopnost zastavit nebo ovládnout starosti", type: "scale0-3", options: ["Vůbec ne", "Několik dní", "Více než polovinu dní", "Téměř každý den"] },
  { id: 3, text: "Nadměrné starosti o různé věci", type: "scale0-3", options: ["Vůbec ne", "Několik dní", "Více než polovinu dní", "Téměř každý den"] },
  { id: 4, text: "Potíže s relaxací", type: "scale0-3", options: ["Vůbec ne", "Několik dní", "Více než polovinu dní", "Téměř každý den"] },
  { id: 5, text: "Tak velký neklid, že je těžké klidně sedět", type: "scale0-3", options: ["Vůbec ne", "Několik dní", "Více než polovinu dní", "Téměř každý den"] },
  { id: 6, text: "Snadná podrážděnost nebo rozčilenost", type: "scale0-3", options: ["Vůbec ne", "Několik dní", "Více než polovinu dní", "Téměř každý den"] },
  { id: 7, text: "Pocit strachu, jako by se mohlo stát něco hrozného", type: "scale0-3", options: ["Vůbec ne", "Několik dní", "Více než polovinu dní", "Téměř každý den"] },
];
const GAD7_SCORING = {
  method: "sum",
  thresholds: [
    { max: 4, label: "Minimální úzkost", color: "green" },
    { max: 9, label: "Mírná úzkost", color: "yellow" },
    { max: 14, label: "Středně těžká úzkost", color: "orange" },
    { max: 21, label: "Těžká úzkost", color: "red" },
  ],
};

const BARTHEL_QUESTIONS = [
  { id: 1, text: "Osobní hygiena (holení, čištění zubů, česání)", type: "options", options: ["0 — Potřebuje pomoc", "5 — Samostatný"], values: [0, 5] },
  { id: 2, text: "Koupání", type: "options", options: ["0 — Závislý", "5 — Samostatný"], values: [0, 5] },
  { id: 3, text: "Příjem potravy", type: "options", options: ["0 — Potřebuje pomoc se vším", "5 — Potřebuje pomoc s řezáním apod.", "10 — Samostatný"], values: [0, 5, 10] },
  { id: 4, text: "Používání WC", type: "options", options: ["0 — Závislý", "5 — Potřebuje pomoc", "10 — Samostatný"], values: [0, 5, 10] },
  { id: 5, text: "Přesun z lůžka na židli a zpět", type: "options", options: ["0 — Neschopný, nemá rovnováhu", "5 — Potřebuje velkou pomoc", "10 — Minimální pomoc", "15 — Samostatný"], values: [0, 5, 10, 15] },
  { id: 6, text: "Chůze po rovině", type: "options", options: ["0 — Imobilní", "5 — Nezávislý na vozíku", "10 — Chůze s pomocí", "15 — Samostatný"], values: [0, 5, 10, 15] },
  { id: 7, text: "Chůze po schodech", type: "options", options: ["0 — Neschopný", "5 — S pomocí", "10 — Samostatný"], values: [0, 5, 10] },
  { id: 8, text: "Oblékání", type: "options", options: ["0 — Závislý", "5 — Potřebuje pomoc", "10 — Samostatný"], values: [0, 5, 10] },
  { id: 9, text: "Kontrola stolice", type: "options", options: ["0 — Inkontinentní", "5 — Občasné nehody", "10 — Kontinentní"], values: [0, 5, 10] },
  { id: 10, text: "Kontrola moče", type: "options", options: ["0 — Inkontinentní nebo katétr", "5 — Občasné nehody", "10 — Kontinentní"], values: [0, 5, 10] },
];
const BARTHEL_SCORING = {
  method: "optionValues",
  thresholds: [
    { max: 20, label: "Plná závislost", color: "darkred" },
    { max: 60, label: "Těžká závislost", color: "red" },
    { max: 80, label: "Středně těžká závislost", color: "orange" },
    { max: 99, label: "Lehká závislost", color: "yellow" },
    { max: 100, label: "Plná soběstačnost", color: "green" },
  ],
};

const VAS_QUESTIONS = [
  { id: 1, text: "Jak silnou bolest právě pociťujete? (0 = žádná bolest, 10 = nejhorší možná bolest)", type: "scale0-10" },
];
const VAS_SCORING = {
  method: "sum",
  thresholds: [
    { max: 2, label: "Mírná bolest", color: "green" },
    { max: 5, label: "Střední bolest", color: "yellow" },
    { max: 7, label: "Silná bolest", color: "orange" },
    { max: 10, label: "Velmi silná bolest", color: "red" },
  ],
};

const SELFRATING_QUESTIONS = [
  { id: 1, text: "Jak hodnotíte svůj celkový pocit pohody dnes?", type: "scale1-5", options: ["1 — Velmi špatně", "2 — Špatně", "3 — Středně", "4 — Dobře", "5 — Velmi dobře"] },
  { id: 2, text: "Jak hodnotíte svůj spánek v posledních dnech?", type: "scale1-5", options: ["1 — Velmi špatně", "2 — Špatně", "3 — Středně", "4 — Dobře", "5 — Velmi dobře"] },
  { id: 3, text: "Jak se cítíte fyzicky (energetická úroveň)?", type: "scale1-5", options: ["1 — Velmi špatně", "2 — Špatně", "3 — Středně", "4 — Dobře", "5 — Velmi dobře"] },
  { id: 4, text: "Jak hodnotíte svou sociální pohodu (vztahy, komunikace)?", type: "scale1-5", options: ["1 — Velmi špatně", "2 — Špatně", "3 — Středně", "4 — Dobře", "5 — Velmi dobře"] },
  { id: 5, text: "Jak hodnotíte svůj celkový pokrok v terapii?", type: "scale1-5", options: ["1 — Žádný pokrok", "2 — Malý pokrok", "3 — Střední pokrok", "4 — Dobrý pokrok", "5 — Výborný pokrok"] },
];
const SELFRATING_SCORING = {
  method: "sum",
  thresholds: [
    { max: 10, label: "Nízká pohoda", color: "red" },
    { max: 15, label: "Střední pohoda", color: "yellow" },
    { max: 20, label: "Dobrá pohoda", color: "green" },
    { max: 25, label: "Výborná pohoda", color: "darkgreen" },
  ],
};

function seedPredefinedQuestionnaires() {
  const insert = rawSqlite.prepare(
    `INSERT INTO questionnaire_templates (name, description, questions, scoring_rules) VALUES (?, ?, ?, ?)`
  );
  insert.run("PHQ-9 — Hodnocení deprese", "Standardizovaný dotazník pro hodnocení závažnosti depresivních příznaků (Patient Health Questionnaire-9). Skóre 0–27.", JSON.stringify(PHQ9_QUESTIONS), JSON.stringify(PHQ9_SCORING));
  insert.run("GAD-7 — Hodnocení úzkosti", "Standardizovaný dotazník pro hodnocení generalizované úzkostné poruchy (Generalized Anxiety Disorder-7). Skóre 0–21.", JSON.stringify(GAD7_QUESTIONS), JSON.stringify(GAD7_SCORING));
  insert.run("Barthel Index — Soběstačnost", "Hodnocení soběstačnosti v denních aktivitách (Barthel Activities of Daily Living Index). Skóre 0–100.", JSON.stringify(BARTHEL_QUESTIONS), JSON.stringify(BARTHEL_SCORING));
  insert.run("VAS — Vizuální analogová škála bolesti", "Hodnocení intenzity bolesti na škále 0–10.", JSON.stringify(VAS_QUESTIONS), JSON.stringify(VAS_SCORING));
  insert.run("Vlastní self-rating", "Subjektivní hodnocení celkové pohody klienta v 5 oblastech. Skóre 5–25.", JSON.stringify(SELFRATING_QUESTIONS), JSON.stringify(SELFRATING_SCORING));
}

// ── Score calculation ─────────────────────────────────────────────────────────
function calculateScore(questions: any[], scoringRules: any, answers: Record<string, number>): { total: number; interpretation: string } {
  let total = 0;

  if (scoringRules.method === "sum") {
    for (const q of questions) {
      const val = answers[String(q.id)];
      if (typeof val === "number") total += val;
    }
  } else if (scoringRules.method === "optionValues") {
    // For Barthel — answer is the option index, value comes from q.values[index]
    for (const q of questions) {
      const idx = answers[String(q.id)];
      if (typeof idx === "number" && q.values && q.values[idx] !== undefined) {
        total += q.values[idx];
      }
    }
  }

  let interpretation = "";
  if (scoringRules.thresholds) {
    for (const t of scoringRules.thresholds) {
      if (total <= t.max) {
        interpretation = t.label;
        break;
      }
    }
  }

  return { total, interpretation };
}

export default async function questionnaireRoutes(app: FastifyInstance) {
  ensureQuestionnaireTables();

  // ── Templates (CRUD, admin only for write) ────────────────────────────────

  // GET /questionnaire-templates — list all active templates
  app.get("/questionnaire-templates", async (req, reply) => {
    const user = (req as any).user;
    if (!user) return reply.status(401).send({ error: "Unauthorized" });
    const rows = rawSqlite.prepare(
      `SELECT qt.*, u.name as created_by_name
       FROM questionnaire_templates qt
       LEFT JOIN users u ON u.id = qt.created_by
       WHERE qt.is_active = 1
       ORDER BY qt.id`
    ).all();
    return rows.map((r: any) => ({
      ...r,
      questions: JSON.parse(r.questions || "[]"),
      scoringRules: JSON.parse(r.scoring_rules || "{}"),
    }));
  });

  // GET /questionnaire-templates/:id
  app.get("/questionnaire-templates/:id", async (req, reply) => {
    const user = (req as any).user;
    if (!user) return reply.status(401).send({ error: "Unauthorized" });
    const id = parseInt((req.params as any).id);
    const row = rawSqlite.prepare("SELECT * FROM questionnaire_templates WHERE id = ?").get(id) as any;
    if (!row) return reply.status(404).send({ error: "Not found" });
    return { ...row, questions: JSON.parse(row.questions || "[]"), scoringRules: JSON.parse(row.scoring_rules || "{}") };
  });

  // POST /questionnaire-templates — ADMIN creates template
  app.post("/questionnaire-templates", async (req, reply) => {
    const user = (req as any).user;
    if (!user || !["ADMIN"].includes(user.role)) return reply.status(403).send({ error: "Forbidden" });
    const body = req.body as any;
    const { name, description, questions, scoringRules } = body;
    if (!name || !questions) return reply.status(400).send({ error: "name and questions required" });
    const result = rawSqlite.prepare(
      `INSERT INTO questionnaire_templates (name, description, questions, scoring_rules, created_by)
       VALUES (?, ?, ?, ?, ?) RETURNING *`
    ).get(name, description || null, JSON.stringify(questions), JSON.stringify(scoringRules || {}), user.id) as any;
    return reply.status(201).send({ ...result, questions: JSON.parse(result.questions), scoringRules: JSON.parse(result.scoring_rules) });
  });

  // PUT /questionnaire-templates/:id — ADMIN updates template
  app.put("/questionnaire-templates/:id", async (req, reply) => {
    const user = (req as any).user;
    if (!user || user.role !== "ADMIN") return reply.status(403).send({ error: "Forbidden" });
    const id = parseInt((req.params as any).id);
    const body = req.body as any;
    const { name, description, questions, scoringRules, isActive } = body;
    rawSqlite.prepare(
      `UPDATE questionnaire_templates SET
         name = COALESCE(?, name),
         description = COALESCE(?, description),
         questions = COALESCE(?, questions),
         scoring_rules = COALESCE(?, scoring_rules),
         is_active = COALESCE(?, is_active),
         updated_at = datetime('now')
       WHERE id = ?`
    ).run(
      name || null,
      description !== undefined ? description : null,
      questions ? JSON.stringify(questions) : null,
      scoringRules ? JSON.stringify(scoringRules) : null,
      isActive !== undefined ? (isActive ? 1 : 0) : null,
      id
    );
    const updated = rawSqlite.prepare("SELECT * FROM questionnaire_templates WHERE id = ?").get(id) as any;
    return { ...updated, questions: JSON.parse(updated.questions), scoringRules: JSON.parse(updated.scoring_rules) };
  });

  // DELETE /questionnaire-templates/:id — ADMIN soft-deletes
  app.delete("/questionnaire-templates/:id", async (req, reply) => {
    const user = (req as any).user;
    if (!user || user.role !== "ADMIN") return reply.status(403).send({ error: "Forbidden" });
    const id = parseInt((req.params as any).id);
    rawSqlite.prepare("UPDATE questionnaire_templates SET is_active = 0, updated_at = datetime('now') WHERE id = ?").run(id);
    return { success: true };
  });

  // ── Assignments ────────────────────────────────────────────────────────────

  // GET /questionnaire-assignments — list assignments
  // CLIENT: own assignments, EMPLOYEE/ADMIN: by clientId
  app.get("/questionnaire-assignments", async (req, reply) => {
    const user = (req as any).user;
    if (!user) return reply.status(401).send({ error: "Unauthorized" });
    const q = req.query as any;

    if (user.role === "CLIENT") {
      const rows = rawSqlite.prepare(
        `SELECT qa.*, qt.name as template_name, qt.description as template_description,
                qt.questions, qt.scoring_rules,
                u.name as assigned_by_name
         FROM questionnaire_assignments qa
         JOIN questionnaire_templates qt ON qt.id = qa.template_id
         LEFT JOIN users u ON u.id = qa.assigned_by
         WHERE qa.client_id = ?
         ORDER BY qa.created_at DESC`
      ).all(user.id);
      return rows.map((r: any) => ({
        ...r,
        questions: JSON.parse(r.questions || "[]"),
        scoringRules: JSON.parse(r.scoring_rules || "{}"),
      }));
    }

    if (["EMPLOYEE", "ADMIN", "RECEPTION"].includes(user.role)) {
      const clientId = q.clientId ? parseInt(q.clientId) : null;
      if (!clientId) return reply.status(400).send({ error: "clientId required" });
      const rows = rawSqlite.prepare(
        `SELECT qa.*, qt.name as template_name, qt.description as template_description,
                qt.questions, qt.scoring_rules,
                u.name as assigned_by_name,
                (SELECT COUNT(*) FROM questionnaire_responses qr WHERE qr.assignment_id = qa.id) as response_count,
                (SELECT qr.total_score FROM questionnaire_responses qr WHERE qr.assignment_id = qa.id ORDER BY qr.created_at DESC LIMIT 1) as last_score,
                (SELECT qr.interpretation FROM questionnaire_responses qr WHERE qr.assignment_id = qa.id ORDER BY qr.created_at DESC LIMIT 1) as last_interpretation,
                (SELECT qr.created_at FROM questionnaire_responses qr WHERE qr.assignment_id = qa.id ORDER BY qr.created_at DESC LIMIT 1) as last_response_at
         FROM questionnaire_assignments qa
         JOIN questionnaire_templates qt ON qt.id = qa.template_id
         LEFT JOIN users u ON u.id = qa.assigned_by
         WHERE qa.client_id = ?
         ORDER BY qa.created_at DESC`
      ).all(clientId);
      return rows.map((r: any) => ({
        ...r,
        questions: JSON.parse(r.questions || "[]"),
        scoringRules: JSON.parse(r.scoring_rules || "{}"),
      }));
    }

    return reply.status(403).send({ error: "Forbidden" });
  });

  // POST /questionnaire-assignments — therapist assigns template to client
  app.post("/questionnaire-assignments", async (req, reply) => {
    const user = (req as any).user;
    if (!user || !["EMPLOYEE", "ADMIN", "RECEPTION"].includes(user.role)) {
      return reply.status(403).send({ error: "Forbidden" });
    }
    const body = req.body as any;
    const { templateId, clientId, deadline } = body;
    if (!templateId || !clientId) return reply.status(400).send({ error: "templateId and clientId required" });

    // Check template exists
    const tmpl = rawSqlite.prepare("SELECT id, name FROM questionnaire_templates WHERE id = ? AND is_active = 1").get(templateId) as any;
    if (!tmpl) return reply.status(404).send({ error: "Template not found" });

    const result = rawSqlite.prepare(
      `INSERT INTO questionnaire_assignments (template_id, client_id, assigned_by, deadline)
       VALUES (?, ?, ?, ?) RETURNING *`
    ).get(templateId, clientId, user.id, deadline || null) as any;

    // Notify client
    try {
      rawSqlite.prepare(
        `INSERT INTO notifications (user_id, type, title, message)
         VALUES (?, 'GENERAL', ?, ?)`
      ).run(clientId, "Nový dotazník k vyplnění", `Terapeut vám přiřadil dotazník: ${tmpl.name}`);
    } catch { /* ignore */ }

    return reply.status(201).send(result);
  });

  // DELETE /questionnaire-assignments/:id — therapist removes assignment
  app.delete("/questionnaire-assignments/:id", async (req, reply) => {
    const user = (req as any).user;
    if (!user || !["EMPLOYEE", "ADMIN"].includes(user.role)) return reply.status(403).send({ error: "Forbidden" });
    const id = parseInt((req.params as any).id);
    rawSqlite.prepare("DELETE FROM questionnaire_assignments WHERE id = ?").run(id);
    return { success: true };
  });

  // ── Responses ──────────────────────────────────────────────────────────────

  // POST /questionnaire-responses — client submits response
  app.post("/questionnaire-responses", async (req, reply) => {
    const user = (req as any).user;
    if (!user) return reply.status(401).send({ error: "Unauthorized" });

    const body = req.body as any;
    const { assignmentId, answers } = body;
    if (!assignmentId || !answers) return reply.status(400).send({ error: "assignmentId and answers required" });

    // Check assignment belongs to user (client) or user is staff
    const assignment = rawSqlite.prepare(
      `SELECT qa.*, qt.questions, qt.scoring_rules
       FROM questionnaire_assignments qa
       JOIN questionnaire_templates qt ON qt.id = qa.template_id
       WHERE qa.id = ?`
    ).get(assignmentId) as any;
    if (!assignment) return reply.status(404).send({ error: "Assignment not found" });
    if (user.role === "CLIENT" && assignment.client_id !== user.id) return reply.status(403).send({ error: "Forbidden" });

    const questions = JSON.parse(assignment.questions || "[]");
    const scoringRules = JSON.parse(assignment.scoring_rules || "{}");
    const { total, interpretation } = calculateScore(questions, scoringRules, answers);

    const result = rawSqlite.prepare(
      `INSERT INTO questionnaire_responses (assignment_id, answers, total_score, interpretation)
       VALUES (?, ?, ?, ?) RETURNING *`
    ).get(assignmentId, JSON.stringify(answers), total, interpretation) as any;

    // Mark assignment as COMPLETED
    rawSqlite.prepare(
      `UPDATE questionnaire_assignments SET status = 'COMPLETED', updated_at = datetime('now') WHERE id = ?`
    ).run(assignmentId);

    return reply.status(201).send({ ...result, answers: JSON.parse(result.answers) });
  });

  // GET /questionnaire-responses — list responses for an assignment
  app.get("/questionnaire-responses", async (req, reply) => {
    const user = (req as any).user;
    if (!user) return reply.status(401).send({ error: "Unauthorized" });
    const q = req.query as any;
    const assignmentId = q.assignmentId ? parseInt(q.assignmentId) : null;
    if (!assignmentId) return reply.status(400).send({ error: "assignmentId required" });

    const assignment = rawSqlite.prepare("SELECT * FROM questionnaire_assignments WHERE id = ?").get(assignmentId) as any;
    if (!assignment) return reply.status(404).send({ error: "Not found" });
    if (user.role === "CLIENT" && assignment.client_id !== user.id) return reply.status(403).send({ error: "Forbidden" });

    const rows = rawSqlite.prepare(
      `SELECT * FROM questionnaire_responses WHERE assignment_id = ? ORDER BY created_at ASC`
    ).all(assignmentId);
    return rows.map((r: any) => ({ ...r, answers: JSON.parse(r.answers || "{}") }));
  });

  // GET /questionnaire-responses/trend — score trend for a template+client
  app.get("/questionnaire-responses/trend", async (req, reply) => {
    const user = (req as any).user;
    if (!user || !["EMPLOYEE", "ADMIN", "RECEPTION"].includes(user.role)) {
      return reply.status(403).send({ error: "Forbidden" });
    }
    const q = req.query as any;
    const templateId = q.templateId ? parseInt(q.templateId) : null;
    const clientId = q.clientId ? parseInt(q.clientId) : null;
    if (!templateId || !clientId) return reply.status(400).send({ error: "templateId and clientId required" });

    const rows = rawSqlite.prepare(
      `SELECT qr.total_score, qr.interpretation, qr.created_at
       FROM questionnaire_responses qr
       JOIN questionnaire_assignments qa ON qa.id = qr.assignment_id
       WHERE qa.template_id = ? AND qa.client_id = ?
       ORDER BY qr.created_at ASC`
    ).all(templateId, clientId);

    return rows;
  });
}
