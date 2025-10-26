import { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  User, 
  BotMessageSquare, 
  Brain, 
  Wrench, 
  ChevronDown, 
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  Clock,
  FileText,
  Volume2,
  Paperclip
} from 'lucide-react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

export interface ConversationLogsRef {
  setActiveLogs: (indices: number[]) => void;
  clearActiveLogs: () => void;
}

// Types for conversation log entries
interface FunctionCall {
  name: string;
  arguments: Record<string, any>;
}

interface FunctionResponse {
  name: string;
  output: any;
  success: boolean;
  error?: string;
}

interface UserContent {
  text?: string;
  audio?: string; // URL or base64 data
  files?: Array<{
    name: string;
    type: string;
    size: number;
    url?: string;
  }>;
}

interface AssistantContent {
  text?: string;
  audio?: string; // URL or base64 data  
  thinking?: string;
}

interface LogEntry {
  id: string;
  timestamp: string;
  type: 'user_message' | 'thinking' | 'function_call' | 'function_response' | 'assistant_message';
  content?: string;
  userContent?: UserContent;
  assistantContent?: AssistantContent;
  functionCall?: FunctionCall;
  functionResponse?: FunctionResponse;
  thinkingSteps?: string[];
}

interface ConversationLogsProps {
  logs?: LogEntry[];
  activeLogIndex?: number;
  onLogsLoaded?: (count: number) => void;
}

// Mock data for demonstration
const mockLogs: LogEntry[] = [
  {
    id: '1',
    timestamp: new Date().toISOString(),
    type: 'user_message',
    userContent: {
      text: 'Can you schedule a meeting with john@example.com for tomorrow at 2 PM?',
      files: [
        {
          name: 'meeting-agenda.pdf',
          type: 'application/pdf',
          size: 125000,
          url: '#'
        }
      ]
    },
  },
  {
    id: '2',
    timestamp: new Date().toISOString(),
    type: 'thinking',
    thinkingSteps: [
      'User wants to schedule a meeting',
      'Need to extract: attendee email, date, and time',
      'Should use schedule_meeting function',
      'Need to convert "tomorrow at 2 PM" to ISO format',
    ],
  },
  {
    id: '3',
    timestamp: new Date().toISOString(),
    type: 'function_call',
    functionCall: {
      name: 'find_available_slots',
      arguments: {
        date: '2025-10-01',
        duration: 60,
        workingHoursStart: '09:00',
        workingHoursEnd: '18:00',
      },
    },
  },
  {
    id: '4',
    timestamp: new Date().toISOString(),
    type: 'function_response',
    functionResponse: {
      name: 'find_available_slots',
      success: true,
      output: {
        availableSlots: [
          '14:00-15:00',
          '15:00-16:00',
          '16:00-17:00',
        ],
        date: '2025-10-01',
      },
    },
  },
  {
    id: '5',
    timestamp: new Date().toISOString(),
    type: 'function_call',
    functionCall: {
      name: 'schedule_meeting',
      arguments: {
        title: 'Meeting with John',
        startDateTime: '2025-10-01T14:00:00-03:00',
        endDateTime: '2025-10-01T15:00:00-03:00',
        attendeeEmails: ['john@example.com'],
        description: 'Scheduled meeting',
      },
    },
  },
  {
    id: '6',
    timestamp: new Date().toISOString(),
    type: 'function_response',
    functionResponse: {
      name: 'schedule_meeting',
      success: true,
      output: {
        eventId: 'evt_123456',
        htmlLink: 'https://calendar.google.com/event?eid=evt_123456',
        meetLink: 'https://meet.google.com/abc-defg-hij',
        status: 'confirmed',
      },
    },
  },
  {
    id: '7',
    timestamp: new Date().toISOString(),
    type: 'assistant_message',
    assistantContent: {
      thinking: 'The user has requested a meeting to be scheduled. I need to process the available time slots and create the meeting with the provided details. The function calls were successful, so I can now confirm the meeting creation.',
      text: 'I\'ve successfully scheduled a meeting with john@example.com for tomorrow (October 1st) at 2:00 PM. The meeting will last 1 hour and a Google Meet link has been created. All participants will receive a calendar invitation.',
    },
  },
];

function JsonDisplay({ data }: { data: any }) {
  return (
    <pre className="text-xs bg-black/20 p-3 rounded-lg overflow-x-auto font-mono">
      <code className="text-emerald-400">
        {JSON.stringify(data, null, 2)}
      </code>
    </pre>
  );
}

