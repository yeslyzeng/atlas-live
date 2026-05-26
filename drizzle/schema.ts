import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, float } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Resources table — stores all atlas entries (films, music, books, art, etc.)
 */
export const resources = mysqlTable("resources", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 500 }).notNull(),
  creator: varchar("creator", { length: 300 }),
  year: int("year"),
  type: varchar("type", { length: 50 }).notNull().default("other"),
  url: text("url"),
  description: text("description"),
  imageUrl: text("imageUrl"),
  themes: text("themes"), // JSON array stored as text
  tags: text("tags"), // JSON array stored as text
  language: varchar("language", { length: 10 }),
  location: varchar("location", { length: 300 }),
  latitude: varchar("latitude", { length: 20 }),
  longitude: varchar("longitude", { length: 20 }),
  quoteText: text("quoteText"),
  videoUrl: text("videoUrl"),
  aspectRatio: varchar("aspectRatio", { length: 10 }),
  dominantHue: float("dominantHue"),
  addedBy: int("addedBy"),
  addedAt: timestamp("addedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Resource = typeof resources.$inferSelect;
export type InsertResource = typeof resources.$inferInsert;
