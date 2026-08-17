import { OpenAPIHono } from "@hono/zod-openapi";
import deletePost from "./post/delete_post.ts";
import getPost from "./post/get_post.ts";
import updatePost from "./post/update_post.ts";

// Mounted by posts.ts at /:postId.
export default new OpenAPIHono()
  .route("/", getPost)
  .route("/", updatePost)
  .route("/", deletePost);
