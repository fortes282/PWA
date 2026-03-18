/**
 * Centralized Swagger/OpenAPI schemas for route documentation.
 * Uses zodToJsonSchema to convert shared Zod schemas into JSON Schema for Fastify.
 */
import { zodToJsonSchema } from "zod-to-json-schema";
import {
  LoginSchema,
  CreateAppointmentSchema,
  UpdateAppointmentSchema,
  CreateServiceSchema,
  UpdateServiceSchema,
  UpdateUserSchema,
  CreateRoomSchema,
  UpdateRoomSchema,
} from "@pristav/shared";
import { z } from "zod";

// Helper: strip $schema from zodToJsonSchema output (Fastify doesn't want it)
function toJsonSchema(zodSchema: z.ZodType, name?: string) {
  const raw = zodToJsonSchema(zodSchema, { name, target: "openApi3" }) as Record<string, unknown>;
  if (name && "definitions" in raw) {
    const defs = raw.definitions as Record<string, unknown> | undefined;
    return defs?.[name] ?? raw;
  }
  const { $schema: _, ...rest } = raw;
  return rest;
}

// ─── Common response schemas ───────────────────────────────────────

const ErrorResponse = {
  type: "object" as const,
  properties: {
    error: { type: "string" as const },
  },
};

const OkResponse = {
  type: "object" as const,
  properties: {
    ok: { type: "boolean" as const },
  },
};

const UserPayload = {
  type: "object" as const,
  properties: {
    id: { type: "integer" as const },
    email: { type: "string" as const, format: "email" },
    name: { type: "string" as const },
    role: { type: "string" as const, enum: ["CLIENT", "EMPLOYEE", "RECEPTION", "ADMIN"] },
  },
};

const PaginationQuery = {
  type: "object" as const,
  properties: {
    limit: { type: "integer" as const, default: 20 },
    offset: { type: "integer" as const, default: 0 },
  },
};

// ─── Auth schemas ──────────────────────────────────────────────────

export const authSchemas = {
  login: {
    tags: ["Auth"],
    summary: "Přihlášení uživatele",
    description: "Ověří email/heslo, vrátí JWT access token a nastaví httpOnly refresh cookie.",
    body: toJsonSchema(LoginSchema),
    response: {
      200: {
        type: "object" as const,
        properties: {
          accessToken: { type: "string" as const },
          user: UserPayload,
        },
      },
      401: ErrorResponse,
      403: ErrorResponse,
    },
  },
  refresh: {
    tags: ["Auth"],
    summary: "Obnovení JWT tokenu",
    description: "Rotuje refresh token (httpOnly cookie) a vrátí nový access token.",
    response: {
      200: {
        type: "object" as const,
        properties: {
          accessToken: { type: "string" as const },
          user: UserPayload,
        },
      },
      401: ErrorResponse,
    },
  },
  me: {
    tags: ["Auth"],
    summary: "Profil přihlášeného uživatele",
    security: [{ bearerAuth: [] }],
    response: {
      200: {
        type: "object" as const,
        properties: {
          id: { type: "integer" as const },
          email: { type: "string" as const },
          name: { type: "string" as const },
          role: { type: "string" as const },
          phone: { type: "string" as const, nullable: true },
          isActive: { type: "boolean" as const },
        },
      },
      401: ErrorResponse,
    },
  },
  logout: {
    tags: ["Auth"],
    summary: "Odhlášení",
    description: "Smaže refresh token a vymaže cookie.",
    response: { 200: OkResponse },
  },
};

// ─── Appointments schemas ──────────────────────────────────────────

