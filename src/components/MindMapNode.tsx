import { Handle, Position, NodeProps, Node } from '@xyflow/react';
import React, { useState, useRef, memo, useEffect } from 'react';
import { Trash2, ImageIcon, AlignLeft, AlignCenter, AlignRight, X, ChevronRight, Type, Bold, Italic, Palette, GripHorizontal, ChevronDown, Network, ImagePlus } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

const DARK_MODE_COLORS = [
  '#1e293b', // Slate
  '#450a0a', // Red
  '#431407', // Orange
  '#451a03', // Amber
  '#422006', // Yellow
  '#1a2e05', // Lime
  '#052e16', // Green
  '#064e3b', // Emerald
  '#115e59', // Teal
  '#164e63', // Cyan
  '#0c4a6e', // Sky
  '#1e3a8a', // Blue
  '#312e81', // Indigo
  '#4c1d95', // Violet
  '#581c87', // Purple
  '#701a75', // Fuchsia
  '#831843', // Pink
  '#881337', // Rose
];

const LIGHT_MODE_COLORS = [
  '#f8fafc', // Slate
  '#fef2f2', // Red
  '#fff7ed', // Orange
  '#fffbeb', // Amber
  '#fefce8', // Yellow
  '#f7fee7', // Lime
  '#f0fdf4', // Green
  '#ecfdf5', // Emerald
  '#f0fdfa', // Teal
  '#ecfeff', // Cyan
  '#f0f9ff', // Sky
  '#eff6ff', // Blue
  '#eef2ff', // Indigo
  '#f5f3ff', // Violet
  '#faf5ff', // Purple
  '#fdf4ff', // Fuchsia
  '#fce7f3', // Pink
  '#fff1f2', // Rose
];

export type NodeData = {
  title: string;
  content: string;
  isCollapsed?: boolean; // Controls body visibility
  theme?: 'dark' | 'light';
  
  // Style
  color?: string; // Hex color
  
  // Text Style
  fontFamily?: 'sans' | 'serif';
  fontSize?: 'sm' | 'md' | 'lg';

  image?: string;
  imageAlign?: 'left' | 'center' | 'right';
  attachments?: { id: string; url: string }[];
  
  // Handlers
  onUpdate?: (id: string, data: Partial<NodeData>) => void;
  onDelete?: (id: string) => void;
  onCollapse?: (id: string) => void; // Controls descendant visibility
};

export type MindMapNodeType = Node<NodeData, 'mindMap'>;

