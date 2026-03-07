import React, { useCallback, useRef, useState, useEffect } from 'react';
import {
  ReactFlow,
  Controls,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Edge,
  Node,
  ReactFlowProvider,
  useReactFlow,
  Panel,
  MarkerType,
  OnConnectStart,
  OnConnectEnd,
  SelectionMode,
  getOutgoers,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { v4 as uuidv4 } from 'uuid';
import MindMapNode, { NodeData, MindMapNodeType } from './MindMapNode';
import { MousePointer2, Save, Upload, Plus, ChevronUp, ChevronDown, Sparkles, X, HelpCircle, FileText, Loader2, Menu, Sun, Moon, Trash2, Undo2, Redo2 } from 'lucide-react';
import { generateMindMapFromContent } from '../services/ai';
import { getLayoutedElements } from '../services/layout';
import { clsx } from 'clsx';

const nodeTypes = {
  mindMap: MindMapNode,
};

const INITIAL_NODES: MindMapNodeType[] = [
  {
    id: 'root',
    type: 'mindMap',
    position: { x: 0, y: 0 },
    dragHandle: '.drag-handle',
    data: { 
      title: 'Unit 1: Introduction', 
      content: 'Main concept overview.',
      imageAlign: 'center',
      color: '#1e293b', // Dark blue-ish default
      theme: 'dark',
      isCollapsed: false,
    },
  },
];

const FlowEditorInner = () => {
  const [nodes, setNodes, onNodesChange] = useNodesState(INITIAL_NODES);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const { screenToFlowPosition, setViewport, getViewport, getNodes, getEdges } = useReactFlow();
  
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const connectionStartRef = useRef<{ nodeId: string | null; handleId: string | null } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const aiFileInputRef = useRef<HTMLInputElement>(null);

  // UI State
  const [isMenuOpen, setIsMenuOpen] = useState(true);
  const [isHelpOpen, setIsHelpOpen] = useState(true);
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);
  const [aiInputText, setAiInputText] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  // History State
  const [past, setPast] = useState<{ nodes: Node[], edges: Edge[] }[]>([]);
  const [future, setFuture] = useState<{ nodes: Node[], edges: Edge[] }[]>([]);

  const takeSnapshot = useCallback(() => {
    setPast((prev) => {
      const newPast = [...prev, { nodes: getNodes(), edges: getEdges() }];
      return newPast.slice(-10); // Keep only last 10
    });
    setFuture([]);
  }, [getNodes, getEdges]);

  const undo = useCallback(() => {
    if (past.length === 0) return;

    const previousState = past[past.length - 1];
    const newPast = past.slice(0, past.length - 1);

    setFuture((prev) => [{ nodes: getNodes(), edges: getEdges() }, ...prev]);
    setPast(newPast);
    setNodes(previousState.nodes);
    setEdges(previousState.edges);
  }, [past, getNodes, getEdges, setNodes, setEdges]);

  const redo = useCallback(() => {
    if (future.length === 0) return;

    const nextState = future[0];
    const newFuture = future.slice(1);

    setPast((prev) => [...prev, { nodes: getNodes(), edges: getEdges() }]);
    setFuture(newFuture);
    setNodes(nextState.nodes);
    setEdges(nextState.edges);
  }, [future, getNodes, getEdges, setNodes, setEdges]);

  // Update theme for all nodes when theme changes
  useEffect(() => {
    setNodes((nds) => nds.map((node) => ({
      ...node,
      data: { ...node.data, theme }
    })));
  }, [theme, setNodes]);

  // Update node data handlers
  const updateNodeData = useCallback((id: string, newData: Partial<NodeData>) => {
    takeSnapshot();
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === id) {
          return { ...node, data: { ...node.data, ...newData } };
        }
        return node;
      })
    );
  }, [setNodes, takeSnapshot]);

  const deleteNode = useCallback((id: string) => {
    takeSnapshot();
    setNodes((nds) => nds.filter((n) => n.id !== id));
    setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id));
  }, [setNodes, setEdges, takeSnapshot]);

  // Collapse/Expand Logic
  const toggleCollapse = useCallback((nodeId: string) => {
    // No snapshot for collapse/expand as it's a view state? 
    // User might want to undo it though. Let's snapshot.
    takeSnapshot();
    const allNodes = getNodes();
    const allEdges = getEdges();
    const node = allNodes.find((n) => n.id === nodeId);
    
    if (!node) return;

    const isCollapsed = !node.data.isCollapsed; // Toggle state

    // Update the clicked node's state
    updateNodeData(nodeId, { isCollapsed });

    const changes: { id: string, hidden: boolean }[] = [];
    const edgeChanges: { id: string, hidden: boolean }[] = [];

    // Recursive traversal to set visibility
    const traverse = (parentId: string, parentVisible: boolean, parentCollapsed: boolean) => {
        const outEdges = allEdges.filter(e => e.source === parentId);
        
        outEdges.forEach(edge => {
            const childId = edge.target;
            const childNode = allNodes.find(n => n.id === childId);
            if (!childNode) return;

            // Child is visible if Parent is Visible AND Parent is NOT Collapsed
            const isVisible = parentVisible && !parentCollapsed;
            
            changes.push({ id: childId, hidden: !isVisible });
            edgeChanges.push({ id: edge.id, hidden: !isVisible }); // Edge hidden if child hidden

            // Recurse
            // Use the child's own collapsed state for the next level
            traverse(childId, isVisible, !!childNode.data.isCollapsed);
        });
    };

    // Start traversal from the toggled node
    // We assume the toggled node is visible (since we clicked it)
    traverse(nodeId, !node.hidden, isCollapsed);

    setNodes(nds => nds.map(n => {
        const change = changes.find(c => c.id === n.id);
        if (change) return { ...n, hidden: change.hidden };
        return n;
    }));

    setEdges(eds => eds.map(e => {
        const change = edgeChanges.find(c => c.id === e.id);
        if (change) return { ...e, hidden: change.hidden };
        return e;
    }));

  }, [getNodes, getEdges, setNodes, setEdges, updateNodeData]);


  // Inject handlers into nodes
  useEffect(() => {
    setNodes((nds) =>
      nds.map((node) => ({
        ...node,
        dragHandle: '.drag-handle',
        data: {
          ...node.data,
          onUpdate: updateNodeData,
          onDelete: deleteNode,
          onCollapse: toggleCollapse,
          theme,
        },
      }))
    );
  }, [updateNodeData, deleteNode, toggleCollapse, setNodes, theme]);

  // Shortcut Logic
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return;
      if ((e.target as HTMLElement).isContentEditable) return;

      // Undo/Redo
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
        e.preventDefault();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'y') {
        redo();
        e.preventDefault();
        return;
      }

      if (e.key.toLowerCase() === 'n') {
        takeSnapshot();
        const selectedNodes = getNodes().filter(n => n.selected);
        const id = uuidv4();
        
        if (selectedNodes.length === 1) {
          const sourceNode = selectedNodes[0];
          const newNode: MindMapNodeType = {
            id,
            type: 'mindMap',
            dragHandle: '.drag-handle',
            position: { 
              x: sourceNode.position.x + 400, 
              y: sourceNode.position.y + (Math.random() * 200 - 100) 
            },
            data: { 
              title: 'Subtopic',
              content: '',
              imageAlign: 'center',
              onUpdate: updateNodeData,
              onDelete: deleteNode,
              onCollapse: toggleCollapse,
              theme,
              color: theme === 'dark' ? '#1e293b' : '#ffffff',
            },
          };
          
          setNodes((nds) => nds.concat(newNode));
          setEdges((eds) => eds.concat({
            id: `e${sourceNode.id}-${id}`,
            source: sourceNode.id,
            target: id,
            type: 'bezier',
            style: { stroke: theme === 'dark' ? '#555' : '#ccc', strokeWidth: 2 },
            markerEnd: { type: MarkerType.ArrowClosed, color: theme === 'dark' ? '#555' : '#ccc' },
          }));
        } else {
          const newNode: MindMapNodeType = {
            id,
            type: 'mindMap',
            dragHandle: '.drag-handle',
            position: { x: 100 + Math.random() * 50, y: 100 + Math.random() * 50 },
            data: { 
              title: 'New Topic',
              content: '',
              imageAlign: 'center',
              onUpdate: updateNodeData,
              onDelete: deleteNode,
              onCollapse: toggleCollapse,
              theme,
              color: theme === 'dark' ? '#1e293b' : '#ffffff',
            },
          };
          setNodes((nds) => nds.concat(newNode));
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [getNodes, setNodes, setEdges, updateNodeData, deleteNode, toggleCollapse, theme]);

  const onConnect = useCallback(
    (params: Connection) => {
        takeSnapshot();
        setEdges((eds) => addEdge({ ...params, type: 'bezier', animated: false }, eds));
    },
    [setEdges, takeSnapshot],
  );

  const onConnectStart: OnConnectStart = useCallback((_, { nodeId, handleId }) => {
    // We don't snapshot here, we snapshot on connect or connect end (if new node created)
    connectionStartRef.current = { nodeId, handleId };
  }, []);

  const onConnectEnd: OnConnectEnd = useCallback(
    (event, connectionState) => {
      if (!connectionState.isValid) {
        const { nodeId, handleId } = connectionStartRef.current || {};
        if (!nodeId) return;

        takeSnapshot();

        // Calculate position
        const { clientX, clientY } = 'changedTouches' in event ? event.changedTouches[0] : event;
        const position = screenToFlowPosition({ x: clientX, y: clientY });

        // Create new node
        const id = uuidv4();
        const newNode: MindMapNodeType = {
          id,
          type: 'mindMap',
          dragHandle: '.drag-handle',
          // Center the node roughly around the cursor (width ~250px)
          position: { x: position.x - 125, y: position.y - 20 },
          data: { 
            title: 'New Topic',
            content: '',
            imageAlign: 'center',
            onUpdate: updateNodeData,
            onDelete: deleteNode,
            onCollapse: toggleCollapse,
            theme,
            color: theme === 'dark' ? '#1e293b' : '#ffffff',
          },
        };

        // Create edge
        const newEdge: Edge = {
            id: `e${nodeId}-${id}`,
            source: nodeId,
            target: id,
            sourceHandle: handleId,
            type: 'bezier',
            style: { stroke: theme === 'dark' ? '#555' : '#ccc', strokeWidth: 2 },
            markerEnd: { type: MarkerType.ArrowClosed, color: theme === 'dark' ? '#555' : '#ccc' },
        };

        setNodes((nds) => nds.concat(newNode));
        setEdges((eds) => eds.concat(newEdge));
      }
    },
    [screenToFlowPosition, theme, updateNodeData, deleteNode, toggleCollapse, setNodes, setEdges]
  );

  const onAddNode = useCallback(() => {
    takeSnapshot();
    const id = uuidv4();
    const newNode: MindMapNodeType = {
      id,
      type: 'mindMap',
      dragHandle: '.drag-handle',
      position: { x: 100, y: 100 },
      data: { 
        title: 'New Topic',
        content: '',
        imageAlign: 'center',
        onUpdate: updateNodeData,
        onDelete: deleteNode,
        onCollapse: toggleCollapse,
        theme,
        color: theme === 'dark' ? '#1e293b' : '#ffffff',
      },
    };
    setNodes((nds) => nds.concat(newNode));
  }, [setNodes, updateNodeData, deleteNode, toggleCollapse, theme]);

  const onDeleteSelected = useCallback(() => {
    takeSnapshot();
    const selectedNodes = getNodes().filter(n => n.selected);
    const selectedEdges = getEdges().filter(e => e.selected);
    
    setNodes(nds => nds.filter(n => !n.selected));
    setEdges(eds => eds.filter(e => !e.selected));
  }, [getNodes, getEdges, setNodes, setEdges]);

  const onSave = useCallback(() => {
    const flow = {
      nodes,
      edges,
      viewport: getViewport(),
    };
    const blob = new Blob([JSON.stringify(flow, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'mindmap.json';
    link.click();
    URL.revokeObjectURL(url);
  }, [nodes, edges, getViewport]);

  const onLoad = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    takeSnapshot();

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const flow = JSON.parse(e.target?.result as string);
        if (flow.nodes && flow.edges) {
          const restoredNodes = flow.nodes.map((node: MindMapNodeType) => ({
            ...node,
            dragHandle: '.drag-handle',
            data: {
              ...node.data,
              onUpdate: updateNodeData,
              onDelete: deleteNode,
              onCollapse: toggleCollapse,
              theme,
            },
          }));
          
          setNodes(restoredNodes);
          setEdges(flow.edges);
          if (flow.viewport) {
            setViewport(flow.viewport);
          }
        }
      } catch (error) {
        console.error('Failed to parse flow file', error);
        alert('Invalid file format');
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [setNodes, setEdges, setViewport, updateNodeData, deleteNode, toggleCollapse, theme]);

  const handleGenerateAI = async () => {
    if (!aiInputText.trim()) return;
    
    setIsGenerating(true);
    takeSnapshot();
    try {
      const base64Content = btoa(aiInputText);
      const data = await generateMindMapFromContent(base64Content, 'text/plain');
      
      if (data.nodes && data.edges) {
        const newNodes: Node[] = data.nodes.map((n: any) => ({
          id: n.id,
          type: 'mindMap',
          dragHandle: '.drag-handle',
          position: { x: 0, y: 0 },
          data: { 
            title: n.label, 
            content: n.description || '', 
            imageAlign: 'center',
            onUpdate: updateNodeData,
            onDelete: deleteNode,
            onCollapse: toggleCollapse,
            theme,
            color: theme === 'dark' ? '#1e293b' : '#ffffff',
          },
        }));
        
        const newEdges: Edge[] = data.edges.map((e: any) => ({
          id: `e${e.source}-${e.target}`,
          source: e.source,
          target: e.target,
          type: 'default',
          style: { stroke: theme === 'dark' ? '#555' : '#ccc', strokeWidth: 2 },
          markerEnd: { type: MarkerType.ArrowClosed, color: theme === 'dark' ? '#555' : '#ccc' },
        }));

        const layouted = getLayoutedElements(newNodes, newEdges);
        setNodes(layouted.nodes);
        setEdges(layouted.edges);
        setIsAIModalOpen(false);
        setAiInputText('');
      }
    } catch (error) {
      console.error(error);
      alert('Failed to generate mind map. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAIFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const result = event.target?.result as string;
      const base64 = result.split(',')[1];
      const mimeType = file.type || 'text/plain';
      
      setIsGenerating(true);
      takeSnapshot();
      try {
        const data = await generateMindMapFromContent(base64, mimeType);
        if (data.nodes && data.edges) {
            const newNodes: Node[] = data.nodes.map((n: any) => ({
              id: n.id,
              type: 'mindMap',
              dragHandle: '.drag-handle',
              position: { x: 0, y: 0 },
              data: { 
                title: n.label, 
                content: n.description || '',
                imageAlign: 'center',
                onUpdate: updateNodeData,
                onDelete: deleteNode,
                onCollapse: toggleCollapse,
                theme,
                color: theme === 'dark' ? '#1e293b' : '#ffffff',
              },
            }));
            
            const newEdges: Edge[] = data.edges.map((e: any) => ({
              id: `e${e.source}-${e.target}`,
              source: e.source,
              target: e.target,
              type: 'default',
              style: { stroke: theme === 'dark' ? '#555' : '#ccc', strokeWidth: 2 },
              markerEnd: { type: MarkerType.ArrowClosed, color: theme === 'dark' ? '#555' : '#ccc' },
            }));
    
            const layouted = getLayoutedElements(newNodes, newEdges);
            setNodes(layouted.nodes);
            setEdges(layouted.edges);
            setIsAIModalOpen(false);
        }
      } catch (err) {
        console.error(err);
        alert("Error processing file.");
      } finally {
        setIsGenerating(false);
        if (aiFileInputRef.current) aiFileInputRef.current.value = '';
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div 
      ref={reactFlowWrapper} 
      className={clsx("w-full h-full transition-colors duration-300", theme === 'dark' ? "bg-[#121212]" : "bg-[#f0f0eb]")}
    >
      {/* Fixed Background Grid Pattern */}
      <div 
        className="absolute inset-0 pointer-events-none z-0 opacity-20"
        style={{
          backgroundImage: `radial-gradient(${theme === 'dark' ? '#555' : '#000'} 1px, transparent 1px)`,
          backgroundSize: '20px 20px',
        }}
      />

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onConnectStart={onConnectStart}
        onConnectEnd={onConnectEnd}
        nodeTypes={nodeTypes}
        fitView
        className="z-10"
        minZoom={0.1}
        maxZoom={4}
        selectionOnDrag={true}
        selectionMode={SelectionMode.Partial}
        panOnDrag={[1, 2]} 
        onNodeDragStart={() => takeSnapshot()}
        connectionLineStyle={{ stroke: theme === 'dark' ? '#666' : '#999', strokeWidth: 2 }}
        defaultEdgeOptions={{
            type: 'bezier',
            style: { stroke: theme === 'dark' ? '#666' : '#999', strokeWidth: 2 },
            markerEnd: { type: MarkerType.ArrowClosed, color: theme === 'dark' ? '#666' : '#999' }
        }}
      >
        <Controls className={clsx("border-[#333]", theme === 'dark' ? "bg-[#1e1e1e] fill-gray-200 text-gray-200" : "bg-white fill-gray-800 text-gray-800 shadow-md")} />
        
        {/* Top Left Menu */}
        <Panel position="top-left" className="m-2 sm:m-4 w-auto max-w-[calc(100vw-8rem)] sm:max-w-none">
            <div className={clsx(
              "backdrop-blur-sm rounded-xl border shadow-2xl w-full sm:w-64 transition-all duration-300 overflow-hidden",
              theme === 'dark' ? "bg-[#1e1e1e]/90 border-[#333] text-gray-300" : "bg-white/90 border-gray-200 text-gray-700"
            )}>
                <div 
                    className={clsx("p-4 flex items-center justify-between cursor-pointer", theme === 'dark' ? "hover:bg-[#252525]" : "hover:bg-gray-100")}
                    onClick={() => setIsMenuOpen(!isMenuOpen)}
                >
                    <h1 className={clsx("text-xl font-bold flex items-center gap-2 leading-none", theme === 'dark' ? "text-white" : "text-gray-900")}>
                        <span className="w-2 h-6 bg-blue-500 rounded-full"></span>
                        FlowMind
                    </h1>
                    {isMenuOpen ? <ChevronUp size={24} /> : <Menu size={24} />}
                </div>
                
                {isMenuOpen && (
                    <div className="p-4 pt-0 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
                        <div className="flex items-center justify-between mb-2">
                           <p className="text-sm opacity-70">Visual note-taking</p>
                           <button 
                             onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                             className="p-1.5 rounded-lg hover:bg-black/10 transition-colors"
                             title="Toggle Theme"
                           >
                             {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
                           </button>
                        </div>

                        <div className="grid grid-cols-2 gap-2">

                            <button 
                                onClick={onAddNode}
                                className="col-span-2 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white p-2 rounded-lg transition-colors font-medium text-sm"
                            >
                                <Plus size={16} />
                                Add Node
                            </button>
                            <button 
                                onClick={() => setIsAIModalOpen(true)}
                                className="col-span-2 flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-500 text-white p-2 rounded-lg transition-colors font-medium text-sm"
                            >
                                <Sparkles size={16} />
                                AI Generate
                            </button>
                            <button 
                                onClick={onSave}
                                className={clsx("flex items-center justify-center gap-2 p-2 rounded-lg transition-colors text-sm", theme === 'dark' ? "bg-[#333] hover:bg-[#444] text-white" : "bg-gray-200 hover:bg-gray-300 text-gray-800")}
                            >
                                <Save size={16} />
                                Save
                            </button>
                            <button 
                                onClick={() => fileInputRef.current?.click()}
                                className={clsx("flex items-center justify-center gap-2 p-2 rounded-lg transition-colors text-sm", theme === 'dark' ? "bg-[#333] hover:bg-[#444] text-white" : "bg-gray-200 hover:bg-gray-300 text-gray-800")}
                            >
                                <Upload size={16} />
                                Load
                            </button>
                            <button 
                                onClick={onDeleteSelected}
                                className="col-span-2 flex items-center justify-center gap-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 p-2 rounded-lg transition-colors text-sm border border-red-500/20"
                            >
                                <Trash2 size={16} />
                                Delete Selected
                            </button>
                        </div>
                        
                        {/* Trademark in Menu */}
                        <div className="pt-2 mt-2 border-t border-gray-200 dark:border-gray-700">
                            <p className="text-[10px] text-center opacity-50">
                                © Ankur Rabha • Built with AI assistance
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </Panel>

        {/* Top Right Undo/Redo */}
        <Panel position="top-right" className="m-2 sm:m-4">
            <div className={clsx(
              "backdrop-blur-sm rounded-xl border shadow-2xl p-2 flex gap-2 transition-all duration-300",
              theme === 'dark' ? "bg-[#1e1e1e]/90 border-[#333] text-gray-300" : "bg-white/90 border-gray-200 text-gray-700"
            )}>
                <button 
                    onClick={undo}
                    disabled={past.length === 0}
                    className={clsx(
                        "p-2 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed",
                        theme === 'dark' ? "hover:bg-[#333] hover:text-white" : "hover:bg-gray-100 hover:text-black"
                    )}
                    title="Undo"
                >
                    <Undo2 size={20} />
                </button>
                <div className={clsx("w-px my-1", theme === 'dark' ? "bg-[#333]" : "bg-gray-200")} />
                <button 
                    onClick={redo}
                    disabled={future.length === 0}
                    className={clsx(
                        "p-2 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed",
                        theme === 'dark' ? "hover:bg-[#333] hover:text-white" : "hover:bg-gray-100 hover:text-black"
                    )}
                    title="Redo"
                >
                    <Redo2 size={20} />
                </button>
            </div>
        </Panel>

        {/* Bottom Right Help Menu */}
        <Panel position="bottom-right" className="m-2 sm:m-4 w-auto max-w-[calc(100vw-4rem)] sm:max-w-none">
            <div className={clsx(
              "backdrop-blur-sm rounded-xl border shadow-2xl w-full sm:w-64 transition-all duration-300 overflow-hidden",
              theme === 'dark' ? "bg-[#1e1e1e]/90 border-[#333] text-gray-300" : "bg-white/90 border-gray-200 text-gray-700"
            )}>
                 <div 
                    className={clsx("p-3 flex items-center justify-between cursor-pointer", theme === 'dark' ? "hover:bg-[#252525]" : "hover:bg-gray-100")}
                    onClick={() => setIsHelpOpen(!isHelpOpen)}
                >
                    <div className={clsx("flex items-center gap-2 text-sm font-semibold", theme === 'dark' ? "text-white" : "text-gray-900")}>
                        <HelpCircle size={16} />
                        Shortcuts
                    </div>
                    {isHelpOpen ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
                </div>

                {isHelpOpen && (
                    <div className="p-3 pt-0 space-y-2 text-xs font-medium animate-in fade-in slide-in-from-bottom-2 duration-200">
                        <div className={clsx("flex items-center gap-3 p-2 rounded-lg border", theme === 'dark' ? "bg-[#252525] border-[#333]" : "bg-gray-50 border-gray-200")}>
                            <div className={clsx("p-1.5 rounded font-mono", theme === 'dark' ? "bg-[#333] text-blue-400" : "bg-white text-blue-600 shadow-sm")}>N</div>
                            <div>
                                <span className={clsx("block", theme === 'dark' ? "text-white" : "text-gray-900")}>Add Node</span>
                                <span className="opacity-70">Selected: Connect<br/>None: Empty</span>
                            </div>
                        </div>
                        <div className={clsx("flex items-center gap-3 p-2 rounded-lg border", theme === 'dark' ? "bg-[#252525] border-[#333]" : "bg-gray-50 border-gray-200")}>
                            <div className={clsx("p-1.5 rounded", theme === 'dark' ? "bg-[#333] text-green-400" : "bg-white text-green-600 shadow-sm")}>
                                <MousePointer2 size={16} />
                            </div>
                            <div>
                                <span className={clsx("block", theme === 'dark' ? "text-white" : "text-gray-900")}>Drag Connection</span>
                                <span className="opacity-70">Drop to create</span>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </Panel>

        {/* AI Modal */}
        {isAIModalOpen && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                <div className={clsx("w-full max-w-md rounded-2xl border shadow-2xl p-6 relative animate-in zoom-in-95 duration-200", theme === 'dark' ? "bg-[#1e1e1e] border-[#333]" : "bg-white border-gray-200")}>
                    <button 
                        onClick={() => setIsAIModalOpen(false)}
                        className="absolute top-4 right-4 opacity-50 hover:opacity-100"
                    >
                        <X size={20} />
                    </button>
                    
                    <h2 className={clsx("text-xl font-bold mb-4 flex items-center gap-2", theme === 'dark' ? "text-white" : "text-gray-900")}>
                        <Sparkles className="text-purple-500" />
                        Generate Mind Map
                    </h2>
                    
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm opacity-70 mb-2">Paste your notes here:</label>
                            <textarea
                                value={aiInputText}
                                onChange={(e) => setAiInputText(e.target.value)}
                                className={clsx("w-full h-32 border rounded-lg p-3 text-sm focus:outline-none focus:border-purple-500 resize-none", theme === 'dark' ? "bg-[#252525] border-[#333] text-white" : "bg-gray-50 border-gray-200 text-gray-900")}
                                placeholder="Paste text content..."
                            />
                        </div>
                        
                        <div className="flex items-center gap-4">
                            <div className="h-px bg-current opacity-10 flex-1" />
                            <span className="text-xs opacity-50">OR</span>
                            <div className="h-px bg-current opacity-10 flex-1" />
                        </div>

                        <button 
                            onClick={() => aiFileInputRef.current?.click()}
                            className={clsx("w-full flex items-center justify-center gap-2 p-3 rounded-lg border border-dashed transition-colors", theme === 'dark' ? "bg-[#252525] hover:bg-[#333] text-gray-300 border-[#333]" : "bg-gray-50 hover:bg-gray-100 text-gray-700 border-gray-300")}
                        >
                            <FileText size={16} />
                            Upload Text/PDF File
                        </button>

                        <button
                            onClick={handleGenerateAI}
                            disabled={isGenerating || (!aiInputText && !aiFileInputRef.current?.files?.length)}
                            className="w-full bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white p-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 mt-4"
                        >
                            {isGenerating ? <Loader2 className="animate-spin" size={20} /> : 'Generate Flow Chart'}
                        </button>
                    </div>
                </div>
            </div>
        )}

      </ReactFlow>
      <input 
        type="file" 
        ref={fileInputRef} 
        className="hidden" 
        accept=".json" 
        onChange={onLoad} 
      />
      <input 
        type="file" 
        ref={aiFileInputRef} 
        className="hidden" 
        accept=".txt,.pdf,.md" 
        onChange={handleAIFileUpload} 
      />
    </div>
  );
};

export default function FlowEditor() {
  return (
    <ReactFlowProvider>
      <FlowEditorInner />
    </ReactFlowProvider>
  );
}
