import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import type { Express, Request, Response, NextFunction } from "express";
import { storage } from "./storage";
import { generateToken } from "./jwtMiddleware";

declare global {
  namespace Express {
    interface User {
      id: string;
      username: string;
      role: "CHIRURGIEN" | "ASSISTANT" | "ADMIN";
      nom: string | null;
      prenom: string | null;
      organisationId: string | null;
    }
  }
}

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function comparePasswords(
  supplied: string,
  stored: string
): Promise<boolean> {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

export function setupAuth(app: Express): void {
  const sessionSecret = process.env.SESSION_SECRET;
  if (!sessionSecret) {
    throw new Error("SESSION_SECRET environment variable is required");
  }

  const sessionSettings: session.SessionOptions = {
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    store: undefined,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000,
    },
  };

  app.set("trust proxy", 1);
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        const user = await storage.getUserByUsername(username);
        if (!user) {
          return done(null, false, { message: "Nom d'utilisateur incorrect" });
        }
        const isMatch = await comparePasswords(password, user.password);
        if (!isMatch) {
          return done(null, false, { message: "Mot de passe incorrect" });
        }
        return done(null, {
          id: user.id,
          username: user.username,
          role: user.role,
          nom: user.nom,
          prenom: user.prenom,
          organisationId: user.organisationId,
        });
      } catch (error) {
        return done(error);
      }
    })
  );

  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await storage.getUserById(id);
      if (!user) {
        return done(null, false);
      }
      done(null, {
        id: user.id,
        username: user.username,
        role: user.role,
        nom: user.nom,
        prenom: user.prenom,
        organisationId: user.organisationId,
      });
    } catch (error) {
      done(error);
    }
  });

  app.post("/api/auth/login", (req, res, next) => {
    passport.authenticate("local", (err: any, user: Express.User | false, info: any) => {
      if (err) {
        return next(err);
      }
      if (!user) {
        return res.status(401).json({ error: info?.message || "Échec de connexion" });
      }
      req.logIn(user, (err) => {
        if (err) {
          return next(err);
        }

        let token: string | null = null;
        try {
          token = generateToken({
            userId: user.id,
            username: user.username,
            role: user.role,
            organisationId: user.organisationId,
          });
        } catch (e) {
          console.warn("JWT_SECRET non configuré, token JWT non généré");
        }

        return res.json({
          token,
          user: {
            id: user.id,
            username: user.username,
            role: user.role,
            nom: user.nom,
            prenom: user.prenom,
            organisationId: user.organisationId,
          },
        });
      });
    })(req, res, next);
  });

  app.post("/api/auth/logout", (req, res) => {
    req.logout((err) => {
      if (err) {
        return res.status(500).json({ error: "Erreur lors de la déconnexion" });
      }
      res.json({ success: true });
    });
  });

  app.get("/api/auth/user", (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Non authentifié" });
    }
    res.json(req.user);
  });

  app.post("/api/auth/register", async (req, res) => {
    try {
      const { username, password, nom, prenom } = req.body;

      if (!username || !password) {
        return res.status(400).json({ error: "Nom d'utilisateur et mot de passe requis" });
      }

      if (password.length < 6) {
        return res.status(400).json({ error: "Le mot de passe doit contenir au moins 6 caractères" });
      }

      const existingUser = await storage.getUserByUsername(username);
      if (existingUser) {
        return res.status(400).json({ error: "Ce nom d'utilisateur existe déjà" });
      }

      const hashedPassword = await hashPassword(password);
      const DEFAULT_ORG_ID = "default-org-001";
      const user = await storage.createUser({
        username,
        password: hashedPassword,
        nom: nom || null,
        prenom: prenom || null,
        role: "ASSISTANT",
        organisationId: DEFAULT_ORG_ID,
      });

      req.logIn(
        {
          id: user.id,
          username: user.username,
          role: user.role,
          nom: user.nom,
          prenom: user.prenom,
          organisationId: user.organisationId,
        },
        (err) => {
          if (err) {
            return res.status(500).json({ error: "Erreur lors de la connexion" });
          }
          return res.status(201).json({
            id: user.id,
            username: user.username,
            role: user.role,
            nom: user.nom,
            prenom: user.prenom,
            organisationId: user.organisationId,
          });
        }
      );
    } catch (error) {
      console.error("Error registering user:", error);
      res.status(500).json({ error: "Erreur lors de l'inscription" });
    }
  });

  // Inscription d'un nouveau cabinet avec création d'organisation et utilisateur ADMIN
  app.post("/api/auth/register-cabinet", async (req, res) => {
    try {
      const { organisationName, username, password, nom, prenom } = req.body;

      // Validation des champs requis
      if (!organisationName || !username || !password) {
        return res.status(400).json({ 
          error: "Nom du cabinet, nom d'utilisateur et mot de passe requis" 
        });
      }

      if (password.length < 6) {
        return res.status(400).json({ 
          error: "Le mot de passe doit contenir au moins 6 caractères" 
        });
      }

      // Vérifier si le nom d'utilisateur existe déjà
      const existingUser = await storage.getUserByUsername(username);
      if (existingUser) {
        return res.status(400).json({ error: "Ce nom d'utilisateur existe déjà" });
      }

      // 1. Créer la nouvelle organisation (cabinet)
      const organisation = await storage.createOrganisation({
        nom: organisationName,
      });

      // 2. Créer l'utilisateur ADMIN rattaché à cette organisation
      const hashedPassword = await hashPassword(password);
      const user = await storage.createUser({
        username,
        password: hashedPassword,
        nom: nom || null,
        prenom: prenom || null,
        role: "ADMIN",
        organisationId: organisation.id,
      });

      // 3. Générer le JWT avec organisationId
      let token: string | null = null;
      try {
        token = generateToken({
          userId: user.id,
          username: user.username,
          role: user.role,
          organisationId: user.organisationId,
        });
      } catch (e) {
        console.warn("JWT_SECRET non configuré, token JWT non généré");
      }

      // 4. Connecter l'utilisateur via session
      req.logIn(
        {
          id: user.id,
          username: user.username,
          role: user.role,
          nom: user.nom,
          prenom: user.prenom,
          organisationId: user.organisationId,
        },
        (err) => {
          if (err) {
            return res.status(500).json({ error: "Erreur lors de la connexion" });
          }

          // 5. Renvoyer la réponse complète
          return res.status(201).json({
            token,
            user: {
              id: user.id,
              username: user.username,
              role: user.role,
              nom: user.nom,
              prenom: user.prenom,
              organisationId: user.organisationId,
            },
            organisation: {
              id: organisation.id,
              nom: organisation.nom,
            },
          });
        }
      );
    } catch (error) {
      console.error("Error registering cabinet:", error);
      res.status(500).json({ error: "Erreur lors de l'inscription du cabinet" });
    }
  });
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Authentification requise" });
    return;
  }
  next();
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.isAuthenticated()) {
      res.status(401).json({ error: "Authentification requise" });
      return;
    }
    if (!roles.includes(req.user!.role)) {
      res.status(403).json({ error: "Accès interdit" });
      return;
    }
    next();
  };
}
