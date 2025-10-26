import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import dotenv from "dotenv";
import OpenAI from 'openai';
import { GoogleCalendarService } from '../google-calendar.js';
import { ObjectId } from 'mongodb';
import { createReasoning } from '../database.js';
dotenv.config({ path: '../../.env' });

// the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const MAX_AGENT_LOOP = 3

export class engine  {
    private calendarService: GoogleCalendarService;

    constructor() {
        this.calendarService = new GoogleCalendarService();
    }

    // Define run function
    async run(userInput: string, input: any[], fileId?: string, userId?: ObjectId) {
        // console.log('🚀 Starting AI Engine...')
        // console.log('📝 User Input:', userInput)
        // console.log('📦 Initial Input Array Length:', input.length)
        // console.log('📁 File ID:', fileId || 'No file ID provided')

        // Define raw variables - use absolute paths
        const __filename = fileURLToPath(import.meta.url)
        const __dirname = dirname(__filename)
        const rawPrompt = readFileSync(join(__dirname, 'system-prompt.txt'), 'utf-8')
        const toolsJson = readFileSync(join(__dirname, 'tools.json'), 'utf-8')
        const tools = JSON.parse(toolsJson)
        
        let loopAgent = true
        let loopCounter = 0

        // Run the agent
        // console.log('🔄 Starting agent loop...')
        while (loopAgent && loopCounter < MAX_AGENT_LOOP) {

            // Increment the loop counter
            loopCounter++
            // console.log(`\n🔄 Agent Loop Iteration: ${loopCounter}/${MAX_AGENT_LOOP}`)
    
            // Replace variables in the prompt
            const dateTimeInfo = this.getSaoPauloTodayInfo()
            
            // Replace variables in the prompt
            const finalPrompt = this.replaceVariable(
            rawPrompt,
            '$dateTime',
            dateTimeInfo
            )
            
            // console.log('🎯 System prompt preview:', finalPrompt.substring(0, 50) + '...')

            // Only rebuild conversation on first iteration
            if (loopCounter === 1) {
                // Define input messages
                if (input.length === 0) {
                    // Create user message with file if fileId is provided
                    const extractedFileId = this.extractFileIdFromContent(userInput);
                    const actualFileId = fileId || extractedFileId;
                    const cleanUserInput = extractedFileId ? userInput.replace(/\[File attached: [^\]]+\]\s*/, '') : userInput;

                    const userMessage = actualFileId ? {
                        role: "user",
                        content: [
                            {
                                type: "input_file",
                                file_id: actualFileId,
                            },
                            {
                                type: "input_text",
                                text: cleanUserInput,
                            },
                        ],
                    } : { role: "user", content: userInput };

                    input = [
                        { role: "system", content: finalPrompt },
                        userMessage
                    ]
                    console.log('🆕 New conversation - system prompt added')
                } else {
                    // Always ensure system prompt is first and current (only on first iteration)
                    // The conversation history already includes the user's message, so just add system prompt
                    input = [
                        { role: "system", content: finalPrompt },
                        ...input.filter(msg => msg.role !== "system")
                    ];
                    
                    console.log('🔄 Continuing conversation with', input.length, 'messages');
                    console.log('📝 Last 3 messages:');
                    input.slice(-3).forEach((msg: any, idx: number) => {
                        const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content).substring(0, 100);
                        console.log(`  ${idx + 1}. [${msg.role}]: ${content.substring(0, 80)}...`);
                    });
                }
            } else {
                // On subsequent iterations, just update the system prompt
                input[0] = { role: "system", content: finalPrompt };
            }
    
