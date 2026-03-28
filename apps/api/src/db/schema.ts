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
  // Insurance
  insuranceCompanyId: integer("insurance_company_id"),
  insuranceNumber: text("insurance_number"),
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

// ─── Rooms (DEPRECATED — commented out, kept for migration reference) ────────
// export const rooms = sqliteTable("rooms", {
//   id: integer("id").primaryKey({ autoIncrement: true }),
//   name: text("name").notNull(),
//   description: text("description"),
//   capacity: integer("capacity").notNull().default(1),
//   isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
//   createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
//   updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
// });

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
  // roomId: integer("room_id").references(() => rooms.id), // DEPRECATED — rooms removed
  slotId: integer("slot_id").references(() => openSlots.id),
  isOutOfSlot: integer("is_out_of_slot", { mode: "boolean" }).notNull().default(false),
  startTime: text("start_time").notNull(), // ISO datetime
  endTime: text("end_time").notNull(),
  status: text("status", {
    enum: ["PENDING", "CONFIRMED", "CANCELLED", "COMPLETED", "UNJUSTIFIED_CANCEL"],
  }).notNull().default("PENDING"),
  notes: text("notes"),
  cancellationReason: text("cancellation_reason"),
  price: real("price"),
  paidAt: text("paid_at"),
  paymentMethod: text("payment_method", { enum: ["CREDIT", "INVOICE", "CASH", "BANK_TRANSFER"] }),
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
  invoiceId: integer("invoice_id").references(() => invoices.id),
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
  invoiceType: text("invoice_type", { enum: ["THERAPY_INVOICE", "PRICE_QUOTE", "FOUNDATION_INVOICE", "GENERAL"] }).notNull().default("GENERAL"),
  status: text("status", { enum: ["DRAFT", "SENT", "PAID", "OVERDUE", "CANCELLED"] })
    .notNull()
    .default("DRAFT"),
  total: real("total").notNull().default(0),
  dueDate: text("due_date").notNull(),
  paidAt: text("paid_at"),
  notes: text("notes"),
  paymentMethod: text("payment_method"),
  paymentPaidAt: integer("payment_paid_at"),
  foundationNotifiedAt: text("foundation_notified_at"),
  reminderSentAt: text("reminder_sent_at"),
  reminderCount: integer("reminder_count").notNull().default(0),
  sourceMonth: text("source_month"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
});

export const invoiceItems = sqliteTable("invoice_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  invoiceId: integer("invoice_id").notNull().references(() => invoices.id, { onDelete: "cascade" }),
  appointmentId: integer("appointment_id").references(() => appointments.id),
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
    enum: ["UNJUSTIFIED_CANCEL", "LATE_CANCEL", "TIMELY_CANCEL", "ON_TIME", "POSITIVE_FEEDBACK"],
  }).notNull(),
  points: real("points").notNull(),
  note: text("note"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
});

// ─── Intensive Blocks ─────────────────────────────────────────────────────────
export const intensiveBlocks = sqliteTable("intensive_blocks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  description: text("description"),
  startDate: text("start_date").notNull(), // "YYYY-MM-DD"
  endDate: text("end_date").notNull(),     // "YYYY-MM-DD"
  maxParticipants: integer("max_participants").notNull().default(10),
  pricePerPerson: real("price_per_person").notNull(),
  includesAccommodation: integer("includes_accommodation", { mode: "boolean" }).notNull().default(false),
  accommodationDetails: text("accommodation_details"),
  mealPlan: text("meal_plan"), // e.g. "Polopenze", "Plná penze"
  programDetails: text("program_details"), // JSON string with daily schedule
  employeeId: integer("employee_id").notNull().references(() => users.id),
  serviceId: integer("service_id").references(() => services.id),
  status: text("status", {
    enum: ["DRAFT", "PUBLISHED", "FULL", "CANCELLED", "COMPLETED"],
  }).notNull().default("DRAFT"),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
});

