/**
 * Stub routes for deprecated features (rooms, packages).
 * These return empty data so frontend pages render without crashing
 * when they call endpoints that no longer have real implementations.
 */
import type { FastifyPluginAsync } from "fastify";

const stubRoutes: FastifyPluginAsync = async (fastify) => {
  // Stub routes for deprecated features (rooms, packages)
  fastify.get("/packages", async () => []);
  fastify.get("/clients/:id/packages", async () => []);
  fastify.get("/rooms", async () => []);
  fastify.get("/heatmap/rooms", async () => ({ rooms: [], period: { from: "", to: "" } }));
  fastify.get("/stats/rooms-utilization", async () => ({ rooms: [], period: {} }));
};

export default stubRoutes;
