/**
 * Stub routes for deprecated features (rooms).
 */
import type { FastifyPluginAsync } from "fastify";

const stubRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/rooms", async () => []);
  fastify.get("/heatmap/rooms", async () => ({ rooms: [], period: { from: "", to: "" } }));
  fastify.get("/stats/rooms-utilization", async () => ({ rooms: [], period: {} }));
};

export default stubRoutes;
