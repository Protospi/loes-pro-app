import OpenAI from "openai";
import fs from "fs";
import dotenv from "dotenv";
dotenv.config();

// the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// In-memory translation cache indexed by sessionId
interface TranslationCache {
  language: string;
  translatedContent: any;
  timestamp: number;
}

const translationCache = new Map<string, TranslationCache>();

// Cache expiration time (24 hours)
const CACHE_EXPIRATION_MS = 24 * 60 * 60 * 1000;

// Get cached translation for a session
export function getCachedTranslation(sessionId: string): TranslationCache | null {
  const cached = translationCache.get(sessionId);
  
  if (!cached) {
    return null;
  }
  
  // Check if cache has expired
  if (Date.now() - cached.timestamp > CACHE_EXPIRATION_MS) {
    translationCache.delete(sessionId);
    console.log('🗑️ Expired translation cache for session:', sessionId);
    return null;
  }
  
  console.log('✅ Retrieved cached translation for session:', sessionId, '- Language:', cached.language);
  return cached;
}

// Cache translation for a session
function cacheTranslation(sessionId: string, language: string, translatedContent: any): void {
  translationCache.set(sessionId, {
    language,
    translatedContent,
    timestamp: Date.now()
  });
  console.log('💾 Cached translation for session:', sessionId, '- Language:', language);
}

// Clear cached translation for a session
export function clearCachedTranslation(sessionId: string): boolean {
  const existed = translationCache.has(sessionId);
  if (existed) {
    translationCache.delete(sessionId);
    console.log('🗑️ Cleared translation cache for session:', sessionId);
  }
  return existed;
}

const PEDRO_BASE_PROMPT = `

## **Persona 🧑‍💻**

You are a professional and helpful digital assistant that represents **Pedro Loes – Data Scientist, Machine Learning & AI Engineer**.
You help people learn about Pedro’s:

* 💼 Work history
* 📂 Projects & portfolio
* 📚 Learning path & education
* 📜 Certificates
* 🛠 Skills & fit for job descriptions
* 📅 Schedule meetings with Pedro

**Tone of voice:**

* Always polite, professional, concise, and approachable.
* Use **10–30 words** for small answers.
* Use **20–40 words** for larger answers.
* Feel free to add **emojis** in your responses to make them friendlier and more engaging 🎯.
* Use markdown notation to emphasize important points, titles, break lines, build lists, etc for clean answers.

---

## **User Information 🧑‍💻**

* Will be working on Pedro's professional website.
* The typical user is a company needing consulting, a recruiter or a hiring manager trying to hire Pedro.

---

## **Tools 🔧**

* Use the function get_portfolio_info when deeper details are needed.
* Use the function get_work_history_info when deeper details are needed.
* Use the function get_learning_path_info when deeper details are needed.
* Use the function get_skills_info when deeper details are needed.
* Use the function get_meetings_info when deeper details are needed.

* Use the function get_schedule_availability when deeper details are needed.
* Use the function book_meeting when deeper details are needed.

---

## **Situational Data ⏰**

Always use this variable for date/time related answers:
$dateTime

---

## **Knowledge Base 📖**

This section holds external information retrieved with RAG:
$information

Use this **only** when the user asks a question that requires more details than the information in this prompt.

---

## **Conversation Instructions 💬**

1. **Greeting 👋**

   * If the user says hello, welcome them warmly.

2. **Work History 💼**

   * If asked, summarize Pedro’s professional journey:

     * **2023–Present – SmartTalks.ai**: AI Engineer, built multiagent platforms, dashboards, RAG systems, mentored engineers.
     * **2021–2022 – Guide 121**: Data Scientist, improved chatbot accuracy, pipelines, diagnostic apps.
     * **2018–2020 – Banco Inter**: Data Analyst, automated reporting, built risk & cross-sell models.
     * **2012–2017 – NetApp**: Technical Support Engineer, optimized WAN & storage.

3. **Projects 🚀**

   * If asked about Pedro’s portfolio, describe his **recent projects**:

     * Workflow Orchestration Platform (low-code LLM orchestrator).
     * Prompter (AI-powered prompt editor).
     * Smart Content (RAG system for vector-embedded content).
   * Use the function get_portfolio_info when deeper details are needed.

4. **Learning Path & Education 🎓**

   * If asked about Pedro’s learning:

     * **B.Sc. Statistics – UFMG (2022)**
     * **B.A. Philosophy – UFMG (2014)**
     * **Certificates**: Data Eng. Professional (2025), DeepLearning.AI ML/AI certs, TOEFL Advanced English.

5. **Skills ⚡**

   * If asked about Pedro’s skills, highlight:

     * **AI/ML**: LLM orchestration, RAG, NLP/NLU, Deep ML.
     * **Data Eng.**: SQL/NoSQL, Spark, Airflow, Hadoop, AWS & GCP.
     * **Software**: Python, R, C++, FastAPI, Flask, JS (Vue/React).
     * **Analytics**: Tableau, Power BI, Plotly.

6. **Meetings 📅**

   * If asked to book a meeting, follow these steps:

     1. Ask for **name** ✍️
     2. Ask for **email** 📧
     3. Ask for **subject** 🗂
     4. Ask for **preferred date & time** ⏰
     5. Show a **checkout summary** 📋
     6. If user says “OK”, call:

        * get_schedule_availability
        * book_meeting
     7. Confirm: “✅ Your meeting has been booked. A confirmation email has been sent.”

7. **Closing 🙏**

   * Always end by thanking the user and reminding them:
     *“Thanks for the chat! I’m always here to help with Pedro’s professional journey 🚀.”*

---

## **Thinking 🧠**

* Think before answering: plan clearly.
* Persistence: Always support user questions about Pedro’s work.
* Planning: Understand intent, provide clarity, and add value.

---

## **Guardrails 🚧**

* Do **not** answer or discuss anything unrelated to Pedro’s **work, portfolio, skills, or meetings**.
* If asked about unrelated topics, politely decline and redirect:
  *“🙏 I can only help with Pedro’s professional career, projects, or scheduling.”*
* Always remain professional and aligned with Pedro’s brand.

---
`;


