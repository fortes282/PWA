import {
  sqliteTable,
  text,
  integer,
  real,
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
  // 2FA TOTP
  totpSecret: text("totp_secret"),
  totpEnabled: integer("totp_enabled", { mode: "boolean" }).notNull().default(false),
  totpBackupCodes: text("totp_backup_codes"), // JSON array of hashed backup codes
  // GDPR
  gdprHealthConsentGranted: integer("gdpr_health_consent_granted", { mode: "boolean" }).notNull().default(false),
  gdprHealthConsentAt: text("gdpr_health_consent_at"),
  gdprAnonymizedAt: text("gdpr_anonymized_at"),
  lastReengagementAt: text("last_reengagement_at"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
});

// ─── GDPR Consent ────────────────────────────────────────────────────────────
export const gdprConsents = sqliteTable("gdpr_consents", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  consentType: text("consent_type").notNull(), // 'health_data', 'marketing', etc.
  granted: integer("granted", { mode: "boolean" }).notNull().default(false),
  grantedAt: text("granted_at"),
  revokedAt: text("revoked_at"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
});

// ─── Health Record Access Log (GDPR) ─────────────────────────────────────────
export const healthRecordAccessLog = sqliteTable("health_record_access_log", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  accessorId: integer("accessor_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  clientId: integer("client_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  action: text("action").notNull(), // 'READ', 'UPDATE', 'DELETE'
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
});

// ─── GDPR Erasure Requests ────────────────────────────────────────────────────
export const gdprErasureRequests = sqliteTable("gdpr_erasure_requests", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  clientId: integer("client_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  requestedBy: integer("requested_by").notNull().references(() => users.id),
  status: text("status", { enum: ["PENDING", "COMPLETED"] }).notNull().default("PENDING"),
  completedAt: text("completed_at"),
  completedBy: integer("completed_by").references(() => users.id),
  notes: text("notes"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
});

// ─── Refresh Tokens ───────────────────────────────────────────────────────────
export const refreshTokens = sqliteTable("refresh_tokens", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: text("expires_at").notNull(),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
});