const MindMapNode = ({ id, data, selected }: NodeProps<MindMapNodeType>) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const attachmentInputRef = useRef<HTMLInputElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const isEditing = useRef(false); // Track editing state to prevent overwrites
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [isContentCollapsed, setIsContentCollapsed] = useState(data.isCollapsed || false);
  const [title, setTitle] = useState(data.title);

  // Sync local state with data prop
  useEffect(() => {
    setIsContentCollapsed(data.isCollapsed || false);
  }, [data.isCollapsed]);

  useEffect(() => {
    setTitle(data.title);
  }, [data.title]);

  // Sync content from props to DOM, but ONLY if we are not currently editing
  useEffect(() => {
    if (contentRef.current && !isEditing.current) {
       const currentContent = contentRef.current.innerHTML;
       const newContent = data.content || '';
       if (currentContent !== newContent) {
          contentRef.current.innerHTML = newContent;
       }
    }
  }, [data.content, isContentCollapsed]);

  const handleFocus = () => {
    isEditing.current = true;
  };

  const handleBlur = () => {
    isEditing.current = false;
    if (contentRef.current) {
      data.onUpdate?.(id, { content: contentRef.current.innerHTML });
    }
  };

  const toggleContentCollapse = (e: React.MouseEvent) => {
    e.stopPropagation();
    const newState = !isContentCollapsed;
    setIsContentCollapsed(newState);
    data.onUpdate?.(id, { isCollapsed: newState });
  };

  const execCommand = (command: string, value?: string) => {
    document.execCommand(command, false, value);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        data.onUpdate?.(id, { image: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleAttachmentUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const newAttachment = { 
            id: Date.now().toString(36) + Math.random().toString(36).substr(2), 
            url: reader.result as string 
        };
        const currentAttachments = data.attachments || [];
        data.onUpdate?.(id, { attachments: [...currentAttachments, newAttachment] });
      };
      reader.readAsDataURL(file);
    }
    if (attachmentInputRef.current) attachmentInputRef.current.value = '';
  };

  const isDark = data.theme === 'dark';
  
  // Default colors if no custom color set
  const defaultBg = isDark ? '#1e1e1e' : '#ffffff';
  const defaultBorder = isDark ? '#555' : '#e2e8f0';
  const defaultText = isDark ? '#f3f4f6' : '#111827';

  const nodeColor = data.color || defaultBg;
  
  return (
    <div
      className={twMerge(
        "group relative flex flex-col border-2 transition-all duration-200 shadow-lg rounded-xl",
        selected ? "ring-2 ring-blue-400/50" : "hover:border-opacity-80"
      )}
      style={{
          backgroundColor: nodeColor,
          borderColor: data.color ? data.color : defaultBorder,
          color: defaultText,
          minWidth: '250px',
          maxWidth: '400px',
      }}
    >
      <Handle type="target" position={Position.Left} className={clsx("!h-3 !w-3 !border-2 z-50", isDark ? "!bg-white !border-black" : "!bg-black !border-white")} />
      <Handle type="source" position={Position.Right} className={clsx("!h-3 !w-3 !border-2 z-50", isDark ? "!bg-white !border-black" : "!bg-black !border-white")} />

      {/* Header / Title - Drag Handle */}
      <div className={clsx(
        "drag-handle flex items-center gap-2 p-3 border-b cursor-move rounded-t-xl",
        isDark ? "border-white/10 bg-black/20" : "border-black/5 bg-black/5",
        isContentCollapsed && "rounded-b-xl border-b-0"
      )}>
         {/* Content Collapse Toggle */}
         <button 
           onClick={toggleContentCollapse}
           className="cursor-pointer p-1 hover:bg-black/10 rounded text-gray-400 hover:text-gray-600 transition-colors"
           onMouseDown={(e) => e.stopPropagation()} // Prevent drag start
         >
            {isContentCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
         </button>

         {/* Explicit Drag Grip */}
         <div className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600">
           <GripHorizontal size={16} />
         </div>

        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => {
            if (title !== data.title) {
              data.onUpdate?.(id, { title });
            }
          }}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === 'Enter') {
              e.currentTarget.blur();
            }
          }}
          className={clsx(
            "flex-1 bg-transparent font-bold placeholder-opacity-50 focus:outline-none nodrag min-w-0",
            isDark ? "text-white placeholder-white" : "text-gray-900 placeholder-gray-500"
          )}
          placeholder="Title"
        />

        {/* Descendant Collapse Button (Moved to Header) */}
        <button
            onClick={(e) => {
                e.stopPropagation();
                data.onCollapse?.(id);
            }}
            className={clsx(
                "p-1.5 rounded hover:bg-black/10 transition-colors",
                isDark ? "text-gray-400 hover:text-white" : "text-gray-500 hover:text-black"
            )}
            title="Toggle Subtopics (Hide/Show Children)"
            onMouseDown={(e) => e.stopPropagation()}
        >
            <Network size={16} />
        </button>
      </div>

      {/* Body */}
      {!isContentCollapsed && (
      <div className="flex flex-col p-3 gap-3 rounded-b-xl">
          {/* Image Display */}
          {data.image && (
            <div className={clsx(
              "relative group/image shrink-0",
              data.imageAlign === 'left' && "self-start",
              data.imageAlign === 'center' && "self-center",
              data.imageAlign === 'right' && "self-end",
            )}>
               <img 
                src={data.image} 
                alt="Node attachment" 
                className="max-h-[300px] max-w-full rounded-md object-contain border border-black/10"
              />
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  data.onUpdate?.(id, { image: undefined });
                }}
                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover/image:opacity-100 transition-opacity shadow-md"
              >
                <X size={12} />
              </button>
            </div>
          )}

          {/* Rich Text Content */}
          <div
            ref={contentRef}
            contentEditable
            suppressContentEditableWarning
            onFocus={handleFocus}
            onBlur={handleBlur}
            className={twMerge(
              "nodrag min-h-[60px] focus:outline-none leading-relaxed outline-none p-1 rounded break-words whitespace-pre-wrap cursor-text",
              data.fontFamily === 'serif' ? 'font-serif' : 'font-sans',
              data.fontSize === 'sm' ? 'text-xs' : data.fontSize === 'lg' ? 'text-lg' : 'text-sm',
              isDark ? "selection:bg-blue-500/30" : "selection:bg-blue-200"
            )}
            onKeyDown={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()} 
          />

          {/* Attachments (Bottom) */}
          {data.attachments && data.attachments.length > 0 && (
            <div className="flex flex-col gap-2 mt-2">
              {data.attachments.map((attachment) => (
                <div key={attachment.id} className="relative group/attachment">
                  <img 
                    src={attachment.url} 
                    alt="Attachment" 
                    className="max-h-[300px] max-w-full rounded-md object-contain border border-black/10"
                  />
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const newAttachments = data.attachments?.filter(a => a.id !== attachment.id);
                      data.onUpdate?.(id, { attachments: newAttachments });
                    }}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover/attachment:opacity-100 transition-opacity shadow-md"
                    title="Remove attachment"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Toolbar - Visible when selected */}
      {selected && (
        <div className="absolute -top-16 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 z-50 w-max">
           <div className={clsx(
             "flex items-center gap-1 rounded-lg p-1.5 shadow-xl border animate-in fade-in zoom-in duration-200",
             isDark ? "bg-[#2a2a2a] border-[#444]" : "bg-white border-gray-200"
           )}>
            {/* Custom Color Picker */}
            <div className="relative flex items-center">
              <button
                onClick={() => setShowColorPicker(!showColorPicker)}
                className={clsx("p-1.5 rounded", isDark ? "text-gray-400 hover:text-white hover:bg-[#333]" : "text-gray-500 hover:text-black hover:bg-gray-100")}
                title="Color"
              >
                <Palette size={16} />
              </button>
              {showColorPicker && (
                  <div className={clsx("absolute top-full left-0 mt-2 p-3 rounded-xl shadow-2xl border z-50 flex flex-col gap-3 w-64", isDark ? "bg-[#1e1e1e] border-[#333]" : "bg-white border-gray-200")}>
                      <div className="flex items-center justify-between">
                        <label className={clsx("text-xs font-bold uppercase tracking-wider opacity-70", isDark ? "text-gray-400" : "text-gray-500")}>
                            Node Color
                        </label>
                        <button 
                            onClick={() => {
                                data.onUpdate?.(id, { color: undefined });
                                setShowColorPicker(false);
                            }}
                            className="text-[10px] hover:underline opacity-50 hover:opacity-100"
                        >
                            Reset
                        </button>
                      </div>
                      
                      <div className="grid grid-cols-5 gap-2">
                          {(isDark ? DARK_MODE_COLORS : LIGHT_MODE_COLORS).map((c) => (
                              <button
                                  key={c}
                                  className={clsx(
                                      "w-8 h-8 rounded-full border-2 transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-2",
                                      data.color === c ? "border-white ring-2 ring-blue-500" : "border-transparent hover:border-white/20"
                                  )}
                                  style={{ backgroundColor: c }}
                                  onClick={() => {
                                      data.onUpdate?.(id, { color: c });
                                      setShowColorPicker(false);
                                  }}
                                  title={c}
                              />
                          ))}
                      </div>
                  </div>
              )}
            </div>

            <div className={clsx("w-px h-4 mx-1", isDark ? "bg-[#444]" : "bg-gray-200")} />

            {/* Text Formatting */}
            <button
              onMouseDown={(e) => { e.preventDefault(); execCommand('bold'); }}
              className={clsx("p-1.5 rounded", isDark ? "text-gray-400 hover:text-white hover:bg-[#333]" : "text-gray-500 hover:text-black hover:bg-gray-100")}
            >
              <Bold size={16} />
            </button>
            <button
              onMouseDown={(e) => { e.preventDefault(); execCommand('italic'); }}
              className={clsx("p-1.5 rounded", isDark ? "text-gray-400 hover:text-white hover:bg-[#333]" : "text-gray-500 hover:text-black hover:bg-gray-100")}
            >
              <Italic size={16} />
            </button>
            <button
              onClick={() => data.onUpdate?.(id, { fontFamily: data.fontFamily === 'serif' ? 'sans' : 'serif' })}
              className={clsx("p-1.5 rounded", isDark ? "text-gray-400 hover:text-white hover:bg-[#333]" : "text-gray-500 hover:text-black hover:bg-gray-100")}
            >
              <Type size={16} />
            </button>
            <button
              onClick={() => {
                const sizes: ('sm' | 'md' | 'lg')[] = ['sm', 'md', 'lg'];
                const nextIndex = (sizes.indexOf(data.fontSize || 'sm') + 1) % sizes.length;
                data.onUpdate?.(id, { fontSize: sizes[nextIndex] });
              }}
              className={clsx("p-1.5 rounded font-mono text-xs", isDark ? "text-gray-400 hover:text-white hover:bg-[#333]" : "text-gray-500 hover:text-black hover:bg-gray-100")}
            >
              {data.fontSize === 'lg' ? 'LG' : data.fontSize === 'md' ? 'MD' : 'SM'}
            </button>

            <div className={clsx("w-px h-4 mx-1", isDark ? "bg-[#444]" : "bg-gray-200")} />

            {/* Image Alignment */}
            <button
              onClick={() => data.onUpdate?.(id, { imageAlign: 'left' })}
              className={clsx("p-1.5 rounded", data.imageAlign === 'left' ? (isDark ? "bg-[#333] text-blue-400" : "bg-gray-100 text-blue-600") : (isDark ? "text-gray-400 hover:text-white" : "text-gray-500 hover:text-black"))}
            >
              <AlignLeft size={16} />
            </button>
            <button
              onClick={() => data.onUpdate?.(id, { imageAlign: 'center' })}
              className={clsx("p-1.5 rounded", data.imageAlign === 'center' ? (isDark ? "bg-[#333] text-blue-400" : "bg-gray-100 text-blue-600") : (isDark ? "text-gray-400 hover:text-white" : "text-gray-500 hover:text-black"))}
            >
              <AlignCenter size={16} />
            </button>
            <button
              onClick={() => data.onUpdate?.(id, { imageAlign: 'right' })}
              className={clsx("p-1.5 rounded", data.imageAlign === 'right' ? (isDark ? "bg-[#333] text-blue-400" : "bg-gray-100 text-blue-600") : (isDark ? "text-gray-400 hover:text-white" : "text-gray-500 hover:text-black"))}
            >
              <AlignRight size={16} />
            </button>

            <div className={clsx("w-px h-4 mx-1", isDark ? "bg-[#444]" : "bg-gray-200")} />

            {/* Image Upload */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className={clsx("p-1.5 rounded", isDark ? "text-gray-400 hover:text-blue-400 hover:bg-[#333]" : "text-gray-500 hover:text-blue-600 hover:bg-gray-100")}
              title="Set Main Image (Top)"
            >
              <ImageIcon size={16} />
            </button>

            {/* Attachment Upload */}
            <button
              onClick={() => attachmentInputRef.current?.click()}
              className={clsx("p-1.5 rounded", isDark ? "text-gray-400 hover:text-blue-400 hover:bg-[#333]" : "text-gray-500 hover:text-blue-600 hover:bg-gray-100")}
              title="Add Image Below Text"
            >
              <ImagePlus size={16} />
            </button>
            
            {/* Delete */}
            <button
              onClick={() => data.onDelete?.(id)}
              className={clsx("p-1.5 rounded", isDark ? "text-gray-400 hover:text-red-400 hover:bg-[#333]" : "text-gray-500 hover:text-red-600 hover:bg-gray-100")}
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>
      )}

      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept="image/*"
        onChange={handleImageUpload}
      />
      <input
        type="file"
        ref={attachmentInputRef}
        className="hidden"
        accept="image/*"
        onChange={handleAttachmentUpload}
      />
    </div>
  );
};

export default memo(MindMapNode);
