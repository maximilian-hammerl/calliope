import { OpenAPIHono } from "@hono/zod-openapi";
import listFolders from "./forum/list_folders.ts";
import createFolder from "./forum/create_folder.ts";
import updateFolder from "./forum/update_folder.ts";
import moveFolder from "./forum/move_folder.ts";
import deleteFolder from "./forum/delete_folder.ts";
import setPermission from "./forum/set_permission.ts";
import moveThread from "./forum/move_thread.ts";
import movePage from "./forum/move_page.ts";
import listThreads from "./forum/list_threads.ts";
import createThread from "./forum/create_thread.ts";
import getThread from "./forum/get_thread.ts";
import listPosts from "./forum/list_posts.ts";
import createPost from "./forum/create_post.ts";
import updatePost from "./forum/update_post.ts";
import deletePost from "./forum/delete_post.ts";
import listPages from "./forum/list_pages.ts";
import createPage from "./forum/create_page.ts";
import getPage from "./forum/get_page.ts";
import updatePage from "./forum/update_page.ts";

// Flatter than `groups.ts`, because there is no id in the path to mount everything under: the
// forum is one of them, so its own routes carry the only parameters there are.
export default new OpenAPIHono()
  .route("/folders", listFolders)
  .route("/folders", createFolder)
  .route("/folders/:folderId", updateFolder)
  .route("/folders/:folderId", deleteFolder)
  .route("/folders/:folderId/parent", moveFolder)
  .route("/permissions/:targetType/:targetId", setPermission)
  .route("/threads", listThreads)
  .route("/threads", createThread)
  .route("/threads/:threadId", getThread)
  .route("/threads/:threadId/folder", moveThread)
  .route("/threads/:threadId/posts", listPosts)
  .route("/threads/:threadId/posts", createPost)
  .route("/threads/:threadId/posts/:postId", updatePost)
  .route("/threads/:threadId/posts/:postId", deletePost)
  .route("/pages", listPages)
  .route("/pages", createPage)
  .route("/pages/:pageId", getPage)
  .route("/pages/:pageId", updatePage)
  .route("/pages/:pageId/folder", movePage);
