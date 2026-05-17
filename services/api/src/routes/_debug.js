export default async function debugRoutes(fastify) {
  fastify.get(
    "/_debug/whoami-shape",
    { preHandler: [fastify.requireSession] },
    async (request, reply) => {
      return reply.send({
        hasAuth: !!request.auth,
        authKeys: request.auth ? Object.keys(request.auth) : [],
        hasUser: !!request.user,
        userKeys: request.user ? Object.keys(request.user) : [],
        hasSession: !!request.session,
        sessionKeys: request.session ? Object.keys(request.session) : [],
        tenantId:
          request.auth?.tenant_id ||
          request.user?.tenant_id ||
          request.session?.tenant_id ||
          null,
      });
    }
  );
}