export const appointmentSchemas = {
  calendar: {
    tags: ["Appointments"],
    summary: "Kalendářový přehled termínů",
    security: [{ bearerAuth: [] }],
    querystring: {
      type: "object" as const,
      properties: {
        from: { type: "string" as const, format: "date", description: "YYYY-MM-DD" },
        to: { type: "string" as const, format: "date", description: "YYYY-MM-DD" },
        employeeId: { type: "integer" as const },
      },
    },
    response: {
      200: {
        type: "array" as const,
        items: {
          type: "object" as const,
          properties: {
            id: { type: "integer" as const },
            clientId: { type: "integer" as const },
            employeeId: { type: "integer" as const },
            serviceId: { type: "integer" as const },
            startTime: { type: "string" as const },
            status: { type: "string" as const },
            clientName: { type: "string" as const, nullable: true },
            employeeName: { type: "string" as const, nullable: true },
            serviceName: { type: "string" as const, nullable: true },
          },
        },
      },
    },
  },
  available: {
    tags: ["Appointments"],
    summary: "Dostupné časové sloty",
    security: [{ bearerAuth: [] }],
    querystring: {
      type: "object" as const,
      properties: {
        serviceId: { type: "integer" as const },
        date: { type: "string" as const, format: "date" },
      },
      required: ["serviceId", "date"],
    },
    response: {
      200: {
        type: "array" as const,
        items: {
          type: "object" as const,
          properties: {
            employeeId: { type: "integer" as const },
            employeeName: { type: "string" as const },
            slots: {
              type: "array" as const,
              items: {
                type: "object" as const,
                properties: {
                  start: { type: "string" as const },
                  end: { type: "string" as const },
                  roomId: { type: "integer" as const, nullable: true },
                },
              },
            },
          },
        },
      },
    },
  },
  create: {
    tags: ["Appointments"],
    summary: "Vytvořit nový termín",
    security: [{ bearerAuth: [] }],
    body: toJsonSchema(CreateAppointmentSchema),
    response: {
      200: {
        type: "object" as const,
        properties: {
          id: { type: "integer" as const },
          clientId: { type: "integer" as const },
          employeeId: { type: "integer" as const },
          serviceId: { type: "integer" as const },
          startTime: { type: "string" as const },
          status: { type: "string" as const },
        },
      },
      400: ErrorResponse,
      403: ErrorResponse,
    },
  },
  update: {
    tags: ["Appointments"],
    summary: "Aktualizovat termín (status, poznámky)",
    security: [{ bearerAuth: [] }],
    params: {
      type: "object" as const,
      properties: { id: { type: "integer" as const } },
      required: ["id"],
    },
    body: toJsonSchema(UpdateAppointmentSchema),
    response: {
      200: {
        type: "object" as const,
        properties: {
          id: { type: "integer" as const },
          status: { type: "string" as const },
        },
      },
      403: ErrorResponse,
      404: ErrorResponse,
    },
  },
  list: {
    tags: ["Appointments"],
    summary: "Seznam termínů",
    security: [{ bearerAuth: [] }],
    querystring: {
      type: "object" as const,
      properties: {
        status: { type: "string" as const },
        recurringOnly: { type: "string" as const, enum: ["true", "false"] },
      },
    },
  },
};

// ─── Users schemas ─────────────────────────────────────────────────

export const userSchemas = {
  list: {
    tags: ["Users"],
    summary: "Seznam uživatelů",
    security: [{ bearerAuth: [] }],
    querystring: {
      type: "object" as const,
      properties: {
        role: { type: "string" as const, enum: ["CLIENT", "EMPLOYEE", "RECEPTION", "ADMIN"] },
        search: { type: "string" as const },
      },
    },
  },
  create: {
    tags: ["Users"],
    summary: "Vytvořit uživatele",
    security: [{ bearerAuth: [] }],
    body: {
      type: "object" as const,
      required: ["email", "password", "name", "role"],
      properties: {
        email: { type: "string" as const, format: "email" },
        password: { type: "string" as const, minLength: 6 },
        name: { type: "string" as const },
        role: { type: "string" as const, enum: ["CLIENT", "EMPLOYEE", "RECEPTION", "ADMIN"] },
        phone: { type: "string" as const, nullable: true },
      },
    },
    response: {
      200: UserPayload,
      400: ErrorResponse,
      403: ErrorResponse,
    },
  },
  update: {
    tags: ["Users"],
    summary: "Aktualizovat uživatele",
    security: [{ bearerAuth: [] }],
    params: {
      type: "object" as const,
      properties: { id: { type: "integer" as const } },
      required: ["id"],
    },
    body: toJsonSchema(UpdateUserSchema),
    response: {
      200: UserPayload,
      403: ErrorResponse,
      404: ErrorResponse,
    },
  },
};

// ─── Services schemas ──────────────────────────────────────────────

export const serviceSchemas = {
  list: {
    tags: ["Services"],
    summary: "Seznam služeb",
    security: [{ bearerAuth: [] }],
  },
  create: {
    tags: ["Services"],
    summary: "Vytvořit službu (ADMIN)",
    security: [{ bearerAuth: [] }],
    body: toJsonSchema(CreateServiceSchema),
    response: { 403: ErrorResponse },
  },
  update: {
    tags: ["Services"],
    summary: "Aktualizovat službu (ADMIN)",
    security: [{ bearerAuth: [] }],
    params: {
      type: "object" as const,
      properties: { id: { type: "integer" as const } },
      required: ["id"],
    },
    body: toJsonSchema(UpdateServiceSchema),
    response: { 403: ErrorResponse, 404: ErrorResponse },
  },
};

// ─── Rooms schemas ─────────────────────────────────────────────────

export const roomSchemas = {
  list: {
    tags: ["Rooms"],
    summary: "Seznam místností",
    security: [{ bearerAuth: [] }],
  },
  create: {
    tags: ["Rooms"],
    summary: "Vytvořit místnost (ADMIN)",
    security: [{ bearerAuth: [] }],
    body: toJsonSchema(CreateRoomSchema),
    response: { 403: ErrorResponse },
  },
  update: {
    tags: ["Rooms"],
    summary: "Aktualizovat místnost (ADMIN)",
    security: [{ bearerAuth: [] }],
    params: {
      type: "object" as const,
      properties: { id: { type: "integer" as const } },
      required: ["id"],
    },
    body: toJsonSchema(UpdateRoomSchema),
    response: { 403: ErrorResponse, 404: ErrorResponse },
  },
};

