import { type User, type InsertUser } from "@shared/schema";

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private nextId = 1;

  constructor() {
    this.users = new Map();
  }

  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.email === email,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.nextId++;
    const user: User = {
      id,
      firstName: null,
      lastName: null,
      displayName: insertUser.displayName,
      displayNameLower: insertUser.displayNameLower,
      role: insertUser.role ?? "athlete",
      email: insertUser.email ?? null,
      passwordHash: insertUser.passwordHash ?? null,
      birthdate: insertUser.birthdate ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
      isActive: insertUser.isActive ?? true,
    };
    this.users.set(id, user);
    return user;
  }
}

export const storage = new MemStorage();
