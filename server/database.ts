import { MongoClient, ServerApiVersion, ObjectId } from 'mongodb';
import dotenv from 'dotenv';
dotenv.config({ path: '../../.env' });

// Types for our collections
export interface User {
    _id?: ObjectId;
    createdAt: Date;
    name?: string;
    email?: string;
    ip: string;
    sessionId?: string;
    requests?: any[];
    csat?: number;
}

export interface Message {
    _id?: ObjectId;
    createdAt: Date;
    userId: ObjectId;
    text?: string;
    author?: string;
}

export interface Function {
    _id?: ObjectId;
    createdAt: Date;
    userId: ObjectId;
    args?: Record<string, any>;
    response?: Record<string, any>;
}

export interface Reasoning {
    _id?: ObjectId;
    createdAt: Date;
    userId: ObjectId;
    text: string;
}

const uri = process.env.MONGODB_URI;
if (!uri) {
    throw new Error("MONGODB_URI is not set");
}

// Create a MongoClient with a MongoClientOptions object
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

// Database and collections
const db = client.db("glass-chat");
const Users = db.collection<User>("users");
const Messages = db.collection<Message>("messages");
const Functions = db.collection<Function>("functions");
const Reasonings = db.collection<Reasoning>("reasonings");

// Export collections for direct access
export { Users, Messages, Functions, Reasonings, client };

// Connect to MongoDB
export async function connectToDatabase() {
    try {
        await client.connect();
        await client.db("admin").command({ ping: 1 });
        console.log("Successfully connected to MongoDB.");
    } catch (error) {
        console.error("Error connecting to MongoDB:", error);
        throw error;
    }
}

// User CRUD Operations
export async function createUser(userData: Omit<User, '_id' | 'createdAt'>) {
    const user: User = {
        ...userData,
        createdAt: new Date(),
    };
    const result = await Users.insertOne(user);
    return result;
}

export async function getUser(userId: string) {
    return await Users.findOne({ _id: new ObjectId(userId) });
}

export async function updateUser(userId: string, updateData: Partial<User>) {
    const result = await Users.updateOne(
        { _id: new ObjectId(userId) },
        { $set: updateData }
    );
    return result;
}

export async function deleteUser(userId: string) {
    const result = await Users.deleteOne({ _id: new ObjectId(userId) });
    return result;
}

// Message CRUD Operations
export async function createMessage(messageData: Omit<Message, '_id' | 'createdAt'>) {
    const message: Message = {
        ...messageData,
        createdAt: new Date(),
    };
    const result = await Messages.insertOne(message);
    return result;
}

export async function getMessage(messageId: string) {
    return await Messages.findOne({ _id: new ObjectId(messageId) });
}

export async function getUserMessages(userId: string) {
    return await Messages.find({ userId: new ObjectId(userId) }).toArray();
}

export async function updateMessage(messageId: string, updateData: Partial<Message>) {
    const result = await Messages.updateOne(
        { _id: new ObjectId(messageId) },
        { $set: updateData }
    );
    return result;
}

export async function deleteMessage(messageId: string) {
    const result = await Messages.deleteOne({ _id: new ObjectId(messageId) });
    return result;
}

// Function CRUD Operations
export async function createFunction(functionData: Omit<Function, '_id' | 'createdAt'>) {
    const functionDoc: Function = {
        ...functionData,
        createdAt: new Date(),
    };
    const result = await Functions.insertOne(functionDoc);
    return result;
}

export async function getFunction(functionId: string) {
    return await Functions.findOne({ _id: new ObjectId(functionId) });
}

export async function getUserFunctions(userId: string) {
    return await Functions.find({ userId: new ObjectId(userId) }).toArray();
}

export async function updateFunction(functionId: string, updateData: Partial<Function>) {
    const result = await Functions.updateOne(
        { _id: new ObjectId(functionId) },
        { $set: updateData }
    );
    return result;
}

export async function deleteFunction(functionId: string) {
    const result = await Functions.deleteOne({ _id: new ObjectId(functionId) });
    return result;
}

// Reasoning CRUD Operations
export async function createReasoning(reasoningData: Omit<Reasoning, '_id' | 'createdAt'>) {
    const reasoning: Reasoning = {
        ...reasoningData,
        createdAt: new Date(),
    };
    const result = await Reasonings.insertOne(reasoning);
    return result;
}

export async function getReasoning(reasoningId: string) {
    return await Reasonings.findOne({ _id: new ObjectId(reasoningId) });
}

export async function getUserReasonings(userId: string) {
    return await Reasonings.find({ userId: new ObjectId(userId) }).toArray();
}

export async function updateReasoning(reasoningId: string, updateData: Partial<Reasoning>) {
    const result = await Reasonings.updateOne(
        { _id: new ObjectId(reasoningId) },
        { $set: updateData }
    );
    return result;
}

export async function deleteReasoning(reasoningId: string) {
    const result = await Reasonings.deleteOne({ _id: new ObjectId(reasoningId) });
    return result;
}

// Cleanup function to close the connection
export async function closeConnection() {
    await client.close();
    console.log("MongoDB connection closed.");
}