// ─── Invoices schemas ──────────────────────────────────────────────

export const invoiceSchemas = {
  list: {
    tags: ["Invoices"],
    summary: "Seznam faktur",
    security: [{ bearerAuth: [] }],
    querystring: {
      type: "object" as const,
      properties: {
        status: { type: "string" as const, enum: ["DRAFT", "SENT", "PAID", "OVERDUE", "CANCELLED"] },
        clientId: { type: "integer" as const },
        from: { type: "string" as const, format: "date" },
        to: { type: "string" as const, format: "date" },
      },
    },
  },
  create: {
    tags: ["Invoices"],
    summary: "Vytvořit fakturu",
    security: [{ bearerAuth: [] }],
    body: {
      type: "object" as const,
      required: ["clientId", "items"],
      properties: {
        clientId: { type: "integer" as const },
        dueDate: { type: "string" as const, format: "date" },
        items: {
          type: "array" as const,
          items: {
            type: "object" as const,
            properties: {
              description: { type: "string" as const },
              quantity: { type: "integer" as const },
              unitPrice: { type: "number" as const },
            },
          },
        },
      },
    },
    response: { 400: ErrorResponse, 403: ErrorResponse },
  },
};

// ─── Notifications schemas ─────────────────────────────────────────

export const notificationSchemas = {
  list: {
    tags: ["Notifications"],
    summary: "Seznam notifikací uživatele",
    security: [{ bearerAuth: [] }],
    querystring: PaginationQuery,
  },
  markRead: {
    tags: ["Notifications"],
    summary: "Označit notifikaci jako přečtenou",
    security: [{ bearerAuth: [] }],
    params: {
      type: "object" as const,
      properties: { id: { type: "integer" as const } },
      required: ["id"],
    },
    response: { 200: OkResponse },
  },
};

// ─── Credits schemas ───────────────────────────────────────────────

export const creditSchemas = {
  balance: {
    tags: ["Credits"],
    summary: "Zůstatek kreditů klienta",
    security: [{ bearerAuth: [] }],
    response: {
      200: {
        type: "object" as const,
        properties: {
          balance: { type: "number" as const },
          transactions: { type: "array" as const, items: { type: "object" as const } },
        },
      },
    },
  },
  create: {
    tags: ["Credits"],
    summary: "Přidat kreditovou transakci",
    security: [{ bearerAuth: [] }],
    body: {
      type: "object" as const,
      required: ["userId", "amount", "type"],
      properties: {
        userId: { type: "integer" as const },
        amount: { type: "number" as const },
        type: { type: "string" as const, enum: ["CREDIT", "DEBIT"] },
        description: { type: "string" as const, nullable: true },
      },
    },
    response: { 403: ErrorResponse },
  },
};

// ─── Waitlist schemas ──────────────────────────────────────────────

export const waitlistSchemas = {
  list: {
    tags: ["Waitlist"],
    summary: "Seznam čekajících",
    security: [{ bearerAuth: [] }],
  },
  create: {
    tags: ["Waitlist"],
    summary: "Přidat na čekací listinu",
    security: [{ bearerAuth: [] }],
    body: {
      type: "object" as const,
      required: ["serviceId"],
      properties: {
        serviceId: { type: "integer" as const },
        preferredEmployeeId: { type: "integer" as const, nullable: true },
        preferredDate: { type: "string" as const, format: "date", nullable: true },
        notes: { type: "string" as const, nullable: true },
      },
    },
    response: { 403: ErrorResponse },
  },
};

// ─── Health / System schemas ───────────────────────────────────────

export const healthSchemas = {
  ping: {
    tags: ["System"],
    summary: "Health check",
    response: {
      200: {
        type: "object" as const,
        properties: {
          status: { type: "string" as const },
          version: { type: "string" as const },
          uptime: { type: "number" as const },
        },
      },
    },
  },
  detailed: {
    tags: ["System"],
    summary: "Detailní health check (ADMIN)",
    security: [{ bearerAuth: [] }],
    response: {
      200: {
        type: "object" as const,
        properties: {
          status: { type: "string" as const },
          version: { type: "string" as const },
          uptime: { type: "number" as const },
          db: { type: "string" as const },
          totalUsers: { type: "integer" as const },
          totalAppointments: { type: "integer" as const },
          dbSize: { type: "string" as const },
          pendingReminders: { type: "integer" as const },
        },
      },
    },
  },
};

// ─── Messages schemas ──────────────────────────────────────────────

