import type { FastifyReply } from "fastify";

/** Schemas v OpenAPI často deklarují jen 200 — runtime stavy 4xx/201 zůstávají, TS uvolníme. */
type LooseCode = (code: number) => { send: (body?: unknown) => unknown };

export function widenReply(reply: FastifyReply): FastifyReply & { code: LooseCode } {
  return reply as FastifyReply & { code: LooseCode };
}
