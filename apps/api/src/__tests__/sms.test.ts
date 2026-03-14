/**
 * Unit tests for the SMS service (SMSAPI.com integration).
 * Tests sendSms() and template helpers.
 * Network calls are mocked so no real SMS is sent.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { sendSms, appointmentReminderSms, appointmentConfirmedSms, waitlistNotificationSms } from "../services/sms.js";

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

beforeEach(() => {
  vi.clearAllMocks();
  // Clean env before each test
  delete process.env.SMSAPI_TOKEN;
  delete process.env.SMSAPI_SENDER;
});

describe("sendSms", () => {
  it("returns false and does not call fetch when SMSAPI_TOKEN is not set", async () => {
    const result = await sendSms("+420777123456", "Test message");
    expect(result).toBe(false);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("returns true on success (200 + valid JSON)", async () => {
    process.env.SMSAPI_TOKEN = "test-token";
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ count: 1, list: [{ id: "abc123", number: "+420777123456", status: "SENT" }] }),
    });

    const result = await sendSms("+420777123456", "Hello!");
    expect(result).toBe(true);
    expect(mockFetch).toHaveBeenCalledOnce();
  });

  it("sends to SMSAPI_URL with Bearer auth", async () => {
    process.env.SMSAPI_TOKEN = "my-secret-token";
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ count: 1, list: [{ id: "x1" }] }),
    });

    await sendSms("+420777000001", "Test");

    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("https://api.smsapi.com/sms.do");
    expect(opts.headers["Authorization"]).toBe("Bearer my-secret-token");
    expect(opts.method).toBe("POST");
  });

  it("normalizes Czech phone number (no country prefix)", async () => {
    process.env.SMSAPI_TOKEN = "test-token";
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ count: 1, list: [{ id: "x2" }] }),
    });

    await sendSms("777123456", "Test");

    const body = new URLSearchParams(mockFetch.mock.calls[0][1].body);
    expect(body.get("to")).toBe("+420777123456");
  });

  it("normalizes Czech phone number starting with 0", async () => {
    process.env.SMSAPI_TOKEN = "test-token";
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ count: 1, list: [{ id: "x3" }] }),
    });

    await sendSms("0777123456", "Test");

    const body = new URLSearchParams(mockFetch.mock.calls[0][1].body);
    expect(body.get("to")).toBe("+420777123456");
  });

  it("includes 'from' when SMSAPI_SENDER is set", async () => {
    process.env.SMSAPI_TOKEN = "test-token";
    process.env.SMSAPI_SENDER = "MyApp";
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ count: 1, list: [{ id: "x4" }] }),
    });

    await sendSms("+420777000001", "Test");

    const body = new URLSearchParams(mockFetch.mock.calls[0][1].body);
    expect(body.get("from")).toBe("MyApp");
  });

  it("does NOT include 'from' when SMSAPI_SENDER is not set", async () => {
    process.env.SMSAPI_TOKEN = "test-token";
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ count: 1, list: [{ id: "x5" }] }),
    });

    await sendSms("+420777000001", "Test");

    const body = new URLSearchParams(mockFetch.mock.calls[0][1].body);
    expect(body.get("from")).toBeNull();
  });

  it("returns false on HTTP error", async () => {
    process.env.SMSAPI_TOKEN = "test-token";
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ error: 14, message: "Invalid from field" }),
    });

    const result = await sendSms("+420777123456", "Test");
    expect(result).toBe(false);
  });

  it("returns false on network error", async () => {
    process.env.SMSAPI_TOKEN = "test-token";
    mockFetch.mockRejectedValueOnce(new Error("Network failure"));

    const result = await sendSms("+420777123456", "Test");
    expect(result).toBe(false);
  });

  it("returns false when response contains invalid_numbers", async () => {
    process.env.SMSAPI_TOKEN = "test-token";
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ invalid_numbers: [{ number: "+420777123456", message: "Invalid" }] }),
    });

    const result = await sendSms("+420777123456", "Test");
    expect(result).toBe(false);
  });
});

describe("SMS templates", () => {
  it("appointmentReminderSms returns correct format", () => {
    const msg = appointmentReminderSms("15.3.2025 10:00", "Masáž");
    expect(msg).toContain("Masáž");
    expect(msg).toContain("15.3.2025 10:00");
    expect(msg).toContain("pristav-radosti.cz");
  });

  it("appointmentConfirmedSms returns correct format", () => {
    const msg = appointmentConfirmedSms("15.3.2025 10:00", "Jóga");
    expect(msg).toContain("Jóga");
    expect(msg).toContain("potvrzen");
  });

  it("waitlistNotificationSms returns correct format", () => {
    const msg = waitlistNotificationSms("Fyzioterapie");
    expect(msg).toContain("Fyzioterapie");
    expect(msg).toContain("pristav-radosti.cz");
  });
});
