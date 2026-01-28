import React from 'react';
import { SceneObject } from '../types';

interface InspectorProps {
  object: SceneObject | null;
  onUpdate: (id: string, data: Partial<SceneObject>, commitHistory?: boolean) => void;
  onDelete: (id: string) => void;
}

const Inspector: React.FC<InspectorProps> = ({ object, onUpdate, onDelete }) => {
  if (!object) return null;

  const handleChange = (field: keyof SceneObject, value: any, commit: boolean = true) => {
    onUpdate(object.id, { [field]: value }, commit);
  };

  const handleVectorChange = (field: 'position' | 'rotation' | 'scale', axis: 0 | 1 | 2, value: string, commit: boolean) => {
    const numVal = parseFloat(value) || 0;
    const newVector = [...object[field]] as [number, number, number];
    newVector[axis] = numVal;
    handleChange(field, newVector, commit);
  };

  return (
    <div className="flex flex-col h-full bg-white overflow-y-auto custom-scrollbar">
      
      <div className="p-6 space-y-8">
        
        {/* Name */}
        <div className="space-y-2">
          <label className="text-[11px] text-neutral-400 uppercase font-bold tracking-wider">Name</label>
          <input 
            type="text" 
            value={object.name}
            onChange={(e) => handleChange('name', e.target.value, false)}
            onBlur={(e) => handleChange('name', e.target.value, true)}
            className="w-full bg-neutral-100 border border-transparent focus:bg-white focus:border-blue-500 transition-colors text-neutral-800 text-sm rounded-lg px-3 py-2 outline-none font-medium"
          />
        </div>

        {/* Transform Group */}
        <div className="space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-neutral-100">
             <span className="text-[11px] text-neutral-400 uppercase font-bold tracking-wider">Transform</span>
          </div>
          <TransformGroup 
            label="Position" 
            values={object.position} 
            onChange={(ax, v, c) => handleVectorChange('position', ax, v, c)} 
          />
          <TransformGroup 
            label="Rotation" 
            values={object.rotation} 
            onChange={(ax, v, c) => handleVectorChange('rotation', ax, v, c)} 
          />
          <TransformGroup 
            label="Scale" 
            values={object.scale} 
            onChange={(ax, v, c) => handleVectorChange('scale', ax, v, c)} 
          />
        </div>

        {/* Appearance */}
        <div className="space-y-2">
          <label className="text-[11px] text-neutral-400 uppercase font-bold tracking-wider">Appearance</label>
          <div className="flex items-center gap-3 p-3 bg-neutral-50 rounded-xl border border-neutral-100">
            <div className="relative w-10 h-10 rounded-lg overflow-hidden shadow-sm border border-neutral-200">
                <input 
                type="color" 
                value={object.color}
                onChange={(e) => handleChange('color', e.target.value, false)}
                onBlur={(e) => handleChange('color', e.target.value, true)}
                className="absolute -top-2 -left-2 w-16 h-16 cursor-pointer p-0 border-0"
                />
            </div>
            <div className="flex flex-col">
                <span className="text-xs text-neutral-500 font-medium">Color Hex</span>
                <span className="text-neutral-800 text-sm font-mono font-bold uppercase">{object.color}</span>
            </div>
          </div>
        </div>

         {/* Actions */}
         <div className="pt-8 mt-auto">
            <button 
              onClick={() => onDelete(object.id)}
              className="w-full bg-red-50 hover:bg-red-100 text-red-600 text-xs py-3 rounded-lg font-bold transition-colors flex items-center justify-center gap-2 uppercase tracking-wide"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
              Delete Object
            </button>
         </div>

      </div>
    </div>
  );
};

const TransformGroup = ({ label, values, onChange }: { label: string, values: [number, number, number], onChange: (axis: 0|1|2, val: string, commit: boolean) => void }) => (
  <div className="space-y-2">
    <div className="flex justify-between">
      <label className="text-xs text-neutral-500 font-semibold">{label}</label>
    </div>
    <div className="flex gap-2">
      <TransformInput axisLabel="X" color="text-red-500" bgColor="bg-red-50 focus-within:bg-red-100" value={values[0]} onChange={(v, c) => onChange(0, v, c)} />
      <TransformInput axisLabel="Y" color="text-green-500" bgColor="bg-green-50 focus-within:bg-green-100" value={values[1]} onChange={(v, c) => onChange(1, v, c)} />
      <TransformInput axisLabel="Z" color="text-blue-500" bgColor="bg-blue-50 focus-within:bg-blue-100" value={values[2]} onChange={(v, c) => onChange(2, v, c)} />
    </div>
  </div>
);

const TransformInput = ({ axisLabel, color, bgColor, value, onChange }: any) => (
    <div className={`relative flex-1 rounded-lg transition-colors ${bgColor} group border border-transparent focus-within:border-neutral-200`}>
        <div className={`absolute left-2 top-0 bottom-0 flex items-center ${color} font-bold text-[10px] pointer-events-none select-none`}>
            {axisLabel}
        </div>
        <input 
            type="number" 
            step="0.1"
            value={Math.round(value * 100) / 100} // Round for display
            onChange={(e) => onChange(e.target.value, false)}
            onBlur={(e) => onChange(e.target.value, true)} // Commit history on blur
            className="w-full bg-transparent text-neutral-700 text-xs rounded-lg pl-6 pr-2 py-2 outline-none font-mono text-right"
        />
    </div>
);

export default Inspector;