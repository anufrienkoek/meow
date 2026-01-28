import React from 'react';
import { Move, RotateCw, Maximize, Magnet, Globe, Box } from 'lucide-react';

export type TransformMode = 'translate' | 'rotate' | 'scale';
export type TransformSpace = 'world' | 'local';

interface ViewportToolbarProps {
  mode: TransformMode;
  setMode: (mode: TransformMode) => void;
  space: TransformSpace;
  setSpace: (space: TransformSpace) => void;
  snap: boolean;
  setSnap: (snap: boolean) => void;
}

const ViewportToolbar: React.FC<ViewportToolbarProps> = ({ 
  mode, setMode, 
  space, setSpace, 
  snap, setSnap 
}) => {
  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur-md shadow-lg border border-neutral-200/60 rounded-full p-1.5 flex items-center gap-1 z-30 select-none animate-in fade-in slide-in-from-top-4 duration-300">
      
      {/* Transform Modes */}
      <div className="flex bg-neutral-100/50 p-1 rounded-full gap-1">
        <ToolButton 
          active={mode === 'translate'} 
          onClick={() => setMode('translate')} 
          icon={Move} 
          label="Move (W)" 
        />
        <ToolButton 
          active={mode === 'rotate'} 
          onClick={() => setMode('rotate')} 
          icon={RotateCw} 
          label="Rotate (E)" 
        />
        <ToolButton 
          active={mode === 'scale'} 
          onClick={() => setMode('scale')} 
          icon={Maximize} 
          label="Scale (R)" 
        />
      </div>

      <div className="w-px h-6 bg-neutral-200 mx-1" />

      {/* Settings */}
      <div className="flex gap-1">
        <ToolButton 
           active={space === 'local'}
           onClick={() => setSpace(space === 'world' ? 'local' : 'world')}
           icon={space === 'world' ? Globe : Box}
           label={space === 'world' ? 'Global Space' : 'Local Space'}
           secondary
        />
        <ToolButton 
           active={snap}
           onClick={() => setSnap(!snap)}
           icon={Magnet}
           label="Snap to Grid"
           secondary
        />
      </div>

    </div>
  );
};

const ToolButton = ({ active, onClick, icon: Icon, label, secondary }: any) => (
  <button
    onClick={onClick}
    title={label}
    className={`
      p-2 rounded-full transition-all duration-200 flex items-center justify-center relative group
      ${active 
        ? (secondary ? 'bg-indigo-100 text-indigo-600 shadow-sm' : 'bg-white text-blue-600 shadow-md ring-1 ring-black/5') 
        : 'text-neutral-500 hover:bg-white hover:text-neutral-700 hover:shadow-sm'}
    `}
  >
    <Icon size={18} strokeWidth={active ? 2.5 : 2} />
    {/* Tooltip */}
    <span className="absolute top-full mt-2 left-1/2 -translate-x-1/2 bg-neutral-800 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
      {label}
    </span>
  </button>
);

export default ViewportToolbar;
