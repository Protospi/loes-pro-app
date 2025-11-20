import { type User, type InsertUser, type Message, type InsertMessage } from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Message operations
  getMessages(): Promise<Message[]>;
  createMessage(message: InsertMessage): Promise<Message>;
  clearMessages(): Promise<void>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private messages: Map<string, Message>;

  constructor() {
    this.users = new Map();
    this.messages = new Map();
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async getMessages(): Promise<Message[]> {
    const messages = Array.from(this.messages.values()).sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
    console.log('📦 Storage - Total messages:', messages.length);
    messages.forEach((msg, i) => {
      console.log(`  ${i + 1}. [${msg.timestamp.toISOString()}] ${msg.isUser ? 'User' : 'Assistant'}: ${msg.content.substring(0, 50)}...`);
    });
    return messages;
  }

  async createMessage(insertMessage: InsertMessage & { fileId?: string | null, fileName?: string | null }): Promise<Message> {
    const id = randomUUID();
    const message: Message = {
      ...insertMessage,
      id,
      timestamp: new Date(),
      isUser: insertMessage.isUser ?? false,
      userId: insertMessage.userId ?? null,
      fileId: insertMessage.fileId ?? null,
      fileName: insertMessage.fileName ?? null,
    };
    this.messages.set(id, message);
    console.log('💾 Storage - Created message:', {
      id,
      isUser: message.isUser,
      content: message.content.substring(0, 50) + '...',
      fileId: message.fileId,
      fileName: message.fileName,
      totalMessages: this.messages.size
    });
    return message;
  }

  async clearMessages(): Promise<void> {
    this.messages.clear();
  }
}

export const storage = new MemStorage();