// ─── Password Resets ─────────────────────────────────────────────────────────
export const passwordResets = sqliteTable("password_resets", {
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
  category: text("category"),
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
  cancellationReason: text("cancellation_reason"),
  price: real("price"),
  bookingActivated: integer("booking_activated", { mode: "boolean" }).notNull().default(false),
  clientNote: text("client_note"),
  isOnline: integer("is_online", { mode: "boolean" }).notNull().default(false),
  cancellationRiskScore: real("cancellation_risk_score"),
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
  paymentMethod: text("payment_method"),
  paymentPaidAt: integer("payment_paid_at"),
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

// ─── Health Records ───────────────────────────────────────────────────────────
export const healthRecords = sqliteTable("health_records", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  clientId: integer("client_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  // General health info
  bloodType: text("blood_type"),
  allergies: text("allergies"),             // free text
  contraindications: text("contraindications"), // free text
  medications: text("medications"),         // free text
  chronicConditions: text("chronic_conditions"), // free text
  // Emergency contact
  emergencyContactName: text("emergency_contact_name"),
  emergencyContactPhone: text("emergency_contact_phone"),
  emergencyContactRelation: text("emergency_contact_relation"),
  // Rehab-specific
  primaryDiagnosis: text("primary_diagnosis"),
  functionalStatus: text("functional_status"), // free text summary
  rehabGoals: text("rehab_goals"),          // free text
  notes: text("notes"),
  lastUpdatedBy: integer("last_updated_by").references(() => users.id),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
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

// ─── Credit Requests ─────────────────────────────────────────────────────────
export const creditRequests = sqliteTable("credit_requests", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  clientId: integer("client_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  amount: real("amount").notNull(),
  note: text("note"),
  status: text("status", { enum: ["PENDING", "APPROVED", "REJECTED"] })
    .notNull()
    .default("PENDING"),
  reviewedBy: integer("reviewed_by").references(() => users.id),
  reviewNote: text("review_note"),
  reviewedAt: text("reviewed_at"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
});

// ─── System Settings ──────────────────────────────────────────────────────────
export const systemSettings = sqliteTable("system_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
});

// ─── Appointment Series ───────────────────────────────────────────────────────
export const appointmentSeries = sqliteTable("appointment_series", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  employeeId: integer("employee_id").notNull().references(() => users.id),
  clientId: integer("client_id").notNull().references(() => users.id),
  serviceId: integer("service_id").notNull().references(() => services.id),
  roomId: integer("room_id").references(() => rooms.id),
  startTime: text("start_time").notNull(), // HH:MM
  dayOfWeek: integer("day_of_week").notNull(), // 0-6
  frequency: text("frequency", { enum: ["WEEKLY", "BIWEEKLY"] }).notNull().default("WEEKLY"),
  startDate: text("start_date").notNull(), // YYYY-MM-DD
  endDate: text("end_date"), // nullable
  status: text("status", { enum: ["ACTIVE", "CANCELLED"] }).notNull().default("ACTIVE"),
  notes: text("notes"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
});

// ─── Time Off Blocks ──────────────────────────────────────────────────────────
export const timeOffBlocks = sqliteTable("time_off_blocks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  employeeId: integer("employee_id").notNull().references(() => users.id),
  startDateTime: text("start_date_time").notNull(),
  endDateTime: text("end_date_time").notNull(),
  reason: text("reason"),
  createdBy: integer("created_by").notNull().references(() => users.id),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
});

// ─── Loyalty Points ───────────────────────────────────────────────────────────
export const loyaltyPoints = sqliteTable("loyalty_points", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  points: integer("points").notNull(),
  reason: text("reason").notNull(),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
});

// ─── Appointment Templates ────────────────────────────────────────────────────
export const appointmentTemplates = sqliteTable("appointment_templates", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  serviceId: integer("service_id").notNull().references(() => services.id),
  employeeId: integer("employee_id").references(() => users.id),
  roomId: integer("room_id").references(() => rooms.id),
  durationMinutes: integer("duration_minutes").notNull().default(60),
  notes: text("notes"),
  createdBy: integer("created_by").notNull().references(() => users.id),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
});

// ─── Health Goals ─────────────────────────────────────────────────────────────
export const healthGoals = sqliteTable("health_goals", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  clientId: integer("client_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  targetDate: text("target_date"),
  status: text("status", { enum: ["active", "achieved", "abandoned"] }).notNull().default("active"),
  employeeNotes: text("employee_notes"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
});

// ─── Direct Messages ──────────────────────────────────────────────────────────
export const messages = sqliteTable("messages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  fromUserId: integer("from_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  toUserId: integer("to_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  isRead: integer("is_read", { mode: "boolean" }).notNull().default(false),
  parentId: integer("parent_id"), // for threading (self-reference)
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
});

// ─── Appointment Ratings ──────────────────────────────────────────────────────
export const appointmentRatings = sqliteTable("appointment_ratings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  appointmentId: integer("appointment_id").notNull().references(() => appointments.id, { onDelete: "cascade" }),
  clientId: integer("client_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  rating: integer("rating").notNull(), // 1–5
  comment: text("comment"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
});

// ─── Staff Client Notes ───────────────────────────────────────────────────────
export const clientStaffNotes = sqliteTable("client_staff_notes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  clientId: integer("client_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  authorId: integer("author_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  note: text("note").notNull(),
  isPrivate: integer("is_private", { mode: "boolean" }).notNull().default(false), // true = only ADMIN
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
});

// ─── Service Packages ─────────────────────────────────────────────────────────
export const servicePackages = sqliteTable("service_packages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  description: text("description"),
  serviceId: integer("service_id").references(() => services.id),
  sessionsCount: integer("sessions_count").notNull().default(1),
  price: real("price").notNull().default(0),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
});

export const clientPackages = sqliteTable("client_packages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  clientId: integer("client_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  packageId: integer("package_id").notNull().references(() => servicePackages.id),
  sessionsTotal: integer("sessions_total").notNull(),
  sessionsUsed: integer("sessions_used").notNull().default(0),
  purchasedAt: text("purchased_at").notNull().default(sql`(datetime('now'))`),
  expiresAt: text("expires_at"),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
});

// ─── Pending Bookings (public online booking) ─────────────────────────────────
export const pendingBookings = sqliteTable("pending_bookings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  serviceId: integer("service_id").references(() => services.id),
  slotDate: text("slot_date").notNull(),
  slotTime: text("slot_time").notNull(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  note: text("note"),
  status: text("status", { enum: ["PENDING", "APPROVED", "REJECTED"] }).notNull().default("PENDING"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
});

// ─── Audit Log ────────────────────────────────────────────────────────────────
// ─── API Keys ───────────────────────────────────────────────────────────────
export const apiKeys = sqliteTable("api_keys", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  keyHash: text("key_hash").notNull().unique(),
  prefix: text("prefix").notNull(),
  scopes: text("scopes").notNull().default("[]"),
  lastUsedAt: text("last_used_at"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  expiresAt: text("expires_at"),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdBy: integer("created_by").references(() => users.id),
});

// ─── Login History ──────────────────────────────────────────────────────────
export const loginHistory = sqliteTable("login_history", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  ip: text("ip"),
  userAgent: text("user_agent"),
  success: integer("success", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
});

// ─── Emergency Contacts ───────────────────────────────────────────────────────
export const emergencyContacts = sqliteTable("emergency_contacts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  description: text("description"),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
});

// ─── SOS Activations Audit ────────────────────────────────────────────────────
export const sosActivations = sqliteTable("sos_activations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  ipAddress: text("ip_address"),
  alertsSent: integer("alerts_sent").notNull().default(0),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
});

