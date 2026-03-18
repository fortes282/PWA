import type { FastifyPluginAsync } from "fastify";
import { db } from "../db/index.js";
import { users, profileLog } from "../db/schema.js";
import { eq, like, and, ne } from "drizzle-orm";
import { UpdateUserSchema } from "@pristav/shared";
import { hashPassword, verifyPassword } from "../utils/hash.js";
import { logAudit } from "./audit.js";
import { userSchemas } from "../utils/swagger-schemas.js";

const usersRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /users — Admin/Reception only
  fastify.get("/users", { schema: userSchemas.list }, async (request, reply) => {
    const { role } = request.auth!;
    // EMPLOYEE can only query CLIENT and EMPLOYEE lists (for their own UI needs)
    if (!["ADMIN", "RECEPTION", "EMPLOYEE"].includes(role)) {
      return reply.code(403).send({ error: "Forbidden" });
    }
    const query = (request.query as { search?: string; role?: string });
    let allUsers = await db.select().from(users);

    // EMPLOYEE can only see CLIENT and EMPLOYEE lists (not ADMIN/RECEPTION sensitive data)
    if (role === "EMPLOYEE") {
      const allowedRoles = ["CLIENT", "EMPLOYEE"];
      allUsers = allUsers.filter((u) => allowedRoles.includes(u.role));
    }

    if (query.search) {
      allUsers = allUsers.filter(
        (u) =>
          u.name.toLowerCase().includes(query.search!.toLowerCase()) ||
          u.email.toLowerCase().includes(query.search!.toLowerCase())
      );
    }
    if (query.role) {
      allUsers = allUsers.filter((u) => u.role === query.role);
    }

    return allUsers.map(({ passwordHash, pushSubscription, ...u }) => u);
  });

  // GET /users/:id
  fastify.get<{ Params: { id: string } }>("/users/:id", async (request, reply) => {
    const targetId = parseInt(request.params.id);
    const { id, role } = request.auth!;

    // Clients can only view themselves
    if (role === "CLIENT" && id !== targetId) {
      return reply.code(403).send({ error: "Forbidden" });
    }

    const [user] = await db.select().from(users).where(eq(users.id, targetId)).limit(1);
    if (!user) return reply.code(404).send({ error: "User not found" });

    const { passwordHash, pushSubscription, ...safe } = user;
    return safe;
  });

  // POST /users — Admin/Reception only (create user)
  fastify.post("/users", { schema: userSchemas.create }, async (request, reply) => {
    const { id: requesterId, role } = request.auth!;
    if (!["ADMIN", "RECEPTION"].includes(role)) {
      return reply.code(403).send({ error: "Forbidden" });
    }

    const body = request.body as {
      email: string;
      password: string;
      name: string;
      role?: string;
      phone?: string;
    };

    if (!body.email || !body.password || !body.name) {
      return reply.code(400).send({ error: "email, password and name are required" });
    }

    const existing = await db.select().from(users).where(eq(users.email, body.email)).limit(1);
    if (existing.length > 0) {
      return reply.code(409).send({ error: "Email already in use" });
    }

    const passwordHash = hashPassword(body.password);
    const [newUser] = await db.insert(users).values({
      email: body.email,
      passwordHash,
      name: body.name,
      role: (body.role ?? "CLIENT") as any,
      phone: body.phone ?? null,
    }).returning();

    logAudit(db, requesterId, "USER_CREATED", { targetId: newUser.id, targetType: "User" });

    reply.code(201);
    const { passwordHash: _, pushSubscription, ...safe } = newUser;
    return safe;
  });

  // PATCH /users/:id
  fastify.patch<{ Params: { id: string } }>("/users/:id", async (request, reply) => {
    const targetId = parseInt(request.params.id);
    const { id, role } = request.auth!;

    if (role === "CLIENT" && id !== targetId) {
      return reply.code(403).send({ error: "Forbidden" });
    }

    const result = UpdateUserSchema.safeParse(request.body);
    if (!result.success) {
      return reply.code(400).send({ error: result.error.flatten() });
    }

    // Log changes
    const [current] = await db.select().from(users).where(eq(users.id, targetId)).limit(1);
    if (!current) return reply.code(404).send({ error: "User not found" });

    const changes = result.data;
    const logEntries = Object.entries(changes)
      .filter(([key, val]) => current[key as keyof typeof current] !== val)
      .map(([field, newValue]) => ({
        userId: targetId,
        changedBy: id,
        field,
        oldValue: String(current[field as keyof typeof current] ?? ""),
        newValue: String(newValue),
      }));

    if (logEntries.length > 0) {
      await db.insert(profileLog).values(logEntries);
    }

    const updated = await db
      .update(users)
      .set({ ...changes, updatedAt: new Date().toISOString() })
      .where(eq(users.id, targetId))
      .returning();

    logAudit(db, id, "USER_UPDATED", { targetId: targetId, targetType: "User" });

    const { passwordHash, pushSubscription, ...safe } = updated[0]!;
    return safe;
  });

  // GET /users/:id/profile-log
  fastify.get<{ Params: { id: string } }>("/users/:id/profile-log", async (request, reply) => {
    const targetId = parseInt(request.params.id);
    const { id, role } = request.auth!;

    if (role === "CLIENT" && id !== targetId) {
      return reply.code(403).send({ error: "Forbidden" });
    }

    return db.select().from(profileLog).where(eq(profileLog.userId, targetId));
  });

  // PATCH /users/:id/password — change own password (or admin changes any)
  fastify.patch<{ Params: { id: string } }>("/users/:id/password", async (request, reply) => {
    const targetId = parseInt(request.params.id);
    const { id, role } = request.auth!;

    if (role !== "ADMIN" && id !== targetId) {
      return reply.code(403).send({ error: "Forbidden" });
    }

    const { currentPassword, newPassword } = request.body as { currentPassword?: string; newPassword: string };

    if (!newPassword || newPassword.length < 8) {
      return reply.code(400).send({ error: "Nové heslo musí mít alespoň 8 znaků" });
    }

    const [user] = await db.select().from(users).where(eq(users.id, targetId)).limit(1);
    if (!user) return reply.code(404).send({ error: "User not found" });

    // Non-admin must verify current password
    if (role !== "ADMIN") {
      if (!currentPassword) return reply.code(400).send({ error: "Vyžadováno aktuální heslo" });
      const valid = verifyPassword(currentPassword, user.passwordHash);
      if (!valid) return reply.code(401).send({ error: "Aktuální heslo je nesprávné" });
    }

    const newHash = hashPassword(newPassword);
    await db.update(users)
      .set({ passwordHash: newHash, updatedAt: new Date().toISOString() })
      .where(eq(users.id, targetId));

    return { ok: true, message: "Heslo bylo úspěšně změněno" };
  });

  // PATCH /users/:id/role — Admin only
  fastify.patch<{ Params: { id: string } }>("/users/:id/role", async (request, reply) => {
    if (request.auth!.role !== "ADMIN") {
      return reply.code(403).send({ error: "Forbidden" });
    }
    const { role } = request.body as { role: string };
    const valid = ["CLIENT", "RECEPTION", "EMPLOYEE", "ADMIN"];
    if (!valid.includes(role)) {
      return reply.code(400).send({ error: "Invalid role" });
    }

    await db.update(users).set({ role: role as any, updatedAt: new Date().toISOString() })
      .where(eq(users.id, parseInt(request.params.id)));

    return { ok: true };
  });

  // DELETE /users/:id — Admin only (soft delete / deactivate)
  fastify.delete<{ Params: { id: string } }>("/users/:id", async (request, reply) => {
    if (request.auth!.role !== "ADMIN") {
      return reply.code(403).send({ error: "Forbidden" });
    }
    const targetId = parseInt(request.params.id);
    const [target] = await db.select().from(users).where(eq(users.id, targetId)).limit(1);
    if (!target) return reply.code(404).send({ error: "User not found" });
    if (target.role === "ADMIN") return reply.code(403).send({ error: "Cannot deactivate admin" });

    await db.update(users).set({ isActive: false, updatedAt: new Date().toISOString() })
      .where(eq(users.id, targetId));
    logAudit(db, request.auth!.id, "USER_DELETED", { targetId: targetId, targetType: "User" });
    return { ok: true };
  });

  // POST /users/:id/reactivate — Admin only (re-enable deactivated user)
  fastify.post<{ Params: { id: string } }>("/users/:id/reactivate", async (request, reply) => {
    if (request.auth!.role !== "ADMIN") {
      return reply.code(403).send({ error: "Forbidden" });
    }
    const targetId = parseInt(request.params.id);
    const [target] = await db.select().from(users).where(eq(users.id, targetId)).limit(1);
    if (!target) return reply.code(404).send({ error: "User not found" });
    if (target.isActive) return reply.code(400).send({ error: "User is already active" });

    await db.update(users).set({ isActive: true, updatedAt: new Date().toISOString() })
      .where(eq(users.id, targetId));
    logAudit(db, request.auth!.id, "USER_REACTIVATED", { targetId: targetId });
    return { ok: true };
  });

  // GET /users/me — current user profile (shortcut, any authenticated role)
  // NOTE: registered AFTER /users/:id to avoid conflicting with id="me"
  fastify.get("/users/me", async (request) => {
    const { id } = request.auth!;
    const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
    if (!user) return {};
    const { passwordHash, pushSubscription, ...safe } = user;
    return safe;
  });

  // GET /users/export/csv — export clients list as CSV (ADMIN/RECEPTION)
  fastify.get("/users/export/csv", async (request, reply) => {
    const { role } = request.auth!;
    if (!["ADMIN", "RECEPTION"].includes(role)) {
      return reply.code(403).send({ error: "Forbidden" });
    }

    const q = request.query as { role?: string; active?: string };
    let allUsers = await db.select().from(users);

    // Filter by role
    if (q.role) {
      allUsers = allUsers.filter((u) => u.role === q.role);
    } else {
      // Default: export only clients
      allUsers = allUsers.filter((u) => u.role === "CLIENT");
    }

    // Filter active
    if (q.active === "true") allUsers = allUsers.filter((u) => u.isActive);
    if (q.active === "false") allUsers = allUsers.filter((u) => !u.isActive);

    const escape = (v: unknown) => {
      const s = v == null ? "" : String(v);
      return s.includes(",") || s.includes('"') || s.includes("\n")
        ? `"${s.replace(/"/g, '""')}"`
        : s;
    };

    const header = ["ID", "Jméno", "Email", "Telefon", "Role", "Aktivní", "Behavior skóre",
      "Email notif.", "SMS notif.", "Push notif.", "Registrace"].join(",");

    const rows = allUsers.map((u) => [
      u.id, u.name, u.email, u.phone ?? "", u.role,
      u.isActive ? "ANO" : "NE", u.behaviorScore,
      u.emailEnabled ? "ANO" : "NE",
      u.smsEnabled ? "ANO" : "NE",
      u.pushEnabled ? "ANO" : "NE",
      u.createdAt,
    ].map(escape).join(","));

    const csv = [header, ...rows].join("\n");
    const roleLabel = q.role ? q.role.toLowerCase() : "clients";
    const filename = `users-${roleLabel}-${new Date().toISOString().slice(0, 10)}.csv`;

    reply
      .header("Content-Type", "text/csv; charset=utf-8")
      .header("Content-Disposition", `attachment; filename="${filename}"`)
      .send("\uFEFF" + csv);
  });

  // GET /clients — shortcut: returns all active CLIENT users (ADMIN/RECEPTION/EMPLOYEE)
  fastify.get("/clients", async (request, reply) => {
    const { role } = request.auth!;
    if (!["ADMIN", "RECEPTION", "EMPLOYEE"].includes(role)) {
      return reply.code(403).send({ error: "Forbidden" });
    }
    const allUsers = await db.select().from(users);
    return allUsers
      .filter((u) => u.role === "CLIENT" && u.isActive)
      .map(({ passwordHash, pushSubscription, ...u }) => u);
  });

  // GET /employees — shortcut: returns all active EMPLOYEE users (any authenticated role)
  fastify.get("/employees", async (request) => {
    const allUsers = await db.select().from(users);
    return allUsers
      .filter((u) => u.role === "EMPLOYEE" && u.isActive)
      .map(({ passwordHash, pushSubscription, ...u }) => u);
  });

  /**
   * PATCH /users/me/avatar — upload avatar as base64 data URL
   * Body: { avatar: "data:image/jpeg;base64,..." }
   * Saves to /data/avatars/<userId>.<ext>, stores URL in users.avatar_url
   */
  fastify.patch<{ Body: { avatar: string } }>(
    "/users/me/avatar",
    async (request, reply) => {
      const { id } = request.auth!;
      const { avatar } = request.body as { avatar: string };

      if (!avatar || typeof avatar !== "string") {
        return reply.code(400).send({ error: "avatar (base64 data URL) je povinný" });
      }

      // Parse data URL: data:<mime>;base64,<data>
      const match = avatar.match(/^data:(image\/(jpeg|jpg|png|webp|gif));base64,(.+)$/);
      if (!match) {
        return reply.code(400).send({ error: "Neplatný formát obrázku. Podporované: jpeg, png, webp, gif" });
      }

      const ext = match[2] === "jpeg" ? "jpg" : match[2];
      const base64Data = match[3];
      const buffer = Buffer.from(base64Data, "base64");

      // Limit: 2 MB
      if (buffer.length > 2 * 1024 * 1024) {
        return reply.code(400).send({ error: "Obrázek je příliš velký. Maximum je 2 MB." });
      }

      // Save to disk
      const { mkdirSync, writeFileSync } = await import("fs");
      const { join } = await import("path");
      const dataDir = process.env.DATA_DIR || join(process.cwd(), "data");
      const avatarDir = join(dataDir, "avatars");
      mkdirSync(avatarDir, { recursive: true });

      const filename = `${id}.${ext}`;
      const filepath = join(avatarDir, filename);
      writeFileSync(filepath, buffer);

      // Store URL in DB (served via /avatars/<filename> static route)
      const avatarUrl = `/avatars/${filename}`;
      await db.update(users).set({ avatarUrl, updatedAt: new Date().toISOString() }).where(eq(users.id, id));

      return { avatarUrl };
    }
  );

  // DELETE /users/me/avatar — remove own avatar
  fastify.delete("/users/me/avatar", async (request, reply) => {
    const { id } = request.auth!;
    await db.update(users).set({ avatarUrl: null, updatedAt: new Date().toISOString() }).where(eq(users.id, id));

    // Remove file if exists
    try {
      const { readdirSync, unlinkSync } = await import("fs");
      const { join } = await import("path");
      const dataDir = process.env.DATA_DIR || join(process.cwd(), "data");
      const avatarDir = join(dataDir, "avatars");
      const files = readdirSync(avatarDir).filter((f) => f.startsWith(`${id}.`));
      for (const f of files) unlinkSync(join(avatarDir, f));
    } catch {
      // File not found — OK
    }

    return { ok: true };
  });
};

export default usersRoutes;
