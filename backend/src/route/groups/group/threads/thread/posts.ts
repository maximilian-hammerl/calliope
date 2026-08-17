import { OpenAPIHono } from "@hono/zod-openapi";
import createPost from "./posts/create_post.ts";
import listPosts from "./posts/list_posts.ts";
import post from "./posts/post.ts";

export default new OpenAPIHono()
  .route("/", createPost)
  .route("/", listPosts)
  .route("/:postId", post);