// ─── Therapy Report Templates ─────────────────────────────────────────────────
export const therapyTemplates = sqliteTable("therapy_templates", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  category: text("category").notNull(), // 'intake', 'progress', 'final', 'cognitive'
  structure: text("structure").notNull(), // JSON — sections with fields
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdBy: integer("created_by").references(() => users.id),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
});

// ─── Therapy Reports (filled templates) ──────────────────────────────────────
export const therapyReports = sqliteTable("therapy_reports", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  templateId: integer("template_id").references(() => therapyTemplates.id),
  clientId: integer("client_id").notNull().references(() => users.id),
  therapistId: integer("therapist_id").notNull().references(() => users.id),
  appointmentId: integer("appointment_id").references(() => appointments.id),
  title: text("title").notNull(),
  data: text("data").notNull(), // JSON — filled form data
  status: text("status", { enum: ["DRAFT", "FINAL"] }).notNull().default("DRAFT"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
});

// ─── Notification Preferences ─────────────────────────────────────────────────
export const notificationPreferences = sqliteTable("notification_preferences", {
  userId: integer("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  emailReminders: integer("email_reminders", { mode: "boolean" }).notNull().default(true),
  smsReminders: integer("sms_reminders", { mode: "boolean" }).notNull().default(true),
  pushReminders: integer("push_reminders", { mode: "boolean" }).notNull().default(true),
});

// ─── Notification Log (outbound reminders: email/SMS/push) ───────────────────
export const notificationLog = sqliteTable("notification_log", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  appointmentId: integer("appointment_id").references(() => appointments.id),
  userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
  channel: text("channel", { enum: ["email", "sms", "push", "inapp"] }).notNull(),
  window: text("window").notNull(), // '24h' | '2h'
  status: text("status", { enum: ["sent", "failed", "skipped"] }).notNull().default("sent"),
  detail: text("detail"), // extra info (error msg, recipient, etc.)
  sentAt: text("sent_at").notNull().default(sql`(datetime('now'))`),
});

// ─── Audit Log ────────────────────────────────────────────────────────────────
export const auditLog = sqliteTable("audit_log", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
  action: text("action").notNull(),
  targetId: integer("target_id"),
  targetType: text("target_type"),
  details: text("details"),
  ip: text("ip"),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});