function UserMessage({ userContent, timestamp, isActive }: { userContent: UserContent; timestamp: string; isActive?: boolean }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const time = new Date(timestamp).toLocaleTimeString([], { 
    hour: '2-digit', 
    minute: '2-digit' 
  });

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getContentPreview = () => {
    const items = [];
    if (userContent.text) items.push('Text');
    if (userContent.audio) items.push('Audio');
    if (userContent.files && userContent.files.length > 0) items.push(`${userContent.files.length} file${userContent.files.length > 1 ? 's' : ''}`);
    return items.join(', ');
  };

  return (
    <div className={`glass-chip rounded-xl p-4 transition-all duration-300 ${isActive ? 'ring-2 ring-yellow-400 shadow-lg shadow-yellow-400/50 scale-105' : ''}`}>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-start gap-3 w-full text-left"
      >
        <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0">
          <User className="w-4 h-4 text-blue-400" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-semibold text-foreground">User</span>
            <span className="text-xs text-muted-foreground">{time}</span>
            {isExpanded ? (
              <ChevronDown className="w-4 h-4 text-muted-foreground ml-auto" />
            ) : (
              <ChevronRight className="w-4 h-4 text-muted-foreground ml-auto" />
            )}
          </div>
          <div className="text-xs text-muted-foreground">Content</div>
          {!isExpanded && (
            <div className="text-xs text-muted-foreground mt-1">{getContentPreview()}</div>
          )}
        </div>
      </button>
      
      {isExpanded && (
        <div className="mt-3 ml-11 space-y-3">
          {userContent.text && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <FileText className="w-4 h-4 text-blue-400" />
                <span className="text-xs font-semibold text-muted-foreground">Message Text</span>
              </div>
              <p className="text-sm text-foreground leading-relaxed pl-6">{userContent.text}</p>
            </div>
          )}
          
          {userContent.audio && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Volume2 className="w-4 h-4 text-blue-400" />
                <span className="text-xs font-semibold text-muted-foreground">Audio Input</span>
              </div>
              <div className="pl-6">
                <audio controls className="w-full max-w-xs">
                  <source src={userContent.audio} type="audio/mpeg" />
                  Your browser does not support the audio element.
                </audio>
              </div>
            </div>
          )}
          
          {userContent.files && userContent.files.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Paperclip className="w-4 h-4 text-blue-400" />
                <span className="text-xs font-semibold text-muted-foreground">File Attachments</span>
              </div>
              <div className="pl-6 space-y-2">
                {userContent.files.map((file, index) => (
                  <div key={index} className="flex items-center gap-2 p-2 bg-black/10 rounded-lg">
                    <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-foreground truncate">{file.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {file.type} • {formatFileSize(file.size)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ThinkingSection({ steps, timestamp, isActive }: { steps: string[]; timestamp: string; isActive?: boolean }) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className={`glass-chip rounded-xl p-4 transition-all duration-300 ${isActive ? 'ring-2 ring-yellow-400 shadow-lg shadow-yellow-400/50 scale-105' : ''}`}>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-start gap-3 w-full text-left"
      >
        <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center flex-shrink-0">
          <Brain className="w-4 h-4 text-purple-400" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-semibold text-foreground">Thinking</span>
            <span className="text-xs text-muted-foreground">{steps.length} steps</span>
            {isExpanded ? (
              <ChevronDown className="w-4 h-4 text-muted-foreground ml-auto" />
            ) : (
              <ChevronRight className="w-4 h-4 text-muted-foreground ml-auto" />
            )}
          </div>
        </div>
      </button>
      
      {isExpanded && (
        <div className="mt-3 ml-11 space-y-2">
          {steps.map((step, index) => (
            <div key={index} className="flex items-start gap-2 text-sm text-muted-foreground">
              <span className="text-purple-400 font-mono">{index + 1}.</span>
              <span>{step}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function FunctionCallSection({ functionCall, timestamp, isActive }: { functionCall: FunctionCall; timestamp: string; isActive?: boolean }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const time = new Date(timestamp).toLocaleTimeString([], { 
    hour: '2-digit', 
    minute: '2-digit' 
  });

  return (
    <div className={`glass-chip rounded-xl p-4 border-l-4 border-amber-500/50 transition-all duration-300 ${isActive ? 'ring-2 ring-yellow-400 shadow-lg shadow-yellow-400/50 scale-105' : ''}`}>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-start gap-3 w-full text-left"
      >
        <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center flex-shrink-0">
          <Wrench className="w-4 h-4 text-amber-400" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-semibold text-foreground">Function Call</span>
            <span className="text-xs text-muted-foreground">{time}</span>
            {isExpanded ? (
              <ChevronDown className="w-4 h-4 text-muted-foreground ml-auto" />
            ) : (
              <ChevronRight className="w-4 h-4 text-muted-foreground ml-auto" />
            )}
          </div>
          <code className="text-xs text-amber-400 font-mono">
            {functionCall.name}()
          </code>
        </div>
      </button>
      
      {isExpanded && (
        <div className="mt-3 ml-11">
          <div className="text-xs font-semibold text-muted-foreground mb-2">Arguments:</div>
          <JsonDisplay data={functionCall.arguments} />
        </div>
      )}
    </div>
  );
}

function FunctionResponseSection({ functionResponse, timestamp, isActive }: { functionResponse: FunctionResponse; timestamp: string; isActive?: boolean }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const time = new Date(timestamp).toLocaleTimeString([], { 
    hour: '2-digit', 
    minute: '2-digit' 
  });

  return (
    <div className={`glass-chip rounded-xl p-4 border-l-4 ${functionResponse.success ? 'border-emerald-500/50' : 'border-red-500/50'} transition-all duration-300 ${isActive ? 'ring-2 ring-yellow-400 shadow-lg shadow-yellow-400/50 scale-105' : ''}`}>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-start gap-3 w-full text-left"
      >
        <div className={`w-8 h-8 rounded-full ${functionResponse.success ? 'bg-emerald-500/20' : 'bg-red-500/20'} flex items-center justify-center flex-shrink-0`}>
          {functionResponse.success ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          ) : (
            <AlertCircle className="w-4 h-4 text-red-400" />
          )}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-semibold text-foreground">Function Response</span>
            <span className="text-xs text-muted-foreground">{time}</span>
            {isExpanded ? (
              <ChevronDown className="w-4 h-4 text-muted-foreground ml-auto" />
            ) : (
              <ChevronRight className="w-4 h-4 text-muted-foreground ml-auto" />
            )}
          </div>
          <code className="text-xs text-emerald-400 font-mono">
            {functionResponse.name}()
          </code>
        </div>
      </button>
      
      {isExpanded && (
        <div className="mt-3 ml-11">
          <div className="text-xs font-semibold text-muted-foreground mb-2">
            {functionResponse.success ? 'Output:' : 'Error:'}
          </div>
          <JsonDisplay data={functionResponse.success ? functionResponse.output : functionResponse.error} />
        </div>
      )}
    </div>
  );
}

function AssistantMessage({ assistantContent, timestamp, isActive }: { assistantContent: AssistantContent; timestamp: string; isActive?: boolean }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const time = new Date(timestamp).toLocaleTimeString([], { 
    hour: '2-digit', 
    minute: '2-digit' 
  });

  const getContentPreview = () => {
    const items = [];
    if (assistantContent.thinking) items.push('Thinking');
    if (assistantContent.text) items.push('Response');
    if (assistantContent.audio) items.push('Audio');
    return items.join(', ');
  };

  return (
    <div className={`glass-chip rounded-xl p-4 transition-all duration-300 ${isActive ? 'ring-2 ring-yellow-400 shadow-lg shadow-yellow-400/50 scale-105' : ''}`}>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-start gap-3 w-full text-left"
      >
        <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center flex-shrink-0">
          <BotMessageSquare className="w-4 h-4 text-purple-400" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-semibold text-foreground">Assistant</span>
            <span className="text-xs text-muted-foreground">{time}</span>
            {isExpanded ? (
              <ChevronDown className="w-4 h-4 text-muted-foreground ml-auto" />
            ) : (
              <ChevronRight className="w-4 h-4 text-muted-foreground ml-auto" />
            )}
          </div>
          <div className="text-xs text-muted-foreground">Content</div>
          {!isExpanded && (
            <div className="text-xs text-muted-foreground mt-1">{getContentPreview()}</div>
          )}
        </div>
      </button>
      
      {isExpanded && (
        <div className="mt-3 ml-11 space-y-3">
          {assistantContent.thinking && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Brain className="w-4 h-4 text-purple-400" />
                <span className="text-xs font-semibold text-muted-foreground">Thinking</span>
              </div>
              <div className="pl-6 p-3 bg-purple-500/10 rounded-lg border-l-2 border-purple-500/30">
                <p className="text-sm text-muted-foreground leading-relaxed italic">{assistantContent.thinking}</p>
              </div>
            </div>
          )}
          
          {assistantContent.text && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <FileText className="w-4 h-4 text-purple-400" />
                <span className="text-xs font-semibold text-muted-foreground">Response</span>
              </div>
              <p className="text-sm text-foreground leading-relaxed pl-6">{assistantContent.text}</p>
            </div>
          )}
          
          {assistantContent.audio && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Volume2 className="w-4 h-4 text-purple-400" />
                <span className="text-xs font-semibold text-muted-foreground">Audio Response</span>
              </div>
              <div className="pl-6">
                <audio controls className="w-full max-w-xs">
                  <source src={assistantContent.audio} type="audio/mpeg" />
                  Your browser does not support the audio element.
                </audio>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const ConversationLogs = forwardRef<ConversationLogsRef, ConversationLogsProps>(({ logs: providedLogs, activeLogIndex = -1, onLogsLoaded }, ref) => {
  const { t } = useTranslation();
  const [logs, setLogs] = useState<LogEntry[]>(providedLogs || []);
  const [isLoading, setIsLoading] = useState(!providedLogs);
  const logRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeIndices, setActiveIndices] = useState<Set<number>>(new Set());

  // Expose methods via ref
  useImperativeHandle(ref, () => ({
    setActiveLogs: (indices: number[]) => {
      setActiveIndices(new Set(indices));
    },
    clearActiveLogs: () => {
      setActiveIndices(new Set());
    }
  }));

  // Fetch logs from API if not provided
  useEffect(() => {
    if (!providedLogs) {
      const fetchLogs = async () => {
        try {
          setIsLoading(true);
          const response = await fetch('/api/conversation-logs');
          if (response.ok) {
            const data = await response.json();
            setLogs(data.logs || []);
            onLogsLoaded?.(data.logs?.length || 0);
          }
        } catch (error) {
          console.error('Error fetching logs:', error);
        } finally {
          setIsLoading(false);
        }
      };
      fetchLogs();
    } else {
      setLogs(providedLogs);
      onLogsLoaded?.(providedLogs.length);
    }
  }, [providedLogs, onLogsLoaded]);

  // Auto-scroll to active log
  useEffect(() => {
    if (activeLogIndex >= 0 && activeLogIndex < logs.length) {
      const logId = logs[activeLogIndex]?.id;
      const logElement = logRefs.current[logId];
      
      if (logElement && containerRef.current) {
        // Scroll with smooth behavior and center alignment
        logElement.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'center',
          inline: 'nearest'
        });
      }
    }
  }, [activeLogIndex, logs]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            {t('server.logs.loading', 'Loading conversation logs...')}
          </p>
        </div>
      </div>
    );
  }

  if (!logs || logs.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <Clock className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-50" />
          <p className="text-sm text-muted-foreground">
            {t('server.logs.empty', 'No conversation logs yet')}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="w-full max-w-3xl mx-auto px-4 py-6">
      <div className="space-y-4">
        {logs.map((log, index) => {
          const isActive = index === activeLogIndex || activeIndices.has(index);
          let content = null;
          
          switch (log.type) {
            case 'user_message':
              content = log.userContent ? (
                <UserMessage 
                  userContent={log.userContent} 
                  timestamp={log.timestamp}
                  isActive={isActive}
                />
              ) : log.content ? (
                // Fallback for legacy content structure
                <UserMessage 
                  userContent={{ text: log.content }}
                  timestamp={log.timestamp}
                  isActive={isActive}
                />
              ) : null;
              break;
            
            case 'thinking':
              content = log.thinkingSteps ? (
                <ThinkingSection 
                  steps={log.thinkingSteps} 
                  timestamp={log.timestamp}
                  isActive={isActive}
                />
              ) : null;
              break;
            
            case 'function_call':
              content = log.functionCall ? (
                <FunctionCallSection 
                  functionCall={log.functionCall} 
                  timestamp={log.timestamp}
                  isActive={isActive}
                />
              ) : null;
              break;
            
            case 'function_response':
              content = log.functionResponse ? (
                <FunctionResponseSection 
                  functionResponse={log.functionResponse} 
                  timestamp={log.timestamp}
                  isActive={isActive}
                />
              ) : null;
              break;
            
            case 'assistant_message':
              content = log.assistantContent ? (
                <AssistantMessage 
                  assistantContent={log.assistantContent} 
                  timestamp={log.timestamp}
                  isActive={isActive}
                />
              ) : log.content ? (
                // Fallback for legacy content structure
                <AssistantMessage 
                  assistantContent={{ text: log.content }}
                  timestamp={log.timestamp}
                  isActive={isActive}
                />
              ) : null;
              break;
            
            default:
              break;
          }
          
          return content ? (
            <div 
              key={log.id}
              ref={(el) => { logRefs.current[log.id] = el; }}
            >
              {content}
            </div>
          ) : null;
        })}
      </div>
    </div>
  );
});

ConversationLogs.displayName = 'ConversationLogs';

export default ConversationLogs;
