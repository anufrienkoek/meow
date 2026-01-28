import React, { useState, useRef } from 'react';
import { ObjectType, SceneObject } from '../types';
import { Box, Circle, Square, Disc, Triangle, Video, Type, Lightbulb, Upload, ChevronDown, ChevronRight, Layers } from 'lucide-react';

interface LeftPanelProps {
  objects: SceneObject[];
  selectedId: string | null;
  onAddObject: (type: ObjectType, data?: Partial<SceneObject>) => void;
  onSelectObject: (id: string) => void;
  onGoToCode: (id: string) => void;
}

const LeftPanel: React.FC<LeftPanelProps> = ({ 
  objects, 
  selectedId, 
  onAddObject, 
  onSelectObject,
  onGoToCode
}) => {
  const [isPrimitivesOpen, setPrimitivesOpen] = useState(true);
  const [isSystemsOpen, setSystemsOpen] = useState(true);
  const [isHierarchyOpen, setHierarchyOpen] = useState(true);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
        const result = evt.target?.result as string;
        onAddObject(ObjectType.GLTF, { 
            name: file.name.replace('.gltf', '').replace('.glb', ''), 
            modelData: result 
        });
    };
    reader.readAsDataURL(file);
    // Reset
    e.target.value = '';
  };

  return (
    <aside className="h-full bg-white border-r border-neutral-200 flex flex-col shrink-0 z-20 shadow-sm flex-grow-0 overflow-hidden w-full">
      
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        
        {/* --- PRIMITIVES SECTION --- */}
        <CollapsibleSection 
          title="Primitives" 
          isOpen={isPrimitivesOpen} 
          onToggle={() => setPrimitivesOpen(!isPrimitivesOpen)}
        >
            <div className="p-3 grid grid-cols-2 gap-2">
                <LibraryItem name="Cube" icon={Box} onAdd={() => onAddObject(ObjectType.CUBE)} />
                <LibraryItem name="Sphere" icon={Circle} onAdd={() => onAddObject(ObjectType.SPHERE)} />
                <LibraryItem name="Plane" icon={Square} onAdd={() => onAddObject(ObjectType.PLANE)} />
                <LibraryItem name="Torus" icon={Disc} onAdd={() => onAddObject(ObjectType.TORUS)} />
                <LibraryItem name="Cone" icon={Triangle} onAdd={() => onAddObject(ObjectType.CONE)} />
            </div>
        </CollapsibleSection>

        {/* --- SYSTEM OBJECTS SECTION --- */}
        <CollapsibleSection 
          title="System" 
          isOpen={isSystemsOpen} 
          onToggle={() => setSystemsOpen(!isSystemsOpen)}
        >
            <div className="p-3 grid grid-cols-2 gap-2">
                <LibraryItem name="Camera" icon={Video} onAdd={() => onAddObject(ObjectType.CAMERA)} />
                <LibraryItem name="Text" icon={Type} onAdd={() => onAddObject(ObjectType.TEXT)} />
                <LibraryItem name="Light" icon={Lightbulb} onAdd={() => onAddObject(ObjectType.LIGHT)} />
            </div>
        </CollapsibleSection>

         {/* --- UPLOAD SECTION --- */}
         <div className="px-4 py-3 border-b border-neutral-200">
            <button 
                onClick={() => fileInputRef.current?.click()}
                className="w-full flex items-center justify-center gap-2 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-600 rounded-lg text-xs font-bold uppercase transition-colors"
            >
                <Upload size={14} />
                Upload GLTF
            </button>
            <input 
                type="file" 
                ref={fileInputRef} 
                accept=".gltf,.glb"
                className="hidden"
                onChange={handleFileUpload}
            />
         </div>

        {/* --- HIERARCHY SECTION --- */}
        <CollapsibleSection 
          title="Hierarchy" 
          isOpen={isHierarchyOpen} 
          onToggle={() => setHierarchyOpen(!isHierarchyOpen)}
          isLast
        >
             <div className="p-2 space-y-1">
                {objects.length === 0 ? (
                  <div className="text-center py-6 text-neutral-400 text-xs italic">
                    Scene is empty
                  </div>
                ) : (
                  objects.map(obj => (
                    <HierarchyItem 
                      key={obj.id} 
                      object={obj} 
                      isSelected={obj.id === selectedId}
                      onSelect={() => onSelectObject(obj.id)}
                      onCode={(e) => {
                        e.stopPropagation();
                        onGoToCode(obj.id);
                      }}
                    />
                  ))
                )}
            </div>
        </CollapsibleSection>

      </div>
    </aside>
  );
};

// --- Sub Components ---

const CollapsibleSection = ({ title, isOpen, onToggle, children, isLast }: any) => (
    <div className={`flex flex-col ${!isLast ? 'border-b border-neutral-200' : ''}`}>
        <button 
          onClick={onToggle}
          className="flex items-center justify-between px-4 py-3 bg-neutral-50 hover:bg-neutral-100 transition-colors select-none"
        >
          <span className="text-xs font-bold uppercase tracking-wider text-neutral-500">{title}</span>
          <span className="text-neutral-400">
              {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </span>
        </button>
        {isOpen && <div className="bg-white">{children}</div>}
    </div>
);

const LibraryItem = ({ name, icon: Icon, onAdd }: { name: string, icon: any, onAdd: () => void }) => (
  <button 
    onClick={onAdd}
    className="flex flex-col items-center justify-center p-3 bg-white border border-neutral-200 hover:border-blue-400 hover:bg-blue-50 rounded-lg transition-all group"
  >
    <div className="mb-2 text-neutral-400 group-hover:text-blue-500 transition-colors">
       <Icon size={20} strokeWidth={1.5} />
    </div>
    <span className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500 group-hover:text-blue-600">{name}</span>
  </button>
);

const HierarchyItem = ({ object, isSelected, onSelect, onCode }: { object: SceneObject, isSelected: boolean, onSelect: () => void, onCode: (e: React.MouseEvent) => void }) => (
  <div 
    onClick={onSelect}
    className={`group flex items-center justify-between px-3 py-2 rounded-md cursor-pointer transition-all border border-transparent ${
      isSelected 
        ? 'bg-blue-600 text-white shadow-md border-blue-500' 
        : 'hover:bg-neutral-100 text-neutral-700'
    }`}
  >
    <div className="flex items-center gap-2 overflow-hidden">
      <span className={`opacity-70 ${isSelected ? 'text-white' : 'text-neutral-400'}`}>
         {/* Simple icon fallback based on Layers */}
         <Layers size={14} />
      </span>
      <span className="text-xs font-medium truncate select-none">{object.name}</span>
    </div>

    {/* Code Button */}
    <button 
      onClick={onCode}
      title="Open Logic"
      className={`p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity ${
        isSelected ? 'hover:bg-blue-500 text-white' : 'hover:bg-neutral-200 text-neutral-500'
      }`}
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
      </svg>
    </button>
  </div>
);

export default LeftPanel;