            // Debug conversation state before API call
            console.log(`\n🤖 AI API Call (Loop ${loopCounter}/${MAX_AGENT_LOOP})`);
            console.log('📋 Conversation before API:');
            input.forEach((msg: any, i: number) => {
                if (msg.role === 'system') {
                    console.log(`  ${i + 1}. [SYSTEM]: ${typeof msg.content === 'string' ? msg.content.substring(0, 60) : 'complex'}...`);
                } else if (msg.role === 'user' || msg.role === 'assistant') {
                    const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content).substring(0, 100);
                    console.log(`  ${i + 1}. [${msg.role.toUpperCase()}]: ${content.substring(0, 100)}${content.length > 100 ? '...' : ''}`);
                } else if (msg.type === 'function_call') {
                    console.log(`  ${i + 1}. [FUNCTION_CALL]: ${msg.name}`);
                } else if (msg.type === 'function_call_output') {
                    console.log(`  ${i + 1}. [FUNCTION_OUTPUT]`);
                } else {
                    console.log(`  ${i + 1}. [${msg.role || msg.type}]`);
                }
            });

            // Generate AI response
            let response = await openai.responses.create({
                model: "gpt-5",
                tools,
                input: input,
                reasoning: {
                    effort: "medium",
                    summary: "auto",
                }
              });
              
            console.log('📤 Response', response)
    
            // Extract and save reasoning summary if present
            if (userId) {
                const reasoningOutput = response.output.find((output: any) => output.type === 'reasoning') as any;
                if (reasoningOutput && reasoningOutput.summary) {
                    // Extract text from summary array
                    const summaryTexts = reasoningOutput.summary
                        .filter((s: any) => s.type === 'summary_text')
                        .map((s: any) => s.text)
                        .join('\n');
                    
                    if (summaryTexts) {
                        try {
                            await createReasoning({
                                userId: userId,
                                text: summaryTexts
                            });
                            console.log('💡 Reasoning summary saved to database');
                        } catch (error) {
                            console.error('❌ Error saving reasoning summary:', error);
                        }
                    }
                }
            }
    
            // For responses.create API, we need to add function calls to input array
            const functionCalls = response.output.filter(output => output.type === 'function_call')
            
            if (functionCalls.length > 0) {
                console.log(`🔧 Found ${functionCalls.length} function call(s) - will continue loop`);
                // Add function calls to input array using the format expected by responses.create
                for (const fc of functionCalls) {
                    input.push({
                        type: "function_call",
                        call_id: fc.call_id,
                        name: fc.name,
                        arguments: fc.arguments
                    })
                }
            }

            // Handle the agent output
            let hasTextResponse = false;
            for (const output of response.output) {

                // Handle the message and function call output
                if (output.type === 'message') {

                    // Handle the message content
                    for (const content of output.content) {
                        console.log('📝 Processing content type:', content.type)

                        // Handle the output text
                        if (content.type === 'output_text') {
                            console.log('✅ Got text response:', content.text.substring(0, 100) + (content.text.length > 100 ? '...' : ''))
                            hasTextResponse = true;
                            loopAgent = false
                            input.push({ role: "assistant", content: content.text })
                        }
                    }

                // Handle the function call output
                } else if (output.type === 'function_call') {
                    // console.log('🎯 Function name:', output.name)
                    // console.log('📦 Function arguments:', output.arguments)

                    // Parse the function call arguments and define variables
                    const args = JSON.parse(output.arguments)
                    let toolResult = ''
        
                    // Switch case to handle the function call
                    switch (output.name) {

                    // Handle the get_portfolio_info tool
                    case 'get_portfolio_info':
                        // console.log('📊 Getting portfolio info for:', args.portfolio)
                        // Run the script
                        toolResult = await this.getPortfolioInfo(args.portfolio)
                        // console.log('✅ Portfolio info result:', toolResult)
                        break

                    // Handle the schedule_meeting tool
                    case 'schedule_meeting':
                        // console.log('📅 Scheduling meeting:', args.title)
                        toolResult = await this.calendarService.scheduleMeeting({
                            title: args.title,
                            description: args.description,
                            startDateTime: args.startDateTime,
                            endDateTime: args.endDateTime,
                            attendeeEmails: args.attendeeEmails,
                            location: args.location
                        })
                        // console.log('✅ Meeting scheduled result:', toolResult)
                        break

                    // Handle the get_upcoming_events tool
                    case 'get_upcoming_events':
                        // console.log('📅 Getting upcoming events')
                        toolResult = await this.calendarService.getUpcomingEvents({
                            maxResults: args.maxResults,
                            timeMin: args.timeMin,
                            timeMax: args.timeMax
                        })
                        // console.log('✅ Upcoming events result:', toolResult.substring(0, 200) + '...')
                        break

                    // Handle the find_available_slots tool
                    case 'find_available_slots':
                        // console.log('🔍 Finding available slots for:', args.date)
                        toolResult = await this.calendarService.findAvailableSlots({
                            date: args.date,
                            duration: args.duration,
                            workingHoursStart: args.workingHoursStart,
                            workingHoursEnd: args.workingHoursEnd
                        })
                        // console.log('✅ Available slots result:', toolResult)
                        break

                    // Handle the cancel_meeting tool
                    case 'cancel_meeting':
                        // console.log('❌ Cancelling meeting:', args.eventId)
                        toolResult = await this.calendarService.cancelMeeting({
                            eventId: args.eventId,
                            sendUpdates: args.sendUpdates
                        })
                        // console.log('✅ Cancel meeting result:', toolResult)
                        break
        
        
                    // Handle the default case
                    default:
                        // console.log('❌ UNHANDLED TOOL:', output.name)
                        toolResult = `ERROR: tool ${output.name} not implemented.`
                        break
                    }
        
                    // Push tool result using the correct format for responses.create API
                    input.push({
                        type: "function_call_output",
                        call_id: output.call_id,
                        output: toolResult
                    })
                } else if (output.type === 'reasoning') {
                    // Reasoning output - just skip it, don't stop the loop
                    console.log('💭 Reasoning output - skipping')
                } else {
                    console.log('❓ Unhandled openAI output type:', output.type, output)
                    // Don't stop the loop for unknown types either - let it continue
                }
            }
            
            // Log loop status
            console.log(`\n🔄 End of loop ${loopCounter}:`);
            console.log(`  - loopAgent: ${loopAgent}`);
            console.log(`  - hasTextResponse: ${hasTextResponse}`);
            console.log(`  - functionCalls: ${functionCalls.length}`);
            console.log(`  - Will continue? ${loopAgent && loopCounter < MAX_AGENT_LOOP}\n`);
        }
        
        // console.log('📊 Final input array:', input)
        
        // Return the input array
        return input
            
    }

    // Define private são paulo date and time function
    private getSaoPauloTodayInfo() {

        // Define raw variables
        const date = new Date()
        const locale = 'pt-BR'
        const timeZone = 'America/Sao_Paulo'

        // Define date and time variables
        const weekDay = date.toLocaleDateString(locale, { weekday: 'long', timeZone })
        const day = date.toLocaleDateString(locale, { day: 'numeric', timeZone })
        const month = date.toLocaleDateString(locale, { month: 'long', timeZone })
        const year = date.toLocaleDateString(locale, { year: 'numeric', timeZone })
        const time = date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', timeZone })

        // Define result string
        const result = `Hoje é ${weekDay}, dia ${day} de ${month} de ${year}, horário atual: ${time}, aqui em São Paulo.`
        return result
    }

    // Define private replace variable function
    private replaceVariable(text: string, variable: string, dynamicValue: string) {

        // Replace variable in text
        const result = text.replace(
            new RegExp(`\\$${variable}`, 'g'),
            () => dynamicValue || ''
        )

        // Return result
        return result
    }

    // Define private function to extract file ID from message content
    private extractFileIdFromContent(content: string): string | null {
        const match = content.match(/\[File attached: ([^\]]+)\]/);
        return match ? match[1] : null;
    }

    // Define private get portfolio info function
    private async getPortfolioInfo(portfolio: string) {

        // Define result string
        const result = `Portfolio: ${portfolio}`

        // Return result
        return result
    }

  
}

// Main function to make the engine executable
async function main() {
    
    try {
        // Create engine instance
        const engineInstance = new engine()
        
        // Test input
        const testUserInput = "Hello, can you get information about project 1?"
        const testInputArray: any[] = []
        const testFileId = "test-file-id-123"
        
        // console.log('🧪 Running test with input:', testUserInput)
        // console.log('🧪 Running test with file ID:', testFileId)
        
        // Run the engine
        const result = await engineInstance.run(testUserInput, testInputArray, testFileId)
        
        // console.log('📋 Final result array length:', result?.length || 0)
        
        if (result && result.length > 0) {
            // console.log('📄 Final conversation:')
            // result.forEach((msg, index) => {
            //     // console.log(`  ${index + 1}. [${msg.role || msg.type}]:`, 
            //     //     typeof msg.content === 'string' ? msg.content.substring(0, 100) + '...' : 
            //     //     typeof msg.output === 'string' ? msg.output.substring(0, 100) + '...' : 
            //     //     JSON.stringify(msg).substring(0, 100) + '...')
            // })
        }
        
    } catch (error) {
        console.error('❌ Error running engine test:', error)
        process.exit(1)
    }
}

// Run main function if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(console.error)
}
