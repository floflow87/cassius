import express, { type Express } from "express";
import fs from "fs";
import path from "path";

export function serveStatic(app: Express) {
  const distPath = path.resolve(__dirname, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  app.use(express.static(distPath));

  // Serve landing page at root for visitors
  app.get("/", (_req, res) => {
    const landingPath = path.resolve(distPath, "landing.html");
    if (fs.existsSync(landingPath)) {
      res.sendFile(landingPath);
    } else {
      res.sendFile(path.resolve(distPath, "index.html"));
    }
  });

  // fall through to index.html for SPA routes (except root which is landing)
  app.use("*", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