export const messageSchemas = {
  list: {
    tags: ["Messages"],
    summary: "Inbox a odeslané zprávy",
    security: [{ bearerAuth: [] }],
    querystring: {
      type: "object" as const,
      properties: {
        folder: { type: "string" as const, enum: ["inbox", "sent"] },
        ...PaginationQuery.properties,
      },
    },
  },
  send: {
    tags: ["Messages"],
    summary: "Odeslat zprávu",
    security: [{ bearerAuth: [] }],
    body: {
      type: "object" as const,
      required: ["toUserId", "subject", "body"],
      properties: {
        toUserId: { type: "integer" as const },
        subject: { type: "string" as const },
        body: { type: "string" as const },
        parentId: { type: "integer" as const, nullable: true },
      },
    },
  },
  unreadCount: {
    tags: ["Messages"],
    summary: "Počet nepřečtených zpráv",
    security: [{ bearerAuth: [] }],
    response: {
      200: {
        type: "object" as const,
        properties: {
          count: { type: "integer" as const },
        },
      },
    },
  },
};

// ─── Ratings schemas ───────────────────────────────────────────────

export const ratingSchemas = {
  create: {
    tags: ["Ratings"],
    summary: "Ohodnotit termín (CLIENT, pouze COMPLETED)",
    security: [{ bearerAuth: [] }],
    params: {
      type: "object" as const,
      properties: { id: { type: "integer" as const } },
      required: ["id"],
    },
    body: {
      type: "object" as const,
      required: ["rating"],
      properties: {
        rating: { type: "integer" as const, minimum: 1, maximum: 5 },
        comment: { type: "string" as const, nullable: true },
      },
    },
  },
  summary: {
    tags: ["Ratings"],
    summary: "Leaderboard hodnocení terapeutů",
    security: [{ bearerAuth: [] }],
  },
};

// ─── Export schemas ────────────────────────────────────────────────

export const exportSchemas = {
  clients: {
    tags: ["Export"],
    summary: "CSV export klientů",
    security: [{ bearerAuth: [] }],
    produces: ["text/csv"],
  },
  appointments: {
    tags: ["Export"],
    summary: "CSV export termínů",
    security: [{ bearerAuth: [] }],
    querystring: {
      type: "object" as const,
      properties: {
        from: { type: "string" as const, format: "date" },
        to: { type: "string" as const, format: "date" },
      },
    },
    produces: ["text/csv"],
  },
  invoices: {
    tags: ["Export"],
    summary: "CSV export faktur (ADMIN)",
    security: [{ bearerAuth: [] }],
    querystring: {
      type: "object" as const,
      properties: {
        from: { type: "string" as const, format: "date" },
        to: { type: "string" as const, format: "date" },
      },
    },
    produces: ["text/csv"],
  },
};

// ─── Reports schemas ───────────────────────────────────────────────

export const reportSchemas = {
  revenueMonthly: {
    tags: ["Reports"],
    summary: "Měsíční přehled výnosů",
    security: [{ bearerAuth: [] }],
    querystring: {
      type: "object" as const,
      properties: {
        year: { type: "integer" as const },
      },
    },
  },
  occupancyWeekly: {
    tags: ["Reports"],
    summary: "Týdenní přehled obsazenosti",
    security: [{ bearerAuth: [] }],
    querystring: {
      type: "object" as const,
      properties: {
        from: { type: "string" as const, format: "date" },
        to: { type: "string" as const, format: "date" },
      },
    },
  },
};

// ─── Booking Public schemas ────────────────────────────────────────

export const bookingPublicSchemas = {
  create: {
    tags: ["Public Booking"],
    summary: "Veřejná rezervace (bez autentizace)",
    body: {
      type: "object" as const,
      required: ["slotDate", "slotTime", "name", "email"],
      properties: {
        name: { type: "string" as const },
        email: { type: "string" as const, format: "email" },
        phone: { type: "string" as const, nullable: true },
        serviceId: { type: "integer" as const, nullable: true },
        slotDate: { type: "string" as const, format: "date" },
        slotTime: { type: "string" as const },
        note: { type: "string" as const, nullable: true },
      },
    },
  },
  pending: {
    tags: ["Public Booking"],
    summary: "Čekající veřejné rezervace (ADMIN/RECEPTION)",
    security: [{ bearerAuth: [] }],
  },
};

// ─── Packages schemas ──────────────────────────────────────────────

export const packageSchemas = {
  list: {
    tags: ["Packages"],
    summary: "Seznam balíčků služeb",
  },
  create: {
    tags: ["Packages"],
    summary: "Vytvořit balíček (ADMIN)",
    security: [{ bearerAuth: [] }],
    body: {
      type: "object" as const,
      required: ["name", "sessionsCount", "price"],
      properties: {
        name: { type: "string" as const },
        description: { type: "string" as const, nullable: true },
        sessionsCount: { type: "integer" as const },
        price: { type: "number" as const },
        serviceId: { type: "integer" as const, nullable: true },
      },
    },
  },
  purchase: {
    tags: ["Packages"],
    summary: "Koupit balíček (CLIENT)",
    security: [{ bearerAuth: [] }],
    params: {
      type: "object" as const,
      properties: { id: { type: "integer" as const } },
      required: ["id"],
    },
  },
};

// ─── Auto-Processor schemas ───────────────────────────────────────

