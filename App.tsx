
import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { svgToAndroidXml, getKotlinConverterLogic } from './utils/converter';
import { GoogleGenAI } from '@google/genai';

const CopyIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
);
const CheckIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
);
const AndroidIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v4"/><path d="m16.2 3.8 2 2"/><path d="m7.8 3.8-2 2"/><path d="M12 11v8"/><path d="M6 13a6 6 0 0 1 12 0v5a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2z"/></svg>
);
const KotlinIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 2h20L2 22z"/><path d="M2 12h10L2 22z"/></svg>
);

const DEFAULT_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="95.837" height="30.159" viewBox="0 0 95.837 30.159">
  <g id="erase_horizon" transform="translate(95.837 0) rotate(90)">
    <path id="path1" d="M0,25.849V13.1A13.1,13.1,0,0,1,13.1,0h0A13.1,13.1,0,0,1,26.2,13.1V25.849a13.1,13.1,0,0,1-13.1,13.1h0A13.1,13.1,0,0,1,0,25.849Z" transform="translate(1.961 3.128)" fill="#f69c9b"/>
    <path id="path2" d="M0,68.416V1.175A1.175,1.175,0,0,1,1.175,0h26.2a1.178,1.178,0,0,1,1.175,1.175v67.25A1.176,1.176,0,0,1,27.373,69.6H1.175A1.175,1.175,0,0,1,0,68.425ZM2.35,2.337v64.9H26.186V2.337Z" transform="translate(0.799 25.149)" fill="#333"/>
  </g>
</svg>`;

const App: React.FC = () => {
  const [svgInput, setSvgInput] = useState<string>(DEFAULT_SVG);
  const [xmlOutput, setXmlOutput] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'xml' | 'kmp_logic'>('xml');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    try { setXmlOutput(svgToAndroidXml(svgInput)); } catch (e) {}
  }, [svgInput]);

  const copyToClipboard = async () => {
    const text = activeTab === 'xml' ? xmlOutput : getKotlinConverterLogic();
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans">
      <header className="bg-slate-900 border-b border-slate-800 px-8 h-20 flex items-center justify-between shadow-lg text-white">
        <div className="flex items-center space-x-4">
          <div className="bg-indigo-500 w-10 h-10 flex items-center justify-center rounded-xl font-bold shadow-lg shadow-indigo-500/20">V</div>
          <div>
            <h1 className="text-xl font-black tracking-tight uppercase">VectorFlatten</h1>
            <p className="text-[10px] text-indigo-400 font-bold uppercase tracking-wider">SVG to Vector & KMP Engine</p>
          </div>
        </div>
      </header>

      <main className="flex-1 p-8 grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-[1400px] mx-auto w-full">
        {/* Left: Input */}
        <div className="flex flex-col space-y-4">
          <div className="flex items-center justify-between px-2">
            <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest">SVG Source</h2>
            <div className="text-[10px] bg-slate-200 text-slate-600 px-2 py-0.5 rounded font-bold uppercase tracking-tighter">Real-time</div>
          </div>
          <textarea
            value={svgInput}
            onChange={(e) => setSvgInput(e.target.value)}
            className="flex-1 p-6 bg-white border border-slate-200 rounded-2xl code-font text-[13px] outline-none shadow-sm focus:ring-4 focus:ring-indigo-500/5 transition-all"
            placeholder="Paste your SVG here..."
          />
        </div>

        {/* Right: Output */}
        <div className="flex flex-col space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex space-x-1 p-1 bg-slate-200 rounded-lg shadow-inner">
              <button onClick={() => setActiveTab('xml')} className={`px-4 py-1.5 rounded-md text-[10px] font-bold flex items-center space-x-2 transition-all ${activeTab === 'xml' ? 'bg-white shadow-md text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}>
                <AndroidIcon /><span>VECTOR XML</span>
              </button>
              <button onClick={() => setActiveTab('kmp_logic')} className={`px-4 py-1.5 rounded-md text-[10px] font-bold flex items-center space-x-2 transition-all ${activeTab === 'kmp_logic' ? 'bg-white shadow-md text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}>
                <KotlinIcon /><span>KMP CONVERTER (iOS/AND)</span>
              </button>
            </div>
            <button 
              onClick={copyToClipboard} 
              className={`px-4 py-1.5 rounded-lg text-xs font-bold flex items-center space-x-2 transition-all ${copied ? 'bg-green-600 text-white' : 'bg-slate-900 text-white hover:bg-slate-800 shadow-md active:scale-95'}`}
            >
              {copied ? <CheckIcon /> : <CopyIcon />}<span>{copied ? 'COPIED' : 'COPY'}</span>
            </button>
          </div>
          
          <div className="flex-1 bg-slate-900 rounded-2xl border border-slate-800 shadow-2xl relative overflow-hidden group">
            <div className="absolute top-4 right-4 text-[9px] text-slate-500 font-bold uppercase bg-slate-800 px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">
              {activeTab === 'xml' ? 'Flattened Output' : 'KMP Source Code'}
            </div>
            <pre className="absolute inset-0 p-6 overflow-auto code-font text-[11px] text-slate-300 leading-relaxed scrollbar-thin scrollbar-thumb-slate-700">
              {activeTab === 'xml' ? xmlOutput : getKotlinConverterLogic()}
            </pre>
          </div>
        </div>
      </main>

      <footer className="bg-white border-t border-slate-100 p-4 text-center text-[9px] text-slate-400 font-bold tracking-[0.3em] uppercase">
        Integrated KMP DOM Flattening Engine • Supports iOS & Android via Compose Multiplatform
      </footer>
    </div>
  );
};

export default App;
