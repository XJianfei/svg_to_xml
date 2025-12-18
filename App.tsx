
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

const DEFAULT_SVG = `<svg id="图层_2" data-name="图层 2" xmlns="http://www.w3.org/2000/svg"
xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 324 324">
<defs>
<style>
.cls-1{fill:#fff;}.cls-2{fill:url(#未命名的渐变_27);}.cls-3{fill:url(#未命名的渐变_27-2);}.cls-4{fill:url(#未命名的渐变_30);}.cls-5{fill:url(#未命名的渐变_28);}.cls-6{fill:url(#未命名的渐变_23);}.cls-7{fill:url(#未命名的渐变_55);}.cls-8{fill:url(#未命名的渐变_25);}.cls-9{fill:url(#未命名的渐变_26);}.cls-10{fill-opacity:0.82;fill:url(#未命名的渐变_424);}
</style>
<linearGradient id="未命名的渐变_27" x1="158.47" y1="160.07" x2="160.92" y2="160.07"
gradientUnits="userSpaceOnUse">
<stop offset="0" stop-color="#fbe14f" />
<stop offset="1" stop-color="#fb6e48" />
</linearGradient>
<linearGradient id="未命名的渐变_27-2" x1="161.03" y1="160.04" x2="163.49" y2="160.04"
xlink:href="#未命名的渐变_27" />
<linearGradient id="未命名的渐变_30" x1="190.75" y1="217.32" x2="253.14" y2="217.32"
gradientUnits="userSpaceOnUse">
<stop offset="0" stop-color="#ff3c00" />
<stop offset="0.45" stop-color="#ff763b" />
<stop offset="1" stop-color="#feb87e" />
</linearGradient>
<linearGradient id="未命名的渐变_28" x1="70.77" y1="245.36" x2="253.14" y2="245.36"
gradientUnits="userSpaceOnUse">
<stop offset="0.33" stop-color="#ff3c00" />
<stop offset="0.63" stop-color="#ff763b" />
<stop offset="1" stop-color="#feb87e" />
</linearGradient>
<linearGradient id="未命名的渐变_23" x1="190.48" y1="132.35" x2="221.05" y2="106.85"
gradientUnits="userSpaceOnUse">
<stop offset="0" stop-color="#ff3c00" />
<stop offset="0.39" stop-color="#ff7131" stop-opacity="0.96" />
<stop offset="1" stop-color="#ffbf7a" stop-opacity="0.9" />
</linearGradient>
<linearGradient id="未命名的渐变_55" x1="149.17" y1="132.83" x2="186.76" y2="82.71"
xlink:href="#未命名的渐变_23" />
<linearGradient id="未命名的渐变_25" x1="177.73" y1="165.4" x2="234.34" y2="144.81"
xlink:href="#未命名的渐变_23" />
<linearGradient id="未命名的渐变_26" x1="115.97" y1="179.79" x2="196.52" y2="119.52"
gradientUnits="userSpaceOnUse">
<stop offset="0" stop-color="#ff3c00" />
<stop offset="1" stop-color="#ffbf7a" stop-opacity="0.9" />
</linearGradient>
<linearGradient id="未命名的渐变_424" x1="113.96" y1="222.58" x2="114.08" y2="192.92"
gradientUnits="userSpaceOnUse">
<stop offset="0" stop-color="#f2966f" />
<stop offset="0.19" stop-color="#fff5db" />
<stop offset="0.43" stop-color="#ffbd81" />
<stop offset="0.92" stop-color="#f8ddc4" />
<stop offset="0.94" stop-color="#f8dec7" />
</linearGradient>
</defs>
<rect class="cls-1" x="0.21" y="0.23" width="323.77" height="323.77" rx="68.48" />
<path class="cls-2"
d="M158.47,160a8.42,8.42,0,0,0,1.52.14h.93a8.45,8.45,0,0,0-1.75-.18C158.93,160,158.7,160,158.47,160Z" />
<path class="cls-3" d="M161,160a8.62,8.62,0,0,0,1.53.14h.93a9.29,9.29,0,0,0-1.76-.17Z" />
<path class="cls-4"
d="M200.35,210.3h43.19q9.6,0,9.6,7h0q0,7-9.6,7H200.35q-9.6,0-9.6-7h0Q190.75,210.3,200.35,210.3Z" />
<path class="cls-5"
d="M80.37,238.35H243.54q9.6,0,9.6,7h0q0,7-9.6,7H80.37q-9.6,0-9.6-7h0Q70.77,238.36,80.37,238.35Z" />
<path class="cls-6"
d="M213.49,87.28c-3.85,9.44-6.31,15.48-8.24,24.3-.52,2.38-.93,4.64-1.26,6.82,2.26.35,4.78.68,7.51.92a100.33,100.33,0,0,0,23.82-.29c3.31-.45,6.2-1,8.57-1.57A27,27,0,0,0,241,113L216,81.4C215.21,83.15,214.38,85.09,213.49,87.28Z" />
<path class="cls-7"
d="M153.87,94.79a67,67,0,0,0,17.19,12.86A89.49,89.49,0,0,0,193,116.14a99.16,99.16,0,0,1,7.49-21.67,162.82,162.82,0,0,1,10.81-18.4c.07-.1.15-.2.22-.31a28.13,28.13,0,0,0-38.2-3.64l-23.41,18C151,91.61,152.33,93.17,153.87,94.79Z" />
<path class="cls-8"
d="M231.63,132.81A101.82,101.82,0,0,1,202.78,138c0,1,0,2.05.05,3,.19,9.62.39,16.71,3.81,25.34a53.56,53.56,0,0,0,2.76,5.92l26.79-20.66.39-.3a27.24,27.24,0,0,0,10.09-24.88A101.91,101.91,0,0,1,231.63,132.81Z" />
<path class="cls-9"
d="M190.08,137.86a131.57,131.57,0,0,1-34.9-6A116.15,116.15,0,0,1,128,119.18c-3.1-2-5.8-4-8.12-5.86L93.06,134a27.44,27.44,0,0,0-9.9,15.06L71.31,196.33a17.67,17.67,0,0,0-.54,4.34A18.29,18.29,0,0,0,80.85,217l.88.43a18.78,18.78,0,0,0,7.55,1.62l49.44.17a28.14,28.14,0,0,0,6-.64c.47-.1.94-.22,1.4-.34a28,28,0,0,0,9.85-4.85l39-30.08A136.11,136.11,0,0,1,190.08,137.86Z" />
<path class="cls-10"
d="M130,206.48c-3.78-3.67-8.62-7-15.68-7s-12.78,5.48-15.43,7.72c-6.94,5.86-8.32,9.17-14.12,11.34a18.82,18.82,0,0,0,4.54.58l49.44.17a26.93,26.93,0,0,0,4.49-.36C138.76,216.29,135.77,212.12,130,206.48Z" />
</svg>`;