export const autoProcessorSchemas = {
  noShows: {
    tags: ["Auto-Processor"],
    summary: "Zpracovat no-shows",
    security: [{ bearerAuth: [] }],
  },
  invoiceOverdue: {
    tags: ["Auto-Processor"],
    summary: "Označit faktury po splatnosti",
    security: [{ bearerAuth: [] }],
  },
  status: {
    tags: ["Auto-Processor"],
    summary: "Stav auto-processoru",
    security: [{ bearerAuth: [] }],
  },
};

// ─── Loyalty schemas ───────────────────────────────────────────────

export const loyaltySchemas = {
  points: {
    tags: ["Loyalty"],
    summary: "Věrnostní body (balance + historie)",
    security: [{ bearerAuth: [] }],
    querystring: {
      type: "object" as const,
      properties: {
        userId: { type: "integer" as const, description: "Admin/reception: body jiného uživatele" },
      },
    },
  },
  leaderboard: {
    tags: ["Loyalty"],
    summary: "Leaderboard věrnostních bodů",
    security: [{ bearerAuth: [] }],
    querystring: {
      type: "object" as const,
      properties: {
        limit: { type: "integer" as const, default: 10 },
      },
    },
  },
};

// ─── Recommendations schemas ──────────────────────────────────────

export const recommendationSchemas = {
  rebooking: {
    tags: ["Recommendations"],
    summary: "Klienti k přeobjednání",
    security: [{ bearerAuth: [] }],
  },
  atRisk: {
    tags: ["Recommendations"],
    summary: "Rizikoví klienti",
    security: [{ bearerAuth: [] }],
  },
  loyaltyRewards: {
    tags: ["Recommendations"],
    summary: "Klienti blízko věrnostní odměny",
    security: [{ bearerAuth: [] }],
  },
};

// ─── iCal schemas ──────────────────────────────────────────────────

export const icalSchemas = {
  export: {
    tags: ["iCal"],
    summary: "Export termínů jako .ics (RFC 5545)",
    security: [{ bearerAuth: [] }],
    querystring: {
      type: "object" as const,
      properties: {
        from: { type: "string" as const, format: "date" },
        to: { type: "string" as const, format: "date" },
        employeeId: { type: "integer" as const },
      },
    },
    produces: ["text/calendar"],
  },
};

// ─── Appointment Templates schemas ────────────────────────────────

export const appointmentTemplateSchemas = {
  create: {
    tags: ["Appointment Templates"],
    summary: "Vytvořit šablonu termínu (ADMIN)",
    security: [{ bearerAuth: [] }],
  },
  list: {
    tags: ["Appointment Templates"],
    summary: "Seznam šablon termínů (ADMIN/RECEPTION)",
    security: [{ bearerAuth: [] }],
  },
  delete: {
    tags: ["Appointment Templates"],
    summary: "Smazat šablonu (ADMIN)",
    security: [{ bearerAuth: [] }],
    params: {
      type: "object" as const,
      properties: { id: { type: "integer" as const } },
      required: ["id"],
    },
  },
};

// ─── Push Notifications schemas ───────────────────────────────────

export const pushSchemas = {
  vapidKey: {
    tags: ["Push"],
    summary: "Veřejný VAPID klíč",
  },
  subscribe: {
    tags: ["Push"],
    summary: "Přihlásit k push notifikacím",
    security: [{ bearerAuth: [] }],
  },
  unsubscribe: {
    tags: ["Push"],
    summary: "Odhlásit z push notifikací",
    security: [{ bearerAuth: [] }],
  },
  test: {
    tags: ["Push"],
    summary: "Testovací push notifikace",
    security: [{ bearerAuth: [] }],
  },
};

// ─── Medical Reports schemas ──────────────────────────────────────

export const medicalSchemas = {
  list: {
    tags: ["Medical Reports"],
    summary: "Seznam lékařských zpráv",
    security: [{ bearerAuth: [] }],
    querystring: {
      type: "object" as const,
      properties: {
        clientId: { type: "integer" as const },
      },
    },
  },
  create: {
    tags: ["Medical Reports"],
    summary: "Vytvořit lékařskou zprávu",
    security: [{ bearerAuth: [] }],
  },
};

// ─── FIO Bank schemas ─────────────────────────────────────────────

export const fioSchemas = {
  list: {
    tags: ["FIO Bank"],
    summary: "Seznam bankovních transakcí",
    security: [{ bearerAuth: [] }],
    querystring: {
      type: "object" as const,
      properties: {
        from: { type: "string" as const },
        to: { type: "string" as const },
        matched: { type: "string" as const, enum: ["true", "false"] },
      },
    },
  },
  create: {
    tags: ["FIO Bank"],
    summary: "Importovat bankovní transakci",
    security: [{ bearerAuth: [] }],
  },
  summary: {
    tags: ["FIO Bank"],
    summary: "Souhrn bankovních transakcí",
    security: [{ bearerAuth: [] }],
  },
  exportCsv: {
    tags: ["FIO Bank"],
    summary: "CSV export bankovních transakcí",
    security: [{ bearerAuth: [] }],
    produces: ["text/csv"],
  },
};

