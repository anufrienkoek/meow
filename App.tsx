import React, { useEffect, useRef, useState, useCallback } from 'react';
import Toolbar from './components/Toolbar';
import LeftPanel from './components/Library';
import Inspector from './components/Inspector';
import ViewportToolbar, { TransformMode, TransformSpace } from './components/ViewportToolbar';
import { LogicEditor } from './components/LogicEditor';
import { SceneManager } from './engine/SceneManager';
import { InteractionEngine } from './engine/InteractionEngine';
import { LogicCompiler } from './engine/LogicCompiler';
import { SceneObject, ObjectType, DEFAULT_LOGIC, LogicEvent } from './types';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';

// Simple ID generator
const generateId = () => Math.random().toString(36).substr(2, 9);

type RightPanelTab = 'PROPERTIES' | 'LOGIC';
type AppMode = 'editor' | 'guest';

const App: React.FC = () => {
  // --- STATE ---
  const [appMode, setAppMode] = useState<AppMode>('editor');
  
  // History Stack
  const [past, setPast] = useState<SceneObject[][]>([]);
  const [objects, setObjects] = useState<SceneObject[]>([]); // Present
  const [future, setFuture] = useState<SceneObject[][]>([]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [activeTab, setActiveTab] = useState<RightPanelTab>('PROPERTIES');
  const [sceneStats, setSceneStats] = useState({ objects: 0, triangles: 0, points: 0 });

  // Viewport Tools State
  const [transformMode, setTransformMode] = useState<TransformMode>('translate');
  const [transformSpace, setTransformSpace] = useState<TransformSpace>('world');
  const [isSnapping, setIsSnapping] = useState(false);
  
  // Layout State
  const [isLeftPanelOpen, setIsLeftPanelOpen] = useState(true);

  const mountRef = useRef<HTMLDivElement>(null);
  
  // Refs for Managers
  const sceneManagerRef = useRef<SceneManager | null>(null);
  const interactionEngineRef = useRef<InteractionEngine | null>(null);

  // Refs for State
  const objectsRef = useRef<SceneObject[]>([]);
  const isSimulatingRef = useRef<boolean>(false);
  const selectedIdRef = useRef<string | null>(null);
  const isSnappingRef = useRef(false);
  
  useEffect(() => { objectsRef.current = objects; }, [objects]);
  useEffect(() => { isSimulatingRef.current = isSimulating; }, [isSimulating]);
  useEffect(() => { selectedIdRef.current = selectedId; }, [selectedId]);
  useEffect(() => { isSnappingRef.current = isSnapping; }, [isSnapping]);

  // --- URL LOADING & SHARING ---
  useEffect(() => {
    // Check URL params on mount
    const params = new URLSearchParams(window.location.search);
    const data = params.get('data');
    const mode = params.get('mode');

    if (mode === 'guest') {
        setAppMode('guest');
        setIsLeftPanelOpen(false); // Default close in guest
    }

    if (data) {
        try {
            const json = atob(data);
            const parsed = JSON.parse(json);
            if (Array.isArray(parsed)) {
                setObjects(parsed);
                // We delay scene sync slightly to ensure manager is ready or handle in manager init
            }
        } catch (e) {
            console.error("Failed to parse shared data", e);
        }
    }
  }, []);

  // --- UNDO / REDO SYSTEM ---
  
  const saveToHistory = useCallback(() => {
    setPast(prev => [...prev, objects]);
    setFuture([]); 
  }, [objects]);

  const handleUndo = useCallback(() => {
    if (past.length === 0) return;
    const newPresent = past[past.length - 1];
    const newPast = past.slice(0, past.length - 1);
    setFuture(prev => [objects, ...prev]);
    setObjects(newPresent);
    setPast(newPast);
    sceneManagerRef.current?.syncScene(newPresent);
  }, [past, objects]);

  const handleRedo = useCallback(() => {
    if (future.length === 0) return;
    const newPresent = future[0];
    const newFuture = future.slice(1);
    setPast(prev => [...prev, objects]);
    setObjects(newPresent);
    setFuture(newFuture);
    sceneManagerRef.current?.syncScene(newPresent);
  }, [future, objects]);


  // --- HELPER HANDLERS ---
  const handleObjectChange = (id: string, data: Partial<SceneObject>, recordHistory: boolean = true) => {
    if (recordHistory) saveToHistory();
    setObjects(prev => prev.map(obj => (obj.id === id ? { ...obj, ...data } : obj)));
    sceneManagerRef.current?.updateObject(id, data);
  };

  // --- INITIALIZATION ---
  useEffect(() => {
    if (!mountRef.current) return;

    while (mountRef.current.firstChild) {
      mountRef.current.removeChild(mountRef.current.firstChild);
    }
    
    const sceneManager = new SceneManager(
        mountRef.current, 
        (id) => {
           if (appMode === 'editor') {
             handleSelectObject(id);
           }
        },
        (id, updates) => {
            if (appMode === 'editor') {
                setPast(prev => [...prev, objectsRef.current]);
                setFuture([]);
                setObjects(prev => prev.map(obj => (obj.id === id ? { ...obj, ...updates } : obj)));
            }
        }
    );
    sceneManagerRef.current = sceneManager;

    sceneManager.setTransformMode(transformMode);
    sceneManager.setSpace(transformSpace);
    sceneManager.setSnap(isSnapping);

    interactionEngineRef.current = new InteractionEngine(sceneManager);

    // Initial Scene Sync from State (if loaded from URL)
    if (objectsRef.current.length > 0) {
        sceneManager.syncScene(objectsRef.current);
        
        // Auto-play for guest mode
        const params = new URLSearchParams(window.location.search);
        if (params.get('mode') === 'guest') {
             // Small timeout to let scene init
             setTimeout(() => {
                handleToggleSimulation(true); // Force start
             }, 500);
        }
    }

    updateStats();

    return () => {
      sceneManager.dispose();
      interactionEngineRef.current?.stop();
    };
  }, []); // Run once on mount

  const updateStats = () => {
      if (sceneManagerRef.current) {
          setSceneStats(sceneManagerRef.current.getStatistics());
      }
  };

  useEffect(() => { updateStats(); }, [objects]);

  useEffect(() => { sceneManagerRef.current?.setTransformMode(transformMode); }, [transformMode]);
  useEffect(() => { sceneManagerRef.current?.setSpace(transformSpace); }, [transformSpace]);
  useEffect(() => { sceneManagerRef.current?.setSnap(isSnapping); }, [isSnapping]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        if (appMode === 'guest') return; // Disable hotkeys in guest

        if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA' || document.activeElement?.tagName === 'SELECT' || isSimulatingRef.current) return;

        const key = e.key.toLowerCase();
        const meta = e.metaKey || e.ctrlKey;

        if (meta && key === 'z') {
            e.preventDefault();
            if (e.shiftKey) handleRedo(); else handleUndo();
            return;
        }

        if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key) && selectedIdRef.current) {
            e.preventDefault();
            const step = isSnappingRef.current ? 0.5 : 0.1;
            let xDir = 0, yDir = 0;
            if (key === 'arrowup') yDir = 1;
            if (key === 'arrowdown') yDir = -1;
            if (key === 'arrowleft') xDir = -1;
            if (key === 'arrowright') xDir = 1;
            saveToHistory();
            sceneManagerRef.current?.moveSelectedObjectByArrow(xDir, yDir, step);
            return;
        }

        switch (key) {
            case 'w': setTransformMode('translate'); break;
            case 'e': setTransformMode('rotate'); break;
            case 'r': setTransformMode('scale'); break;
            case 'backspace':
            case 'delete':
                if (selectedIdRef.current) handleDeleteObject(selectedIdRef.current);
                break;
            case '[': setIsLeftPanelOpen(p => !p); break;
        }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo, saveToHistory, appMode]);

  const handleSelectObject = (id: string | null) => {
      if (appMode === 'guest') return;
      if (!id) {
          setSelectedId(null);
          sceneManagerRef.current?.highlightObjectById('');
          return;
      }
      setSelectedId(id);
      sceneManagerRef.current?.highlightObjectById(id);
  };

  const handleTabChange = (tab: RightPanelTab) => setActiveTab(tab);

  const handleAddObject = (type: ObjectType, extraData: Partial<SceneObject> = {}) => {
    saveToHistory();
    const newObj: SceneObject = {
      id: generateId(),
      name: extraData.name || `${type.toLowerCase()}_${objects.length + 1}`,
      type,
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      color: '#007AFF',
      visible: true,
      logicData: JSON.parse(JSON.stringify(DEFAULT_LOGIC)),
      ...extraData
    };
    const newObjects = [...objects, newObj];
    setObjects(newObjects);
    sceneManagerRef.current?.addObject(newObj);
    handleSelectObject(newObj.id);
    setActiveTab('PROPERTIES'); 
  };

  const handleLogicUpdate = (newLogic: LogicEvent[]) => {
      if (!selectedId) return;
      handleObjectChange(selectedId, { logicData: newLogic }, true);
  };

  const handleDeleteObject = (id: string) => {
    saveToHistory();
    setObjects(prev => prev.filter(obj => obj.id !== id));
    sceneManagerRef.current?.removeObject(id);
    if (selectedId === id) setSelectedId(null);
  };

  const handleGoToCode = (id: string) => {
      handleSelectObject(id);
      handleTabChange('LOGIC');
  };

  const handleLoadScene = (json: string) => {
      try {
          const data = JSON.parse(json);
          if (data.objects && Array.isArray(data.objects)) {
              saveToHistory();
              setObjects(data.objects);
              sceneManagerRef.current?.syncScene(data.objects);
          }
      } catch (e) {
          alert('Invalid Scene File');
      }
  };

  // Force specific state if provided, otherwise toggle
  const handleToggleSimulation = async (forceState?: boolean) => {
    const newState = forceState !== undefined ? forceState : !isSimulating;
    
    if (!newState) {
      interactionEngineRef.current?.stop();
      sceneManagerRef.current?.setSimulating(false);
      setIsSimulating(false);
      sceneManagerRef.current?.syncScene(objects);
      if (selectedId && appMode === 'editor') sceneManagerRef.current?.highlightObjectById(selectedId);
    } else {
      setIsSimulating(true);
      sceneManagerRef.current?.setSimulating(true);

      const map = new Map<string, string>();
      for (const obj of objects) {
         if (!obj.logicData) continue;
         const code = LogicCompiler.compile(obj.logicData);
         if (code) map.set(obj.id, code);
      }
      await interactionEngineRef.current?.start(objects, map);
    }
  };

  const selectedObject = objects.find(o => o.id === selectedId) || null;
  const isLogicOpen = selectedObject && activeTab === 'LOGIC';

  return (
    <div className="flex flex-col h-screen w-screen bg-[#F5F5F7] text-neutral-800 overflow-hidden font-sans">
      <Toolbar 
        onSave={() => {
           const json = JSON.stringify({ objects }, null, 2);
           const blob = new Blob([json], {type: 'application/json'});
           const url = URL.createObjectURL(blob);
           const a = document.createElement('a');
           a.href = url;
           a.download = 'voxelverse-scene.json';
           a.click();
        }} 
        onLoad={(file) => {
            const reader = new FileReader();
            reader.onload = (e) => handleLoadScene(e.target?.result as string);
            reader.readAsText(file);
        }}
        onClear={() => { 
            saveToHistory();
            setObjects([]); 
            setSelectedId(null); 
            sceneManagerRef.current?.syncScene([]);
        }}
        isSimulating={isSimulating}
        onToggleSimulation={() => handleToggleSimulation()}
        canUndo={past.length > 0}
        canRedo={future.length > 0}
        onUndo={handleUndo}
        onRedo={handleRedo}
        stats={sceneStats}
        currentObjects={objects}
        mode={appMode}
      />

      {/* Main Layout */}
      <div className="flex flex-1 overflow-hidden relative">
        
        {/* Left Panel - Hidden in Guest Mode */}
        {appMode === 'editor' && (
             <div className={`${isLeftPanelOpen && !isLogicOpen ? 'w-64 opacity-100' : 'w-0 opacity-0 overflow-hidden'} transition-all duration-300 ease-in-out shrink-0 bg-white border-r border-neutral-200 relative`}>
                <LeftPanel 
                        objects={objects} 
                        selectedId={selectedId}
                        onAddObject={handleAddObject} 
                        onSelectObject={handleSelectObject}
                        onGoToCode={handleGoToCode}
                    />
             </div>
        )}

        {/* Center: 3D Scene */}
        <main className="flex-1 relative flex flex-col bg-white min-w-0 shadow-inner z-10 overflow-hidden transition-all duration-300">
          <div className="w-full h-full relative" ref={mountRef} />
          
          {/* Toggle Panel Button (Editor only) */}
          {appMode === 'editor' && (
            <button 
                onClick={() => setIsLeftPanelOpen(!isLeftPanelOpen)}
                className="absolute top-4 left-4 z-20 p-2 bg-white/90 backdrop-blur rounded-lg shadow border border-neutral-200 text-neutral-500 hover:text-neutral-800 transition-colors"
                title={isLeftPanelOpen ? "Collapse Panel ([)" : "Expand Panel ([)"}
            >
                {isLeftPanelOpen ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}
            </button>
          )}
          
          {/* Viewport Tools Overlay (Editor only) */}
          {appMode === 'editor' && !isSimulating && selectedId && (
            <ViewportToolbar 
              mode={transformMode}
              setMode={setTransformMode}
              space={transformSpace}
              setSpace={setTransformSpace}
              snap={isSnapping}
              setSnap={setIsSnapping}
            />
          )}

          {isSimulating && (
            <div className="absolute top-6 left-6 bg-white/90 backdrop-blur text-red-500 px-4 py-2 rounded-full text-xs font-bold shadow-lg pointer-events-none select-none z-10 border border-red-100 flex items-center gap-2">
               <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
               {appMode === 'guest' ? 'INTERACTIVE MODE' : 'LIVE PREVIEW'}
            </div>
          )}
          
          {/* Guest Mode Hints */}
           {appMode === 'guest' && isSimulating && (
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur text-white px-4 py-2 rounded-full text-xs font-mono shadow-lg pointer-events-none select-none z-10">
               WASD to Move &bull; Click to Lock Mouse &bull; ESC to Unlock
            </div>
          )}
        </main>

        {/* Right Panel - Hidden in Guest Mode */}
        {appMode === 'editor' && (
        <div 
          className={`${isLogicOpen ? 'w-[50vw]' : 'w-80'} bg-white border-l border-neutral-200 flex flex-col shrink-0 relative z-20 shadow-xl h-full transition-all duration-300 ease-in-out`}
        >
            {selectedObject ? (
                <div className="flex border-b border-neutral-200 bg-neutral-50/50 shrink-0">
                    <button 
                        onClick={() => handleTabChange('PROPERTIES')}
                        className={`flex-1 py-3 text-xs font-bold uppercase tracking-wide transition-colors ${activeTab === 'PROPERTIES' ? 'text-blue-600 border-b-2 border-blue-600 bg-white' : 'text-neutral-500 hover:text-neutral-700'}`}
                    >
                        Properties
                    </button>
                    <button 
                        onClick={() => handleTabChange('LOGIC')}
                        className={`flex-1 py-3 text-xs font-bold uppercase tracking-wide transition-colors ${activeTab === 'LOGIC' ? 'text-purple-600 border-b-2 border-purple-600 bg-white' : 'text-neutral-500 hover:text-neutral-700'}`}
                    >
                        Logic Flow
                    </button>
                    {isLogicOpen && (
                         <button 
                            onClick={() => setActiveTab('PROPERTIES')}
                            className="px-4 text-neutral-400 hover:text-neutral-600 border-l border-neutral-200"
                            title="Close Logic Editor"
                         >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                         </button>
                    )}
                </div>
            ) : (
                <div className="h-10 bg-neutral-50 border-b border-neutral-200 shrink-0" />
            )}

            <div className="flex-1 relative bg-[#F9F9F9] w-full h-full overflow-hidden">
                {selectedObject && activeTab === 'LOGIC' && (
                    <div className="absolute inset-0 z-20">
                        <LogicEditor 
                           logicData={selectedObject.logicData}
                           onChange={handleLogicUpdate}
                        />
                    </div>
                )}
                {selectedObject && activeTab === 'PROPERTIES' && (
                    <div className="absolute inset-0 bg-white flex flex-col z-10 w-full h-full">
                        <Inspector 
                            object={selectedObject} 
                            onUpdate={handleObjectChange}
                            onDelete={handleDeleteObject}
                        />
                    </div>
                )}
                {!selectedObject && (
                    <div className="absolute inset-0 bg-neutral-50 z-20 flex flex-col items-center justify-center text-neutral-400 p-8 text-center w-full h-full">
                        <div className="w-16 h-16 bg-neutral-200 rounded-full mb-4 flex items-center justify-center text-neutral-400">
                            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
                        </div>
                        <p className="text-sm font-medium">No object selected</p>
                        <p className="text-xs mt-2">Select an object to edit.</p>
                    </div>
                )}
            </div>
        </div>
        )}
      </div>
    </div>
  );
};

export default App;