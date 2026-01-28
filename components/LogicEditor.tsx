import React, { useRef, useState } from 'react';
import { LogicEvent, LogicAction, LogicActionType } from '../types';
import { Plus, Trash2, Play, Clock, Move, RotateCw, Eye, Palette, Maximize, MousePointer2, GripVertical } from 'lucide-react';

interface LogicEditorProps {
  logicData: LogicEvent[];
  onChange: (newData: LogicEvent[]) => void;
}

// Action Definitions for the UI
const ACTION_DEFS: Record<LogicActionType, { label: string, icon: any, color: string }> = {
  'MOVE': { label: 'Move', icon: Move, color: 'bg-blue-500' },
  'ROTATE': { label: 'Rotate', icon: RotateCw, color: 'bg-purple-500' },
  'SCALE': { label: 'Scale', icon: Maximize, color: 'bg-green-500' },
  'COLOR': { label: 'Set Color', icon: Palette, color: 'bg-pink-500' },
  'WAIT': { label: 'Wait', icon: Clock, color: 'bg-orange-400' },
  'VISIBLE': { label: 'Visibility', icon: Eye, color: 'bg-slate-500' },
};

export const LogicEditor: React.FC<LogicEditorProps> = ({ logicData, onChange }) => {
  const dragItem = useRef<{ eventId: string; index: number } | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  // Guard against missing data
  if (!logicData || !Array.isArray(logicData)) {
    return (
      <div className="flex h-full items-center justify-center text-neutral-400">
        <p>No logic data available for this object.</p>
      </div>
    );
  }

  const addAction = (eventId: string, type: LogicActionType) => {
    const newData = logicData.map(ev => {
      if (ev.id === eventId) {
        const newAction: LogicAction = {
          id: Math.random().toString(36).substr(2, 9),
          type,
          params: getDefaultParams(type)
        };
        return { ...ev, actions: [...ev.actions, newAction] };
      }
      return ev;
    });
    onChange(newData);
  };

  const removeAction = (eventId: string, actionId: string) => {
    const newData = logicData.map(ev => ({
      ...ev,
      actions: ev.id === eventId ? ev.actions.filter(a => a.id !== actionId) : ev.actions
    }));
    onChange(newData);
  };

  const updateActionParam = (eventId: string, actionId: string, param: string, value: any) => {
    const newData = logicData.map(ev => {
      if (ev.id === eventId) {
        return {
          ...ev,
          actions: ev.actions.map(a => a.id === actionId ? { ...a, params: { ...a.params, [param]: value } } : a)
        };
      }
      return ev;
    });
    onChange(newData);
  };

  // Drag and Drop Handlers
  const handleDragStart = (e: React.DragEvent, eventId: string, index: number, actionId: string) => {
    dragItem.current = { eventId, index };
    setDraggingId(actionId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragEnter = (e: React.DragEvent, eventId: string, targetIndex: number) => {
    if (!dragItem.current) return;
    // Only reorder within the same event list
    if (dragItem.current.eventId !== eventId) return;
    // Don't replace itself
    if (dragItem.current.index === targetIndex) return;

    const sourceIndex = dragItem.current.index;
    
    // Perform reorder
    const newData = logicData.map(ev => {
        if (ev.id === eventId) {
            const newActions = [...ev.actions];
            const [movedItem] = newActions.splice(sourceIndex, 1);
            newActions.splice(targetIndex, 0, movedItem);
            return { ...ev, actions: newActions };
        }
        return ev;
    });

    onChange(newData);
    dragItem.current.index = targetIndex;
  };

  const handleDragEnd = () => {
      dragItem.current = null;
      setDraggingId(null);
  };

  return (
    <div className="w-full h-full p-8 overflow-y-auto custom-scrollbar bg-[#F5F5F7]">
      <div className="max-w-3xl mx-auto space-y-8">
        
        <div className="text-center mb-10">
           <h2 className="text-2xl font-bold text-neutral-800 tracking-tight">Logic Flow</h2>
           <p className="text-neutral-500 text-sm mt-1">Define how your object behaves</p>
        </div>

        {logicData.map(event => (
          <div key={event.id} className="relative group">
            {/* Connection Line */}
            <div className="absolute left-8 top-12 bottom-0 w-0.5 bg-neutral-200 -z-10 group-last:hidden" />

            {/* Event Header Card */}
            <div className="flex items-center gap-4 mb-4">
               <div className={`w-16 h-16 rounded-2xl shadow-sm flex items-center justify-center shrink-0 border border-white/50 ${
                 event.type === 'ON_START' ? 'bg-green-100 text-green-600' : 'bg-blue-100 text-blue-600'
               }`}>
                  {event.type === 'ON_START' ? <Play fill="currentColor" size={24} /> : <MousePointer2 size={24} />}
               </div>
               <div>
                  <h3 className="text-lg font-bold text-neutral-800">
                    {event.type === 'ON_START' ? 'When Scene Starts' : 'When Object Clicked'}
                  </h3>
                  <p className="text-xs text-neutral-400 font-medium uppercase tracking-wide">Trigger</p>
               </div>
            </div>

            {/* Actions List */}
            <div className="ml-8 pl-8 space-y-3 pb-8">
               {(!event.actions || event.actions.length === 0) && (
                 <div className="text-neutral-400 text-sm italic py-2">No actions yet</div>
               )}

               {event.actions && event.actions.map((action, index) => (
                 <div
                    key={action.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, event.id, index, action.id)}
                    onDragEnter={(e) => handleDragEnter(e, event.id, index)}
                    onDragOver={(e) => e.preventDefault()} // Necessary to allow dropping/entering
                    onDragEnd={handleDragEnd}
                    className={`transition-all duration-200 ${draggingId === action.id ? 'opacity-40 scale-[0.98]' : 'opacity-100'}`}
                 >
                     <ActionCard 
                        action={action} 
                        onDelete={() => removeAction(event.id, action.id)}
                        onUpdate={(p, v) => updateActionParam(event.id, action.id, p, v)}
                        showHandle={true}
                     />
                 </div>
               ))}

               {/* Add Button */}
               <div className="pt-2">
                 <ActionPicker onSelect={(t) => addAction(event.id, t)} />
               </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// --- Sub Components ---

const ActionCard = ({ action, onDelete, onUpdate, showHandle }: { action: LogicAction, onDelete: () => void, onUpdate: (k: string, v: any) => void, showHandle?: boolean }) => {
  const def = ACTION_DEFS[action.type] || { label: 'Unknown', icon: Move, color: 'bg-gray-400' };
  const Icon = def.icon;
  const params = action.params || {};

  return (
    <div className="bg-white rounded-xl shadow-sm border border-neutral-100 p-1 flex items-center gap-2 pr-4 group transition-all hover:shadow-md hover:border-neutral-200">
      
      {/* Drag Handle */}
      {showHandle && (
          <div className="cursor-grab active:cursor-grabbing text-neutral-300 hover:text-neutral-500 pl-2">
            <GripVertical size={14} />
          </div>
      )}

      {/* Icon */}
      <div className={`w-10 h-10 ${def.color} rounded-lg flex items-center justify-center text-white shrink-0 ml-1`}>
        <Icon size={18} />
      </div>

      {/* Content */}
      <div className="flex-1 flex items-center gap-2 overflow-x-auto custom-scrollbar py-2">
        <span className="font-semibold text-sm text-neutral-700 mr-2 whitespace-nowrap">{def.label}</span>
        
        {/* Dynamic Inputs based on Type */}
        {action.type === 'MOVE' && (
          <>
             <AxisSelector value={params.axis || 'x'} onChange={(v: string) => onUpdate('axis', v)} />
             <span className="text-neutral-400 text-xs">by</span>
             <NumberInput value={params.amount ?? 1} onChange={v => onUpdate('amount', v)} suffix="m" />
          </>
        )}
        {action.type === 'ROTATE' && (
          <>
             <AxisSelector value={params.axis || 'y'} onChange={(v: string) => onUpdate('axis', v)} />
             <span className="text-neutral-400 text-xs">by</span>
             <NumberInput value={params.amount ?? 90} onChange={v => onUpdate('amount', v)} suffix="°" />
          </>
        )}
        {action.type === 'SCALE' && (
          <>
             <span className="text-neutral-400 text-xs">to</span>
             <NumberInput value={params.scale ?? 1.5} onChange={v => onUpdate('scale', v)} suffix="x" />
          </>
        )}
        {action.type === 'COLOR' && (
           <input 
             type="color" 
             value={params.color || '#ff0000'} 
             onChange={e => onUpdate('color', e.target.value)} 
             className="w-8 h-8 rounded border-none bg-transparent cursor-pointer"
           />
        )}
        {action.type === 'WAIT' && (
           <NumberInput value={params.seconds ?? 1} onChange={v => onUpdate('seconds', v)} suffix="s" />
        )}
        {action.type === 'VISIBLE' && (
            <select 
              value={(params.visible ?? false).toString()} 
              onChange={(e) => onUpdate('visible', e.target.value === 'true')}
              className="bg-neutral-100 text-sm rounded-md px-2 py-1 outline-none focus:ring-2 focus:ring-blue-500/20 text-neutral-700"
            >
              <option value="true">Show</option>
              <option value="false">Hide</option>
            </select>
        )}
      </div>

      {/* Delete */}
      <button onClick={onDelete} className="text-neutral-300 hover:text-red-500 transition-colors p-2">
        <Trash2 size={16} />
      </button>
    </div>
  );
};

const ActionPicker = ({ onSelect }: { onSelect: (t: LogicActionType) => void }) => {
  const [isOpen, setIsOpen] = React.useState(false);

  if (!isOpen) {
    return (
      <button 
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 text-blue-600 bg-blue-50 hover:bg-blue-100 px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
      >
        <Plus size={16} /> Add Action
      </button>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-xl border border-neutral-100 p-2 grid grid-cols-3 gap-2 w-full max-w-md animate-in zoom-in-95 duration-200">
      {Object.entries(ACTION_DEFS).map(([type, def]) => (
        <button
          key={type}
          onClick={() => { onSelect(type as LogicActionType); setIsOpen(false); }}
          className="flex flex-col items-center gap-2 p-3 hover:bg-neutral-50 rounded-lg transition-colors group"
        >
          <div className={`w-8 h-8 ${def.color} rounded-md flex items-center justify-center text-white shadow-sm group-hover:scale-110 transition-transform`}>
            <def.icon size={16} />
          </div>
          <span className="text-xs font-medium text-neutral-600">{def.label}</span>
        </button>
      ))}
      <button onClick={() => setIsOpen(false)} className="col-span-3 mt-2 text-xs text-neutral-400 hover:text-neutral-600 py-1">Cancel</button>
    </div>
  );
};

// --- Helper Inputs ---

const AxisSelector = ({ value, onChange }: { value: string, onChange: (val: string) => void }) => {
  return (
    <div className="flex items-center bg-neutral-100 rounded-lg p-1 gap-1 border border-neutral-200/50">
      {['x', 'y', 'z'].map(axis => {
        const isActive = value === axis;
        const activeColors: Record<string, string> = {
            'x': 'text-red-500',
            'y': 'text-green-500',
            'z': 'text-blue-500'
        };
        return (
            <button
              key={axis}
              onClick={() => onChange(axis)}
              className={`
                w-6 h-6 flex items-center justify-center rounded-md text-[10px] font-bold uppercase transition-all
                ${isActive 
                  ? `bg-white shadow-sm ring-1 ring-black/5 ${activeColors[axis]}` 
                  : 'text-neutral-400 hover:text-neutral-600 hover:bg-neutral-200/50'}
              `}
            >
              {axis}
            </button>
        );
      })}
    </div>
  );
};

const NumberInput = ({ value, onChange, suffix }: any) => (
  <div className="relative flex items-center bg-neutral-100 rounded-md group focus-within:ring-2 focus-within:ring-blue-500/20">
    <input 
      type="number" 
      value={value} 
      onChange={e => onChange(parseFloat(e.target.value) || 0)}
      className="w-16 bg-transparent border-none text-sm px-2 py-1 outline-none text-right font-mono text-neutral-800"
    />
    <span className="text-xs text-neutral-400 pr-2 select-none">{suffix}</span>
  </div>
);

const Select = ({ value, onChange, options }: any) => (
  <select 
    value={value} 
    onChange={e => onChange(e.target.value)}
    className="bg-neutral-100 text-sm rounded-md px-2 py-1 outline-none focus:ring-2 focus:ring-blue-500/20 text-neutral-700 uppercase font-bold"
  >
    {options.map((o: string) => <option key={o} value={o}>{o}</option>)}
  </select>
);

const getDefaultParams = (type: LogicActionType) => {
  switch (type) {
    case 'MOVE': return { axis: 'x', amount: 1 };
    case 'ROTATE': return { axis: 'y', amount: 90 };
    case 'SCALE': return { scale: 1.5 };
    case 'COLOR': return { color: '#ff0000' };
    case 'WAIT': return { seconds: 1 };
    case 'VISIBLE': return { visible: false };
    default: return {};
  }
};