// ─── Search schemas ───────────────────────────────────────────────

export const searchSchemas = {
  search: {
    tags: ["Search"],
    summary: "Globální vyhledávání (uživatelé, termíny, faktury, zprávy)",
    security: [{ bearerAuth: [] }],
    querystring: {
      type: "object" as const,
      required: ["q"],
      properties: {
        q: { type: "string" as const, description: "Hledaný výraz" },
      },
    },
  },
};

// ─── Stats schemas ────────────────────────────────────────────────

export const statsSchemas = {
  overview: {
    tags: ["Stats"],
    summary: "Přehled statistik (ADMIN/RECEPTION)",
    security: [{ bearerAuth: [] }],
    querystring: {
      type: "object" as const,
      properties: {
        from: { type: "string" as const },
        to: { type: "string" as const },
      },
    },
  },
  topClients: {
    tags: ["Stats"],
    summary: "Top klienti dle návštěv",
    security: [{ bearerAuth: [] }],
    querystring: {
      type: "object" as const,
      properties: {
        limit: { type: "integer" as const, default: 10 },
      },
    },
  },
  revenueSummary: {
    tags: ["Stats"],
    summary: "Souhrn výnosů",
    security: [{ bearerAuth: [] }],
    querystring: {
      type: "object" as const,
      properties: {
        from: { type: "string" as const },
        to: { type: "string" as const },
      },
    },
  },
  roomsUtilization: {
    tags: ["Stats"],
    summary: "Využití místností",
    security: [{ bearerAuth: [] }],
    querystring: {
      type: "object" as const,
      properties: {
        from: { type: "string" as const },
        to: { type: "string" as const },
      },
    },
  },
  employeesPerformance: {
    tags: ["Stats"],
    summary: "Výkon zaměstnanců",
    security: [{ bearerAuth: [] }],
    querystring: {
      type: "object" as const,
      properties: {
        from: { type: "string" as const },
        to: { type: "string" as const },
      },
    },
  },
  activityFeed: {
    tags: ["Stats"],
    summary: "Feed aktivity (termíny, uživatelé, audit)",
    security: [{ bearerAuth: [] }],
    querystring: {
      type: "object" as const,
      properties: {
        limit: { type: "integer" as const, default: 20 },
      },
    },
  },
  quickSummary: {
    tags: ["Stats"],
    summary: "Rychlý přehled dnešního dne",
    security: [{ bearerAuth: [] }],
  },
};

// ─── Credit Requests schemas ──────────────────────────────────────

export const creditRequestSchemas = {
  list: {
    tags: ["Credit Requests"],
    summary: "Seznam požadavků na kredit",
    security: [{ bearerAuth: [] }],
    querystring: {
      type: "object" as const,
      properties: {
        status: { type: "string" as const, enum: ["PENDING", "APPROVED", "REJECTED"] },
      },
    },
  },
  create: {
    tags: ["Credit Requests"],
    summary: "Vytvořit požadavek na kredit (CLIENT)",
    security: [{ bearerAuth: [] }],
  },
};

// ─── Dashboard schemas ────────────────────────────────────────────

export const dashboardSchemas = {
  reception: {
    tags: ["Dashboard"],
    summary: "Dashboard recepce — dnešní přehled",
    security: [{ bearerAuth: [] }],
  },
  client: {
    tags: ["Dashboard"],
    summary: "Dashboard klienta — souhrn účtu",
    security: [{ bearerAuth: [] }],
  },
  employee: {
    tags: ["Dashboard"],
    summary: "Dashboard terapeuta — dnešní termíny + statistiky",
    security: [{ bearerAuth: [] }],
  },
  adminPending: {
    tags: ["Dashboard"],
    summary: "Čekající úkoly admina",
    security: [{ bearerAuth: [] }],
  },
};

// ─── Reminders schemas ────────────────────────────────────────────

export const reminderSchemas = {
  upcoming: {
    tags: ["Reminders"],
    summary: "Nadcházející připomínky",
    security: [{ bearerAuth: [] }],
  },
  run: {
    tags: ["Reminders"],
    summary: "Spustit odeslání připomínek (ADMIN)",
    security: [{ bearerAuth: [] }],
  },
};

// ─── Appointment Series schemas ───────────────────────────────────

export const appointmentSeriesSchemas = {
  create: {
    tags: ["Appointment Series"],
    summary: "Vytvořit sérii termínů",
    security: [{ bearerAuth: [] }],
  },
  list: {
    tags: ["Appointment Series"],
    summary: "Seznam sérií termínů",
    security: [{ bearerAuth: [] }],
  },
};

// ─── Employee Clients schemas ─────────────────────────────────────

export const employeeClientSchemas = {
  clients: {
    tags: ["Employee"],
    summary: "Klienti terapeuta (z termínů)",
    security: [{ bearerAuth: [] }],
  },
  stats: {
    tags: ["Employee"],
    summary: "Statistiky terapeuta",
    security: [{ bearerAuth: [] }],
  },
};