// ─── Intensive Block Enrollments ──────────────────────────────────────────────
export const intensiveBlockEnrollments = sqliteTable("intensive_block_enrollments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  blockId: integer("block_id").notNull().references(() => intensiveBlocks.id, { onDelete: "cascade" }),
  clientId: integer("client_id").notNull().references(() => users.id),
  status: text("status", {
    enum: ["ENROLLED", "CANCELLED", "WAITLIST"],
  }).notNull().default("ENROLLED"),
  paymentStatus: text("payment_status", {
    enum: ["PENDING", "PAID", "REFUNDED"],
  }).notNull().default("PENDING"),
  notes: text("notes"),
  enrolledAt: text("enrolled_at").notNull().default(sql`(datetime('now'))`),
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
  // roomId: integer("room_id").references(() => rooms.id), // DEPRECATED — rooms removed
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
  // roomId: integer("room_id").references(() => rooms.id), // DEPRECATED — rooms removed
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

// ─── Service Packages (DEPRECATED — commented out, kept for migration reference) ──
// export const servicePackages = sqliteTable("service_packages", {
//   id: integer("id").primaryKey({ autoIncrement: true }),
//   name: text("name").notNull(),
//   description: text("description"),
//   serviceId: integer("service_id").references(() => services.id),
//   sessionsCount: integer("sessions_count").notNull().default(1),
//   price: real("price").notNull().default(0),
//   isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
//   createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
//   updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
// });

// export const clientPackages = sqliteTable("client_packages", {
//   id: integer("id").primaryKey({ autoIncrement: true }),
//   clientId: integer("client_id").notNull().references(() => users.id, { onDelete: "cascade" }),
//   packageId: integer("package_id").notNull().references(() => servicePackages.id),
//   sessionsTotal: integer("sessions_total").notNull(),
//   sessionsUsed: integer("sessions_used").notNull().default(0),
//   purchasedAt: text("purchased_at").notNull().default(sql`(datetime('now'))`),
//   expiresAt: text("expires_at"),
//   isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
// });

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

// ─── Insurance Companies ─────────────────────────────────────────────────────
export const insuranceCompanies = sqliteTable("insurance_companies", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  code: text("code").notNull().unique(), // "111", "207", etc.
  name: text("name").notNull(),
  contactEmail: text("contact_email"),
  contactPhone: text("contact_phone"),
  contractNotes: text("contract_notes"),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
});

// ─── Insurance Procedures ────────────────────────────────────────────────────
export const insuranceProcedures = sqliteTable("insurance_procedures", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  code: text("code").notNull().unique(), // VZP výkonový kód, e.g. "906"
  name: text("name").notNull(),
  points: real("points").notNull().default(0),
  pointPrice: real("point_price").notNull().default(1.0), // Kč per bod
  maxPerDay: integer("max_per_day"),
  maxPerMonth: integer("max_per_month"),
  timeUnitMin: integer("time_unit_min"),
  maxUnitsPerSession: integer("max_units_per_session"),
  regulationCode: text("regulation_code"),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
});

// ─── Service → Procedure Mapping ─────────────────────────────────────────────
export const serviceProcedureMapping = sqliteTable("service_procedure_mapping", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  serviceId: integer("service_id").notNull().references(() => services.id, { onDelete: "cascade" }),
  procedureId: integer("procedure_id").notNull().references(() => insuranceProcedures.id, { onDelete: "cascade" }),
});

// ─── Insurance Claims ────────────────────────────────────────────────────────
export const insuranceClaims = sqliteTable("insurance_claims", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  appointmentId: integer("appointment_id").notNull().references(() => appointments.id, { onDelete: "cascade" }),
  procedureId: integer("procedure_id").notNull().references(() => insuranceProcedures.id),
  clientId: integer("client_id").references(() => users.id),
  employeeId: integer("employee_id").references(() => users.id),
  batchId: integer("batch_id"), // references insurance_batches.id (set after batch creation)
  status: text("status", {
    enum: ["UNBILLED", "GENERATED", "SENT", "PAID", "REJECTED"],
  }).notNull().default("UNBILLED"),
  amount: real("amount").notNull().default(0),
  timeUnits: integer("time_units"),
  diagnosis: text("diagnosis"), // ICD-10 code, e.g. "F33"
  procedureDate: text("procedure_date"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
});

// ─── Insurance Batches ───────────────────────────────────────────────────────
export const insuranceBatches = sqliteTable("insurance_batches", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  insuranceCompanyId: integer("insurance_company_id").notNull().references(() => insuranceCompanies.id),
  period: text("period").notNull(), // "2024-03" (YYYY-MM)
  xmlContent: text("xml_content"), // generated DASTA XML
  status: text("status", {
    enum: ["GENERATED", "SENT", "PAID", "REJECTED"],
  }).notNull().default("GENERATED"),
  totalAmount: real("total_amount").notNull().default(0),
  claimsCount: integer("claims_count").notNull().default(0),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
});