// Generate AI response using the OpenAI API
export async function generateAIResponse(userMessage: string, conversationHistory: Array<{ content: string; isUser: boolean }> = []): Promise<string> {
  try {
    // Build conversation context from history
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: "system", content: PEDRO_BASE_PROMPT }
    ];

    // Add conversation history (last 10 messages to keep context manageable)
    const recentHistory = conversationHistory;
    for (const msg of recentHistory) {
      messages.push({
        role: msg.isUser ? "user" : "assistant",
        content: msg.content
      });
    }

    // Add the current user message
    messages.push({ role: "user", content: userMessage });

    // Generate AI response
    const response = await openai.chat.completions.create({
      model: "gpt-4.1", // Using gpt-4o as it's available
      messages: messages,
    });
    // console.log(response);

    return response.choices[0]?.message?.content || "I apologize, but I couldn't generate a response at the moment. Please try again.";
  } catch (error) {
    console.error("OpenAI API error:", error);
    throw new Error("Failed to generate AI response");
  }
}

// Function that uses OpenAI to detect language and translate custom.json
export async function detectLanguageAndTranslate(userInput: string, sessionId?: string) {
  try {
    // Check cache first if sessionId is provided
    if (sessionId) {
      const cached = getCachedTranslation(sessionId);
      if (cached) {
        console.log('🚀 Returning cached translation for session:', sessionId);
        return {
          language: cached.language,
          translatedContent: cached.translatedContent,
          rawResponse: null,
          fromCache: true
        };
      }
    }

    // Step 1: Detect the language
    const languageDetection = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a language detection assistant. 
          Analyze the text and determine what language it's written in. 
          
          IMPORTANT RULES:
          1. Respond with the EXACT language name only, no additional text
          2. Use these specific language names:
             - English (for English)
             - Spanish (for Spanish/Español)
             - Portuguese (for Portuguese/Português)
             - Chinese (for Chinese/中文/Mandarin/Cantonese)
             - German (for German/Deutsch)
             - French (for French/Français)
             - Japanese (for Japanese/日本語)
             - Italian (for Italian/Italiano)
             - Russian (for Russian/Русский)
             - Arabic (for Arabic/العربية)
             - Korean (for Korean/한국어)
             - Hindi (for Hindi/हिन्दी)
          3. If you detect any other language, respond with the language name in English
          4. If the language cannot be determined, respond with "English"`
        },
        {
          role: "user",
          content: userInput,
        },
      ],
    });

    let detectedLanguage = languageDetection.choices[0].message.content?.trim() || 'English';
    
    // Special handling for Chinese variants
    if (detectedLanguage.toLowerCase().includes('chinese') || 
        detectedLanguage.includes('中文') || 
        detectedLanguage.toLowerCase().includes('mandarin') ||
        detectedLanguage.toLowerCase().includes('cantonese')) {
      detectedLanguage = 'Chinese';
    }
    
    console.log('Raw language detection response:', languageDetection.choices[0].message.content);
    console.log('Processed detected language:', detectedLanguage);
    
    // Additional check: if user input contains Chinese characters, force Chinese detection
    const containsChinese = /[\u4e00-\u9fff]/.test(userInput);
    if (containsChinese && detectedLanguage === 'English') {
      detectedLanguage = 'Chinese';
      console.log('Overriding to Chinese based on character detection');
    }

    // Step 2: Load the current custom.json content
    const fs = await import('fs/promises');
    const path = await import('path');
    const customJsonPath = path.resolve(process.cwd(), 'client/src/translations/custom.json');
    const customJsonContent = await fs.readFile(customJsonPath, 'utf8');
    const customJson = JSON.parse(customJsonContent);

    // Step 3: Translate the custom.json content to the detected language
    const translationCompletion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a professional translator specializing in user interface translations. 
          You will receive a JSON object with interface text in English and need to translate it to ${detectedLanguage}.
          
          CRITICAL TRANSLATION RULES:
          1. Maintain the EXACT same JSON structure - all keys, arrays, and nesting must be identical
          2. Only translate the VALUES (text content), NEVER translate the KEYS
          3. Keep proper nouns unchanged: "Pedro", "Drope" 
          4. Translate ALL text values to ${detectedLanguage}, including:
             - Titles and subtitles
             - Button text
             - Sample questions
             - Error messages
          5. For ${detectedLanguage}:
             ${detectedLanguage === 'Chinese' ? '- Use Simplified Chinese characters (简体中文)' : ''}
             ${detectedLanguage === 'Arabic' ? '- Use Modern Standard Arabic' : ''}
             ${detectedLanguage === 'Japanese' ? '- Use appropriate mix of Hiragana, Katakana, and Kanji' : ''}
          6. Ensure translations are natural, professional, and appropriate for an AI assistant interface
          7. Return ONLY the translated JSON object, no explanations or additional text
          8. If the target language is English, return the original JSON unchanged
          
          Example structure preservation:
          Input: {"chat": {"title": "Hello"}}
          Output: {"chat": {"title": "[TRANSLATED_HELLO]"}}`
        },
        {
          role: "user",
          content: `Translate this JSON interface to ${detectedLanguage}:\n\n${JSON.stringify(customJson, null, 2)}`
        },
      ],
    });

    const translatedContent = translationCompletion.choices[0].message.content?.trim();
    
    if (!translatedContent) {
      throw new Error('No translation received from OpenAI');
    }

    // Step 4: Parse the translated JSON
    let translatedJson;
    try {
      translatedJson = JSON.parse(translatedContent);
    } catch (parseError) {
      console.error('Failed to parse translated JSON:', parseError);
      console.error('Raw translation response:', translatedContent);
      throw new Error('Invalid JSON received from translation');
    }

    // Cache translation if sessionId is provided
    if (sessionId) {
      cacheTranslation(sessionId, detectedLanguage, translatedJson);
    }

    // Return translations to client (no file write - each user gets their own in-memory translation)
    console.log('Successfully generated translations for:', detectedLanguage);
    console.log('Sample translated content:', JSON.stringify(translatedJson.chat?.title || 'N/A'));

    return {
      language: detectedLanguage,
      translatedContent: translatedJson,
      rawResponse: languageDetection.choices[0].message,
      fromCache: false
    };
  } catch (error) {
    console.error('Language detection and translation error:', error);
    throw new Error('Failed to detect language and translate content');
  }
}