// ─── Recurrence schemas ───────────────────────────────────────────

export const recurrenceSchemas = {
  create: {
    tags: ["Recurrence"],
    summary: "Vytvořit opakování termínu",
    security: [{ bearerAuth: [] }],
    params: {
      type: "object" as const,
      properties: { id: { type: "integer" as const } },
      required: ["id"],
    },
  },
  delete: {
    tags: ["Recurrence"],
    summary: "Zrušit opakování (budoucí termíny)",
    security: [{ bearerAuth: [] }],
    params: {
      type: "object" as const,
      properties: { id: { type: "integer" as const } },
      required: ["id"],
    },
  },
};

// ─── Notification Preferences schemas ─────────────────────────────

export const notificationPrefSchemas = {
  get: {
    tags: ["Notification Preferences"],
    summary: "Nastavení notifikací uživatele",
    security: [{ bearerAuth: [] }],
  },
  update: {
    tags: ["Notification Preferences"],
    summary: "Uložit nastavení notifikací",
    security: [{ bearerAuth: [] }],
  },
};

// ─── Batch Operations schemas ─────────────────────────────────────

export const batchSchemas = {
  appointmentStatus: {
    tags: ["Batch"],
    summary: "Hromadná změna statusu termínů",
    security: [{ bearerAuth: [] }],
  },
  notifications: {
    tags: ["Batch"],
    summary: "Hromadné odeslání notifikací",
    security: [{ bearerAuth: [] }],
  },
  usersActive: {
    tags: ["Batch"],
    summary: "Hromadná aktivace/deaktivace uživatelů",
    security: [{ bearerAuth: [] }],
  },
};

// ─── Health Goals schemas ─────────────────────────────────────────

export const healthGoalSchemas = {
  list: {
    tags: ["Health Goals"],
    summary: "Seznam zdravotních cílů klienta",
    security: [{ bearerAuth: [] }],
    params: {
      type: "object" as const,
      properties: { id: { type: "integer" as const } },
      required: ["id"],
    },
  },
  create: {
    tags: ["Health Goals"],
    summary: "Vytvořit zdravotní cíl",
    security: [{ bearerAuth: [] }],
    params: {
      type: "object" as const,
      properties: { id: { type: "integer" as const } },
      required: ["id"],
    },
  },
  update: {
    tags: ["Health Goals"],
    summary: "Aktualizovat zdravotní cíl",
    security: [{ bearerAuth: [] }],
    params: {
      type: "object" as const,
      properties: { id: { type: "integer" as const } },
      required: ["id"],
    },
  },
  delete: {
    tags: ["Health Goals"],
    summary: "Smazat zdravotní cíl",
    security: [{ bearerAuth: [] }],
    params: {
      type: "object" as const,
      properties: { id: { type: "integer" as const } },
      required: ["id"],
    },
  },
};

// ─── Health Records schemas ───────────────────────────────────────

export const healthRecordSchemas = {
  list: {
    tags: ["Health Records"],
    summary: "Zdravotní záznamy klienta",
    security: [{ bearerAuth: [] }],
    querystring: {
      type: "object" as const,
      properties: {
        clientId: { type: "integer" as const },
      },
    },
  },
};

// ─── Behavior schemas ─────────────────────────────────────────────

export const behaviorSchemas = {
  record: {
    tags: ["Behavior"],
    summary: "Zaznamenat behavior event",
    security: [{ bearerAuth: [] }],
  },
};

// ─── Working Hours schemas ────────────────────────────────────────

export const workingHoursSchemas = {
  list: {
    tags: ["Working Hours"],
    summary: "Pracovní hodiny zaměstnanců",
    security: [{ bearerAuth: [] }],
    querystring: {
      type: "object" as const,
      properties: {
        employeeId: { type: "integer" as const },
      },
    },
  },
  employees: {
    tags: ["Working Hours"],
    summary: "Seznam zaměstnanců s pracovními hodinami",
    security: [{ bearerAuth: [] }],
  },
};

// ─── Waitlist Extended schemas ────────────────────────────────────

export const waitlistExtSchemas = {
  stats: {
    tags: ["Waitlist"],
    summary: "Statistiky čekací listiny",
    security: [{ bearerAuth: [] }],
  },
  suggestions: {
    tags: ["Waitlist"],
    summary: "Návrhy na obsazení z čekající listiny",
    security: [{ bearerAuth: [] }],
  },
};

// ─── Audit schemas ────────────────────────────────────────────────

export const auditSchemas = {
  list: {
    tags: ["Audit"],
    summary: "Audit log (ADMIN)",
    security: [{ bearerAuth: [] }],
    querystring: {
      type: "object" as const,
      properties: {
        action: { type: "string" as const },
        userId: { type: "integer" as const },
        ...PaginationQuery.properties,
      },
    },
  },
  me: {
    tags: ["Audit"],
    summary: "Vlastní audit log",
    security: [{ bearerAuth: [] }],
    querystring: PaginationQuery,
  },
};

