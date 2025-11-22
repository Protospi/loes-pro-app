import { useCallback, useMemo, useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import type { ComponentType } from 'react';
import {
  ReactFlow,
  Node,
  Edge,
  Background,
  useNodesState,
  useEdgesState,
  BackgroundVariant,
  Position,
  ConnectionLineType,
  Handle,
  useReactFlow,
  ReactFlowProvider,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { User, BotMessageSquare, Calendar, FileText, HeartPulse, Database, Save, Mic, Type, File, Brain, CalendarClock } from 'lucide-react';
import { useTheme } from '@/components/theme-provider';

export interface ConversationFlowItem {
  type: 'message' | 'function' | 'reasoning';
  createdAt: Date;
  author?: string;
  text?: string;
  args?: any;
  response?: any;
  file?: string;
  audio?: boolean;
}

// Custom Node Component
function CustomNode({ data }: { data: any }) {
  const Icon = data.icon;
  const isAgent = data.type === 'agent';
  const isUser = data.type === 'user';
  const isTool = data.type === 'tool';
  const isInput = data.type === 'input';
  const isBotNode = data.id === 'agent'; // The main bot/chatbot node
  const isThinkingNode = data.id === 'thinking'; // The brain node above bot
  const isClockNode = data.id === 'clock'; // The clock node below bot
  const isActive = data.isActive || false; // Active state for animation
  const { theme } = useTheme();
  
  // Use darker colors for light theme, lighter colors for dark theme
  const userColor = theme === 'light' ? 'text-blue-500' : 'text-blue-400';
  const agentColor = theme === 'light' ? 'text-purple-500' : 'text-purple-400';
  const toolColor = theme === 'light' ? 'text-emerald-500' : 'text-emerald-400';
  const inputColor = theme === 'light' ? 'text-gray-900' : 'text-amber-500';

  return (
    <div 
      className={`
        relative p-2 rounded-xl shadow-xl
        backdrop-filter backdrop-blur-lg
        transition-all duration-300 hover:scale-105
        ${isUser ? 'glass-chip border-2 border-blue-500/40' : ''}
        ${isAgent ? 'glass-chip border-2 border-purple-500/40' : ''}
        ${isTool ? 'glass-chip border-2 border-emerald-500/30' : ''}
        ${isInput ? 'glass-chip border-2 border-gray-500/30' : ''}
      `}
    >
      {/* Left-side handles */}
      {/* Target handle on left for receiving forward messages (not for user node) */}
      {((isAgent && !isThinkingNode && !isClockNode) || isTool || isInput) && (
        <Handle
          type="target"
          position={Position.Left}
          id="left"
          style={{ background: '#a855f7', border: '2px solid #ffffff' }}
        />
      )}
      
      {/* Source handle on left for sending backward messages (agent and input nodes) - same position as target */}
      {(isInput || (isAgent && !isThinkingNode && !isClockNode)) && (
        <Handle
          type="source"
          position={Position.Left}
          id="left-source"
          style={{ background: '#a855f7', border: '2px solid #ffffff' }}
        />
      )}
      
      {/* Right-side handles */}
      {/* Source handle on right for sending forward messages */}
      {(isUser || (isAgent && !isThinkingNode && !isClockNode) || isInput) && (
        <Handle
          type="source"
          position={Position.Right}
          id="right"
          style={{ background: '#3b82f6', border: '2px solid #ffffff' }}
        />
      )}
      
      {/* Target handle on right for receiving backward messages (input nodes and user) - same position as source */}
      {(isInput || isUser) && (
        <Handle
          type="target"
          position={Position.Right}
          id="right-target"
          style={{ background: '#3b82f6', border: '2px solid #ffffff' }}
        />
      )}
      
      {/* Top handle for bot node - to connect with brain above */}
      {isBotNode && (
        <Handle
          type="target"
          position={Position.Top}
          id="top"
          style={{ background: '#a855f7', border: '2px solid #ffffff' }}
        />
      )}
      
      {/* Bottom handle for bot node - to connect with clock below */}
      {isBotNode && (
        <Handle
          type="source"
          position={Position.Bottom}
          id="bottom"
          style={{ background: '#a855f7', border: '2px solid #ffffff' }}
        />
      )}
      
      {/* Bottom handle for thinking node - to connect with bot below */}
      {isThinkingNode && (
        <Handle
          type="source"
          position={Position.Bottom}
          id="bottom"
          style={{ background: '#a855f7', border: '2px solid #ffffff' }}
        />
      )}
      
      {/* Top handle for clock node - to connect with bot above */}
      {isClockNode && (
        <Handle
          type="target"
          position={Position.Top}
          id="top"
          style={{ background: '#a855f7', border: '2px solid #ffffff' }}
        />
      )}
      
      <div 
        className={`
          w-12 h-12 rounded-xl flex items-center justify-center
          ${isUser ? '' : ''}
          ${isAgent ? '' : ''}
          ${isTool ? '' : ''}
        `}
      >
        <Icon 
          className={`
            w-7 h-7 transition-colors duration-200
            ${isUser ? userColor : ''}
            ${isAgent ? agentColor : ''}
            ${isTool ? toolColor : ''}
            ${isInput ? inputColor : ''}
          `}
        />
      </div>
      
      {/* Active pulse animation */}
      {isActive && (
        <div className="absolute inset-0 rounded-xl border-2 border-yellow-400 animate-pulse shadow-lg shadow-yellow-400/50" />
      )}
      {/* Default agent pulse */}
      {isAgent && !isActive && (
        <div className="absolute inset-0 rounded-xl border-2 border-purple-500/20 animate-pulse" />
      )}
    </div>
  );
}

const nodeTypes = {
  custom: CustomNode,
};

interface ReactFlowCanvasProps {
  tools?: Array<{ 
    name: string; 
    description?: string;
    icon?: ComponentType;
  }>;
  onPlaybackComplete?: () => void;
}

export interface ReactFlowCanvasRef {
  playConversationFlow: (flow: ConversationFlowItem[]) => void;
  stopPlayback: () => void;
}

// Inner component that uses useReactFlow for fitView control
const FlowCanvas = forwardRef<ReactFlowCanvasRef, ReactFlowCanvasProps>(({ tools, onPlaybackComplete }, ref) => {
  // Default tools from tools.json if not provided
  const defaultTools = [
    { name: '', icon: Calendar },
    { name: '', icon: Database },
    { name: '', icon:  HeartPulse},
    { name: '', icon: Save },
  ];

  const toolsToDisplay = tools && tools.length > 0 ? tools : defaultTools;
  const reactFlowInstance = useReactFlow();
  const [activeNodes, setActiveNodes] = useState<Set<string>>(new Set());
  const [activeEdges, setActiveEdges] = useState<Set<string>>(new Set());
  const playbackTimeoutRef = useRef<NodeJS.Timeout[]>([]);

  // Create nodes with responsive positioning
  const createNodes = useCallback(() => {
    const isMobile = window.innerWidth < 768;
    
    // Adjust spacing based on screen size with equal distances between columns
    const userX = isMobile ? 50 : 100;
    const columnSpacing = isMobile ? 170 : 250;
    const inputX = userX + columnSpacing;
    const agentX = inputX + columnSpacing;
    const toolX = agentX + columnSpacing;
    const toolSpacing = 85;
    const centerY = 150;

    const inputStartY = centerY - toolSpacing;

    const nodes: Node[] = [
      // User Node
      {
        id: 'user',
        type: 'custom',
        position: { x: userX, y: centerY },
        data: { 
          label: '', 
          icon: User, 
          type: 'user'
        },
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
      },
      // Input Nodes
      {
        id: 'audio-input',
        type: 'custom',
        position: { x: inputX, y: inputStartY },
        data: { 
          label: '', 
          icon: Mic,
          type: 'input'
        },
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
      },
      {
        id: 'text-input',
        type: 'custom',
        position: { x: inputX, y: centerY },
        data: { 
          label: '', 
          icon: Type,
          type: 'input'
        },
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
      },
      {
        id: 'document-input',
        type: 'custom',
        position: { x: inputX, y: inputStartY + toolSpacing * 2 },
        data: { 
          label: '', 
          icon: File,
          type: 'input'
        },
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
      },
      // Thinking Node (above agent)
      {
        id: 'thinking',
        type: 'custom',
        position: { x: agentX, y: centerY - toolSpacing * 1.5 },
        data: { 
          id: 'thinking',
          label: '', 
          icon: Brain, 
          type: 'agent'
        },
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
      },
      // Agent Node
      {
        id: 'agent',
        type: 'custom',
        position: { x: agentX, y: centerY },
        data: { 
          id: 'agent',
          label: '', 
          icon: BotMessageSquare, 
          type: 'agent'
        },
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
      },
      // Clock Node (below agent)
      {
        id: 'clock',
        type: 'custom',
        position: { x: agentX, y: centerY + toolSpacing * 1.5 },
        data: { 
          id: 'clock',
          label: '', 
          icon: CalendarClock, 
          type: 'agent'
        },
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
      },
    ];

    // Tool Nodes - arranged vertically to the right of agent
    const toolCount = toolsToDisplay.length;
    const startY = centerY - ((toolCount - 1) * toolSpacing) / 2; // Center tools vertically

    toolsToDisplay.forEach((tool, index) => {
      const icon = tool.icon || FileText;
      nodes.push({
        id: `tool-${index}`,
        type: 'custom',
        position: { x: toolX, y: startY + (index * toolSpacing) },
        data: { 
          label: tool.name,
          icon: tool.icon,
          type: 'tool'
        },
        targetPosition: Position.Left,
      });
    });

    return nodes;
  }, [toolsToDisplay]);

  // Create nodes
  const initialNodes: Node[] = useMemo(() => createNodes(), [createNodes]);

  // Create edges
  const initialEdges: Edge[] = useMemo(() => {
    // Define the base edge style
    const baseEdgeStyle = {
      animated: true,
      type: 'default' as const,
      style: {
        strokeWidth: 4,
        strokeOpacity: 1,
      },
    };

    const userEdgeStyle = {
      ...baseEdgeStyle,
      style: {
        ...baseEdgeStyle.style,
        stroke: '#3b82f6', // Blue for user connections
      },
    };

    const agentEdgeStyle = {
      ...baseEdgeStyle,
      style: {
        ...baseEdgeStyle.style,
        stroke: '#a855f7', // Purple for agent connections
      },
    };

    const edges: Edge[] = [
      // Thinking (brain) to agent (bot) - vertical connection from bottom of brain to top of bot
      {
        id: 'thinking-agent',
        source: 'thinking',
        target: 'agent',
        sourceHandle: 'bottom', // Use bottom handle from thinking
        targetHandle: 'top', // Connect to top handle of bot
        ...agentEdgeStyle,
        type: 'straight',
      },
      // Agent (bot) to clock - vertical connection from bottom of bot to top of clock
      {
        id: 'agent-clock',
        source: 'agent',
        target: 'clock',
        sourceHandle: 'bottom', // Use bottom handle of bot
        targetHandle: 'top', // Connect to top handle of clock
        ...agentEdgeStyle,
        type: 'straight',
      },
      // User to Input nodes
      {
        id: 'user-audio',
        source: 'user',
        target: 'audio-input',
        sourceHandle: 'right',
        targetHandle: 'left',
        ...userEdgeStyle,
      },
      {
        id: 'user-text',
        source: 'user',
        target: 'text-input',
        sourceHandle: 'right', // User's right handle
        targetHandle: 'left',  // Text-input's left handle
        ...userEdgeStyle,
      },
      {
        id: 'user-document',
        source: 'user',
        target: 'document-input',
        sourceHandle: 'right',
        targetHandle: 'left',
        ...userEdgeStyle,
      },
      // Input nodes to Agent
      {
        id: 'audio-agent',
        source: 'audio-input',
        target: 'agent',
        sourceHandle: 'right',
        targetHandle: 'left',
        ...userEdgeStyle,
      },
      {
        id: 'text-agent',
        source: 'text-input',
        target: 'agent',
        sourceHandle: 'right', // Text-input's right handle
        targetHandle: 'left',  // Agent's left handle
        ...userEdgeStyle,
      },
      {
        id: 'document-agent',
        source: 'document-input',
        target: 'agent',
        sourceHandle: 'right',
        targetHandle: 'left',
        ...userEdgeStyle,
      },
      
      // Reverse edges for assistant responses (completely hidden by default)
      // These edges flow BACKWARD: agent -> text-input -> user
      {
        id: 'agent-text-response',
        source: 'agent',
        target: 'text-input',
        sourceHandle: 'left-source',  // Agent sends from left-source (going backward toward text-input)
        targetHandle: 'right-target', // Text-input receives on right side
        animated: false,
        hidden: true, // Completely hidden
        style: {
          strokeWidth: 0,
          strokeOpacity: 0,
          stroke: '#a855f7',
          display: 'none',
        },
        type: 'default',
      },
      {
        id: 'text-user-response',
        source: 'text-input',
        target: 'user',
        sourceHandle: 'left-source',  // Text-input sends from left (going left toward user)
        targetHandle: 'right-target', // User receives on right side
        animated: false,
        hidden: true, // Completely hidden
        style: {
          strokeWidth: 0,
          strokeOpacity: 0,
          stroke: '#a855f7',
          display: 'none',
        },
        type: 'default',
      },
    ];

    // Agent to Tools
    toolsToDisplay.forEach((_, index) => {
      edges.push({
        id: `agent-tool-${index}`,
        source: 'agent',
        target: `tool-${index}`,
        sourceHandle: 'right', // Explicitly use right handle for tool connections
        targetHandle: 'left',
        animated: true,
        style: { 
          stroke: '#a855f7',
          strokeWidth: 4,
          strokeOpacity: 1,
        },
        type: 'default',
      });
    });

    return edges;
  }, [toolsToDisplay]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const fitViewTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Expose playback methods via ref
  useImperativeHandle(ref, () => ({
    playConversationFlow: (flow: ConversationFlowItem[]) => {
      console.log('🎬 Starting conversation flow playback with', flow.length, 'items');
      
      // Clear any existing playback
      playbackTimeoutRef.current.forEach(clearTimeout);
      playbackTimeoutRef.current = [];
      setActiveNodes(new Set());
      setActiveEdges(new Set());
      
      // Animate each step with 2 second interval
      flow.forEach((item, index) => {
        const timeout = setTimeout(() => {
          console.log(`🎯 Step ${index + 1}:`, item.type, item);
          
          // Determine which nodes and edges to activate based on item type
          let nodesToActivate: string[] = [];
          let edgesToActivate: string[] = [];
          
          if (item.type === 'message') {
            if (item.author === 'user') {
              // User message: user -> input nodes -> agent
              // Always include user and agent
              nodesToActivate = ['user', 'agent'];
              edgesToActivate = [];
              
              // Check for audio input
              if (item.audio) {
                nodesToActivate.push('audio-input');
                edgesToActivate.push('user-audio', 'audio-agent');
              }
              
              // Check for file/document input
              if (item.file && item.file.trim() !== '') {
                nodesToActivate.push('document-input');
                edgesToActivate.push('user-document', 'document-agent');
              }
              
              // Always include text input (user always types something)
              nodesToActivate.push('text-input');
              edgesToActivate.push('user-text', 'text-agent');
            } else if (item.author === 'assistant') {
              // Assistant message: First highlight agent, then animate backward
              // Stage 1: Just highlight the agent node (no edges yet)
              nodesToActivate = ['agent'];
              edgesToActivate = [];
              
              // Stage 2: After 500ms, start the backward animation to text-input and user
              const backwardAnimTimeout = setTimeout(() => {
                setNodes(prevNodes => 
                  prevNodes.map(node => ({
                    ...node,
                    data: {
                      ...node.data,
                      isActive: ['agent', 'text-input', 'user'].includes(node.id)
                    }
                  }))
                );
                
                // Show and animate the backward edges
                setEdges(prevEdges =>
                  prevEdges.map(edge => {
                    const isResponseEdge = edge.id === 'agent-text-response' || edge.id === 'text-user-response';
                    const isForwardTextEdge = edge.id === 'user-text' || edge.id === 'text-agent';
                    
                    if (isResponseEdge) {
                      // Show and animate backward edges
                      return {
                        ...edge,
                        animated: true,
                        hidden: false,
                        style: {
                          stroke: '#a855f7',
                          strokeWidth: 6,
                          strokeOpacity: 1,
                          display: undefined,
                        }
                      };
                    } else if (isForwardTextEdge) {
                      // Hide forward edges during backward animation
                      return {
                        ...edge,
                        animated: false,
                        hidden: true,
                        style: {
                          strokeWidth: 0,
                          strokeOpacity: 0,
                          display: 'none',
                        }
                      };
                    }
                    return edge;
                  })
                );
              }, 500);
              
              playbackTimeoutRef.current.push(backwardAnimTimeout);
            }
          } else if (item.type === 'reasoning') {
            // Reasoning: thinking node
            nodesToActivate = ['thinking', 'agent'];
            edgesToActivate = ['thinking-agent'];
          } else if (item.type === 'function') {
            // Function call: agent -> tool (determine which tool based on function name)
            const functionName = item.args?.name || '';
            nodesToActivate = ['agent'];
            edgesToActivate = [];
            
            // Map function to tool node
            const toolMapping: Record<string, number> = {
              'schedule_meeting': 0,
              'find_available_slots': 0,
              'create_event': 0,
              'save_to_storage': 1,
              'get_from_storage': 1,
              'query_database': 1,
              'check_vitals': 2,
              'monitor_health': 2,
              'save_document': 3,
              'load_document': 3,
            };
            
            const toolIndex = toolMapping[functionName] ?? 0;
            nodesToActivate.push(`tool-${toolIndex}`);
            edgesToActivate.push(`agent-tool-${toolIndex}`);
          }
          
          // Update active nodes
          setNodes(prevNodes => 
            prevNodes.map(node => ({
              ...node,
              data: {
                ...node.data,
                isActive: nodesToActivate.includes(node.id)
              }
            }))
          );
          
          // Update active edges with animation direction
          setEdges(prevEdges =>
            prevEdges.map(edge => {
              const isActive = edgesToActivate.includes(edge.id);
              const isResponseEdge = edge.id === 'agent-text-response' || edge.id === 'text-user-response';
              const isForwardTextEdge = edge.id === 'user-text' || edge.id === 'text-agent';
              const responseEdgesActive = edgesToActivate.includes('agent-text-response') || edgesToActivate.includes('text-user-response');
              
              if (isResponseEdge) {
                // Response edges: show and animate when active, hide when not
                // Use purple color for assistant responses
                return {
                  ...edge,
                  animated: isActive, // Animate when active
                  hidden: !isActive,   // Show only when active
                  style: {
                    stroke: '#a855f7', // Purple for assistant
                    strokeWidth: isActive ? 6 : 0,
                    strokeOpacity: isActive ? 1 : 0,
                    display: isActive ? undefined : 'none',
                  }
                };
              } else if (isForwardTextEdge && responseEdgesActive) {
                // Completely hide forward text edges when response edges are active
                // This prevents visual overlap and confusion
                return {
                  ...edge,
                  animated: false,
                  hidden: true,
                  style: {
                    strokeWidth: 0,
                    strokeOpacity: 0,
                    display: 'none',
                  }
                };
              } else {
                // Regular edges: always visible, animate when active
                return {
                  ...edge,
                  animated: isActive,
                  style: {
                    ...edge.style,
                    strokeWidth: isActive ? 6 : 4,
                    strokeOpacity: 1,
                  }
                };
              }
            })
          );
          
          // Clear active state after 1.5 seconds (leaving 0.5s before next step)
          const clearTimeout_id = setTimeout(() => {
            setNodes(prevNodes => 
              prevNodes.map(node => ({
                ...node,
                data: {
                  ...node.data,
                  isActive: false
                }
              }))
            );
            
            // Hide response edges and restore forward edges after animation
            setEdges(prevEdges =>
              prevEdges.map(edge => {
                const isResponseEdge = edge.id === 'agent-text-response' || edge.id === 'text-user-response';
                const isForwardTextEdge = edge.id === 'user-text' || edge.id === 'text-agent';
                
                if (isResponseEdge) {
                  // Hide response edges
                  return {
                    ...edge,
                    animated: false,
                    hidden: true,
                    style: {
                      ...edge.style,
                      strokeWidth: 0,
                      strokeOpacity: 0,
                      display: 'none',
                    }
                  };
                } else if (isForwardTextEdge) {
                  // Restore forward text edges to normal state
                  return {
                    ...edge,
                    animated: true,
                    hidden: false,
                    style: {
                      ...edge.style,
                      strokeWidth: 4,
                      strokeOpacity: 1,
                      display: undefined,
                    }
                  };
                }
                return edge;
              })
            );
          }, 1500);
          
          playbackTimeoutRef.current.push(clearTimeout_id);
          
          // If this is the last item, restore original state and call onPlaybackComplete
          if (index === flow.length - 1) {
            const completeTimeout = setTimeout(() => {
              console.log('✅ Playback complete - restoring original state');
              
              // Restore all edges to original animated state
              setEdges(initialEdges);
              
              // Clear active nodes
              setNodes(prevNodes => 
                prevNodes.map(node => ({
                  ...node,
                  data: {
                    ...node.data,
                    isActive: false
                  }
                }))
              );
              
              onPlaybackComplete?.();
            }, 2000);
            playbackTimeoutRef.current.push(completeTimeout);
          }
        }, index * 2000); // 2 second interval between steps
        
        playbackTimeoutRef.current.push(timeout);
      });
    },
    stopPlayback: () => {
      console.log('⏹️ Stopping playback');
      playbackTimeoutRef.current.forEach(clearTimeout);
      playbackTimeoutRef.current = [];
      setActiveNodes(new Set());
      setActiveEdges(new Set());
      
      // Reset all nodes
      setNodes(prevNodes => 
        prevNodes.map(node => ({
          ...node,
          data: {
            ...node.data,
            isActive: false
          }
        }))
      );
      
      // Restore all edges to original animated state
      setEdges(initialEdges);
    }
  }));

  // Initial fitView only once when mounted
  useEffect(() => {
    // Clear any pending timeout
    if (fitViewTimeoutRef.current) {
      clearTimeout(fitViewTimeoutRef.current);
    }
    
    // Single fitView call after mount
    fitViewTimeoutRef.current = setTimeout(() => {
      const isMobile = window.innerWidth < 768;
      const padding = isMobile ? 0.3 : 0.2;
      reactFlowInstance.fitView({ 
        padding,
        duration: 800,
        maxZoom: 1.2,
      });
    }, 150);

    return () => {
      if (fitViewTimeoutRef.current) {
        clearTimeout(fitViewTimeoutRef.current);
      }
    };
  }, [reactFlowInstance]);

  // Handle window resize to reposition nodes
  useEffect(() => {
    let resizeTimeout: NodeJS.Timeout;
    
    const handleResize = () => {
      // Clear any pending timeouts
      if (fitViewTimeoutRef.current) {
        clearTimeout(fitViewTimeoutRef.current);
      }
      clearTimeout(resizeTimeout);
      
      const isMobile = window.innerWidth < 768;
      const padding = isMobile ? 0.3 : 0.2;
      
      // Recreate nodes with new positions based on screen size
      const newNodes = createNodes();
      setNodes(newNodes);
      
      // Debounced fitView after resize
      fitViewTimeoutRef.current = setTimeout(() => {
        reactFlowInstance.fitView({ 
          padding,
          duration: 400,
          maxZoom: 1.2,
        });
      }, 200);
    };

    const debouncedResize = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(handleResize, 250);
    };

    window.addEventListener('resize', debouncedResize);
    
    return () => {
      window.removeEventListener('resize', debouncedResize);
      clearTimeout(resizeTimeout);
      if (fitViewTimeoutRef.current) {
        clearTimeout(fitViewTimeoutRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reactFlowInstance]);

  // Cleanup playback on unmount
  useEffect(() => {
    return () => {
      playbackTimeoutRef.current.forEach(clearTimeout);
    };
  }, []);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      nodeTypes={nodeTypes}
      zoomOnScroll={false}
      zoomOnPinch={false}
      zoomOnDoubleClick={false}
      panOnDrag={true}
      minZoom={0.5}
      maxZoom={1.5}
      proOptions={{ hideAttribution: true }}
      connectionLineType={ConnectionLineType.Straight}
      defaultEdgeOptions={{
        animated: true,
        style: { 
          strokeWidth: 4,
          strokeOpacity: 1,
        },
        type: 'default',
      }}
    >
      <Background 
        variant={BackgroundVariant.Dots}
        gap={20}
        size={1}
        className="opacity-20"
      />
    </ReactFlow>
  );
});

// Main component wrapped with ReactFlowProvider
const ReactFlowCanvas = forwardRef<ReactFlowCanvasRef, ReactFlowCanvasProps>(({ tools, onPlaybackComplete }, ref) => {
  return (
    <div className="w-full h-full relative rounded-xl glass-chip" style={{ overflow: 'visible' }}>
      <ReactFlowProvider>
        <FlowCanvas tools={tools} onPlaybackComplete={onPlaybackComplete} ref={ref} />
      </ReactFlowProvider>
    </div>
  );
});

ReactFlowCanvas.displayName = 'ReactFlowCanvas';

export default ReactFlowCanvas;
