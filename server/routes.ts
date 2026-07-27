import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import session from "express-session";
import createMemoryStore from "memorystore";
import passport from "passport";
import { Strategy as GoogleStrategy, type Profile } from "passport-google-oauth20";
import { randomBytes, scryptSync, timingSafeEqual } from "crypto";

type AuthUser = {
  id: string;
  displayName: string;
  email: string;
  photo?: string;
};

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const [salt, savedHash] = stored.split(":");
  if (!salt || !savedHash) {
    return false;
  }

  const computedHash = scryptSync(password, salt, 64).toString("hex");
  const savedHashBuffer = Buffer.from(savedHash, "hex");
  const computedHashBuffer = Buffer.from(computedHash, "hex");
  if (savedHashBuffer.length !== computedHashBuffer.length) {
    return false;
  }

  return timingSafeEqual(savedHashBuffer, computedHashBuffer);
}

declare global {
  namespace Express {
    interface User extends AuthUser {}
  }
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  const googleConfigured = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
  const demoAuthEnabled = process.env.NODE_ENV !== "production";
  const localAuthEnabled = true;

  const MemoryStore = createMemoryStore(session);
  const sessionSecret = process.env.SESSION_SECRET || "dev-session-secret-change-me";

  app.set("trust proxy", 1);
  app.use(
    session({
      store: new MemoryStore({
        checkPeriod: 24 * 60 * 60 * 1000,
      }),
      secret: sessionSecret,
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: 7 * 24 * 60 * 60 * 1000,
      },
    }),
  );

  app.use(passport.initialize());
  app.use(passport.session());

  passport.serializeUser((user, done) => {
    done(null, user);
  });

  passport.deserializeUser((user: AuthUser, done) => {
    done(null, user);
  });

  if (googleConfigured) {
    const googleClientId = process.env.GOOGLE_CLIENT_ID as string;
    const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET as string;

    passport.use(
      new GoogleStrategy(
        {
          clientID: googleClientId,
          clientSecret: googleClientSecret,
          callbackURL: "/api/auth/google/callback",
        },
        (_accessToken: string, _refreshToken: string, profile: Profile, done: (error: unknown, user?: AuthUser) => void) => {
          const user: AuthUser = {
            id: profile.id,
            displayName: profile.displayName,
            email: profile.emails?.[0]?.value || "",
            photo: profile.photos?.[0]?.value,
          };
          done(null, user);
        },
      ),
    );
  }

  app.get("/api/auth/me", (req, res) => {
    if (!req.isAuthenticated || !req.isAuthenticated()) {
      return res.status(401).json({ authenticated: false });
    }

    return res.status(200).json({
      authenticated: true,
      user: req.user,
    });
  });

  app.get("/api/auth/config", (_req, res) => {
    res.status(200).json({
      googleConfigured,
      demoAuthEnabled,
      localAuthEnabled,
    });
  });

  app.post("/api/auth/register", async (req, res, next) => {
    try {
      if (!localAuthEnabled) {
        return res.status(403).json({ message: "Email/password sign-up is disabled." });
      }

      const email = String(req.body?.email || "").trim().toLowerCase();
      const password = String(req.body?.password || "");
      const displayName = String(req.body?.displayName || "").trim();

      if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required." });
      }

      if (password.length < 8) {
        return res.status(400).json({ message: "Password must be at least 8 characters." });
      }

      const existing = await storage.getUserByUsername(email);
      if (existing) {
        return res.status(409).json({ message: "An account with this email already exists." });
      }

      const created = await storage.createUser({
        username: email,
        password: hashPassword(password),
      });

      const authUser: AuthUser = {
        id: created.id,
        displayName: displayName || email.split("@")[0],
        email,
      };

      req.logIn(authUser, (err) => {
        if (err) {
          return next(err);
        }
        return res.status(201).json({ ok: true, user: authUser });
      });
    } catch (error) {
      return next(error);
    }
  });

  app.post("/api/auth/login", async (req, res, next) => {
    try {
      if (!localAuthEnabled) {
        return res.status(403).json({ message: "Email/password login is disabled." });
      }

      const email = String(req.body?.email || "").trim().toLowerCase();
      const password = String(req.body?.password || "");

      if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required." });
      }

      const user = await storage.getUserByUsername(email);
      if (!user || !verifyPassword(password, user.password)) {
        return res.status(401).json({ message: "Invalid email or password." });
      }

      const authUser: AuthUser = {
        id: user.id,
        displayName: email.split("@")[0],
        email,
      };

      req.logIn(authUser, (err) => {
        if (err) {
          return next(err);
        }
        return res.status(200).json({ ok: true, user: authUser });
      });
    } catch (error) {
      return next(error);
    }
  });

  app.get("/api/auth/google", (req, res, next) => {
    if (!googleConfigured) {
      return res.redirect("/login?error=google_not_configured");
    }

    const nextPath = typeof req.query.next === "string" ? req.query.next : "/builder";
    const state = Buffer.from(JSON.stringify({ next: nextPath })).toString("base64url");

    passport.authenticate("google", {
      scope: ["profile", "email"],
      state,
    })(req, res, next);
  });

  app.get("/api/auth/google/callback", (req, res, next) => {
    passport.authenticate("google", { failureRedirect: "/login?error=google_auth_failed" }, (err: unknown, user?: Express.User) => {
      if (err) {
        return next(err);
      }

      if (!user) {
        return res.redirect("/login?error=google_auth_failed");
      }

      req.logIn(user, (loginErr) => {
        if (loginErr) {
          return next(loginErr);
        }

        let redirectPath = "/builder";
        const encodedState = typeof req.query.state === "string" ? req.query.state : "";
        if (encodedState) {
          try {
            const parsed = JSON.parse(Buffer.from(encodedState, "base64url").toString("utf8")) as {
              next?: string;
            };
            if (parsed.next && parsed.next.startsWith("/")) {
              redirectPath = parsed.next;
            }
          } catch {
            // Ignore invalid state payload and use default route.
          }
        }

        return res.redirect(redirectPath);
      });
    })(req, res, next);
  });

  app.post("/api/auth/logout", (req, res, next) => {
    req.logout((logoutErr) => {
      if (logoutErr) {
        return next(logoutErr);
      }

      req.session.destroy((sessionErr) => {
        if (sessionErr) {
          return next(sessionErr);
        }
        res.clearCookie("connect.sid");
        return res.status(200).json({ ok: true });
      });
    });
  });

  app.post("/api/auth/dev-login", (req, res, next) => {
    if (!demoAuthEnabled) {
      return res.status(403).json({ message: "Demo login disabled in production." });
    }

    const demoUser: AuthUser = {
      id: "dev-user",
      displayName: "Demo User",
      email: "demo@resumehub.local",
    };

    req.logIn(demoUser, (err) => {
      if (err) {
        return next(err);
      }
      return res.status(200).json({ ok: true, user: demoUser });
    });
  });

  app.get("/api/health", (_req, res) => {
    res.status(200).json({
      status: "ok",
      uptimeSec: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
      service: "rest-express",
    });
  });

  app.get("/api/ready", async (_req, res) => {
    try {
      // Minimal runtime dependency check.
      await storage.getUserByUsername("__healthcheck__");

      res.status(200).json({
        status: "ready",
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(503).json({
        status: "not_ready",
        message: "Storage dependency check failed",
      });
    }
  });

  // put application routes here
  // prefix all routes with /api

  // use storage to perform CRUD operations on the storage interface
  // e.g. storage.insertUser(user) or storage.getUserByUsername(username)

  return httpServer;
}
