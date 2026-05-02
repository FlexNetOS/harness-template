import "dotenv/config";
import { buildApp } from "./app.js";

const port = Number(process.env.PORT ?? 3000);
const app = buildApp();

app.listen(port, () => {
  console.log(`[app] listening on http://0.0.0.0:${port}`);
  console.log(`[app] try: curl http://localhost:${port}/health`);
});