// ─── Wellbeing Surveys (Burnout Monitoring) ───────────────────────────────────
export const wellbeingSurveys = sqliteTable("wellbeing_surveys", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  // ISO week string: "2024-W12"
  week: text("week").notNull(),
  // 5 questions, scale 1-5
  q1: integer("q1").notNull(), // Fyzicky
  q2: integer("q2").notNull(), // Emocionálně
  q3: integer("q3").notNull(), // Pracovní zátěž
  q4: integer("q4").notNull(), // Spánek
  q5: integer("q5").notNull(), // Energie na volný čas
  averageScore: real("average_score").notNull(),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
});

// ─── Work Schedule (v2) ───────────────────────────────────────────────────────
export const workSchedule = sqliteTable("work_schedule", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  employeeId: integer("employee_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  dayOfWeek: integer("day_of_week").notNull(), // 0=Sun,1=Mon,...,6=Sat
  startTime: text("start_time").notNull(), // "08:00"
  endTime: text("end_time").notNull(),     // "17:00"
  breakStart: text("break_start"),         // "12:00" nullable
  breakEnd: text("break_end"),             // "13:00" nullable
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
});

// ─── Time Off v2 ──────────────────────────────────────────────────────────────
export const timeOffV2 = sqliteTable("time_off_v2", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  employeeId: integer("employee_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  dateFrom: text("date_from").notNull(), // ISO "2026-03-25"
  dateTo: text("date_to").notNull(),     // ISO "2026-03-25"
  type: text("type", { enum: ["vacation", "sick", "other"] }).notNull().default("vacation"),
  note: text("note"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
});

// ─── Open Slots (v2) ──────────────────────────────────────────────────────────
export const openSlots = sqliteTable("open_slots", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  employeeId: integer("employee_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  serviceId: integer("service_id").references(() => services.id),
  date: text("date").notNull(),   // "2026-03-25"
  time: text("time").notNull(),   // "08:00"
  durationMin: integer("duration_min").notNull().default(60),
  isEnabled: integer("is_enabled", { mode: "boolean" }).notNull().default(true),
  isOutOfSchedule: integer("is_out_of_schedule", { mode: "boolean" }).notNull().default(false),
  status: text("status", { enum: ["open", "booked", "cancelled"] }).notNull().default("open"),
  bookingId: integer("booking_id"), // nullable FK to bookings_v2
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
});

// ─── Bookings v2 ──────────────────────────────────────────────────────────────
export const bookingsV2 = sqliteTable("bookings_v2", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  slotId: integer("slot_id").notNull().references(() => openSlots.id),
  clientId: integer("client_id").notNull().references(() => users.id),
  status: text("status", { enum: ["confirmed", "cancelled", "completed", "unjustified_cancel"] }).notNull().default("confirmed"),
  note: text("note"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  cancelledAt: text("cancelled_at"),
});

// ─── Gift Vouchers ──────────────────────────────────────────────────────────
export const giftVouchers = sqliteTable("gift_vouchers", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  code: text("code").notNull().unique(),
  amount: integer("amount").notNull(), // cents
  currency: text("currency").notNull().default("CZK"),
  purchasedBy: integer("purchased_by").notNull().references(() => users.id),
  redeemedBy: integer("redeemed_by").references(() => users.id),
  redeemedAt: text("redeemed_at"),
  expiresAt: text("expires_at").notNull(),
  status: text("status", { enum: ["ACTIVE", "REDEEMED", "EXPIRED"] }).notNull().default("ACTIVE"),
  recipientName: text("recipient_name").notNull(),
  recipientEmail: text("recipient_email"),
  message: text("message"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
});

// ─── Exercise Library ───────────────────────────────────────────────────────
export const exerciseLibrary = sqliteTable("exercise_library", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  description: text("description").notNull(),
  category: text("category", {
    enum: ["STRETCHING", "STRENGTH", "BREATHING", "MINDFULNESS", "MOBILITY", "BALANCE", "OTHER"],
  }).notNull(),
  videoUrl: text("video_url"),
  thumbnailUrl: text("thumbnail_url"),
  duration: integer("duration").notNull(), // minutes
  difficulty: text("difficulty", { enum: ["EASY", "MEDIUM", "HARD"] }).notNull(),
  bodyPart: text("body_part"),
  instructions: text("instructions"),
  createdBy: integer("created_by").notNull().references(() => users.id),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
});

// ─── Badge Definitions ──────────────────────────────────────────────────────
export const badgeDefinitions = sqliteTable("badge_definitions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  key: text("key").notNull().unique(), // e.g. 'FIRST_SESSION', 'STREAK_7', 'HOMEWORK_10'
  name: text("name").notNull(),
  description: text("description").notNull(),
  iconUrl: text("icon_url"),
  category: text("category", {
    enum: ["ATTENDANCE", "HOMEWORK", "LOYALTY", "PROGRESS", "SPECIAL"],
  }).notNull(),
  threshold: integer("threshold").notNull(),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
});

