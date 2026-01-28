import React, { useState, useRef, useEffect } from 'react';
import { Undo2, Redo2, Share2, BarChart3, ChevronDown, FileJson, FilePlus, Save, Play, Square, FolderOpen } from 'lucide-react';
import { SceneObject } from '../types';
import { ShareModal } from './ShareModal';

interface ToolbarProps {
  onSave: () => void;
  onLoad: (file: File) => void;
  onClear: () => void;
  isSimulating: boolean;
  onToggleSimulation: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  stats: { objects: number, triangles: number, points: number };
  currentObjects: SceneObject[];
  mode: 'editor' | 'guest';
}

const Toolbar: React.FC<ToolbarProps> = ({ 
  onSave, onLoad, onClear, 
  isSimulating, onToggleSimulation, 
  canUndo, canRedo, onUndo, onRedo,
  stats, currentObjects, mode
}) => {
  const [isFileMenuOpen, setFileMenuOpen] = useState(false);
  const [isStatsOpen, setStatsOpen] = useState(false);
  const [isShareModalOpen, setShareModalOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Click outside listener for menus
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setFileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <>
    <header className="h-14 bg-white/90 backdrop-blur-md border-b border-neutral-200 flex items-center justify-between px-4 shrink-0 z-50 select-none">
      
      {/* Left Group: Logo & File Menu */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 mr-2">
          <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg shadow-sm flex items-center justify-center">
            <span className="text-white font-bold text-lg leading-none">V</span>
          </div>
          <h1 className="text-neutral-800 font-bold text-sm tracking-tight hidden md:block">
            {mode === 'guest' ? 'VoxelVerse Viewer' : 'VoxelVerse Editor'}
          </h1>
        </div>

        {/* Editor Controls */}
        {mode === 'editor' && (
            <>
                <div className="h-6 w-px bg-neutral-200" />
                <div className="relative" ref={menuRef}>
                    <button 
                        onClick={() => setFileMenuOpen(!isFileMenuOpen)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-neutral-600 hover:bg-neutral-100 rounded-md transition-colors"
                    >
                        File <ChevronDown size={14} className="opacity-50" />
                    </button>
                    
                    {isFileMenuOpen && (
                        <div className="absolute top-full left-0 mt-1 w-48 bg-white rounded-xl shadow-xl border border-neutral-100 p-1 flex flex-col z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                            <MenuItem icon={FilePlus} label="New Scene" onClick={() => { onClear(); setFileMenuOpen(false); }} />
                            <MenuItem icon={FolderOpen} label="Open..." onClick={() => { fileInputRef.current?.click(); setFileMenuOpen(false); }} />
                            <MenuItem icon={Save} label="Save JSON" onClick={() => { onSave(); setFileMenuOpen(false); }} />
                        </div>
                    )}
                    <input 
                        type="file" 
                        ref={fileInputRef} 
                        className="hidden" 
                        accept=".json"
                        onChange={(e) => {
                            if (e.target.files?.[0]) onLoad(e.target.files[0]);
                        }} 
                    />
                </div>

                <div className="flex items-center gap-1">
                    <button 
                        onClick={onUndo} 
                        disabled={!canUndo}
                        className="p-1.5 text-neutral-500 hover:text-neutral-800 hover:bg-neutral-100 rounded-md disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                        title="Undo (Ctrl+Z)"
                    >
                        <Undo2 size={16} />
                    </button>
                    <button 
                        onClick={onRedo} 
                        disabled={!canRedo}
                        className="p-1.5 text-neutral-500 hover:text-neutral-800 hover:bg-neutral-100 rounded-md disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                        title="Redo (Ctrl+Shift+Z)"
                    >
                        <Redo2 size={16} />
                    </button>
                </div>
            </>
        )}
      </div>

      {/* Center Group: Simulation Controls */}
      <div className="absolute left-1/2 transform -translate-x-1/2 flex items-center">
        {mode === 'editor' ? (
             <button 
             onClick={onToggleSimulation}
             className={`flex items-center gap-2 pl-3 pr-4 py-1.5 rounded-full text-sm font-semibold transition-all shadow-sm border ${
                 isSimulating 
                 ? 'bg-white text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300' 
                 : 'bg-neutral-900 text-white border-transparent hover:bg-neutral-800'
             }`}
             >
             {isSimulating ? <Square size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}
             {isSimulating ? 'Stop' : 'Play'}
             </button>
        ) : (
            <div className="text-xs font-mono bg-neutral-100 px-3 py-1 rounded text-neutral-500">
                GUEST MODE
            </div>
        )}
      </div>

      {/* Right Group: Stats & Share */}
      <div className="flex items-center gap-3">
         
         {/* Stats Popover */}
         <div className="relative">
            <button 
                onClick={() => setStatsOpen(!isStatsOpen)}
                className={`p-2 rounded-lg transition-colors ${isStatsOpen ? 'bg-neutral-100 text-blue-600' : 'text-neutral-500 hover:bg-neutral-100'}`}
                title="Scene Statistics"
            >
                <BarChart3 size={18} />
            </button>
            {isStatsOpen && (
                <div className="absolute top-full right-0 mt-2 w-56 bg-white/95 backdrop-blur rounded-xl shadow-xl border border-neutral-200 p-4 z-50 text-xs">
                    <h4 className="font-bold text-neutral-800 mb-3 border-b border-neutral-100 pb-2">Scene Statistics</h4>
                    <div className="space-y-2">
                        <StatRow label="Objects" value={stats.objects} />
                        <StatRow label="Triangles" value={stats.triangles.toLocaleString()} />
                        <StatRow label="Vertices" value={stats.points.toLocaleString()} />
                    </div>
                </div>
            )}
         </div>

         {mode === 'editor' && (
            <button 
                onClick={() => setShareModalOpen(true)}
                className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg text-xs font-semibold transition-colors"
            >
                <Share2 size={14} />
                Share
            </button>
         )}
         {mode === 'guest' && (
             <a 
               href={window.location.pathname}
               className="flex items-center gap-2 px-3 py-1.5 bg-neutral-800 text-white hover:bg-neutral-700 rounded-lg text-xs font-semibold transition-colors"
             >
                 Open Editor
             </a>
         )}
      </div>
    </header>
    
    <ShareModal 
      isOpen={isShareModalOpen} 
      onClose={() => setShareModalOpen(false)} 
      objects={currentObjects} 
    />
    </>
  );
};

const MenuItem = ({ icon: Icon, label, onClick }: any) => (
    <button onClick={onClick} className="flex items-center gap-2 px-3 py-2 text-left text-xs font-medium text-neutral-700 hover:bg-neutral-50 hover:text-blue-600 rounded-lg transition-colors">
        <Icon size={14} />
        {label}
    </button>
);

const StatRow = ({ label, value }: any) => (
    <div className="flex justify-between items-center text-neutral-600">
        <span>{label}</span>
        <span className="font-mono font-medium text-neutral-900">{value}</span>
    </div>
);

export default Toolbar;