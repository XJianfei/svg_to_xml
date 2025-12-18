
import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { svgToAndroidXml } from './utils/converter';
import { GoogleGenAI } from '@google/genai';

const CopyIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
);
const CheckIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
);
const AiIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-400"><path d="M12 2v8"/><path d="m4.93 4.93 5.66 5.66"/><path d="M2 12h8"/><path d="m4.93 19.07 5.66-5.66"/><path d="M12 22v-8"/><path d="m19.07 19.07-5.66-5.66"/><path d="M22 12h-8"/><path d="m19.07 4.93-5.66 5.66"/></svg>
);

const DEFAULT_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="95.837" height="30.159" viewBox="0 0 95.837 30.159">
  <g id="erase_horizon" transform="translate(95.837 0) rotate(90)">
    <path id="矩形_2264" data-name="矩形 2264" d="M0,25.849V13.1A13.1,13.1,0,0,1,13.1,0h0A13.1,13.1,0,0,1,26.2,13.1V25.849a13.1,13.1,0,0,1-13.1,13.1h0A13.1,13.1,0,0,1,0,25.849Z" transform="translate(1.961 3.128)" fill="#f69c9b"/>
    <path id="矩形_2264_-_轮廓" data-name="矩形 2264 - 轮廓" d="M0,28.2V12.936A12.937,12.937,0,0,1,12.936,0h2.511A12.937,12.937,0,0,1,28.382,12.933V28.2A12.936,12.936,0,0,1,15.447,41.131H12.935A12.933,12.933,0,0,1,0,28.194Zm26.2-15.26A10.775,10.775,0,0,0,15.437,2.175h-2.5A10.771,10.771,0,0,0,2.168,12.942V28.2A10.768,10.768,0,0,0,12.938,38.964h2.511A10.773,10.773,0,0,0,26.2,28.2Z" transform="translate(0.878 2.037)" fill="#333"/>
    <rect id="矩形_2265" data-name="矩形 2265" width="26.198" height="67.366" transform="translate(1.973 26.311)" fill="#fff"/>
    <path id="矩形_2265_-_轮廓" data-name="矩形 2265 - 轮廓" d="M0,68.416V1.175A1.175,1.175,0,0,1,1.175,0h26.2a1.178,1.178,0,0,1,1.175,1.175v67.25A1.176,1.176,0,0,1,27.373,69.6H1.175A1.175,1.175,0,0,1,0,68.425ZM2.35,2.337v64.9H26.186V2.337Z" transform="translate(0.799 25.149)" fill="#333"/>
    <rect id="矩形_2280" data-name="矩形 2280" width="30.159" height="95.837" transform="translate(0 0)" fill="rgba(155,225,255,0)" opacity="0"/>
  </g>
