import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import dotenv from "dotenv";
import OpenAI from 'openai';
import { GoogleCalendarService } from '../google-calendar.js';
import { ObjectId } from 'mongodb';
import { createReasoning, createMeeting } from '../database.js';
dotenv.config({ path: '../../.env' });

// the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const MAX_AGENT_LOOP = 3

// Pricing constants for gpt-5 model (per 1M tokens)
const INPUT_PRICE_PER_MILLION = 1.250;  // $1.250 per 1M input tokens
const OUTPUT_PRICE_PER_MILLION = 10;    // $10 per 1M output tokens

export class engine  {
    private calendarService: GoogleCalendarService;

    constructor() {
        this.calendarService = new GoogleCalendarService();
    }

    // Calculate cost based on token usage
    private calculateCost(usage: { input_tokens: number; output_tokens: number }): number {
        const inputCost = (usage.input_tokens / 1_000_000) * INPUT_PRICE_PER_MILLION;
        const outputCost = (usage.output_tokens / 1_000_000) * OUTPUT_PRICE_PER_MILLION;
        const totalCost = inputCost + outputCost;
        return parseFloat(totalCost.toFixed(6)); // Round to 6 decimal places for precision
    }

    // Define run function
    async run(userInput: string, input: any[], fileId?: string, userId?: ObjectId): Promise<{ conversation: any[], totalCost: number }> {
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
        let totalCostAccumulated = 0; // Accumulate costs across all loops

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
                    // New conversation - create user message with file if fileId is provided
                    const userMessage = fileId ? {
                        role: "user",
                        content: [
                            {
                                type: "input_file",
                                file_id: fileId,
                            },
                            {
                                type: "input_text",
                                text: userInput,
                            },
                        ],
                    } : { role: "user", content: userInput };

                    input = [
                        { role: "system", content: finalPrompt },
                        userMessage
                    ]
                    console.log('🆕 New conversation - system prompt added')
                    if (fileId) {
                        console.log('📎 File included in message - OpenAI File ID:', fileId);
                    }
                } else {
                    // Continuing conversation
                    if (fileId) {
                        // If there's a file, add the new user message with file format
                        // (routes.ts should have excluded the current message from history)
                        const userMessageWithFile = {
                            role: "user",
                            content: [
                                {
                                    type: "input_file",
                                    file_id: fileId,
                                },
                                {
                                    type: "input_text",
                                    text: userInput,
                                },
                            ],
                        };

                        input = [
                            { role: "system", content: finalPrompt },
                            ...input.filter(msg => msg.role !== "system"),
                            userMessageWithFile
                        ];
                        
                        console.log('🔄 Continuing conversation with file attachment');
                        console.log('📎 File included in new message - OpenAI File ID:', fileId);
                    } else {
                        // No file - use history as-is (includes the current user message)
                        input = [
                            { role: "system", content: finalPrompt },
                            ...input.filter(msg => msg.role !== "system")
                        ];
                        
                        console.log('🔄 Continuing conversation without file');
                    }
                    
                    console.log('📝 Total messages:', input.length);
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
                    effort: "minimal",
                    summary: "auto",
                }
              });
              
            console.log('📤 Response', response)
    
            // Calculate cost from usage data
            let loopCost = 0;
            if (response.usage) {
                loopCost = this.calculateCost({
                    input_tokens: response.usage.input_tokens,
                    output_tokens: response.usage.output_tokens
                });
                totalCostAccumulated += loopCost;
                console.log('💰 Cost calculation (this loop):', {
                    input_tokens: response.usage.input_tokens,
                    output_tokens: response.usage.output_tokens,
                    total_tokens: response.usage.total_tokens,
                    loopCost: `$${loopCost.toFixed(6)}`,
                    totalAccumulated: `$${totalCostAccumulated.toFixed(6)}`
                });
            }
    
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
                                text: summaryTexts,
                                totalCost: loopCost
                            });
                            console.log('💡 Reasoning summary saved to database with cost:', `$${loopCost.toFixed(6)}`);
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
                        
                        // Store meeting in database if userId is provided
                        if (userId) {
                            try {
                                // Parse eventId from toolResult if available
                                let eventId: string | undefined;
                                try {
                                    const resultJson = JSON.parse(toolResult);
                                    eventId = resultJson.eventId || resultJson.id;
                                } catch {
                                    // If toolResult is not JSON, it's fine - we'll store without eventId
                                }
                                
                                await createMeeting({
                                    userId: userId,
                                    title: args.title,
                                    description: args.description,
                                    startDateTime: args.startDateTime,
                                    endDateTime: args.endDateTime,
                                    attendeeEmails: args.attendeeEmails,
                                    location: args.location,
                                    eventId: eventId
                                });
                                console.log('✅ Meeting saved to database');
                            } catch (error) {
                                console.error('❌ Error saving meeting to database:', error);
                            }
                        }
                        
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

                    // Handle the record_csat tool
                    case 'record_csat':
                        console.log('📊 Recording CSAT:', args.csat, 'Feedback:', args.feedback)
                        toolResult = await this.recordCSAT({
                            userId: userId!,
                            csat: args.csat,
                            feedback: args.feedback
                        })
                        console.log('✅ CSAT recorded:', toolResult)
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
        
        console.log(`💰 Total cost for this conversation turn: $${totalCostAccumulated.toFixed(6)}`);
        
        // Return the input array and total cost
        return {
            conversation: input,
            totalCost: totalCostAccumulated
        }
            
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

    // Define private get portfolio info function
    private async getPortfolioInfo(portfolio: string) {

        // Define result string
        const result = `Portfolio: ${portfolio}`

        // Return result
        return result
    }

    // Define private record CSAT function
    private async recordCSAT(params: { userId: ObjectId, csat: number, feedback: string }) {
        try {
            const { updateUser } = await import('../database.js');
            
            // Validate CSAT score (1-5 scale)
            if (params.csat < 1 || params.csat > 5) {
                return 'ERROR: CSAT score must be between 1 and 5';
            }

            // Update user with CSAT and feedback
            await updateUser(params.userId.toString(), {
                csat: params.csat,
                feedback: params.feedback
            });

            return `CSAT score of ${params.csat} and feedback successfully recorded. Thank you for your valuable input!`;
        } catch (error) {
            console.error('❌ Error recording CSAT:', error);
            return `ERROR: Failed to record CSAT - ${error}`;
        }
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
        
        // console.log('📋 Final result array length:', result?.conversation.length || 0)
        // console.log('💰 Total cost:', result?.totalCost || 0)
        
        if (result && result.conversation && result.conversation.length > 0) {
            // console.log('📄 Final conversation:')
            // result.conversation.forEach((msg, index) => {
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