// ─── Client Staff Notes schemas ───────────────────────────────────

export const clientStaffNoteSchemas = {
  list: {
    tags: ["Client Staff Notes"],
    summary: "Interní poznámky o klientovi",
    security: [{ bearerAuth: [] }],
    params: {
      type: "object" as const,
      properties: { id: { type: "integer" as const } },
      required: ["id"],
    },
  },
  create: {
    tags: ["Client Staff Notes"],
    summary: "Přidat interní poznámku",
    security: [{ bearerAuth: [] }],
    params: {
      type: "object" as const,
      properties: { id: { type: "integer" as const } },
      required: ["id"],
    },
  },
  update: {
    tags: ["Client Staff Notes"],
    summary: "Editovat interní poznámku",
    security: [{ bearerAuth: [] }],
    params: {
      type: "object" as const,
      properties: { id: { type: "integer" as const } },
      required: ["id"],
    },
  },
  delete: {
    tags: ["Client Staff Notes"],
    summary: "Smazat interní poznámku",
    security: [{ bearerAuth: [] }],
    params: {
      type: "object" as const,
      properties: { id: { type: "integer" as const } },
      required: ["id"],
    },
  },
};

// ─── Timeline schemas ─────────────────────────────────────────────

export const timelineSchemas = {
  list: {
    tags: ["Timeline"],
    summary: "Časová osa událostí klienta",
    security: [{ bearerAuth: [] }],
    params: {
      type: "object" as const,
      properties: { id: { type: "integer" as const } },
      required: ["id"],
    },
    querystring: {
      type: "object" as const,
      properties: {
        cursor: { type: "string" as const },
        limit: { type: "integer" as const, default: 20 },
      },
    },
  },
};

// ─── Password Reset schemas ───────────────────────────────────────

export const passwordResetSchemas = {
  forgot: {
    tags: ["Auth"],
    summary: "Zapomenuté heslo — odeslat reset email",
  },
  reset: {
    tags: ["Auth"],
    summary: "Reset hesla — nastavit nové heslo",
  },
};

// ─── PDF schemas ──────────────────────────────────────────────────

export const pdfSchemas = {
  medicalReport: {
    tags: ["PDF"],
    summary: "PDF lékařské zprávy",
    security: [{ bearerAuth: [] }],
    params: {
      type: "object" as const,
      properties: { id: { type: "integer" as const } },
      required: ["id"],
    },
    produces: ["application/pdf"],
  },
  invoice: {
    tags: ["PDF"],
    summary: "PDF faktury",
    security: [{ bearerAuth: [] }],
    params: {
      type: "object" as const,
      properties: { id: { type: "integer" as const } },
      required: ["id"],
    },
    produces: ["application/pdf"],
  },
  clientAppointments: {
    tags: ["PDF"],
    summary: "PDF přehled termínů klienta",
    security: [{ bearerAuth: [] }],
    params: {
      type: "object" as const,
      properties: { id: { type: "integer" as const } },
      required: ["id"],
    },
    produces: ["application/pdf"],
  },
};

// ─── Time Off schemas ─────────────────────────────────────────────

export const timeOffSchemas = {
  list: {
    tags: ["Time Off"],
    summary: "Bloky volna zaměstnanců",
    security: [{ bearerAuth: [] }],
    querystring: {
      type: "object" as const,
      properties: {
        employeeId: { type: "integer" as const },
        from: { type: "string" as const },
        to: { type: "string" as const },
      },
    },
  },
  create: {
    tags: ["Time Off"],
    summary: "Vytvořit blok volna",
    security: [{ bearerAuth: [] }],
  },
  delete: {
    tags: ["Time Off"],
    summary: "Smazat blok volna",
    security: [{ bearerAuth: [] }],
    params: {
      type: "object" as const,
      properties: { id: { type: "integer" as const } },
      required: ["id"],
    },
  },
};

// ─── Invoices Extended schemas ────────────────────────────────────

export const invoiceExtSchemas = {
  overdue: {
    tags: ["Invoices"],
    summary: "Faktury po splatnosti",
    security: [{ bearerAuth: [] }],
  },
  exportCsv: {
    tags: ["Invoices"],
    summary: "CSV export faktur",
    security: [{ bearerAuth: [] }],
    produces: ["text/csv"],
  },
};

// ─── Reports Extended schemas ─────────────────────────────────────

export const reportExtSchemas = {
  monthly: {
    tags: ["Reports"],
    summary: "Měsíční přehled termínů a výnosů",
    security: [{ bearerAuth: [] }],
    querystring: {
      type: "object" as const,
      properties: {
        year: { type: "integer" as const },
        month: { type: "integer" as const },
      },
    },
  },
  monthlyCsv: {
    tags: ["Reports"],
    summary: "CSV export měsíčního přehledu",
    security: [{ bearerAuth: [] }],
    querystring: {
      type: "object" as const,
      properties: {
        year: { type: "integer" as const },
        month: { type: "integer" as const },
      },
    },
    produces: ["text/csv"],
  },
};