// ─── User Badges ────────────────────────────────────────────────────────────
export const userBadges = sqliteTable("user_badges", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull().references(() => users.id),
  badgeId: integer("badge_id").notNull().references(() => badgeDefinitions.id),
  earnedAt: text("earned_at").notNull(),
  notified: integer("notified", { mode: "boolean" }).notNull().default(false),
});

// ─── Companies ──────────────────────────────────────────────────────────────
export const companies = sqliteTable("companies", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  ico: text("ico"), // Czech company ID
  contactEmail: text("contact_email").notNull(),
  contactPhone: text("contact_phone"),
  address: text("address"),
  creditBalance: integer("credit_balance").notNull().default(0),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  notes: text("notes"),
});

// ─── Company Employees ──────────────────────────────────────────────────────
export const companyEmployees = sqliteTable("company_employees", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyId: integer("company_id").notNull().references(() => companies.id),
  userId: integer("user_id").notNull().references(() => users.id),
  role: text("role", { enum: ["MANAGER", "EMPLOYEE"] }).notNull(),
  joinedAt: text("joined_at").notNull(),
});

// ─── Session Note Templates ─────────────────────────────────────────────────
export const sessionNoteTemplates = sqliteTable("session_note_templates", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  category: text("category", {
    enum: ["ANAMNESIS", "PROGRESS", "CONCLUSION", "INTAKE", "DISCHARGE"],
  }).notNull(),
  content: text("content").notNull(), // template body with placeholders
  createdBy: integer("created_by").notNull().references(() => users.id),
  isGlobal: integer("is_global", { mode: "boolean" }).notNull().default(false),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
});

// ─── Off-Peak Rules ─────────────────────────────────────────────────────────
export const offPeakRules = sqliteTable("off_peak_rules", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  dayOfWeek: integer("day_of_week").notNull(), // 0-6
  startTime: text("start_time").notNull(), // "HH:MM"
  endTime: text("end_time").notNull(),     // "HH:MM"
  discountPercent: integer("discount_percent").notNull(),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
});

// ─── Therapist Services ──────────────────────────────────────────────────────
export const therapistServices = sqliteTable("therapist_services", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  employeeId: integer("employee_id").notNull().references(() => users.id),
  serviceId: integer("service_id").notNull().references(() => services.id),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
});

// ─── Client FT Vouchers ─────────────────────────────────────────────────────
export const clientFtVouchers = sqliteTable("client_ft_vouchers", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  clientId: integer("client_id").notNull().references(() => users.id),
  insuranceCompanyId: integer("insurance_company_id").notNull().references(() => insuranceCompanies.id),
  voucherNumber: text("voucher_number").notNull(),
  totalUnits: integer("total_units").notNull(),
  usedUnits: integer("used_units").notNull().default(0),
  validFrom: text("valid_from").notNull(),
  validTo: text("valid_to").notNull(),
  notes: text("notes"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
});

// ─── Payment Reminders ──────────────────────────────────────────────────────
export const paymentReminders = sqliteTable("payment_reminders", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  invoiceId: integer("invoice_id").notNull().references(() => invoices.id),
  sentAt: text("sent_at").notNull(),
  channel: text("channel", { enum: ["email", "sms", "push", "inapp"] }).notNull(),
  status: text("status", { enum: ["sent", "failed"] }).notNull().default("sent"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
});

// ─── Cancellation Records ───────────────────────────────────────────────────
export const cancellationRecords = sqliteTable("cancellation_records", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  appointmentId: integer("appointment_id").references(() => appointments.id),
  clientId: integer("client_id").notNull().references(() => users.id),
  cancelledBy: integer("cancelled_by").notNull().references(() => users.id),
  reason: text("reason"),
  isUnjustified: integer("is_unjustified", { mode: "boolean" }).notNull().default(true),
  originalDate: text("original_date").notNull(),
  originalTime: text("original_time").notNull(),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
});

// ─── First Visit Followups ──────────────────────────────────────────────────
export const firstVisitFollowups = sqliteTable("first_visit_followups", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  appointmentId: integer("appointment_id").notNull().references(() => appointments.id),
  clientId: integer("client_id").notNull().references(() => users.id),
  therapistId: integer("therapist_id").notNull().references(() => users.id),
  scheduledAt: text("scheduled_at").notNull(), // when to send
  sentAt: text("sent_at"),
  status: text("status", { enum: ["PENDING", "SENT", "SKIPPED"] }).notNull().default("PENDING"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
});
