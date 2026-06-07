import "dotenv/config";
import mongoose from "mongoose";
import app from "./app.js";
import connectDB from "./db/index.js";
import { validateEnv } from "./utils/env.js";

const port = process.env.PORT || 3000;

validateEnv();

connectDB()
  .then(() => {
    const server = app.listen(port, () => {
      console.log(`Server listening on http://localhost:${port}`);
    });

    const shutdown = async (signal) => {
      console.log(`${signal} received. Closing server.`);
      server.close(async () => {
        await mongoose.connection.close();
        process.exit(0);
      });
    };

    process.on("SIGTERM", () => {
      shutdown("SIGTERM");
    });

    process.on("SIGINT", () => {
      shutdown("SIGINT");
    });
  })
  .catch((err) => {
    console.error("Application startup failed", err);
    process.exit(1);
  });
