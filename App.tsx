
import React, { useState, useEffect, useMemo } from 'react';
import { svgToAndroidXml, getKotlinConverterLogic } from './utils/converter';

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

const Checkerboard = ({ children, className = "" }: { children: React.ReactNode, className?: string }) => (
  <div className={`relative overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm ${className}`} style={{ 
    backgroundImage: 'linear-gradient(45deg, #f0f0f0 25%, transparent 25%), linear-gradient(-45deg, #f0f0f0 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #f0f0f0 75%), linear-gradient(-45deg, transparent 75%, #f0f0f0 75%)',
    backgroundSize: '20px 20px',
    backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px'
  }}>
    <div className="flex items-center justify-center p-8 min-h-[160px] w-full h-full">
      {children}
    </div>
  </div>
);

const DEFAULT_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="95.837" height="30.159" viewBox="0 0 95.837 30.159">
  <g id="erase_horizon" transform="translate(95.837 0) rotate(90)">
    <path id="path1" d="M0,25.849V13.1A13.1,13.1,0,0,1,13.1,0h0A13.1,13.1,0,0,1,26.2,13.1V25.849a13.1,13.1,0,0,1-13.1,13.1h0A13.1,13.1,0,0,1,0,25.849Z" transform="translate(1.961 3.128)" fill="#f69c9b"/>
    <path id="path2" d="M0,68.416V1.175A1.175,1.175,0,0,1,1.175,0h26.2a1.178,1.178,0,0,1,1.175,1.175v67.25A1.176,1.176,0,0,1,27.373,69.6H1.175A1.175,1.175,0,0,1,0,68.425ZM2.35,2.337v64.9H26.186V2.337Z" transform="translate(0.799 25.149)" fill="#333"/>
  </g>
