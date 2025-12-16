import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export interface JwtPayload {
  userId: string;
  username: string;
  role: string;
  organisationId: string | null;
}

declare global {
  namespace Express {
    interface Request {
      jwtUser?: JwtPayload;
    }
  }
}

const JWT_SECRET = process.env.JWT_SECRET;

export function requireJwt(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ 
      error: "Accès non autorisé",
      message: "Token JWT manquant. Utilisez le header: Authorization: Bearer <token>"
    });
  }

  const token = authHeader.substring(7);

  if (!JWT_SECRET) {
    console.error("JWT_SECRET non configuré dans les variables d'environnement");
    return res.status(500).json({ 
      error: "Erreur de configuration serveur",
      message: "JWT_SECRET non défini"
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
    req.jwtUser = decoded;
    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({ 
        error: "Token expiré",
        message: "Votre session a expiré. Veuillez vous reconnecter."
      });
    }
    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({ 
        error: "Token invalide",
        message: "Le token JWT fourni est invalide."
      });
    }
    return res.status(401).json({ 
      error: "Erreur d'authentification",
      message: "Impossible de vérifier le token."
    });
  }
}

export function requireJwtOrSession(req: Request, res: Response, next: NextFunction) {
  if (typeof req.isAuthenticated === "function" && req.isAuthenticated() && req.user) {
    req.jwtUser = {
      userId: req.user.id,
      username: req.user.username,
      role: req.user.role,
      organisationId: req.user.organisationId,
    };
    return next();
  }

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return requireJwt(req, res, next);
  }

  return res.status(401).json({ 
    error: "Accès non autorisé",
    message: "Authentification requise (session ou JWT)"
  });
}

export function generateToken(payload: JwtPayload, expiresInSeconds: number = 14400): string {
  if (!JWT_SECRET) {
    throw new Error("JWT_SECRET non configuré");
  }
  return jwt.sign(payload, JWT_SECRET, { expiresIn: expiresInSeconds });
}
