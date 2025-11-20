import { MongoClient, ObjectId } from 'mongodb';
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
const client = new MongoClient(uri);

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

// Analytics Aggregation Functions
export async function getAnalyticsSummary(startDate: Date, endDate: Date) {
    try {
        const dateFilter = {
            createdAt: {
                $gte: startDate,
                $lte: endDate
            }
        };

        // Fetch all data in parallel
        const [messages, functions, reasonings, allUsersForCSAT] = await Promise.all([
            Messages.find(dateFilter).toArray(),
            Functions.find(dateFilter).toArray(),
            Reasonings.find(dateFilter).toArray(),
            Users.find({ csat: { $exists: true, $ne: null } }).toArray()
        ]);

        // Calculate metrics in JavaScript
        const totalMessages = messages.length;
        const functionCount = functions.length;
        const reasoningCount = reasonings.length;

        // Count unique users based on all activity (messages, functions, reasonings)
        const uniqueUserIds = new Set<string>();
        
        // Add users from messages
        messages.forEach(m => uniqueUserIds.add(m.userId.toString()));
        
        // Add users from functions
        functions.forEach(f => uniqueUserIds.add(f.userId.toString()));
        
        // Add users from reasonings
        reasonings.forEach(r => uniqueUserIds.add(r.userId.toString()));
        
        const userCount = uniqueUserIds.size;

        // Count unique users who sent messages (conversations)
        const conversationUserIds = new Set(
            messages
                .filter(m => m.author === 'user')
                .map(m => m.userId.toString())
        );
        const totalConversations = conversationUserIds.size;

        // Calculate average CSAT
        const avgCSAT = allUsersForCSAT.length > 0
            ? allUsersForCSAT.reduce((sum, u) => sum + (u.csat || 0), 0) / allUsersForCSAT.length
            : 75;

        return {
            users: userCount,
            messages: totalMessages,
            functions: functionCount,
            reasonings: reasoningCount,
            conversations: totalConversations,
            csat: Math.round(avgCSAT)
        };
    } catch (error) {
        console.error('Error in getAnalyticsSummary:', error);
        throw error;
    }
}

export async function getTimeSeriesData(
    startDate: Date, 
    endDate: Date, 
    granularity: 'hour' | 'day' | 'month'
) {
    try {
        const dateFilter = {
            createdAt: {
                $gte: startDate,
                $lte: endDate
            }
        };

        // Fetch all data
        const [messages, users, functions, reasonings] = await Promise.all([
            Messages.find(dateFilter).toArray(),
            Users.find(dateFilter).toArray(),
            Functions.find(dateFilter).toArray(),
            Reasonings.find(dateFilter).toArray()
        ]);

        // Helper function to format date based on granularity
        const formatDate = (date: Date): string => {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            const hour = String(date.getHours()).padStart(2, '0');

            switch (granularity) {
                case 'hour':
                    // For hour granularity, normalize to a base date and keep only the hour
                    // This aggregates all activity by hour across all days
                    return `2024-01-01T${hour}:00:00.000Z`;
                case 'month':
                    return `${year}-${month}-01T00:00:00.000Z`;
                case 'day':
                default:
                    return `${year}-${month}-${day}T00:00:00.000Z`;
            }
        };

        // Create time series map
        const timeSeriesMap = new Map<string, {
            date: Date;
            users: Set<string>;
            messages: number;
            functions: number;
            reasonings: number;
            csatSum: number;
            csatCount: number;
        }>();

        // Helper to get or create time series entry
        const getOrCreateEntry = (key: string) => {
            if (!timeSeriesMap.has(key)) {
                timeSeriesMap.set(key, {
                    date: new Date(key),
                    users: new Set(),
                    messages: 0,
                    functions: 0,
                    reasonings: 0,
                    csatSum: 0,
                    csatCount: 0
                });
            }
            return timeSeriesMap.get(key)!;
        };

        // Process messages
        messages.forEach(message => {
            const key = formatDate(message.createdAt);
            const entry = getOrCreateEntry(key);
            entry.messages++;
            entry.users.add(message.userId.toString());
        });

        // Process functions
        functions.forEach(func => {
            const key = formatDate(func.createdAt);
            const entry = getOrCreateEntry(key);
            entry.functions++;
            entry.users.add(func.userId.toString());
        });

        // Process reasonings
        reasonings.forEach(reasoning => {
            const key = formatDate(reasoning.createdAt);
            const entry = getOrCreateEntry(key);
            entry.reasonings++;
            entry.users.add(reasoning.userId.toString());
        });

        // Process users and CSAT
        users.forEach(user => {
            const key = formatDate(user.createdAt);
            const entry = getOrCreateEntry(key);
            // Add CSAT if available
            if (user.csat && user.csat >= 0 && user.csat <= 100) {
                entry.csatSum += user.csat;
                entry.csatCount++;
            }
        });

        // Fill in missing time periods with zeros
        const fillMissingPeriods = () => {
            if (granularity === 'hour') {
                // For hour granularity, show all hours 0-23
                // Using a normalized base date since we're aggregating by hour only
                for (let hour = 0; hour < 24; hour++) {
                    const date = new Date('2024-01-01T00:00:00.000Z');
                    date.setHours(hour, 0, 0, 0);
                    const key = formatDate(date);
                    getOrCreateEntry(key);
                }
            } else if (granularity === 'day') {
                // For day granularity, fill all days in the range
                const currentDate = new Date(startDate);
                currentDate.setHours(0, 0, 0, 0);
                const endDateNormalized = new Date(endDate);
                endDateNormalized.setHours(0, 0, 0, 0);
                
                while (currentDate <= endDateNormalized) {
                    const key = formatDate(currentDate);
                    getOrCreateEntry(key);
                    currentDate.setDate(currentDate.getDate() + 1);
                }
            } else if (granularity === 'month') {
                // For month granularity, fill all months in the range
                const currentDate = new Date(startDate);
                currentDate.setDate(1);
                currentDate.setHours(0, 0, 0, 0);
                const endDateNormalized = new Date(endDate);
                endDateNormalized.setDate(1);
                endDateNormalized.setHours(0, 0, 0, 0);
                
                while (currentDate <= endDateNormalized) {
                    const key = formatDate(currentDate);
                    getOrCreateEntry(key);
                    currentDate.setMonth(currentDate.getMonth() + 1);
                }
            }
        };

        // Fill in any missing periods with zero values
        fillMissingPeriods();

        // Convert to array format with counts
        const result = Array.from(timeSeriesMap.entries())
            .map(([key, value]) => ({
                date: value.date,
                users: value.users.size,
                messages: value.messages,
                functions: value.functions,
                reasonings: value.reasonings,
                csat: value.csatCount > 0 ? Math.round(value.csatSum / value.csatCount) : 0
            }))
            .sort((a, b) => a.date.getTime() - b.date.getTime());

        return result;
    } catch (error) {
        console.error('Error in getTimeSeriesData:', error);
        throw error;
    }
}

// Cleanup function to close the connection
export async function closeConnection() {
    await client.close();
    console.log("MongoDB connection closed.");
}
