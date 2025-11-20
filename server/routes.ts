import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertMessageSchema } from "@shared/schema";
import { z } from "zod";
import { generateAIResponse, detectLanguage, detectLanguageAndTranslate, transcribeAudio, uploadFileToOpenAI } from "./openai";
import { engine } from "./resources/engine";
import { GoogleCalendarService } from "./google-calendar";
import multer from "multer";
import path from "path";
import fs from "fs";
import { ObjectId } from 'mongodb';
import * as db from './database';

export async function registerRoutes(app: Express): Promise<Server> {
  // Initialize engine instance
  const aiEngine = new engine();

  // Helper function to get or create user by session ID
  async function getOrCreateUserBySession(sessionId: string, ip: string): Promise<ObjectId> {
    try {
      // Try to find existing user by session ID
      const { Users } = await import('./database.js');
      const existingUser = await Users.findOne({ sessionId });
      
      if (existingUser) {
        console.log('👤 Found existing user for session:', sessionId, '- User ID:', existingUser._id);
        return existingUser._id;
      }
      
      // Create new user if not found
      console.log('👤 Creating new user for session:', sessionId, 'IP:', ip);
      const result = await db.createUser({ sessionId, ip });
      return result.insertedId;
    } catch (error) {
      console.error('Error getting/creating user:', error);
      throw error;
    }
  }

  // Helper function to extract session ID from request
  function getSessionId(req: any): string {
    const sessionId = req.headers['x-session-id'];
    if (!sessionId) {
      throw new Error('Session ID not provided in request headers');
    }
    return sessionId;
  }

  // Helper function to convert conversation history to engine format
  function convertHistoryToEngineFormat(messages: Array<{ content: string; isUser: boolean }>): any[] {
    const engineMessages: any[] = [];
    
    // Add system prompt first (this will be handled by engine if input.length === 0)
    // But if we have conversation history, we need to build the full context
    
    if (messages.length > 0) {
      // If we have conversation history, we need to include it all
      console.log('🔄 Converting conversation history to engine format:');
      for (const msg of messages) {
        const role = msg.isUser ? "user" : "assistant";
        console.log(`  - Converting [${role}]: ${msg.content.substring(0, 50)}...`);
        engineMessages.push({
          role: role,
          content: msg.content
        });
      }
      console.log('✅ Converted', messages.length, 'messages to engine format');
    } else {
      console.log('🆕 No conversation history - starting fresh');
    }
    
    return engineMessages;
  }

  // Configure multer for audio file uploads
  const upload = multer({
    storage: multer.diskStorage({
      destination: 'uploads/',
      filename: (req, file, cb) => {
        // Ensure proper file extension for webm files
        const ext = file.mimetype === 'audio/webm' ? '.webm' : path.extname(file.originalname) || '.webm';
        cb(null, Date.now() + ext);
      }
    }),
    limits: {
      fileSize: 25 * 1024 * 1024, // 25MB limit
    },
    fileFilter: (req, file, cb) => {
      // Accept audio files
      if (file.mimetype.startsWith('audio/')) {
        cb(null, true);
      } else {
        cb(new Error('Only audio files are allowed'));
      }
    }
  });

  // Configure multer for document file uploads
  const fileUpload = multer({
    storage: multer.diskStorage({
      destination: 'uploads/',
      filename: (req, file, cb) => {
        const ext = path.extname(file.originalname) || '';
        cb(null, Date.now() + ext);
      }
    }),
    limits: {
      fileSize: 50 * 1024 * 1024, // 50MB limit for documents
    },
    fileFilter: (req, file, cb) => {
      // Accept common document formats and images
      const allowedTypes = [
        'application/pdf',
        'text/plain',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/markdown',
        'application/json',
        'text/csv',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'image/jpeg',
        'image/jpg',
        'image/png',
        'image/gif',
        'image/webp',
        'image/svg+xml'
      ];
      
      if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error('Only document files and images are allowed (PDF, TXT, DOC, DOCX, MD, JSON, CSV, XLS, XLSX, JPG, PNG, GIF, WEBP, SVG)'));
      }
    }
  });

  // Audio transcription endpoint
  app.post("/api/transcribe", upload.single('audio'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No audio file provided" });
      }

      console.log('File received:', {
        filename: req.file.filename,
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
        path: req.file.path
      });

      // Check if file exists
      if (!fs.existsSync(req.file.path)) {
        console.error('File does not exist at path:', req.file.path);
        return res.status(400).json({ error: "Audio file not found" });
      }

      // Transcribe the audio file
      const transcribedText = await transcribeAudio(req.file.path);
      
      // Clean up the temporary file
      fs.unlinkSync(req.file.path);
      
      console.log('✅ Audio transcription completed:', transcribedText.text);
      
      // Return only the transcribed text
      // The client will handle creating the messages and getting the AI response
      // This ensures the typing indicator shows properly
      res.json({
        transcribedText: transcribedText.text
      });
    } catch (error) {
      // Clean up the temporary file in case of error
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      
      console.error("Audio transcription error:", error);
      res.status(500).json({ error: "Failed to transcribe audio" });
    }
  });

  // File upload endpoint
  app.post("/api/upload-file", fileUpload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file provided" });
      }

      console.log('File received:', {
        filename: req.file.filename,
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
        path: req.file.path
      });

      // Check if file exists
      if (!fs.existsSync(req.file.path)) {
        console.error('File does not exist at path:', req.file.path);
        return res.status(400).json({ error: "File not found" });
      }

      // Upload file to OpenAI
      const fileId = await uploadFileToOpenAI(req.file.path);
      
      // Clean up the temporary file
      fs.unlinkSync(req.file.path);
      
      console.log('File uploaded to OpenAI with ID:', fileId);
      
      res.json({
        fileId,
        originalName: req.file.originalname,
        size: req.file.size,
        type: req.file.mimetype
      });
    } catch (error) {
      // Clean up the temporary file in case of error
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      
      console.error("File upload error:", error);
      res.status(500).json({ error: "Failed to upload file" });
    }
  });

  // Detect language and translate interface
  app.post("/api/language-detection", async (req, res) => {
    try {
      const { text } = req.body;
      if (!text) {
        return res.status(400).json({ error: "Text is required" });
      }
      
      const result = await detectLanguageAndTranslate(text);
      res.json(result);
    } catch (error) {
      console.error("Language detection error:", error);
      res.status(500).json({ error: "Failed to detect language and translate interface" });
    }
  });


  // Get all messages
  app.get("/api/messages", async (_req, res) => {
    try {
      const messages = await storage.getMessages();
      res.json(messages);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch messages" });
    }
  });

  // Create a new message
  app.post("/api/messages", async (req, res) => {
    try {
      // Extract all fields including fileId and fileName
      const { content, isUser, userId, fileId, fileName } = req.body;
      const messageData = insertMessageSchema.parse({ content, isUser, userId });
      
      // Create message with file information
      const message = await storage.createMessage({
        ...messageData,
        fileId,
        fileName,
      });
      
      // Mirror to MongoDB (don't block the response)
      const sessionId = getSessionId(req);
      const userIP = req.ip || req.socket.remoteAddress || '127.0.0.1';
      getOrCreateUserBySession(sessionId, userIP).then(userId => {
        db.createMessage({
          userId,
          text: messageData.content,
          author: messageData.isUser ? 'user' : 'assistant'
        }).then(() => {
          console.log('💾 Message persisted to MongoDB');
        }).catch(err => {
          console.error('Error persisting message to MongoDB:', err);
        });
      }).catch(err => {
        console.error('Error getting user for message persistence:', err);
      });
      
      res.json(message);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid message data", errors: error.errors });
      } else {
        res.status(500).json({ message: "Failed to create message" });
      }
    }
  });

  // Generate AI response for chat completion
  app.post("/api/chat/completion", async (req, res) => {
    try {
      const { content, fileId, fileName } = z.object({ 
        content: z.string(),
        fileId: z.string().optional(),
        fileName: z.string().optional()
      }).parse(req.body);
      
      // Small delay to ensure user message is saved (race condition fix)
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Get conversation history for context (user message should already be saved by frontend)
      const messages = await storage.getMessages();
      console.log('📚 Total messages in history:', messages.length);
      console.log('💬 Processing user message:', content);
      
      // If there's a file, exclude the current user message from history
      // The engine will add it with proper file format
      let conversationHistory = messages;
      if (fileId && messages.length > 0) {
        // Remove the last message (current user message) so engine can add it with file
        conversationHistory = messages.slice(0, -1);
        console.log('📎 File detected - excluding current user message from history to add with file format');
      }
      
      // Convert conversation history to engine format
      const engineInput = convertHistoryToEngineFormat(conversationHistory);
      console.log('🔄 Engine input length:', engineInput.length);
      
      // Debug: Show recent conversation history
      console.log('📜 Recent conversation history (sent to engine):');
      conversationHistory.slice(-5).forEach((msg, i) => {
        const fileInfo = msg.fileId ? ` [📎 ${msg.fileName || 'file'}]` : '';
        console.log(`  ${i + 1}. ${msg.isUser ? 'User' : 'Assistant'}: ${msg.content.substring(0, 50)}...${fileInfo}`);
      });
      if (fileId && messages.length > 0) {
        console.log(`  → Current message with file will be added by engine with proper format`);
      }
      
      // Get userId for reasoning storage
      const sessionId = getSessionId(req);
      const userIP = req.ip || req.socket.remoteAddress || '127.0.0.1';
      const userId = await getOrCreateUserBySession(sessionId, userIP);
      
      // Generate AI response using the engine
      // Pass the fileId directly to the engine - it will handle the file formatting
      let engineResult;
      if (fileId) {
        console.log('📎 File attached:', fileName || fileId, '- OpenAI File ID:', fileId);
        engineResult = await aiEngine.run(content, engineInput, fileId, userId);
      } else {
        engineResult = await aiEngine.run(content, engineInput, undefined, userId);
      }
      
      // Extract the AI response from engine result
      // The engine returns the conversation array, find the last assistant message
      const lastAssistantMessage = engineResult
        .filter((msg: any) => msg.role === "assistant")
        .pop();
      
      // Debug the message structure
      console.log('🔍 Debug - Last assistant message:', JSON.stringify(lastAssistantMessage, null, 2));
      
      // Extract the actual text content
      const responseText = lastAssistantMessage?.content || 
        "I apologize, but I couldn't generate a response at the moment.";
      
      // Save the AI response as a message
      const responseMessage = await storage.createMessage({
        content: responseText,
        isUser: false,
      });
      console.log('🤖 AI response saved:', responseText.substring(0, 100) + '...');
      
      // Mirror AI response to MongoDB (don't block the response, reusing userId from above)
      Promise.resolve(userId).then(userId => {
        db.createMessage({
          userId,
          text: responseText,
          author: 'assistant'
        }).then(() => {
          console.log('💾 AI response persisted to MongoDB');
        }).catch(err => {
          console.error('Error persisting AI response to MongoDB:', err);
        });
        
        // Extract and persist function calls
        const functionCalls = engineResult.filter((msg: any) => msg.type === 'function_call');
        const functionOutputs = engineResult.filter((msg: any) => msg.type === 'function_call_output');
        
        if (functionCalls.length > 0) {
          console.log('🔧 Persisting', functionCalls.length, 'function calls to MongoDB');
          functionCalls.forEach((funcCall: any, index: number) => {
            const output = functionOutputs.find((fo: any) => fo.call_id === funcCall.call_id);
            db.createFunction({
              userId,
              args: {
                name: funcCall.name,
                call_id: funcCall.call_id,
                arguments: JSON.parse(funcCall.arguments)
              },
              response: {
                output: output?.output || null
              }
            }).then(() => {
              console.log(`💾 Function call ${funcCall.name} persisted to MongoDB`);
            }).catch(err => {
              console.error(`Error persisting function call ${funcCall.name}:`, err);
            });
          });
        }
      }).catch(err => {
        console.error('Error getting user for persistence:', err);
      });
      
      res.json(responseMessage);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid request data", errors: error.errors });
      } else {
        console.error("Chat completion error:", error);
        res.status(500).json({ message: "Failed to generate AI response" });
      }
    }
  });

  // Delete all messages (clear conversation)
  app.delete("/api/messages", async (_req, res) => {
    try {
      await storage.clearMessages();
      res.json({ message: "All messages cleared" });
    } catch (error) {
      res.status(500).json({ message: "Failed to clear messages" });
    }
  });

  // Google Calendar OAuth setup routes
  app.get("/api/auth/google", async (_req, res) => {
    try {
      const calendarService = new GoogleCalendarService(true);
      const authUrl = calendarService.getAuthUrl();
      res.json({ authUrl });
    } catch (error) {
      console.error("OAuth URL generation error:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to generate OAuth URL";
      
      // Send detailed error response for OAuth setup issues
      if (errorMessage.includes('Missing Google OAuth credentials')) {
        res.status(400).json({ 
          error: "OAuth not configured", 
          message: errorMessage,
          setupInstructions: {
            step1: "Create a .env file in your project root",
            step2: "Add Google OAuth credentials from Google Cloud Console",
            step3: "Set GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET",
            step4: "Restart your server and try again",
            guide: "Check CALENDAR_SETUP.md for detailed instructions"
          }
        });
      } else {
        res.status(500).json({ error: errorMessage });
      }
    }
  });

  app.get("/auth/callback", async (req, res) => {
    try {
      const { code } = req.query;
      if (!code) {
        return res.status(400).send(`
          <html>
            <body style="font-family: Arial, sans-serif; padding: 40px; background-color: #f5f5f5;">
              <div style="max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                <h1 style="color: #d32f2f;">❌ Authorization Failed</h1>
                <p>Authorization code not provided. Please try the authorization process again.</p>
                <a href="/booking" style="background: #1976d2; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">← Back to Booking</a>
              </div>
            </body>
          </html>
        `);
      }

      const calendarService = new GoogleCalendarService(true);
      await calendarService.setAuthCode(code as string);
      
      // Get the tokens to display
      const auth = (calendarService as any).auth;
      const credentials = auth.credentials;
      
      console.log('\n🎉 OAUTH SETUP SUCCESSFUL! 🎉');
      console.log('=================================');
      console.log('✅ Refresh Token:', credentials.refresh_token);
      console.log('✅ Access Token:', credentials.access_token);
      console.log('\n📝 Add this to your .env file:');
      console.log(`GOOGLE_OAUTH_REFRESH_TOKEN=${credentials.refresh_token}`);
      console.log('=================================\n');
      
      res.send(`
        <html>
          <head>
            <title>OAuth Setup Complete</title>
            <style>
              body { font-family: Arial, sans-serif; padding: 40px; background-color: #f5f5f5; }
              .container { max-width: 800px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
              .success { color: #2e7d32; }
              .token-box { background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0; font-family: monospace; word-break: break-all; }
              .copy-btn { background: #1976d2; color: white; padding: 8px 16px; border: none; border-radius: 4px; cursor: pointer; margin-left: 10px; }
              .copy-btn:hover { background: #1565c0; }
              .step { background: #e3f2fd; padding: 15px; border-radius: 8px; margin: 15px 0; }
            </style>
          </head>
          <body>
            <div class="container">
              <h1 class="success">🎉 OAuth Setup Complete!</h1>
              <p>Your Google Calendar integration is now authorized and ready to use.</p>
              
              <div class="step">
                <h3>📝 Step 1: Copy your refresh token</h3>
                <p>Add this line to your <code>.env</code> file:</p>
                <div class="token-box">
                  <strong>GOOGLE_OAUTH_REFRESH_TOKEN=</strong>${credentials.refresh_token}
                  <button class="copy-btn" onclick="navigator.clipboard.writeText('GOOGLE_OAUTH_REFRESH_TOKEN=${credentials.refresh_token}')">Copy</button>
                </div>
              </div>
              
              <div class="step">
                <h3>🔄 Step 2: Restart your server</h3>
                <p>After adding the refresh token to your .env file, restart your server for the changes to take effect.</p>
              </div>
              
              <div class="step">
                <h3>✅ Step 3: Test the booking system</h3>
                <p>Your calendar integration is now ready!</p>
                <a href="/booking" style="background: #2e7d32; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; margin-top: 10px;">
                  🗓️ Test Booking Page
                </a>
              </div>
              
              <hr style="margin: 30px 0;">
              <h3>🔧 Technical Details</h3>
              <p><strong>Access Token:</strong> <code>${credentials.access_token?.substring(0, 20)}...</code></p>
              <p><strong>Token Type:</strong> ${credentials.token_type || 'Bearer'}</p>
              <p><strong>Expires:</strong> ${credentials.expiry_date ? new Date(credentials.expiry_date).toLocaleString() : 'N/A'}</p>
            </div>
            
            <script>
              // Auto-scroll to top
              window.scrollTo(0, 0);
            </script>
          </body>
        </html>
      `);
    } catch (error) {
      console.error("OAuth callback error:", error);
      res.status(500).send(`
        <html>
          <body style="font-family: Arial, sans-serif; padding: 40px; background-color: #f5f5f5;">
            <div style="max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
              <h1 style="color: #d32f2f;">❌ Authorization Failed</h1>
              <p><strong>Error:</strong> ${error instanceof Error ? error.message : 'Unknown error occurred'}</p>
              <p>Please check your server logs for more details and try again.</p>
              <a href="/booking" style="background: #1976d2; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">← Back to Booking</a>
            </div>
          </body>
        </html>
      `);
    }
  });

  // Calendar availability check endpoint
  app.get("/api/calendar/availability", async (req, res) => {
    try {
      const { date, duration = 60 } = req.query;
      
      if (!date) {
        return res.status(400).json({ error: "Date parameter is required (YYYY-MM-DD format)" });
      }

      const calendarService = new GoogleCalendarService(true);
      const availability = await calendarService.findAvailableSlots({
        date: date as string,
        duration: parseInt(duration as string),
        workingHoursStart: "09:00",
        workingHoursEnd: "18:00"
      });

      res.json({ availability });
    } catch (error) {
      console.error("Calendar availability error:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to check calendar availability";
      
      // Provide helpful error messages for common OAuth issues
      if (errorMessage.includes('OAuth')) {
        res.status(401).json({ 
          error: "OAuth not configured or expired", 
          message: errorMessage,
          action: "Please complete OAuth setup first"
        });
      } else if (errorMessage.includes('invalid_grant')) {
        res.status(401).json({ 
          error: "OAuth token expired or invalid", 
          message: "Your refresh token has expired or is invalid",
          action: "Please re-authorize your application by visiting /api/auth/google"
        });
      } else {
        res.status(500).json({ error: errorMessage });
      }
    }
  });

  // MongoDB Analytics Routes
  
  // Connect to MongoDB when server starts
  await db.connectToDatabase();

  // User Routes
  app.post("/api/analytics/users", async (req, res) => {
    try {
      const { name, email, ip } = req.body;
      const result = await db.createUser({ name, email, ip });
      res.json(result);
    } catch (error) {
      console.error("Create user error:", error);
      res.status(500).json({ error: "Failed to create user" });
    }
  });

  app.get("/api/analytics/users/:id", async (req, res) => {
    try {
      const user = await db.getUser(req.params.id);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      res.json(user);
    } catch (error) {
      console.error("Get user error:", error);
      res.status(500).json({ error: "Failed to get user" });
    }
  });

  app.put("/api/analytics/users/:id", async (req, res) => {
    try {
      const result = await db.updateUser(req.params.id, req.body);
      res.json(result);
    } catch (error) {
      console.error("Update user error:", error);
      res.status(500).json({ error: "Failed to update user" });
    }
  });

  app.delete("/api/analytics/users/:id", async (req, res) => {
    try {
      const result = await db.deleteUser(req.params.id);
      res.json(result);
    } catch (error) {
      console.error("Delete user error:", error);
      res.status(500).json({ error: "Failed to delete user" });
    }
  });

  // Message Routes
  app.post("/api/analytics/messages", async (req, res) => {
    try {
      const { userId, text, author } = req.body;
      const result = await db.createMessage({ userId: new ObjectId(userId), text, author });
      res.json(result);
    } catch (error) {
      console.error("Create message error:", error);
      res.status(500).json({ error: "Failed to create message" });
    }
  });

  app.get("/api/analytics/messages/:id", async (req, res) => {
    try {
      const message = await db.getMessage(req.params.id);
      if (!message) {
        return res.status(404).json({ error: "Message not found" });
      }
      res.json(message);
    } catch (error) {
      console.error("Get message error:", error);
      res.status(500).json({ error: "Failed to get message" });
    }
  });

  app.get("/api/analytics/messages/user/:userId", async (req, res) => {
    try {
      const messages = await db.getUserMessages(req.params.userId);
      res.json(messages);
    } catch (error) {
      console.error("Get user messages error:", error);
      res.status(500).json({ error: "Failed to get user messages" });
    }
  });

  app.put("/api/analytics/messages/:id", async (req, res) => {
    try {
      const result = await db.updateMessage(req.params.id, req.body);
      res.json(result);
    } catch (error) {
      console.error("Update message error:", error);
      res.status(500).json({ error: "Failed to update message" });
    }
  });

  app.delete("/api/analytics/messages/:id", async (req, res) => {
    try {
      const result = await db.deleteMessage(req.params.id);
      res.json(result);
    } catch (error) {
      console.error("Delete message error:", error);
      res.status(500).json({ error: "Failed to delete message" });
    }
  });

  // Function Routes
  app.post("/api/analytics/functions", async (req, res) => {
    try {
      const { userId, args, response } = req.body;
      const result = await db.createFunction({ userId: new ObjectId(userId), args, response });
      res.json(result);
    } catch (error) {
      console.error("Create function error:", error);
      res.status(500).json({ error: "Failed to create function" });
    }
  });

  app.get("/api/analytics/functions/:id", async (req, res) => {
    try {
      const func = await db.getFunction(req.params.id);
      if (!func) {
        return res.status(404).json({ error: "Function not found" });
      }
      res.json(func);
    } catch (error) {
      console.error("Get function error:", error);
      res.status(500).json({ error: "Failed to get function" });
    }
  });

  app.get("/api/analytics/functions/user/:userId", async (req, res) => {
    try {
      const functions = await db.getUserFunctions(req.params.userId);
      res.json(functions);
    } catch (error) {
      console.error("Get user functions error:", error);
      res.status(500).json({ error: "Failed to get user functions" });
    }
  });

  app.put("/api/analytics/functions/:id", async (req, res) => {
    try {
      const result = await db.updateFunction(req.params.id, req.body);
      res.json(result);
    } catch (error) {
      console.error("Update function error:", error);
      res.status(500).json({ error: "Failed to update function" });
    }
  });

  app.delete("/api/analytics/functions/:id", async (req, res) => {
    try {
      const result = await db.deleteFunction(req.params.id);
      res.json(result);
    } catch (error) {
      console.error("Delete function error:", error);
      res.status(500).json({ error: "Failed to delete function" });
    }
  });

  // Get conversation flow for current user
  app.get("/api/conversation-flow", async (req, res) => {
    try {
      const sessionId = getSessionId(req);
      const userIP = req.ip || req.socket.remoteAddress || '127.0.0.1';
      const userId = await getOrCreateUserBySession(sessionId, userIP);
      
      // Fetch all data for this user
      const messages = await db.getUserMessages(userId.toString());
      const functions = await db.getUserFunctions(userId.toString());
      const reasonings = await db.getUserReasonings(userId.toString());
      
      // Combine and sort by createdAt
      const conversationFlow = [
        ...messages.map(m => ({ ...m, type: 'message', createdAt: m.createdAt })),
        ...functions.map(f => ({ ...f, type: 'function', createdAt: f.createdAt })),
        ...reasonings.map(r => ({ ...r, type: 'reasoning', createdAt: r.createdAt }))
      ].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      
      res.json({ conversationFlow, userId: userId.toString() });
    } catch (error) {
      console.error("Get conversation flow error:", error);
      res.status(500).json({ error: "Failed to get conversation flow" });
    }
  });

  // Get formatted conversation logs for display
  app.get("/api/conversation-logs", async (req, res) => {
    try {
      const sessionId = getSessionId(req);
      const userIP = req.ip || req.socket.remoteAddress || '127.0.0.1';
      const userId = await getOrCreateUserBySession(sessionId, userIP);
      
      // Fetch all data for this user
      const messages = await db.getUserMessages(userId.toString());
      const functions = await db.getUserFunctions(userId.toString());
      const reasonings = await db.getUserReasonings(userId.toString());
      
      // Format logs for the ConversationLogs component
      const logs: Array<{
        id: string;
        timestamp: string;
        type: string;
        userContent?: any;
        assistantContent?: any;
        thinkingSteps?: string[];
        functionCall?: any;
        functionResponse?: any;
      }> = [];
      
      // Combine all events and sort by createdAt
      const allEvents = [
        ...messages.map(m => ({ ...m, eventType: 'message', createdAt: m.createdAt })),
        ...functions.map(f => ({ ...f, eventType: 'function', createdAt: f.createdAt })),
        ...reasonings.map(r => ({ ...r, eventType: 'reasoning', createdAt: r.createdAt }))
      ].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      
      // Transform to log format
      allEvents.forEach((event, index) => {
        if (event.eventType === 'message') {
          const msg: any = event;
          if (msg.author === 'user') {
            logs.push({
              id: `msg-${msg._id}`,
              timestamp: msg.createdAt.toISOString(),
              type: 'user_message',
              userContent: {
                text: msg.text
              }
            });
          } else if (msg.author === 'assistant') {
            logs.push({
              id: `msg-${msg._id}`,
              timestamp: msg.createdAt.toISOString(),
              type: 'assistant_message',
              assistantContent: {
                text: msg.text
              }
            });
          }
        } else if (event.eventType === 'reasoning') {
          const reasoning: any = event;
          // Parse reasoning text into steps if it's formatted as a list
          const steps = reasoning.text.split('\n').filter((line: string) => line.trim().length > 0);
          logs.push({
            id: `reasoning-${reasoning._id}`,
            timestamp: reasoning.createdAt.toISOString(),
            type: 'thinking',
            thinkingSteps: steps
          });
        } else if (event.eventType === 'function') {
          const func: any = event;
          // Function call
          logs.push({
            id: `func-call-${func._id}`,
            timestamp: func.createdAt.toISOString(),
            type: 'function_call',
            functionCall: {
              name: func.args?.name || 'unknown',
              arguments: func.args?.arguments || func.args || {}
            }
          });
          
          // Function response (if available)
          if (func.response) {
            logs.push({
              id: `func-response-${func._id}`,
              timestamp: new Date(new Date(func.createdAt).getTime() + 100).toISOString(), // Slightly after call
              type: 'function_response',
              functionResponse: {
                name: func.args?.name || 'unknown',
                success: !func.response.error,
                output: func.response.output,
                error: func.response.error
              }
            });
          }
        }
      });
      
      res.json({ logs, userId: userId.toString() });
    } catch (error) {
      console.error("Get conversation logs error:", error);
      res.status(500).json({ error: "Failed to get conversation logs" });
    }
  });

  // Reasoning Routes
  app.post("/api/analytics/reasonings", async (req, res) => {
    try {
      const { userId, text } = req.body;
      const result = await db.createReasoning({ userId: new ObjectId(userId), text });
      res.json(result);
    } catch (error) {
      console.error("Create reasoning error:", error);
      res.status(500).json({ error: "Failed to create reasoning" });
    }
  });

  app.get("/api/analytics/reasonings/:id", async (req, res) => {
    try {
      const reasoning = await db.getReasoning(req.params.id);
      if (!reasoning) {
        return res.status(404).json({ error: "Reasoning not found" });
      }
      res.json(reasoning);
    } catch (error) {
      console.error("Get reasoning error:", error);
      res.status(500).json({ error: "Failed to get reasoning" });
    }
  });

  app.get("/api/analytics/reasonings/user/:userId", async (req, res) => {
    try {
      const reasonings = await db.getUserReasonings(req.params.userId);
      res.json(reasonings);
    } catch (error) {
      console.error("Get user reasonings error:", error);
      res.status(500).json({ error: "Failed to get user reasonings" });
    }
  });

  app.put("/api/analytics/reasonings/:id", async (req, res) => {
    try {
      const result = await db.updateReasoning(req.params.id, req.body);
      res.json(result);
    } catch (error) {
      console.error("Update reasoning error:", error);
      res.status(500).json({ error: "Failed to update reasoning" });
    }
  });

  app.delete("/api/analytics/reasonings/:id", async (req, res) => {
    try {
      const result = await db.deleteReasoning(req.params.id);
      res.json(result);
    } catch (error) {
      console.error("Delete reasoning error:", error);
      res.status(500).json({ error: "Failed to delete reasoning" });
    }
  });

  // Test Routes for Creating Sample Documents
  app.post("/api/analytics/test/create-samples", async (req, res) => {
    try {
      // Create a test user
      const userResult = await db.createUser({
        name: "Test User",
        email: "test@example.com",
        ip: "127.0.0.1"
      });
      
      // Create a test message
      const messageResult = await db.createMessage({
        userId: userResult.insertedId,
        text: "Hello, this is a test message",
        author: "user"
      });

      // Create a test function call
      const functionResult = await db.createFunction({
        userId: userResult.insertedId,
        args: { name: "testFunction", parameters: { test: true } },
        response: { status: "success", result: "test completed" }
      });

      // Create a test reasoning
      const reasoningResult = await db.createReasoning({
        userId: userResult.insertedId,
        text: "**Testing reasoning summary**\n\nThis is a test reasoning summary to verify the reasoning collection is working correctly. The AI assistant analyzed the user's request and determined that a simple response would be most appropriate."
      });

      res.json({
        user: userResult,
        message: messageResult,
        function: functionResult,
        reasoning: reasoningResult
      });
    } catch (error) {
      console.error("Create test samples error:", error);
      res.status(500).json({ error: "Failed to create test samples" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
