import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { createStore } from "../store/paths.ts";
import { createApp } from "./app.ts";

const root = path.resolve(process.env.MIGRATION_ROOT ?? process.cwd());
const port = Number(process.env.PORT ?? 4317);
const store = createStore(root);

const app = createApp(store);
const publicDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "public");
app.use(express.static(publicDir));

app.listen(port, () => {
  console.log(`Migration web UI running at http://localhost:${port} (store root: ${root})`);
});