const VectorXmlPreview = ({ xml }: { xml: string }) => {
  const preview = useMemo(() => {
    if (!xml) return null;
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(xml, 'text/xml');
      const vector = doc.getElementsByTagName('vector')[0];
      if (!vector) return null;

      const viewportWidth = vector.getAttribute('android:viewportWidth') || '24';
      const viewportHeight = vector.getAttribute('android:viewportHeight') || '24';
      
      const pathElements = Array.from(doc.getElementsByTagName('path'));
      const defs: React.ReactNode[] = [];
      const paths: React.ReactNode[] = [];

      pathElements.forEach((p, i) => {
        const d = p.getAttribute('android:pathData');
        if (!d) return;

        let fill = p.getAttribute('android:fillColor') || '#000000';
        const stroke = p.getAttribute('android:strokeColor');
        const strokeWidth = p.getAttribute('android:strokeWidth');
        const fillAlpha = p.getAttribute('android:fillAlpha');

        // Handle aapt gradients
        const aaptAttr = p.getElementsByTagName('aapt:attr')[0];
        if (aaptAttr && aaptAttr.getAttribute('name') === 'android:fillColor') {
          const grad = aaptAttr.getElementsByTagName('gradient')[0];
          if (grad) {
            const gradId = `grad_preview_${i}`;
            const type = grad.getAttribute('android:type');
            const stops = Array.from(grad.getElementsByTagName('item')).map((item, j) => (
              <stop key={j} offset={item.getAttribute('android:offset')} stopColor={item.getAttribute('android:color')} />
            ));

            if (type === 'linear') {
              defs.push(
                <linearGradient 
                  key={gradId} id={gradId} 
                  x1={grad.getAttribute('android:startX')} y1={grad.getAttribute('android:startY')} 
                  x2={grad.getAttribute('android:endX')} y2={grad.getAttribute('android:endY')}
                  gradientUnits="userSpaceOnUse"
                >
                  {stops}
                </linearGradient>
              );
            } else {
              defs.push(
                <radialGradient 
                  key={gradId} id={gradId} 
                  cx={grad.getAttribute('android:centerX')} cy={grad.getAttribute('android:centerY')} 
                  r={grad.getAttribute('android:gradientRadius')}
                  gradientUnits="userSpaceOnUse"
                >
                  {stops}
                </radialGradient>
              );
            }
            fill = `url(#${gradId})`;
          }
        }

        paths.push(
          <path 
            key={i} d={d} 
            fill={fill} 
            stroke={stroke || 'none'} 
            strokeWidth={strokeWidth || '0'} 
            fillOpacity={fillAlpha || '1'}
          />
        );
      });

      return (
        <svg 
          viewBox={`0 0 ${viewportWidth} ${viewportHeight}`} 
          width="100%" height="100%" 
          className="max-w-[120px] max-h-[120px] drop-shadow-md"
        >
          <defs>{defs}</defs>
          {paths}
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