</svg>`;

const VectorXmlPreview = ({ xml }: { xml: string }) => {
  const preview = useMemo(() => {
    if (!xml) return null;
    try {
      const parser = new DOMParser();
      // Use text/xml to avoid HTML auto-corrections
      const doc = parser.parseFromString(xml, 'text/xml');
      const vector = doc.getElementsByTagName('vector')[0];
      if (!vector) return null;

      const viewportWidth = vector.getAttribute('android:viewportWidth') || '24';
      const viewportHeight = vector.getAttribute('android:viewportHeight') || '24';
      
      const pathElements = Array.from(doc.getElementsByTagName('path'));
      
      return (
        <svg 
          viewBox={`0 0 ${viewportWidth} ${viewportHeight}`} 
          width="100%" 
          height="100%" 
          className="max-w-[120px] max-h-[120px] drop-shadow-md"
        >
          {pathElements.map((p, i) => {
            const d = p.getAttribute('android:pathData');
            const fill = p.getAttribute('android:fillColor');
            const stroke = p.getAttribute('android:strokeColor');
            const strokeWidth = p.getAttribute('android:strokeWidth');
            if (!d) return null;
            return (
              <path 
                key={i} 
                d={d} 
                fill={fill || '#000000'} 
                stroke={stroke || 'none'} 
                strokeWidth={strokeWidth || '0'} 
              />
            );
          })}
        </svg>
      );
    } catch (e) {
      console.error('Preview error:', e);
      return <div className="text-red-500 text-[10px] font-bold">PREVIEW FAILED</div>;
    }
  }, [xml]);

  return preview || <div className="text-slate-300 text-[10px] font-bold tracking-widest uppercase">No Vector Data</div>;
};

const App: React.FC = () => {
  const [svgInput, setSvgInput] = useState<string>(DEFAULT_SVG);
  const [xmlOutput, setXmlOutput] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'xml' | 'kmp_logic'>('xml');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    try { 
      const converted = svgToAndroidXml(svgInput);
      setXmlOutput(converted);
    } catch (e) {
      console.error('Conversion failed', e);
    }
  }, [svgInput]);

  const copyToClipboard = async () => {
    const text = activeTab === 'xml' ? xmlOutput : getKotlinConverterLogic();
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <header className="bg-slate-900 px-8 h-16 flex items-center justify-between shadow-lg text-white z-10">
        <div className="flex items-center space-x-3">
          <div className="bg-indigo-500 w-8 h-8 flex items-center justify-center rounded-lg font-bold shadow-lg">V</div>
          <h1 className="text-lg font-black tracking-tight uppercase">VectorFlatten</h1>
        </div>
        <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest hidden sm:block">
          SVG to Android Drawable & KMP Engine
        </div>
      </header>

      <main className="flex-1 p-6 grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-[1600px] mx-auto w-full overflow-hidden">
        {/* Input Column */}
        <div className="flex flex-col space-y-4 overflow-hidden">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest">SVG Source</h2>
            <div className="text-[10px] bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded font-bold">PREVIEW</div>
          </div>
          
          <div className="h-48">
            <Checkerboard>
              <div 
                className="w-full h-full flex items-center justify-center transition-transform hover:scale-110 duration-300"
                dangerouslySetInnerHTML={{ __html: svgInput }} 
              />
            </Checkerboard>
          </div>

          <div className="flex-1 relative bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm flex flex-col min-h-[300px]">
            <textarea
              value={svgInput}
              onChange={(e) => setSvgInput(e.target.value)}
              className="w-full h-full p-6 code-font text-[13px] outline-none resize-none scrollbar-thin scrollbar-thumb-slate-200"
              placeholder="Paste SVG code here..."
              spellCheck={false}
            />
          </div>
        </div>

        {/* Output Column */}
        <div className="flex flex-col space-y-4 overflow-hidden">
          <div className="flex items-center justify-between">
            <div className="flex space-x-1 p-1 bg-slate-200 rounded-lg">
              <button 
                onClick={() => setActiveTab('xml')} 
                className={`px-4 py-1.5 rounded-md text-[10px] font-bold flex items-center space-x-2 transition-all ${activeTab === 'xml' ? 'bg-white shadow text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
              >
                <AndroidIcon /><span>VECTOR XML</span>
              </button>
              <button 
                onClick={() => setActiveTab('kmp_logic')} 
                className={`px-4 py-1.5 rounded-md text-[10px] font-bold flex items-center space-x-2 transition-all ${activeTab === 'kmp_logic' ? 'bg-white shadow text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
              >
                <KotlinIcon /><span>KMP SOURCE</span>
              </button>
            </div>
            <button 
              onClick={copyToClipboard} 
              className={`px-4 py-1.5 rounded-lg text-xs font-bold flex items-center space-x-2 transition-all ${copied ? 'bg-green-600 text-white' : 'bg-slate-900 text-white hover:bg-slate-800 shadow-lg active:scale-95'}`}
            >
              {copied ? <CheckIcon /> : <CopyIcon />}
              <span>{copied ? 'COPIED' : 'COPY'}</span>
            </button>
          </div>

          <div className="flex flex-col space-y-4 flex-1 overflow-hidden">
            {activeTab === 'xml' && (
              <div className="h-48">
                <Checkerboard className="border-indigo-100 ring-2 ring-indigo-500/5">
                   <VectorXmlPreview xml={xmlOutput} />
                </Checkerboard>
              </div>
            )}

            <div className="flex-1 bg-slate-900 rounded-xl border border-slate-800 shadow-xl relative overflow-hidden min-h-[300px]">
              <div className="absolute top-4 right-4 text-[9px] text-slate-500 font-bold uppercase z-20">
                {activeTab === 'xml' ? 'Flattened Output' : 'KMP Engine Logic'}
              </div>
              <div className="w-full h-full p-6 overflow-auto code-font text-[11px] text-slate-300 scrollbar-thin scrollbar-thumb-slate-700">
                <pre className="whitespace-pre-wrap break-all">
                  {activeTab === 'xml' ? (xmlOutput || 'Processing...') : getKotlinConverterLogic()}
                </pre>
              </div>
            </div>
          </div>
        </div>
      </main>

      <footer className="bg-white border-t border-slate-200 p-3 text-center text-[9px] text-slate-400 font-bold tracking-widest uppercase">
        Real-time Path Flattening & Vector Drawable Generation
      </footer>
    </div>
  );
};

export default App;
