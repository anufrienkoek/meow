import React, { useState, useEffect } from 'react';
import { X, Copy, Check, Globe, Lock, ChevronDown, User, Shield } from 'lucide-react';
import { SceneObject } from '../types';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  objects: SceneObject[];
}

export const ShareModal: React.FC<ShareModalProps> = ({ isOpen, onClose, objects }) => {
  const [accessLevel, setAccessLevel] = useState<'restricted' | 'public'>('public');
  const [role, setRole] = useState<'guest' | 'editor'>('guest');
  const [generatedLink, setGeneratedLink] = useState('');
  const [isCopied, setIsCopied] = useState(false);
  const [shortId, setShortId] = useState('');

  // Generate unique 8-char ID based on requested format
  const generateShortId = (mode: string) => {
    const date = Date.now().toString(36);
    // Mock IDs for frontend demo
    const userId = Math.random().toString(36).substring(2, 5); 
    const projectId = Math.random().toString(36).substring(2, 5);
    
    const rawString = `${date}-${userId}-${projectId}-${mode}`;
    
    // Simple hash to 8 chars
    let hash = 0;
    for (let i = 0; i < rawString.length; i++) {
      const char = rawString.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    // Convert to hex and slice, ensuring positive
    const short = Math.abs(hash).toString(36).substring(0, 8).padEnd(8, 'x');
    return short;
  };

  useEffect(() => {
    if (isOpen) {
      updateLink();
    }
  }, [isOpen, accessLevel, role, objects]);

  const updateLink = () => {
    if (accessLevel === 'restricted') {
      setGeneratedLink('');
      setShortId('');
      return;
    }

    // 1. Generate Short ID
    const id = generateShortId(role);
    setShortId(id);

    // 2. Encode Data (Serverless requirement)
    // In a real backend app, we would save 'objects' to DB with 'id' and just return the ID URL.
    // Here we must embed data to make it functional.
    const json = JSON.stringify(objects);
    const encoded = btoa(json);

    const url = new URL(window.location.href);
    url.searchParams.set('mode', role);
    url.searchParams.set('ref', id); // The short unique ID
    url.searchParams.set('data', encoded);

    setGeneratedLink(url.toString());
  };

  const handleCopy = () => {
    if (!generatedLink) return;
    navigator.clipboard.writeText(generatedLink);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-neutral-200 font-sans">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-neutral-100 flex items-center justify-between">
          <h2 className="text-lg font-bold text-neutral-800">Share "My Voxel Scene"</h2>
          <button onClick={onClose} className="p-2 hover:bg-neutral-100 rounded-full text-neutral-500 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6">
          
          {/* Link Box */}
          <div className="space-y-2">
             <div className="flex gap-2">
                <input 
                  type="text" 
                  readOnly
                  value={accessLevel === 'restricted' ? 'No link created' : generatedLink}
                  className="flex-1 bg-neutral-100 border-none rounded-lg px-3 py-2 text-sm text-neutral-600 outline-none focus:ring-2 focus:ring-blue-500/20 truncate"
                />
                <button 
                  onClick={handleCopy}
                  disabled={accessLevel === 'restricted'}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isCopied ? <Check size={16} /> : <Copy size={16} />}
                  {isCopied ? 'Copied' : 'Copy'}
                </button>
             </div>
             {shortId && (
                <p className="text-[10px] text-neutral-400 font-mono pl-1">
                   ID: <span className="bg-neutral-100 px-1 rounded text-neutral-600">{shortId}</span> (Hash: Date-User-Proj-Mode)
                </p>
             )}
          </div>

          <div className="h-px bg-neutral-100" />

          {/* General Access */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-neutral-500 uppercase tracking-wider">General Access</h3>
            
            <div className="flex items-start gap-3">
               <div className={`mt-1 p-2 rounded-full ${accessLevel === 'public' ? 'bg-green-100 text-green-600' : 'bg-neutral-100 text-neutral-500'}`}>
                  {accessLevel === 'public' ? <Globe size={20} /> : <Lock size={20} />}
               </div>
               
               <div className="flex-1 space-y-1">
                  <div className="relative inline-block text-left">
                     <select 
                        value={accessLevel}
                        onChange={(e) => setAccessLevel(e.target.value as any)}
                        className="appearance-none bg-transparent font-semibold text-neutral-800 text-sm pr-8 outline-none cursor-pointer hover:text-blue-600"
                     >
                       <option value="restricted">Restricted</option>
                       <option value="public">Anyone with the link</option>
                     </select>
                     <ChevronDown size={14} className="absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none text-neutral-500" />
                  </div>
                  <p className="text-xs text-neutral-500">
                    {accessLevel === 'public' ? 'Anyone on the internet with the link can view' : 'Only people with access can open with the link'}
                  </p>
               </div>

               {/* Role Selector (Only if public) */}
               {accessLevel === 'public' && (
                  <div className="relative">
                     <select 
                        value={role}
                        onChange={(e) => setRole(e.target.value as any)}
                        className="appearance-none bg-white border border-neutral-200 rounded-lg py-1.5 pl-3 pr-8 text-xs font-medium text-neutral-700 outline-none hover:border-neutral-300 cursor-pointer"
                     >
                        <option value="guest">Viewer</option>
                        <option value="editor">Editor</option>
                     </select>
                     <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-neutral-400" />
                  </div>
               )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-neutral-50 border-t border-neutral-100 flex justify-end">
          <button 
            onClick={onClose}
            className="px-6 py-2 bg-blue-600 text-white text-sm font-semibold rounded-full hover:bg-blue-700 transition-colors shadow-sm"
          >
            Done
          </button>
        </div>

      </div>
    </div>
  );
};
