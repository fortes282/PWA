/**
 * Dashboard aggregation endpoints — single-call summaries for each role.
 *
 * GET /dashboard/reception — today's stats + pending work for reception
 * GET /dashboard/client    — client summary (balance, next appt, unread notifs)
 */
import type { FastifyPluginAsync } from "fastify";
import { db } from "../db/index.js";
import { appointments, users, notifications, waitlist, creditRequests, creditTransactions, invoices } from "../db/schema.js";
import { eq } from "drizzle-orm";

const dashboardRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /dashboard/reception — aggregated reception dashboard data
  fastify.get("/dashboard/reception", async (request, reply) => {
    const { role } = request.auth!;
    if (!["RECEPTION", "ADMIN"].includes(role)) {
      return reply.code(403).send({ error: "Forbidden" });
    }

    const today = new Date().toISOString().slice(0, 10);
    const todayStart = `${today}T00:00:00`;
    const todayEnd = `${today}T23:59:59`;

    const allAppts = await db.select().from(appointments);
    const allUsers = await db.select().from(users);
    const allWaitlist = await db.select().from(waitlist);
    const allCreditRequests = await db.select().from(creditRequests);
    const allNotifications = await db.select().from(notifications);

    const todayAppts = allAppts.filter(
      (a) => a.startTime >= todayStart && a.startTime <= todayEnd && a.status !== "CANCELLED"
    );
    const pendingActivation = allAppts.filter((a) => !a.bookingActivated && a.status === "PENDING");
    const pendingCreditRequests = allCreditRequests.filter((r) => r.status === "PENDING");
    const waitingWaitlist = allWaitlist.filter((w) => w.status === "WAITING");
    const activeClients = allUsers.filter((u) => u.role === "CLIENT" && u.isActive);

    // Today's revenue (completed)
    const todayRevenue = todayAppts
      .filter((a) => a.status === "COMPLETED" && a.price)
      .reduce((s, a) => s + (a.price ?? 0), 0);

    // Unread notifications for reception users
    const receptionUserIds = allUsers
      .filter((u) => u.role === "RECEPTION" || u.role === "ADMIN")
      .map((u) => u.id);
    const unreadNotifications = allNotifications.filter(
      (n) => receptionUserIds.includes(n.userId) && !n.isRead
    );

    // Upcoming appointments today (not yet started)
    const now = new Date().toISOString();
    const upcomingToday = todayAppts
      .filter((a) => a.startTime > now && (a.status === "CONFIRMED" || a.status === "PENDING"))
      .sort((a, b) => a.startTime.localeCompare(b.startTime))
      .slice(0, 5);

    return {
      today,
      counts: {
        todayTotal: todayAppts.length,
        todayConfirmed: todayAppts.filter((a) => a.status === "CONFIRMED").length,
        todayCompleted: todayAppts.filter((a) => a.status === "COMPLETED").length,
        pendingActivation: pendingActivation.length,
        pendingCreditRequests: pendingCreditRequests.length,
        waitingWaitlist: waitingWaitlist.length,
        activeClients: activeClients.length,
        unreadNotifications: unreadNotifications.length,
      },
      todayRevenue,
      upcomingToday,
    };
  });

  // GET /dashboard/client — aggregated client dashboard data
  fastify.get("/dashboard/client", async (request) => {
    const { id } = request.auth!;

    const allAppts = await db.select().from(appointments).where(eq(appointments.clientId, id));
    const allNotifs = await db.select().from(notifications).where(eq(notifications.userId, id));
    const allCreditReqs = await db.select().from(creditRequests).where(eq(creditRequests.clientId, id));

    // Balance
    const txns = await db.select().from(creditTransactions)
      .where(eq(creditTransactions.userId, id));
    txns.sort((a, b) => b.id - a.id);
    const balance = txns[0]?.balance ?? 0;

    // Next appointment
    const now = new Date().toISOString();
    const upcoming = allAppts
      .filter((a) => a.startTime > now && a.status === "CONFIRMED")
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
    const nextAppt = upcoming[0] ?? null;

    // Stats
    const completed = allAppts.filter((a) => a.status === "COMPLETED").length;
    const cancelled = allAppts.filter((a) => a.status === "CANCELLED").length;
    const unreadNotifs = allNotifs.filter((n) => !n.isRead).length;
    const pendingCreditReqs = allCreditReqs.filter((r) => r.status === "PENDING").length;

    return {
      balance,
      nextAppointment: nextAppt,
      stats: {
        completedAppointments: completed,
        cancelledAppointments: cancelled,
        unreadNotifications: unreadNotifs,
        pendingCreditRequests: pendingCreditReqs,
      },
    };
  });
  // GET /dashboard/employee — employee daily summary
  fastify.get("/dashboard/employee", async (request, reply) => {
    const { id, role } = request.auth!;
    if (!["ADMIN", "RECEPTION", "EMPLOYEE"].includes(role)) {
      return reply.code(403).send({ error: "Forbidden" });
    }

    const empId = id; // employee sees own data
    const now = new Date();
    const today = now.toISOString().slice(0, 10);

    const allAppts = await db.select().from(appointments);
    const myAppts = allAppts.filter((a) => role === "EMPLOYEE" ? a.employeeId === empId : true);

    const todayAppts = myAppts.filter((a) => a.startTime.startsWith(today) && a.status !== "CANCELLED");
    const upcoming = myAppts.filter((a) => a.startTime > now.toISOString() && a.status === "CONFIRMED");
    const nextAppt = upcoming.sort((a, b) => a.startTime.localeCompare(b.startTime))[0] ?? null;

    const completed = myAppts.filter((a) => a.status === "COMPLETED").length;
    const noShows = myAppts.filter((a) => a.status === "NO_SHOW").length;
    const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const weekCompleted = myAppts.filter((a) => a.status === "COMPLETED" && a.startTime >= weekStart).length;

    const allNotifs = await db.select().from(notifications).where(eq(notifications.userId, empId));
    const unreadNotifs = allNotifs.filter((n) => !n.isRead).length;

    return {
      today: today,
      todayApptCount: todayAppts.length,
      nextAppointment: nextAppt,
      stats: {
        completedAllTime: completed,
        noShows,
        weekCompleted,
        unreadNotifications: unreadNotifs,
      },
    };
  });
  // GET /dashboard/admin/pending — ADMIN only — pending items summary
  fastify.get("/dashboard/admin/pending", async (request, reply) => {
    const { role } = request.auth!;
    if (role !== "ADMIN") return reply.code(403).send({ error: "Forbidden" });

    const allAppts = await db.select().from(appointments);
    const allInvoices = await db.select().from(invoices);
    const allWaitlist = await db.select().from(waitlist);
    const allUsers = await db.select().from(users);

    const pendingActivations = allAppts.filter((a) => a.status === "PENDING").length;
    const overdueInvoices = allInvoices.filter((i) => i.status === "OVERDUE").length;
    const waitlistCount = allWaitlist.filter((w) => w.status === "WAITING").length;
    const lowBehaviorClients = allUsers.filter((u) => u.role === "CLIENT" && u.behaviorScore < 50).length;

    return { pendingActivations, overdueInvoices, waitlistCount, lowBehaviorClients };
  });
};

export default dashboardRoutes;
