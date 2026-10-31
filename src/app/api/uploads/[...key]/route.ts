import { readLocalObject, usesLocalStorage } from "@/server/storage";

// Serves locally stored uploads in development. In production images come
// straight from R2, so this route returns 404.
export async function GET(_request: Request, ctx: RouteContext<"/api/uploads/[...key]">) {
  if (!usesLocalStorage) return new Response("Not found", { status: 404 });

  const { key } = await ctx.params;
  if (key.some((part) => part === ".." || part.startsWith("."))) {
    return new Response("Not found", { status: 404 });
  }
  const body = await readLocalObject(key.join("/"));
  if (!body) return new Response("Not found", { status: 404 });

  return new Response(new Uint8Array(body), {
    headers: {
      "Content-Type": "image/webp",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