</svg>`;

const VectorXmlPreview: React.FC<{ xml: string }> = ({ xml }) => {
  const renderedPaths = useMemo(() => {
    if (!xml) return null;
    try {
      const parser = new DOMParser();
      const vDoc = parser.parseFromString(xml, 'text/xml');
      const vector = vDoc.querySelector('vector');
      if (!vector) return null;

      const vw = vector.getAttribute('android:viewportWidth') || '24';
      const vh = vector.getAttribute('android:viewportHeight') || '24';
      
      const paths = Array.from(vDoc.querySelectorAll('path')).map((p, i) => {
        const d = p.getAttribute('android:pathData');
        const fill = p.getAttribute('android:fillColor');
        const stroke = p.getAttribute('android:strokeColor');
        const strokeW = p.getAttribute('android:strokeWidth');
        const alpha = p.getAttribute('android:alpha') || '1';
        const fillAlpha = p.getAttribute('android:fillAlpha') || '1';

        return (
          <path
            key={i}
            d={d || ''}
            fill={fill || 'none'}
            fillOpacity={fillAlpha}
            stroke={stroke || 'none'}
            strokeWidth={strokeW || '0'}
            opacity={alpha}
          />
        );
      });

      return (
        <svg viewBox={`0 0 ${vw} ${vh}`} className="w-full h-full drop-shadow-md overflow-visible">
          {paths}
        </svg>
      );
    } catch (e) {
      return <div className="text-red-400 text-xs italic">Render Error</div>;
    }
  }, [xml]);

  return (
    <div className="w-full h-full flex items-center justify-center relative">
      <div className="w-56 h-56 flex items-center justify-center p-4 bg-white/40 border border-white/20 rounded-xl backdrop-blur-md shadow-inner">
        {renderedPaths}
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const [svgInput, setSvgInput] = useState<string>(DEFAULT_SVG);
  const [xmlOutput, setXmlOutput] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isAiLoading, setIsAiLoading] = useState(false);

  const handleConvert = useCallback((input: string) => {
    if (!input.trim()) {
      setXmlOutput('');
      setError(null);
      return;
    }
    try {
      const result = svgToAndroidXml(input);
      setXmlOutput(result);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to convert SVG');
      setXmlOutput('');
    }
  }, []);

  useEffect(() => {
    handleConvert(DEFAULT_SVG);
  }, [handleConvert]);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setSvgInput(val);
    handleConvert(val);
  };

  const copyToClipboard = async () => {
    if (!xmlOutput) return;
    try {
      await navigator.clipboard.writeText(xmlOutput);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy!', err);
    }
  };

  const optimizeWithAi = async () => {
    if (!svgInput) return;
    setIsAiLoading(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: `Optimized this SVG for mobile. Strip unused groups, flatten paths, and clean up namespaces. Keep visual fidelity 100%. Return only SVG code.\n\n${svgInput}`,
      });
      const text = response.text;
      if (!text) throw new Error('AI Error');
      const optimizedSvg = text.replace(/```svg|```xml|```/g, '').trim();
      setSvgInput(optimizedSvg);
      handleConvert(optimizedSvg);
    } catch (err) {
      setError('AI Optimization failed.');
    } finally {
      setIsAiLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans">
      <header className="bg-slate-900 border-b border-slate-800 px-8 h-20 flex items-center justify-between shadow-lg">
        <div className="flex items-center space-x-4">
          <div className="bg-indigo-500 text-white w-10 h-10 flex items-center justify-center rounded-xl shadow-indigo-500/20 shadow-lg">
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5"/><path d="m5 12 7-7 7 7"/></svg>
          </div>
          <div>
            <h1 className="text-xl font-black text-white tracking-tight uppercase">VectorFlatten</h1>
            <p className="text-[10px] text-indigo-400 font-bold tracking-widest uppercase">Android Drawable Engine</p>
          </div>
        </div>
        <button 
          onClick={optimizeWithAi}
          disabled={!svgInput || isAiLoading}
          className={`flex items-center space-x-2 px-6 py-2.5 rounded-xl text-sm font-bold tracking-tight transition-all shadow-md ${
            isAiLoading ? 'bg-slate-800 text-slate-500 cursor-not-allowed' : 'bg-indigo-600 text-white hover:bg-indigo-500 active:scale-95'
          }`}
        >
          <AiIcon />
          <span>{isAiLoading ? 'OPTIMIZING...' : 'AI FLATTEN'}</span>
        </button>
      </header>

      <main className="flex-1 p-8 grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-[1800px] mx-auto w-full overflow-hidden">
        {/* Input Column */}
        <div className="flex flex-col space-y-4 h-full">
          <div className="flex items-center justify-between px-2">
            <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest">SVG Source</h2>
            <div className="w-2 h-2 rounded-full bg-slate-300 animate-pulse"></div>
          </div>
          <textarea
            value={svgInput}
            onChange={handleInputChange}
            className="flex-1 w-full p-6 bg-white border border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none resize-none code-font text-[13px] leading-relaxed transition-all shadow-sm"
            placeholder="Paste SVG code here..."
          />
        </div>

        {/* Preview Column */}
        <div className="flex flex-col space-y-8">
          <div className="flex flex-col space-y-4 flex-1">
            <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest px-2">Original SVG</h2>
            <div className="flex-1 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-center p-10 shadow-sm relative overflow-hidden group">
              <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: 'conic-gradient(#000 25%, transparent 0 50%, #000 0 75%, transparent 0)', backgroundSize: '20px 20px' }}></div>
              <div className="relative z-10 w-full h-full flex items-center justify-center transform group-hover:scale-110 transition-transform duration-500 overflow-visible" dangerouslySetInnerHTML={{ __html: svgInput }} />
            </div>
          </div>

          <div className="flex flex-col space-y-4 flex-1">
            <h2 className="text-xs font-black text-indigo-400 uppercase tracking-widest px-2">Drawable Result</h2>
            <div className="flex-1 bg-slate-50 border border-indigo-100 rounded-2xl flex items-center justify-center p-10 shadow-sm relative overflow-hidden group">
               <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: 'conic-gradient(#000 25%, transparent 0 50%, #000 0 75%, transparent 0)', backgroundSize: '20px 20px' }}></div>
              <div className="relative z-10 w-full h-full flex items-center justify-center transform group-hover:scale-110 transition-transform duration-500">
                <VectorXmlPreview xml={xmlOutput} />
              </div>
            </div>
          </div>
        </div>

        {/* Output Column */}
        <div className="flex flex-col space-y-4 h-full">
          <div className="flex items-center justify-between px-2">
            <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest">Android XML (Flattened)</h2>
            <button
              onClick={copyToClipboard}
              disabled={!xmlOutput}
              className={`flex items-center space-x-2 px-4 py-1.5 rounded-lg text-xs font-black transition-all ${
                copied ? 'bg-green-500 text-white shadow-green-500/20' : 'bg-slate-200 text-slate-700 hover:bg-slate-300 disabled:opacity-30 shadow-sm'
              }`}
            >
              {copied ? <CheckIcon /> : <CopyIcon />}
              <span>{copied ? 'COPIED' : 'COPY XML'}</span>
            </button>
          </div>
          <div className="flex-1 relative rounded-2xl overflow-hidden border border-slate-800 shadow-2xl bg-[#0d1117]">
            <pre className="absolute inset-0 p-6 overflow-auto code-font text-[12px] text-slate-300 leading-relaxed scrollbar-thin scrollbar-thumb-slate-700">
              {xmlOutput || '// Ready for conversion...'}
            </pre>
          </div>
          {error && (
            <div className="p-4 bg-red-500 text-white rounded-xl text-xs font-bold flex items-center space-x-3 shadow-lg animate-bounce">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              <span>{error}</span>
            </div>
          )}
        </div>
      </main>

      <footer className="bg-white border-t border-slate-200 py-4 px-8 text-center text-[9px] text-slate-400 font-bold uppercase tracking-[0.3em]">
        Proprietary Flattening Logic • Zero-Opacity Pruning • ViewBox Offset Correction
      </footer>
    </div>
  );
};

export default App;
