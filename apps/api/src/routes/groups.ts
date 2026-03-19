import { FastifyInstance } from "fastify";
import { rawSqlite } from "../db/index.js";

// ─── Runtime migrations ───────────────────────────────────────────────────────
function ensureGroupTables() {
  rawSqlite.exec(`
    CREATE TABLE IF NOT EXISTS support_groups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      category TEXT NOT NULL DEFAULT 'general',
      moderator_id INTEGER NOT NULL REFERENCES users(id),
      max_members INTEGER NOT NULL DEFAULT 20,
      rules TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS group_memberships (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      group_id INTEGER NOT NULL REFERENCES support_groups(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'pending',
      is_anonymous INTEGER NOT NULL DEFAULT 0,
      joined_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(group_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS group_topics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      group_id INTEGER NOT NULL REFERENCES support_groups(id) ON DELETE CASCADE,
      author_id INTEGER NOT NULL REFERENCES users(id),
      title TEXT NOT NULL,
      is_locked INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS group_posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      topic_id INTEGER NOT NULL REFERENCES group_topics(id) ON DELETE CASCADE,
      author_id INTEGER NOT NULL REFERENCES users(id),
      content TEXT NOT NULL,
      is_anonymous INTEGER NOT NULL DEFAULT 0,
      is_hidden INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS group_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      post_id INTEGER NOT NULL REFERENCES group_posts(id) ON DELETE CASCADE,
      reporter_id INTEGER NOT NULL REFERENCES users(id),
      reason TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_group_memberships_group ON group_memberships(group_id);
    CREATE INDEX IF NOT EXISTS idx_group_memberships_user ON group_memberships(user_id);
    CREATE INDEX IF NOT EXISTS idx_group_topics_group ON group_topics(group_id);
    CREATE INDEX IF NOT EXISTS idx_group_posts_topic ON group_posts(topic_id);
    CREATE INDEX IF NOT EXISTS idx_group_reports_post ON group_reports(post_id);
  `);
}

// ─── Crisis detection ─────────────────────────────────────────────────────────
const CRISIS_WORDS = [
  "sebevražda",
  "sebevražd",
  "nechci žít",
  "chci umřít",
  "ublížit si",
  "zabít se",
  "konec života",
];

function detectCrisis(text: string): boolean {
  const lower = text.toLowerCase();
  return CRISIS_WORDS.some((w) => lower.includes(w));
}

// ─── Helper: check approved membership ────────────────────────────────────────
function isMember(groupId: number, userId: number): boolean {
  const row = rawSqlite
    .prepare(
      "SELECT id FROM group_memberships WHERE group_id = ? AND user_id = ? AND status = 'approved'"
    )
    .get(groupId, userId);
  return !!row;
}

function isModerator(groupId: number, userId: number): boolean {
  const row = rawSqlite
    .prepare("SELECT id FROM support_groups WHERE id = ? AND moderator_id = ?")
    .get(groupId, userId);
  return !!row;
}

