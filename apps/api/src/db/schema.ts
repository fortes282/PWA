import {
  sqliteTable,
  text,
  integer,
  real,
  blob,
} from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

// ─── Users ───────────────────────────────────────────────────────────────────
export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  role: text("role", { enum: ["CLIENT", "RECEPTION", "EMPLOYEE", "ADMIN"] })
    .notNull()
    .default("CLIENT"),
  phone: text("phone"),
  avatarUrl: text("avatar_url"),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  behaviorScore: real("behavior_score").notNull().default(100),
  emailEnabled: integer("email_enabled", { mode: "boolean" }).notNull().default(true),
  smsEnabled: integer("sms_enabled", { mode: "boolean" }).notNull().default(false),
  pushEnabled: integer("push_enabled", { mode: "boolean" }).notNull().default(false),
  pushSubscription: text("push_subscription"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
});

// ─── Refresh Tokens ───────────────────────────────────────────────────────────
export const refreshTokens = sqliteTable("refresh_tokens", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: text("expires_at").notNull(),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
});

// ─── Services ─────────────────────────────────────────────────────────────────
export const services = sqliteTable("services", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  description: text("description"),
  durationMin: integer("duration_min").notNull().default(60),
  price: real("price").notNull().default(0),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
});

// ─── Rooms ────────────────────────────────────────────────────────────────────
export const rooms = sqliteTable("rooms", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  description: text("description"),
  capacity: integer("capacity").notNull().default(1),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
});

// ─── Working Hours ────────────────────────────────────────────────────────────
export const workingHours = sqliteTable("working_hours", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  employeeId: integer("employee_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  dayOfWeek: integer("day_of_week").notNull(), // 0=Sun, 1=Mon, ..., 6=Sat
  startTime: text("start_time").notNull(), // "HH:MM"
  endTime: text("end_time").notNull(),   // "HH:MM"
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
});

// ─── Appointments ─────────────────────────────────────────────────────────────
export const appointments = sqliteTable("appointments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  clientId: integer("client_id").notNull().references(() => users.id),
  employeeId: integer("employee_id").notNull().references(() => users.id),
  serviceId: integer("service_id").notNull().references(() => services.id),
  roomId: integer("room_id").references(() => rooms.id),
  startTime: text("start_time").notNull(), // ISO datetime
  endTime: text("end_time").notNull(),
  status: text("status", {
    enum: ["PENDING", "CONFIRMED", "CANCELLED", "COMPLETED", "NO_SHOW"],
  }).notNull().default("PENDING"),
  notes: text("notes"),
  price: real("price"),
  bookingActivated: integer("booking_activated", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
});

// ─── Credits ──────────────────────────────────────────────────────────────────
export const creditTransactions = sqliteTable("credit_transactions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  appointmentId: integer("appointment_id").references(() => appointments.id),
  type: text("type", { enum: ["PURCHASE", "USE", "REFUND", "ADJUSTMENT"] }).notNull(),
  amount: real("amount").notNull(),
  balance: real("balance").notNull(),
  note: text("note"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
});

// ─── Waitlist ─────────────────────────────────────────────────────────────────
export const waitlist = sqliteTable("waitlist", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  clientId: integer("client_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  serviceId: integer("service_id").notNull().references(() => services.id),
  employeeId: integer("employee_id").references(() => users.id),
  preferredDates: text("preferred_dates"), // JSON array
  status: text("status", { enum: ["WAITING", "NOTIFIED", "BOOKED", "CANCELLED"] })
    .notNull()
    .default("WAITING"),
  notifiedAt: text("notified_at"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
});

// ─── Notifications ────────────────────────────────────────────────────────────
export const notifications = sqliteTable("notifications", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: text("type", {
    enum: [
      "APPOINTMENT_CONFIRMED",
      "APPOINTMENT_REMINDER",
      "APPOINTMENT_CANCELLED",
      "WAITLIST_AVAILABLE",
      "INVOICE",
      "GENERAL",
    ],
  }).notNull(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  isRead: integer("is_read", { mode: "boolean" }).notNull().default(false),
  metadata: text("metadata"), // JSON
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
});

// ─── Invoices ─────────────────────────────────────────────────────────────────
export const invoices = sqliteTable("invoices", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  invoiceNumber: text("invoice_number").notNull().unique(),
  clientId: integer("client_id").notNull().references(() => users.id),
  status: text("status", { enum: ["DRAFT", "SENT", "PAID", "OVERDUE", "CANCELLED"] })
    .notNull()
    .default("DRAFT"),
  total: real("total").notNull().default(0),
  dueDate: text("due_date").notNull(),
  paidAt: text("paid_at"),
  notes: text("notes"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
});

export const invoiceItems = sqliteTable("invoice_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  invoiceId: integer("invoice_id").notNull().references(() => invoices.id, { onDelete: "cascade" }),
  description: text("description").notNull(),
  quantity: real("quantity").notNull().default(1),
  unitPrice: real("unit_price").notNull(),
  total: real("total").notNull(),
});

// ─── Medical Reports ──────────────────────────────────────────────────────────
export const medicalReports = sqliteTable("medical_reports", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  clientId: integer("client_id").notNull().references(() => users.id),
  employeeId: integer("employee_id").notNull().references(() => users.id),
  appointmentId: integer("appointment_id").references(() => appointments.id),
  title: text("title").notNull(),
  content: text("content").notNull(), // rich text / JSON
  diagnosis: text("diagnosis"),
  recommendations: text("recommendations"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
});

// ─── Behavior Events ──────────────────────────────────────────────────────────
export const behaviorEvents = sqliteTable("behavior_events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: text("type", {
    enum: ["NO_SHOW", "LATE_CANCEL", "TIMELY_CANCEL", "ON_TIME", "POSITIVE_FEEDBACK"],
  }).notNull(),
  points: real("points").notNull(),
  note: text("note"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
});

// ─── Profile Log ──────────────────────────────────────────────────────────────
export const profileLog = sqliteTable("profile_log", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  changedBy: integer("changed_by").notNull().references(() => users.id),
  field: text("field").notNull(),
  oldValue: text("old_value"),
  newValue: text("new_value"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
});

// ─── FIO Transactions ─────────────────────────────────────────────────────────
export const fioTransactions = sqliteTable("fio_transactions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  fioId: text("fio_id").notNull().unique(),
  amount: real("amount").notNull(),
  currency: text("currency").notNull().default("CZK"),
  variableSymbol: text("variable_symbol"),
  note: text("note"),
  counterAccount: text("counter_account"),
  counterName: text("counter_name"),
  transactionDate: text("transaction_date").notNull(),
  matchedInvoiceId: integer("matched_invoice_id").references(() => invoices.id),
  matchedClientId: integer("matched_client_id").references(() => users.id),
  isMatched: integer("is_matched", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
});
