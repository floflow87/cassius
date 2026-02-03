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

  // Serve landing page at root and /landing BEFORE static middleware
  const serveLanding = (_req: any, res: any) => {
    const landingPath = path.resolve(distPath, "landing.html");
    if (fs.existsSync(landingPath)) {
      res.sendFile(landingPath);
    } else {
      res.sendFile(path.resolve(distPath, "index.html"));
    }
  };
  
  app.get("/", serveLanding);
  app.get("/landing", serveLanding);

  // Static files (CSS, JS, images, etc.)
  app.use(express.static(distPath));

  // fall through to index.html for SPA routes
  app.use("*", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
