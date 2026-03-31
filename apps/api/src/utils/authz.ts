import type { FastifyReply, FastifyRequest } from "fastify";

type Role = "CLIENT" | "RECEPTION" | "EMPLOYEE" | "ADMIN";

export function requireRole(request: FastifyRequest, reply: FastifyReply, roles: Role[]): boolean {
  const role = request.auth?.role;
  if (!role || !roles.includes(role)) {
    reply.code(403).send({ error: "Forbidden" });
    return false;
  }
  return true;
}

export function requireApiScope(request: FastifyRequest, reply: FastifyReply, scopes: string[]): boolean {
  if (!request.authViaApiKey) return true;
  const keyScopes = request.authScopes ?? [];
  if (keyScopes.includes("*")) return true;
  if (!scopes.some((scope) => keyScopes.includes(scope))) {
    reply.code(403).send({
      error: "Forbidden",
      message: "API key missing required scope",
      requiredScopes: scopes,
    });
    return false;
  }
  return true;
}
