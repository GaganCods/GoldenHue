import logo from '/3d-fav.png';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Palette } from './components/Palette';
import { 
  HarmonyMode, 
  PaletteSize, 
  Settings, 
  ColorData,
  ColorBlindnessMode 
} from './types';
import { generatePalette, uuid, hslToHex, hexToHsl, isValidHex } from './utils/colorUtils';
import { extractColorsFromImage, generatePaletteFromText } from './services/geminiService';
import { generatePaletteImage, downloadImage } from './utils/imageExport';
import { 
  Wand2, 
  Image as ImageIcon,
  Menu,
  X,
  RefreshCw,
  Shuffle,
  Pipette,
  ArrowRightLeft,
  Download,
  CheckCircle2,
  Share2,
  Eye
} from 'lucide-react';

const DEFAULTS: Settings = {
  harmony: HarmonyMode.GOLDEN_RATIO,
  size: 5,
  baseColor: '#3B82F6'
};

// Official Brand Icon
const GoldenHueLogo = ({ className = "w-8 h-8" }: { className?: string }) => (
  <img 
    src={logo}
    alt="GoldenHue Logo"
    className={`object-contain select-none ${className}`} 
  />
);


// Reusable Brand Header Component
const BrandHeader = ({ className = "" }: { className?: string }) => (
  <div className={`flex items-center gap-3.5 ${className}`}>
    <GoldenHueLogo className="w-10 h-10 md:w-11 md:h-11 shrink-0" />
    <div className="flex flex-col justify-center">
      <span className="font-bold text-slate-900 text-lg md:text-xl leading-none tracking-tight">
        GoldenHue
      </span>
      <span className="text-xs md:text-sm text-slate-500 font-medium leading-none mt-1.5 tracking-wide">
        Perfect Color Harmony
      </span>
    </div>
  </div>
);

