import { useCallback, useMemo, useEffect, useRef } from 'react';
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
      {/* Source handle for user, input nodes, and agent (but not thinking or clock) */}
      {(isUser || (isAgent && !isThinkingNode && !isClockNode) || isInput) && (
        <Handle
          type="source"
          position={Position.Right}
          id="right"
          style={{ background: '#3b82f6', border: '2px solid #ffffff' }}
        />
      )}
      
      {/* Target handle for agent, input nodes, and tools (but not thinking or clock) */}
      {((isAgent && !isThinkingNode && !isClockNode) || isTool || isInput) && (
        <Handle
          type="target"
          position={Position.Left}
          id="left"
          style={{ background: '#a855f7', border: '2px solid #ffffff' }}
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
      
      {isAgent && (
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
}

// Inner component that uses useReactFlow for fitView control
function FlowCanvas({ tools }: ReactFlowCanvasProps) {
  // Default tools from tools.json if not provided
  const defaultTools = [
    { name: '', icon: Calendar },
    { name: '', icon: Database },
    { name: '', icon:  HeartPulse},
    { name: '', icon: Save },
  ];

  const toolsToDisplay = tools && tools.length > 0 ? tools : defaultTools;
  const reactFlowInstance = useReactFlow();

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
        ...userEdgeStyle,
      },
      {
        id: 'user-text',
        source: 'user',
        target: 'text-input',
        ...userEdgeStyle,
      },
      {
        id: 'user-document',
        source: 'user',
        target: 'document-input',
        ...userEdgeStyle,
      },
      // Input nodes to Agent
      {
        id: 'audio-agent',
        source: 'audio-input',
        target: 'agent',
        ...userEdgeStyle,
      },
      {
        id: 'text-agent',
        source: 'text-input',
        target: 'agent',
        ...userEdgeStyle,
      },
      {
        id: 'document-agent',
        source: 'document-input',
        target: 'agent',
        ...userEdgeStyle,
      },
    ];

    // Agent to Tools
    toolsToDisplay.forEach((_, index) => {
      edges.push({
        id: `agent-tool-${index}`,
        source: 'agent',
        target: `tool-${index}`,
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
  const [edges, , onEdgesChange] = useEdgesState(initialEdges);

  // Handle window resize to reposition nodes and re-center
  useEffect(() => {
    const handleResize = () => {
      const isMobile = window.innerWidth < 768;
      const padding = isMobile ? 0.3 : 0.2;
      
      // Recreate nodes with new positions based on screen size
      const newNodes = createNodes();
      setNodes(newNodes);
      
      // Use setTimeout to ensure ReactFlow has rendered with new positions
      setTimeout(() => {
        reactFlowInstance.fitView({ 
          padding,
          duration: 200,
        });
      }, 100);
    };

    // Initial fit
    handleResize();

    // Add resize listener with debounce
    let resizeTimeout: NodeJS.Timeout;
    const debouncedResize = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(handleResize, 150);
    };

    window.addEventListener('resize', debouncedResize);
    
    return () => {
      window.removeEventListener('resize', debouncedResize);
      clearTimeout(resizeTimeout);
    };
  }, [reactFlowInstance, createNodes, setNodes]);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      nodeTypes={nodeTypes}
      fitView
      fitViewOptions={{ padding: 0.2, maxZoom: 1.2 }}
      zoomOnScroll={false}
      zoomOnPinch={false}
      zoomOnDoubleClick={false}
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
}

// Main component wrapped with ReactFlowProvider
export default function ReactFlowCanvas({ tools }: ReactFlowCanvasProps) {
  return (
    <div className="w-full h-full relative rounded-xl glass-chip" style={{ overflow: 'visible' }}>
      <ReactFlowProvider>
        <FlowCanvas tools={tools} />
      </ReactFlowProvider>
    </div>
  );
}
