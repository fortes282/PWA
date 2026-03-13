import fp from "fastify-plugin";
import type { FastifyPluginAsync } from "fastify";

export type AuthUser = {
  id: number;
  email: string;
  name: string;
  role: "CLIENT" | "RECEPTION" | "EMPLOYEE" | "ADMIN";
};

declare module "fastify" {
  interface FastifyRequest {
    auth?: AuthUser;
  }
}

const authPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.decorateRequest("auth", null);

  fastify.addHook("preHandler", async (request, reply) => {
    const publicRoutes = [
      { method: "POST", url: "/auth/login" },
      { method: "POST", url: "/auth/refresh" },
      { method: "GET", url: "/health" },
    ];

    const isPublic = publicRoutes.some(
      (r) => r.method === request.method && (request.url === r.url || request.url.startsWith(r.url + "?") || request.url.startsWith(r.url + "/"))
    );

    if (isPublic) return;

    try {
      const payload = await request.jwtVerify<AuthUser>();
      request.auth = payload;
    } catch {
      return reply.code(401).send({ error: "Unauthorized" });
    }
  });
};

export default fp(authPlugin);