// ─── Routes ───────────────────────────────────────────────────────────────────
export default async function groupsRoutes(app: FastifyInstance) {
  ensureGroupTables();

  // ── GROUPS CRUD ──────────────────────────────────────────────────────────────

  // GET /groups — list all active groups (public for authenticated users)
  app.get("/groups", async (req, reply) => {
    const user = (req as any).auth;
    if (!user) return reply.status(401).send({ error: "Unauthorized" });

    const groups = rawSqlite
      .prepare(
        `SELECT sg.*, u.name as moderator_name,
          (SELECT COUNT(*) FROM group_memberships gm WHERE gm.group_id = sg.id AND gm.status = 'approved') as member_count,
          (SELECT status FROM group_memberships gm2 WHERE gm2.group_id = sg.id AND gm2.user_id = ? LIMIT 1) as my_status
         FROM support_groups sg
         LEFT JOIN users u ON u.id = sg.moderator_id
         WHERE sg.status = 'active'
         ORDER BY sg.created_at DESC`
      )
      .all(user.id);

    return groups;
  });

  // GET /groups/all — admin: all groups including archived
  app.get("/groups/all", async (req, reply) => {
    const user = (req as any).auth;
    if (!user || !["ADMIN", "EMPLOYEE"].includes(user.role)) {
      return reply.status(403).send({ error: "Forbidden" });
    }

    const groups = rawSqlite
      .prepare(
        `SELECT sg.*, u.name as moderator_name,
          (SELECT COUNT(*) FROM group_memberships gm WHERE gm.group_id = sg.id AND gm.status = 'approved') as member_count,
          (SELECT COUNT(*) FROM group_memberships gm2 WHERE gm2.group_id = sg.id AND gm2.status = 'pending') as pending_count
         FROM support_groups sg
         LEFT JOIN users u ON u.id = sg.moderator_id
         ORDER BY sg.created_at DESC`
      )
      .all();

    return groups;
  });

  // GET /groups/mine — groups where I am approved member
  app.get("/groups/mine", async (req, reply) => {
    const user = (req as any).auth;
    if (!user) return reply.status(401).send({ error: "Unauthorized" });

    const groups = rawSqlite
      .prepare(
        `SELECT sg.*, u.name as moderator_name, gm.is_anonymous,
          (SELECT COUNT(*) FROM group_memberships gm2 WHERE gm2.group_id = sg.id AND gm2.status = 'approved') as member_count
         FROM group_memberships gm
         JOIN support_groups sg ON sg.id = gm.group_id
         LEFT JOIN users u ON u.id = sg.moderator_id
         WHERE gm.user_id = ? AND gm.status = 'approved'
         ORDER BY sg.name`
      )
      .all(user.id);

    return groups;
  });

  // GET /groups/moderated — groups I moderate
  app.get("/groups/moderated", async (req, reply) => {
    const user = (req as any).auth;
    if (!user || !["EMPLOYEE", "ADMIN"].includes(user.role)) {
      return reply.status(403).send({ error: "Forbidden" });
    }

    const groups = rawSqlite
      .prepare(
        `SELECT sg.*,
          (SELECT COUNT(*) FROM group_memberships gm WHERE gm.group_id = sg.id AND gm.status = 'approved') as member_count,
          (SELECT COUNT(*) FROM group_memberships gm2 WHERE gm2.group_id = sg.id AND gm2.status = 'pending') as pending_count,
          (SELECT COUNT(*) FROM group_reports gr JOIN group_posts gp ON gp.id = gr.post_id JOIN group_topics gt ON gt.id = gp.topic_id WHERE gt.group_id = sg.id AND gr.status = 'open') as report_count
         FROM support_groups sg
         WHERE sg.moderator_id = ?
         ORDER BY sg.created_at DESC`
      )
      .all(user.id);

    return groups;
  });

  // GET /groups/:id — group detail
  app.get<{ Params: { id: string } }>("/groups/:id", async (req, reply) => {
    const user = (req as any).auth;
    if (!user) return reply.status(401).send({ error: "Unauthorized" });

    const group = rawSqlite
      .prepare(
        `SELECT sg.*, u.name as moderator_name,
          (SELECT COUNT(*) FROM group_memberships gm WHERE gm.group_id = sg.id AND gm.status = 'approved') as member_count
         FROM support_groups sg
         LEFT JOIN users u ON u.id = sg.moderator_id
         WHERE sg.id = ?`
      )
      .get(parseInt(req.params.id)) as any;

    if (!group) return reply.status(404).send({ error: "Group not found" });

    const membership = rawSqlite
      .prepare("SELECT * FROM group_memberships WHERE group_id = ? AND user_id = ?")
      .get(parseInt(req.params.id), user.id) as any;

    return { ...group, myMembership: membership || null };
  });

  // POST /groups — create group (EMPLOYEE/ADMIN)
  app.post("/groups", async (req, reply) => {
    const user = (req as any).auth;
    if (!user || !["EMPLOYEE", "ADMIN"].includes(user.role)) {
      return reply.status(403).send({ error: "Forbidden" });
    }

    const body = req.body as any;
    const { name, description, category, moderatorId, maxMembers, rules } = body;

    if (!name || !category) {
      return reply.status(400).send({ error: "name and category are required" });
    }

    const modId = moderatorId || user.id;

    const result = rawSqlite
      .prepare(
        `INSERT INTO support_groups (name, description, category, moderator_id, max_members, rules)
         VALUES (?, ?, ?, ?, ?, ?)
         RETURNING *`
      )
      .get(name, description || null, category, modId, maxMembers || 20, rules || null) as any;

    return reply.status(201).send(result);
  });

  // PATCH /groups/:id — update group (moderator or ADMIN)
  app.patch<{ Params: { id: string } }>("/groups/:id", async (req, reply) => {
    const user = (req as any).auth;
    if (!user) return reply.status(401).send({ error: "Unauthorized" });

    const gid = parseInt(req.params.id);
    const group = rawSqlite.prepare("SELECT * FROM support_groups WHERE id = ?").get(gid) as any;
    if (!group) return reply.status(404).send({ error: "Not found" });

    if (user.role !== "ADMIN" && group.moderator_id !== user.id) {
      return reply.status(403).send({ error: "Forbidden" });
    }

    const body = req.body as any;
    const fields: string[] = [];
    const values: any[] = [];

    if (body.name !== undefined) { fields.push("name = ?"); values.push(body.name); }
    if (body.description !== undefined) { fields.push("description = ?"); values.push(body.description); }
    if (body.category !== undefined) { fields.push("category = ?"); values.push(body.category); }
    if (body.maxMembers !== undefined) { fields.push("max_members = ?"); values.push(body.maxMembers); }
    if (body.rules !== undefined) { fields.push("rules = ?"); values.push(body.rules); }
    if (body.status !== undefined) { fields.push("status = ?"); values.push(body.status); }
    if (body.moderatorId !== undefined && user.role === "ADMIN") {
      fields.push("moderator_id = ?");
      values.push(body.moderatorId);
    }

    if (fields.length === 0) return reply.status(400).send({ error: "No fields to update" });

    fields.push("updated_at = datetime('now')");
    values.push(gid);

    const updated = rawSqlite
      .prepare(`UPDATE support_groups SET ${fields.join(", ")} WHERE id = ? RETURNING *`)
      .get(...values) as any;

    return updated;
  });

  // ── MEMBERSHIP ───────────────────────────────────────────────────────────────

  // POST /groups/:id/join — client requests membership
  app.post<{ Params: { id: string } }>("/groups/:id/join", async (req, reply) => {
    const user = (req as any).auth;
    if (!user) return reply.status(401).send({ error: "Unauthorized" });

    const gid = parseInt(req.params.id);
    const group = rawSqlite
      .prepare("SELECT * FROM support_groups WHERE id = ? AND status = 'active'")
      .get(gid) as any;
    if (!group) return reply.status(404).send({ error: "Group not found" });

    const existing = rawSqlite
      .prepare("SELECT * FROM group_memberships WHERE group_id = ? AND user_id = ?")
      .get(gid, user.id) as any;

    if (existing) {
      return reply.status(409).send({ error: "Already requested or member", status: existing.status });
    }

    const body = req.body as any;
    const isAnonymous = body?.isAnonymous ? 1 : 0;

    rawSqlite
      .prepare(
        "INSERT INTO group_memberships (group_id, user_id, status, is_anonymous) VALUES (?, ?, 'pending', ?)"
      )
      .run(gid, user.id, isAnonymous);

    // Notify moderator (insert in-app notification if table exists)
    try {
      rawSqlite
        .prepare(
          `INSERT INTO notifications (user_id, type, title, body, link)
           VALUES (?, 'group_join_request', 'Nová žádost o vstup do skupiny', ?, ?)`
        )
        .run(
          group.moderator_id,
          `Uživatel žádá o vstup do skupiny "${group.name}"`,
          `/employee/groups`
        );
    } catch {}

    return reply.status(201).send({ message: "Membership requested" });
  });

  // GET /groups/:id/members — moderator or member sees members
  app.get<{ Params: { id: string } }>("/groups/:id/members", async (req, reply) => {
    const user = (req as any).auth;
    if (!user) return reply.status(401).send({ error: "Unauthorized" });

    const gid = parseInt(req.params.id);
    const isMod = isModerator(gid, user.id);
    const mem = isMember(gid, user.id);

    if (!isMod && !mem && user.role !== "ADMIN") {
      return reply.status(403).send({ error: "Forbidden" });
    }

    const members = rawSqlite
      .prepare(
        `SELECT gm.id, gm.status, gm.is_anonymous, gm.joined_at, gm.created_at,
          CASE WHEN gm.is_anonymous = 1 AND ? = 0 THEN 'Anonymní člen' ELSE u.name END as name,
          CASE WHEN gm.is_anonymous = 1 AND ? = 0 THEN NULL ELSE u.email END as email,
          CASE WHEN gm.is_anonymous = 1 AND ? = 0 THEN NULL ELSE u.id END as userId
         FROM group_memberships gm
         JOIN users u ON u.id = gm.user_id
         WHERE gm.group_id = ? AND gm.status = 'approved'
         ORDER BY gm.joined_at`
      )
      .all(isMod ? 1 : 0, isMod ? 1 : 0, isMod ? 1 : 0, gid);

    return members;
  });

  // GET /groups/:id/pending — moderator sees pending requests
  app.get<{ Params: { id: string } }>("/groups/:id/pending", async (req, reply) => {
    const user = (req as any).auth;
    if (!user) return reply.status(401).send({ error: "Unauthorized" });

    const gid = parseInt(req.params.id);
    if (!isModerator(gid, user.id) && user.role !== "ADMIN") {
      return reply.status(403).send({ error: "Forbidden" });
    }

    const pending = rawSqlite
      .prepare(
        `SELECT gm.id, gm.user_id, gm.is_anonymous, gm.created_at, u.name, u.email
         FROM group_memberships gm
         JOIN users u ON u.id = gm.user_id
         WHERE gm.group_id = ? AND gm.status = 'pending'
         ORDER BY gm.created_at`
      )
      .all(gid);

    return pending;
  });

  // PATCH /groups/:id/members/:memberId — approve/reject/remove
  app.patch<{ Params: { id: string; memberId: string } }>(
    "/groups/:id/members/:memberId",
    async (req, reply) => {
      const user = (req as any).auth;
      if (!user) return reply.status(401).send({ error: "Unauthorized" });

      const gid = parseInt(req.params.id);
      if (!isModerator(gid, user.id) && user.role !== "ADMIN") {
        return reply.status(403).send({ error: "Forbidden" });
      }

      const body = req.body as any;
      const { status } = body; // 'approved' | 'rejected' | 'removed'

      if (!["approved", "rejected", "removed"].includes(status)) {
        return reply.status(400).send({ error: "Invalid status" });
      }

      const updated = rawSqlite
        .prepare(
          `UPDATE group_memberships SET status = ?, joined_at = CASE WHEN ? = 'approved' THEN datetime('now') ELSE joined_at END
           WHERE id = ? AND group_id = ?
           RETURNING *`
        )
        .get(status, status, parseInt(req.params.memberId), gid) as any;

      if (!updated) return reply.status(404).send({ error: "Membership not found" });

      // Notify the user
      try {
        const group = rawSqlite.prepare("SELECT name FROM support_groups WHERE id = ?").get(gid) as any;
        const msg =
          status === "approved"
            ? `Vaše žádost o vstup do skupiny "${group.name}" byla schválena.`
            : `Vaše žádost o vstup do skupiny "${group.name}" byla zamítnuta.`;
        rawSqlite
          .prepare(
            `INSERT INTO notifications (user_id, type, title, body, link)
             VALUES (?, 'group_membership', 'Skupinové členství', ?, ?)`
          )
          .run(updated.user_id, msg, `/client/groups`);
      } catch {}

      return updated;
    }
  );

  // ── TOPICS ────────────────────────────────────────────────────────────────────

  // GET /groups/:id/topics
  app.get<{ Params: { id: string } }>("/groups/:id/topics", async (req, reply) => {
    const user = (req as any).auth;
    if (!user) return reply.status(401).send({ error: "Unauthorized" });

    const gid = parseInt(req.params.id);
    if (!isMember(gid, user.id) && !isModerator(gid, user.id) && user.role !== "ADMIN") {
      return reply.status(403).send({ error: "Not a member" });
    }

    const topics = rawSqlite
      .prepare(
        `SELECT gt.*, u.name as author_name,
          (SELECT COUNT(*) FROM group_posts gp WHERE gp.topic_id = gt.id AND gp.is_hidden = 0) as post_count,
          (SELECT MAX(gp2.created_at) FROM group_posts gp2 WHERE gp2.topic_id = gt.id) as last_post_at
         FROM group_topics gt
         LEFT JOIN users u ON u.id = gt.author_id
         WHERE gt.group_id = ?
         ORDER BY last_post_at DESC, gt.created_at DESC`
      )
      .all(gid);

    return topics;
  });

  // POST /groups/:id/topics
  app.post<{ Params: { id: string } }>("/groups/:id/topics", async (req, reply) => {
    const user = (req as any).auth;
    if (!user) return reply.status(401).send({ error: "Unauthorized" });

    const gid = parseInt(req.params.id);
    if (!isMember(gid, user.id) && !isModerator(gid, user.id) && user.role !== "ADMIN") {
      return reply.status(403).send({ error: "Not a member" });
    }

    const body = req.body as any;
    const { title } = body;
    if (!title) return reply.status(400).send({ error: "title is required" });

    const topic = rawSqlite
      .prepare("INSERT INTO group_topics (group_id, author_id, title) VALUES (?, ?, ?) RETURNING *")
      .get(gid, user.id, title) as any;

    return reply.status(201).send(topic);
  });

  // PATCH /groups/:id/topics/:topicId — lock/unlock (moderator)
  app.patch<{ Params: { id: string; topicId: string } }>(
    "/groups/:id/topics/:topicId",
    async (req, reply) => {
      const user = (req as any).auth;
      if (!user) return reply.status(401).send({ error: "Unauthorized" });

      const gid = parseInt(req.params.id);
      if (!isModerator(gid, user.id) && user.role !== "ADMIN") {
        return reply.status(403).send({ error: "Forbidden" });
      }

      const body = req.body as any;
      const updated = rawSqlite
        .prepare(
          "UPDATE group_topics SET is_locked = ? WHERE id = ? AND group_id = ? RETURNING *"
        )
        .get(body.isLocked ? 1 : 0, parseInt(req.params.topicId), gid) as any;

      if (!updated) return reply.status(404).send({ error: "Topic not found" });
      return updated;
    }
  );

  // ── POSTS ─────────────────────────────────────────────────────────────────────

  // GET /groups/:id/topics/:topicId/posts
  app.get<{ Params: { id: string; topicId: string } }>(
    "/groups/:id/topics/:topicId/posts",
    async (req, reply) => {
      const user = (req as any).auth;
      if (!user) return reply.status(401).send({ error: "Unauthorized" });

      const gid = parseInt(req.params.id);
      const tid = parseInt(req.params.topicId);
      const isMod = isModerator(gid, user.id) || user.role === "ADMIN";

      if (!isMember(gid, user.id) && !isMod) {
        return reply.status(403).send({ error: "Not a member" });
      }

      const posts = rawSqlite
        .prepare(
          `SELECT gp.id, gp.topic_id, gp.content, gp.is_anonymous, gp.is_hidden, gp.created_at,
            CASE WHEN gp.is_anonymous = 1 AND ? = 0 THEN 'Anonymní člen' ELSE u.name END as author_name,
            CASE WHEN gp.is_anonymous = 1 AND ? = 0 THEN NULL ELSE gp.author_id END as author_id
           FROM group_posts gp
           JOIN users u ON u.id = gp.author_id
           WHERE gp.topic_id = ? AND (gp.is_hidden = 0 OR ? = 1)
           ORDER BY gp.created_at`
        )
        .all(isMod ? 1 : 0, isMod ? 1 : 0, tid, isMod ? 1 : 0);

      return posts;
    }
  );

  // POST /groups/:id/topics/:topicId/posts
  app.post<{ Params: { id: string; topicId: string } }>(
    "/groups/:id/topics/:topicId/posts",
    async (req, reply) => {
      const user = (req as any).auth;
      if (!user) return reply.status(401).send({ error: "Unauthorized" });

      const gid = parseInt(req.params.id);
      const tid = parseInt(req.params.topicId);
      const isMod = isModerator(gid, user.id) || user.role === "ADMIN";

      if (!isMember(gid, user.id) && !isMod) {
        return reply.status(403).send({ error: "Not a member" });
      }

      // Check topic exists and not locked
      const topic = rawSqlite
        .prepare("SELECT * FROM group_topics WHERE id = ? AND group_id = ?")
        .get(tid, gid) as any;

      if (!topic) return reply.status(404).send({ error: "Topic not found" });
      if (topic.is_locked && !isMod) {
        return reply.status(403).send({ error: "Topic is locked" });
      }

      const body = req.body as any;
      const { content, isAnonymous } = body;
      if (!content) return reply.status(400).send({ error: "content is required" });

      // Detect crisis words
      const crisis = detectCrisis(content);

      // Get anonymous flag from membership
      const membership = rawSqlite
        .prepare(
          "SELECT is_anonymous FROM group_memberships WHERE group_id = ? AND user_id = ? AND status = 'approved'"
        )
        .get(gid, user.id) as any;

      const useAnonymous = isAnonymous !== undefined ? (isAnonymous ? 1 : 0) : (membership?.is_anonymous || 0);

      const post = rawSqlite
        .prepare(
          "INSERT INTO group_posts (topic_id, author_id, content, is_anonymous) VALUES (?, ?, ?, ?) RETURNING *"
        )
        .get(tid, user.id, content, useAnonymous) as any;

      // If crisis detected → notify moderator + include crisis info in response
      if (crisis) {
        const group = rawSqlite.prepare("SELECT * FROM support_groups WHERE id = ?").get(gid) as any;
        try {
          rawSqlite
            .prepare(
              `INSERT INTO notifications (user_id, type, title, body, link)
               VALUES (?, 'crisis_detected', '⚠️ Krizový příspěvek detekován', ?, ?)`
            )
            .run(
              group.moderator_id,
              `Ve skupině "${group.name}" byl detekován příspěvek s krizovým obsahem.`,
              `/employee/groups`
            );
        } catch {}
      }

      return reply.status(201).send({ ...post, crisisDetected: crisis });
    }
  );

  // DELETE /groups/:id/topics/:topicId/posts/:postId — moderator hides post
  app.delete<{ Params: { id: string; topicId: string; postId: string } }>(
    "/groups/:id/topics/:topicId/posts/:postId",
    async (req, reply) => {
      const user = (req as any).auth;
      if (!user) return reply.status(401).send({ error: "Unauthorized" });

      const gid = parseInt(req.params.id);
      if (!isModerator(gid, user.id) && user.role !== "ADMIN") {
        return reply.status(403).send({ error: "Forbidden" });
      }

      rawSqlite
        .prepare("UPDATE group_posts SET is_hidden = 1 WHERE id = ? AND topic_id = ?")
        .run(parseInt(req.params.postId), parseInt(req.params.topicId));

      return { message: "Post hidden" };
    }
  );

  // ── REPORTS ───────────────────────────────────────────────────────────────────

  // POST /groups/:id/posts/:postId/report
  app.post<{ Params: { id: string; postId: string } }>(
    "/groups/:id/posts/:postId/report",
    async (req, reply) => {
      const user = (req as any).auth;
      if (!user) return reply.status(401).send({ error: "Unauthorized" });

      const gid = parseInt(req.params.id);
      if (!isMember(gid, user.id) && !isModerator(gid, user.id) && user.role !== "ADMIN") {
        return reply.status(403).send({ error: "Not a member" });
      }

      const body = req.body as any;
      const { reason } = body;
      if (!reason) return reply.status(400).send({ error: "reason is required" });

      const report = rawSqlite
        .prepare(
          "INSERT INTO group_reports (post_id, reporter_id, reason) VALUES (?, ?, ?) RETURNING *"
        )
        .get(parseInt(req.params.postId), user.id, reason) as any;

      // Notify moderator
      try {
        const group = rawSqlite.prepare("SELECT * FROM support_groups WHERE id = ?").get(gid) as any;
        rawSqlite
          .prepare(
            `INSERT INTO notifications (user_id, type, title, body, link)
             VALUES (?, 'group_report', '🚨 Nahlášen příspěvek', ?, ?)`
          )
          .run(
            group.moderator_id,
            `Ve skupině "${group.name}" byl nahlášen příspěvek.`,
            `/employee/groups`
          );
      } catch {}

      return reply.status(201).send(report);
    }
  );

  // GET /groups/:id/reports — moderator sees reports
  app.get<{ Params: { id: string } }>("/groups/:id/reports", async (req, reply) => {
    const user = (req as any).auth;
    if (!user) return reply.status(401).send({ error: "Unauthorized" });

    const gid = parseInt(req.params.id);
    if (!isModerator(gid, user.id) && user.role !== "ADMIN") {
      return reply.status(403).send({ error: "Forbidden" });
    }

    const reports = rawSqlite
      .prepare(
        `SELECT gr.*, gp.content as post_content, u.name as reporter_name,
          gt.id as topic_id, gt.title as topic_title
         FROM group_reports gr
         JOIN group_posts gp ON gp.id = gr.post_id
         JOIN group_topics gt ON gt.id = gp.topic_id
         JOIN users u ON u.id = gr.reporter_id
         WHERE gt.group_id = ? AND gr.status = 'open'
         ORDER BY gr.created_at DESC`
      )
      .all(gid);

    return reports;
  });

  // PATCH /groups/:id/reports/:reportId — resolve report
  app.patch<{ Params: { id: string; reportId: string } }>(
    "/groups/:id/reports/:reportId",
    async (req, reply) => {
      const user = (req as any).auth;
      if (!user) return reply.status(401).send({ error: "Unauthorized" });

      const gid = parseInt(req.params.id);
      if (!isModerator(gid, user.id) && user.role !== "ADMIN") {
        return reply.status(403).send({ error: "Forbidden" });
      }

      const updated = rawSqlite
        .prepare("UPDATE group_reports SET status = 'resolved' WHERE id = ? RETURNING *")
        .get(parseInt(req.params.reportId)) as any;

      if (!updated) return reply.status(404).send({ error: "Report not found" });
      return updated;
    }
  );
}