const App: React.FC = () => {
  // State
  const [colors, setColors] = useState<ColorData[]>([]);
  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showA11y, setShowA11y] = useState(false);
  const [cbMode, setCbMode] = useState<ColorBlindnessMode>(ColorBlindnessMode.NONE);
  const [loading, setLoading] = useState(false);
  
  // Input State for Hex Editing
  const [hexInput, setHexInput] = useState(DEFAULTS.baseColor.replace('#', ''));
  
  // Modals
  const [showExport, setShowExport] = useState(false);
  const [showAI, setShowAI] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');

  // Export State
  const [exportScale, setExportScale] = useState(2);
  const [exportTransparent, setExportTransparent] = useState(false);
  const [isExportingImg, setIsExportingImg] = useState(false);
  const [imgExportSuccess, setImgExportSuccess] = useState(false);

  // Initialization
  useEffect(() => {
    regenerate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run once on mount

  // Sync hex input when settings change externally
  useEffect(() => {
    setHexInput(settings.baseColor.replace('#', ''));
  }, [settings.baseColor]);

  const regenerate = useCallback((newSettings?: Partial<Settings>, keepLocks = true) => {
    const nextSettings = { ...settings, ...newSettings };
    setSettings(nextSettings);
    
    setColors(prev => {
      const prevColors = keepLocks ? prev : [];
      const newPalette = generatePalette(
        nextSettings.baseColor,
        nextSettings.harmony,
        nextSettings.size,
        prevColors
      );
      return newPalette;
    });
  }, [settings]);

  // Derived state for sliders
  const hsl = useMemo(() => hexToHsl(settings.baseColor), [settings.baseColor]);

  // Handlers
  const handleLock = (id: string) => {
    setColors(prev => prev.map(c => c.id === id ? { ...c, locked: !c.locked } : c));
  };

  const handleColorUpdate = (id: string, hex: string) => {
    setColors(prev => prev.map(c => c.id === id ? { ...c, hex: hex.toUpperCase() } : c));
  };

  const handleMove = (from: number, to: number) => {
    const copy = [...colors];
    const [removed] = copy.splice(from, 1);
    copy.splice(to, 0, removed);
    setColors(copy);
  };

  const handleShuffle = () => {
    const h = Math.random() * 360;
    const s = 0.5 + Math.random() * 0.4;
    const l = 0.4 + Math.random() * 0.4;
    const randomHex = hslToHex(h, s, l);
    // Preserve locks by passing true
    regenerate({ baseColor: randomHex }, true);
  };

  const handleBaseColorChange = (hex: string) => {
    if (isValidHex(hex)) {
        regenerate({ baseColor: hex.toUpperCase() });
    }
  };

  // Manual Hex Input Handlers
  const handleHexInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.toUpperCase();
    if (/^[0-9A-F]*$/.test(val) && val.length <= 6) {
        setHexInput(val);
        // Only trigger update if full 6 characters to prevent jumping/expanding of 3-char hexes while typing
        if (val.length === 6) {
             regenerate({ baseColor: '#' + val });
        }
    }
  };

  const handleHexInputBlur = () => {
    const fullHex = '#' + hexInput;
    if (isValidHex(fullHex)) {
        regenerate({ baseColor: fullHex });
    } else {
        // Revert to valid if invalid on blur
        setHexInput(settings.baseColor.replace('#', ''));
    }
  };

  const handleHslChange = (channel: 'h' | 's' | 'l', value: number) => {
      let { h, s, l } = hsl;
      if (channel === 'h') h = value;
      if (channel === 's') s = value / 100;
      if (channel === 'l') l = value / 100;
      const hex = hslToHex(h, s, l);
      regenerate({ baseColor: hex.toUpperCase() });
  };

  const handleInvertBase = () => {
      const { h, s, l } = hsl;
      const newHex = hslToHex((h + 180) % 360, s, l);
      regenerate({ baseColor: newHex.toUpperCase() });
  };

  const handleAI = async () => {
    setLoading(true);
    const hexes = await generatePaletteFromText(aiPrompt);
    setLoading(false);
    setShowAI(false);
    if (hexes.length > 0) {
        const newColors: ColorData[] = hexes.map(hex => ({
            id: uuid(),
            hex: hex.toUpperCase(),
            name: hex,
            locked: false
        }));
        setColors(newColors);
        setSettings(s => ({ ...s, size: newColors.length as PaletteSize, baseColor: newColors[0].hex }));
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    const reader = new FileReader();
    reader.onloadend = async () => {
        const base64 = reader.result as string;
        const hexes = await extractColorsFromImage(base64);
        setLoading(false);
        if (hexes.length > 0) {
            const newColors: ColorData[] = hexes.map(hex => ({
                id: uuid(),
                hex: hex.toUpperCase(),
                name: hex,
                locked: false
            }));
            setColors(newColors);
            setSettings(s => ({ ...s, size: newColors.length as PaletteSize, baseColor: newColors[0].hex }));
        }
    };
    reader.readAsDataURL(file);
  };

  const handleDownloadPNG = () => {
    setIsExportingImg(true);
    // Slight delay to allow UI to update
    setTimeout(() => {
        const dataUrl = generatePaletteImage(colors, exportScale, exportTransparent);
        downloadImage(dataUrl, `golden-hue-palette-${Date.now()}.png`);
        setIsExportingImg(false);
        setImgExportSuccess(true);
        setTimeout(() => setImgExportSuccess(false), 2000);
    }, 100);
  };

  const exportCSS = () => {
     return `:root {\n${colors.map((c, i) => `  --color-${i + 1}: ${c.hex};`).join('\n')}\n}`;
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-gray-50 text-slate-900 overflow-hidden relative transition-colors duration-500 font-sans">
      
      {/* Mobile Navbar */}
      <div className="md:hidden flex items-center justify-between p-4 bg-white border-b border-gray-100 z-50 shadow-sm">
        <BrandHeader />
        <button onClick={() => setSidebarOpen(true)} className="p-2 text-slate-600 hover:bg-gray-100 rounded-lg transition-colors"><Menu className="w-6 h-6" /></button>
      </div>

      {/* Sidebar Controls */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-80 bg-white border-r border-gray-100 shadow-2xl transform transition-transform duration-300 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:relative md:translate-x-0 md:shadow-none flex flex-col
      `}>
        {/* Sidebar Header */}
        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-white">
          <BrandHeader />
          <button onClick={() => setSidebarOpen(false)} className="md:hidden p-2 text-gray-400 hover:text-slate-600 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-8 pb-24 md:pb-6">
            
            {/* Harmony Mode */}
            <div className="space-y-3">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Harmony</label>
                <div className="grid grid-cols-1 gap-2">
                    {Object.values(HarmonyMode).map(mode => (
                        <button
                            key={mode}
                            onClick={() => regenerate({ harmony: mode })}
                            className={`px-4 py-3 rounded-xl text-left text-sm font-medium transition-all ${settings.harmony === mode ? 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200 shadow-sm' : 'hover:bg-gray-50 text-slate-600'}`}
                        >
                            {mode}
                        </button>
                    ))}
                </div>
            </div>

            {/* AI Tools */}
            <div className="space-y-3">
                 <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">AI Magic</label>
                 <button 
                    onClick={() => setShowAI(true)}
                    className="w-full flex items-center gap-3 p-3 rounded-xl border border-dashed border-purple-300 bg-purple-50 hover:bg-purple-100 text-purple-700 transition"
                 >
                    <Wand2 className="w-5 h-5" />
                    <span className="text-sm font-medium">Generate from Description</span>
                 </button>
                 <label className="w-full flex items-center gap-3 p-3 rounded-xl border border-dashed border-gray-300 hover:bg-gray-50 cursor-pointer transition text-slate-600">
                    <ImageIcon className="w-5 h-5" />
                    <span className="text-sm font-medium">Extract from Image</span>
                    <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
                 </label>
            </div>

            {/* Size Slider */}
            <div className="space-y-3">
                <div className="flex justify-between">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Count</label>
                    <span className="text-xs font-mono bg-gray-100 px-2 py-1 rounded">{colors.length}</span>
                </div>
                <input 
                    type="range" min="3" max="9" step="1" 
                    value={settings.size} 
                    onChange={(e) => regenerate({ size: Number(e.target.value) as PaletteSize })}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                />
            </div>

            {/* View Options */}
            <div className="space-y-3">
                 <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Accessibility</label>
                 <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-600">Contrast Scores</span>
                    <button 
                        onClick={() => setShowA11y(!showA11y)}
                        className={`w-12 h-6 rounded-full transition-colors relative ${showA11y ? 'bg-indigo-600' : 'bg-gray-200'}`}
                    >
                        <span className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${showA11y ? 'translate-x-6' : ''}`} />
                    </button>
                 </div>
                 
                 <select 
                    value={cbMode}
                    onChange={(e) => setCbMode(e.target.value as ColorBlindnessMode)}
                    className="w-full mt-2 p-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500"
                 >
                    {Object.values(ColorBlindnessMode).map(m => (
                        <option key={m} value={m}>{m} Simulator</option>
                    ))}
                 </select>
            </div>

            <button onClick={() => setShowExport(true)} className="w-full py-3 bg-slate-900 text-white rounded-xl font-medium hover:bg-slate-800 transition shadow-xl flex items-center justify-center gap-2">
                <Download className="w-5 h-5" /> Export Palette
            </button>
        </div>
      </aside>

      {/* Main Canvas */}
      <main className="flex-1 relative flex flex-col h-[calc(100vh-80px)] md:h-screen p-4 md:p-8 overflow-y-auto overflow-x-hidden bg-gray-50/50 pb-24 md:pb-8">
        
        {/* Main Picker Section */}
        <div className="max-w-6xl mx-auto w-full mb-8 transition-all duration-500 ease-in-out shrink-0">
            <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 p-6 md:p-8 flex flex-col md:flex-row gap-8 items-center border border-slate-100">
                
                {/* Input Group */}
                <div className="flex items-center gap-6 w-full md:w-auto">
                    {/* Color Trigger */}
                    <div className="relative w-24 h-24 rounded-2xl shadow-lg ring-4 ring-white overflow-hidden flex-shrink-0 cursor-pointer group transition-transform active:scale-95">
                        <input 
                            type="color" 
                            value={settings.baseColor}
                            onChange={(e) => handleBaseColorChange(e.target.value)}
                            className="absolute inset-0 w-[150%] h-[150%] -translate-x-1/4 -translate-y-1/4 cursor-pointer opacity-0"
                        />
                        <div style={{ background: settings.baseColor }} className="absolute inset-0 transition-colors duration-200" />
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/10 transition-opacity pointer-events-none">
                            <Pipette className="w-8 h-8 text-white drop-shadow-md" />
                        </div>
                    </div>

                    {/* Hex Input */}
                    <div className="flex flex-col gap-1">
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Base Color</label>
                        <div className="relative group">
                            <span className="absolute left-0 top-1/2 -translate-y-1/2 text-gray-300 font-mono text-xl select-none">#</span>
                            <input 
                                className="w-32 bg-transparent text-slate-800 font-mono font-bold text-3xl p-0 pl-6 focus:outline-none uppercase placeholder-gray-200"
                                value={hexInput}
                                onChange={handleHexInputChange}
                                onBlur={handleHexInputBlur}
                                maxLength={6}
                                placeholder="000000"
                            />
                        </div>
                    </div>
                </div>

                {/* Sliders - Flex grow */}
                <div className="w-full md:flex-1 space-y-4 px-2">
                    {/* Hue */}
                    <div className="flex items-center gap-3">
                        <span className="text-xs font-bold text-gray-400 w-4">H</span>
                        <div className="h-3 rounded-full w-full relative group">
                            <input 
                                type="range" min="0" max="360" value={hsl.h || 0}
                                onChange={(e) => handleHslChange('h', Number(e.target.value))}
                                className="absolute inset-0 w-full h-full opacity-0 z-20 cursor-pointer" 
                            />
                            <div className="absolute inset-0 rounded-full h-full shadow-inner" style={{ background: 'linear-gradient(to right, #f00 0%, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00 100%)' }} />
                            <div 
                                className="absolute top-1/2 -translate-y-1/2 w-5 h-5 bg-white border-2 border-gray-100 shadow-md rounded-full pointer-events-none transform -translate-x-1/2 z-10 transition-transform group-active:scale-125" 
                                style={{ left: `${((hsl.h || 0)/360)*100}%` }} 
                            />
                        </div>
                    </div>
                    {/* Saturation */}
                    <div className="flex items-center gap-3">
                        <span className="text-xs font-bold text-gray-400 w-4">S</span>
                        <div className="h-3 rounded-full w-full relative group">
                            <input 
                                type="range" min="0" max="100" value={(hsl.s * 100) || 0}
                                onChange={(e) => handleHslChange('s', Number(e.target.value))}
                                className="absolute inset-0 w-full h-full opacity-0 z-20 cursor-pointer" 
                            />
                            <div className="absolute inset-0 rounded-full h-full shadow-inner border border-gray-100" style={{ background: `linear-gradient(to right, #808080, ${hslToHex(hsl.h || 0, 1, 0.5)})` }} />
                            <div 
                                className="absolute top-1/2 -translate-y-1/2 w-5 h-5 bg-white border-2 border-gray-100 shadow-md rounded-full pointer-events-none transform -translate-x-1/2 z-10 transition-transform group-active:scale-125" 
                                style={{ left: `${(hsl.s * 100)}%` }} 
                            />
                        </div>
                    </div>
                    {/* Lightness */}
                    <div className="flex items-center gap-3">
                        <span className="text-xs font-bold text-gray-400 w-4">L</span>
                        <div className="h-3 rounded-full w-full relative group">
                            <input 
                                type="range" min="0" max="100" value={(hsl.l * 100) || 0}
                                onChange={(e) => handleHslChange('l', Number(e.target.value))}
                                className="absolute inset-0 w-full h-full opacity-0 z-20 cursor-pointer" 
                            />
                            <div className="absolute inset-0 rounded-full h-full shadow-inner border border-gray-100" style={{ background: `linear-gradient(to right, #000, ${hslToHex(hsl.h || 0, hsl.s, 0.5)}, #fff)` }} />
                            <div 
                                className="absolute top-1/2 -translate-y-1/2 w-5 h-5 bg-white border-2 border-gray-100 shadow-md rounded-full pointer-events-none transform -translate-x-1/2 z-10 transition-transform group-active:scale-125" 
                                style={{ left: `${(hsl.l * 100)}%` }} 
                            />
                        </div>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex md:flex-col gap-2 w-full md:w-auto">
                    <button 
                        onClick={handleInvertBase} 
                        className="flex-1 md:flex-none p-3 hover:bg-gray-50 rounded-xl transition text-slate-500 hover:text-indigo-600 flex items-center justify-center gap-2 border border-transparent hover:border-gray-200" 
                        title="Complementary Swap"
                    >
                        <ArrowRightLeft className="w-5 h-5" />
                        <span className="md:hidden text-sm font-medium">Swap</span>
                    </button>
                    <button 
                        onClick={handleShuffle} 
                        className="flex-1 md:flex-none p-3 hover:bg-gray-50 rounded-xl transition text-slate-500 hover:text-indigo-600 flex items-center justify-center gap-2 border border-transparent hover:border-gray-200" 
                        title="Shuffle"
                    >
                        <Shuffle className="w-5 h-5" />
                        <span className="md:hidden text-sm font-medium">Shuffle</span>
                    </button>
                     <button 
                        onClick={() => regenerate({ baseColor: DEFAULTS.baseColor }, false)}
                        className="flex-1 md:flex-none p-3 hover:bg-gray-50 rounded-xl transition text-slate-500 hover:text-indigo-600 flex items-center justify-center gap-2 border border-transparent hover:border-gray-200"
                        title="Reset"
                    >
                        <RefreshCw className="w-5 h-5" />
                        <span className="md:hidden text-sm font-medium">Reset</span>
                    </button>
                </div>
            </div>
        </div>

        {/* Desktop Brand Header / Navbar (Top of Main) */}
        <div className="hidden md:flex justify-between items-center mb-6 max-w-6xl mx-auto w-full shrink-0">
            <BrandHeader />
        </div>

        {/* Palette Display */}
        {/* Added shrink-0 and removed justified-center constraints to prevent layout squashing */}
        <div className="w-full max-w-6xl mx-auto flex-1 flex flex-col min-h-min shrink-0 mb-8">
             {loading ? (
                 <div className="w-full h-96 flex items-center justify-center animate-pulse">
                     <div className="flex flex-col items-center gap-4">
                        <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
                        <p className="text-slate-400 font-medium">Generating Harmony...</p>
                     </div>
                 </div>
             ) : (
                <Palette 
                    colors={colors}
                    onLockToggle={handleLock}
                    onUpdateColor={handleColorUpdate}
                    onMove={handleMove}
                    onSetPrimary={(hex) => handleBaseColorChange(hex)}
                    colorBlindnessMode={cbMode}
                    showAccessibility={showA11y}
                />
             )}
        </div>

        {/* Preview Section Container */}
        {/* Wrapped in a separate container div to ensure spacing and prevent overlap */}
        {!loading && (
             <section className="mt-auto hidden md:block max-w-6xl mx-auto w-full pb-8">
                 <div className="flex items-center gap-2 mb-4 text-slate-400 text-sm font-bold uppercase tracking-wider px-2">
                    <Eye className="w-4 h-4" />
                    <span>Quick Preview</span>
                 </div>
                 
                 <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* UI Preview Card */}
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-6 overflow-hidden">
                        <div className="w-14 h-14 rounded-full flex items-center justify-center text-white font-bold shadow-md ring-2 ring-white shrink-0" style={{ backgroundColor: colors[0]?.hex }}>AB</div>
                        <div className="min-w-0 flex-1">
                            <h4 className="font-bold text-slate-800 text-lg truncate">Heading Text</h4>
                            <p className="text-slate-500 truncate">Body text appears like this.</p>
                        </div>
                        <button className="ml-auto px-6 py-2.5 rounded-lg text-sm font-bold text-white shadow-lg transition-transform hover:scale-105 active:scale-95 shrink-0" style={{ backgroundColor: colors[1]?.hex || '#000' }}>
                            Button
                        </button>
                    </div>

                    {/* Gradient Preview Card */}
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-center h-28 relative overflow-hidden group">
                        <div className="absolute inset-0" style={{ background: `linear-gradient(to right, ${colors[0]?.hex}, ${colors[1]?.hex}, ${colors[2]?.hex || colors[1]?.hex})` }}></div>
                        <span className="text-white font-medium mix-blend-overlay z-10 text-lg">Gradient Preview</span>
                    </div>
                 </div>
             </section>
        )}

      </main>

      {/* Mobile Sticky Toolbar */}
      <div className="md:hidden fixed bottom-0 inset-x-0 bg-white border-t border-gray-200 px-6 py-4 flex justify-between items-center z-40 pb-safe shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
           <button 
             onClick={() => setShowExport(true)} 
             className="flex flex-col items-center gap-1 text-slate-500 hover:text-indigo-600 active:text-indigo-600 transition"
            >
                <Download className="w-6 h-6" />
                <span className="text-[10px] font-medium uppercase tracking-wide">Export</span>
           </button>

           {/* Floating Shuffle Button */}
           <button 
             onClick={handleShuffle} 
             className="-mt-10 bg-indigo-600 text-white p-4 rounded-full shadow-xl shadow-indigo-300 active:scale-95 transition-transform"
            >
                <Shuffle className="w-7 h-7" />
           </button>

           <button 
             onClick={() => setShowAI(true)} 
             className="flex flex-col items-center gap-1 text-slate-500 hover:text-purple-600 active:text-purple-600 transition"
            >
                <Wand2 className="w-6 h-6" />
                <span className="text-[10px] font-medium uppercase tracking-wide">AI Magic</span>
           </button>
      </div>

      {/* AI Modal */}
      {showAI && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
                  <div className="flex justify-between items-center mb-4">
                      <h3 className="text-xl font-bold">Describe your mood</h3>
                      <button onClick={() => setShowAI(false)}><X className="text-gray-400" /></button>
                  </div>
                  <textarea 
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    placeholder="e.g., A cyberpunk city at midnight with neon lights..."
                    className="w-full h-32 p-4 bg-gray-50 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none resize-none mb-4"
                  />
                  <button 
                    onClick={handleAI}
                    disabled={!aiPrompt}
                    className="w-full py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 disabled:opacity-50"
                  >
                    Generate Palette
                  </button>
              </div>
          </div>
      )}

      {/* Export Modal */}
      {showExport && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
                  <div className="flex justify-between items-center mb-6">
                      <h3 className="text-xl font-bold">Export Palette</h3>
                      <button onClick={() => setShowExport(false)}><X className="text-gray-400" /></button>
                  </div>
                  
                  <div className="grid md:grid-cols-2 gap-8">
                      {/* PNG Export Section */}
                      <div className="space-y-6">
                           <h4 className="font-bold text-slate-800 flex items-center gap-2">
                               <ImageIcon className="w-5 h-5 text-indigo-500" />
                               PNG Image
                           </h4>
                           
                           <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Resolution</label>
                                    <div className="flex gap-2">
                                        {[1, 2, 4].map(scale => (
                                            <button 
                                                key={scale}
                                                onClick={() => setExportScale(scale)}
                                                className={`flex-1 py-2 rounded-lg text-sm font-medium border ${exportScale === scale ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-gray-200 text-slate-600 hover:bg-gray-50'}`}
                                            >
                                                {scale}x
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Background</label>
                                    <div className="flex gap-2">
                                        <button 
                                            onClick={() => setExportTransparent(false)}
                                            className={`flex-1 py-2 rounded-lg text-sm font-medium border ${!exportTransparent ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-gray-200 text-slate-600 hover:bg-gray-50'}`}
                                        >
                                            White
                                        </button>
                                        <button 
                                            onClick={() => setExportTransparent(true)}
                                            className={`flex-1 py-2 rounded-lg text-sm font-medium border ${exportTransparent ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-gray-200 text-slate-600 hover:bg-gray-50'}`}
                                        >
                                            Transparent
                                        </button>
                                    </div>
                                </div>

                                <button 
                                    onClick={handleDownloadPNG}
                                    disabled={isExportingImg}
                                    className={`w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${imgExportSuccess ? 'bg-green-500 text-white' : 'bg-slate-900 text-white hover:bg-slate-800'}`}
                                >
                                    {isExportingImg ? (
                                        <>
                                           <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                           Generating...
                                        </>
                                    ) : imgExportSuccess ? (
                                        <>
                                            <CheckCircle2 className="w-5 h-5" /> Downloaded!
                                        </>
                                    ) : (
                                        <>
                                            <Download className="w-5 h-5" /> Download PNG
                                        </>
                                    )}
                                </button>
                           </div>
                      </div>

                      {/* Code Export Section */}
                      <div className="space-y-6 md:border-l md:pl-8 border-gray-100">
                           <h4 className="font-bold text-slate-800 flex items-center gap-2">
                               <Share2 className="w-5 h-5 text-indigo-500" />
                               Code Snippets
                           </h4>

                          <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">CSS Variables</label>
                                <pre className="bg-slate-900 text-indigo-300 p-3 rounded-lg text-xs overflow-x-auto font-mono scrollbar-hide">
                                    {exportCSS()}
                                </pre>
                            </div>
                            
                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">JSON</label>
                                <pre className="bg-slate-900 text-indigo-300 p-3 rounded-lg text-xs overflow-x-auto font-mono scrollbar-hide">
                                    {JSON.stringify(colors.map(c => c.hex), null, 2)}
                                </pre>
                            </div>
                          </div>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* Toast (Simple) */}
      {loading && (
          <div className="fixed bottom-6 right-6 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 z-[110]">
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Processing...
          </div>
      )}

    </div>
  );
};

export default App;
