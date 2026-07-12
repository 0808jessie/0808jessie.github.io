export default {
  async fetch(_request: Request) {
    return new Response("DecideNow static app", {
      status: 200,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  },
};