// Audio transcription function
export async function transcribeAudio(audioFilePath: string): Promise<{ text: string; usage?: any }> {
  try {
    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(audioFilePath),
      model: "whisper-1", // Using whisper-1 as it's the standard transcription model
      response_format: "json", // Changed to json to get the structured response
    });

    console.log('Audio transcription completed:', transcription);
    return transcription;
  } catch (error) {
    console.error('OpenAI transcription error:', error);
    throw new Error('Failed to transcribe audio');
  }
}

// Upload file to OpenAI
export async function uploadFileToOpenAI(filePath: string): Promise<string> {
  try {
    const file = await openai.files.create({
      file: fs.createReadStream(filePath),
      purpose: "user_data",
    });

    console.log('File uploaded to OpenAI:', {
      id: file.id,
      filename: file.filename,
      purpose: file.purpose,
      status: file.status
    });

    return file.id;
  } catch (error) {
    console.error('OpenAI file upload error:', error);
    throw new Error('Failed to upload file to OpenAI');
  }
}

// Text-to-speech function
export async function generateSpeech(text: string): Promise<Buffer> {
  const instructions = `
  Voice: Warm, upbeat, and reassuring, with a steady and confident cadence that keeps the conversation calm and productive.

  Tone: Positive and solution-oriented, always focusing on the next steps rather than dwelling on the problem.

  Dialect: Neutral and professional, avoiding overly casual speech but maintaining a friendly and approachable style.

  Pronunciation: Clear and precise, with a natural rhythm that emphasizes key words to instill confidence and keep the customer engaged.

  Features: Uses empathetic phrasing, gentle reassurance, and proactive language to shift the focus from frustration to resolution.
  `
  try {
    const mp3 = await openai.audio.speech.create({
      model: "gpt-4o-mini-tts",
      voice: "nova",
      input: text,
      instructions: instructions,
    });

    const buffer = Buffer.from(await mp3.arrayBuffer());
    console.log('Speech generated successfully, buffer size:', buffer.length);
    return buffer;
  } catch (error) {
    console.error('OpenAI text-to-speech error:', error);
    throw new Error('Failed to generate speech');
  }
}

// Keep the original function for backward compatibility
export async function detectLanguage(userInput: string) {
  try {
    const result = await detectLanguageAndTranslate(userInput);
    return {
      language: result.language,
      rawResponse: result.rawResponse,
    };
  } catch (error) {
    console.error('OpenAI API error:', error);
    throw new Error('Failed to detect language');
  }
}
