
/**
 * Utility to convert SVG to Android VectorDrawable XML and generate Kotlin source code for the logic.
 */

class Matrix {
  constructor(public a = 1, public b = 0, public c = 0, public d = 1, public e = 0, public f = 0) {}

  multiply(m: Matrix) {
    return new Matrix(
      this.a * m.a + this.c * m.b,
      this.b * m.a + this.d * m.b,
      this.a * m.c + this.c * m.d,
      this.b * m.c + this.d * m.d,
      this.a * m.e + this.c * m.f + this.e,
      this.b * m.e + this.d * m.f + this.f
    );
  }

  apply(x: number, y: number) {
    return {
      x: x * this.a + y * this.c + this.e,
      y: x * this.b + y * this.d + this.f
    };
  }

  applyToArc(rx: number, ry: number, xAxisRotation: number) {
    const rad = (xAxisRotation * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const v1 = { x: rx * cos, y: rx * sin };
    const v2 = { x: -ry * sin, y: ry * cos };
    const tv1 = { x: v1.x * this.a + v1.y * this.c, y: v1.x * this.b + v1.y * this.d };
    const tv2 = { x: v2.x * this.a + v2.y * this.c, y: v2.x * this.b + v2.y * this.d };
    return { 
      rx: Math.sqrt(tv1.x * tv1.x + tv1.y * tv1.y), 
      ry: Math.sqrt(tv2.x * tv2.x + tv2.y * tv2.y), 
      rotation: (Math.atan2(tv1.y, tv1.x) * 180) / Math.PI 
    };
  }
}

interface GradientData {
  id: string;
  type: 'linear' | 'radial';
  stops: { offset: string; color: string; opacity?: string }[];
  x1?: string; y1?: string; x2?: string; y2?: string;
  cx?: string; cy?: string; r?: string;
  units?: 'objectBoundingBox' | 'userSpaceOnUse'; 
  href?: string;
}

const parseColor = (color: string, opacity: string | number = '1'): string => {
  if (!color || color === 'none') return '#00000000';
  
  let hex = '#000000';
  if (color.startsWith('#')) {
    if (color.length === 4) { // #RGB
      hex = '#' + color[1] + color[1] + color[2] + color[2] + color[3] + color[3];
    } else {
      hex = color.slice(0, 7);
    }
  } else if (color.startsWith('rgb')) {
    const parts = color.match(/\d+/g);
    if (parts && parts.length >= 3) {
      hex = '#' + parts.slice(0, 3).map(x => parseInt(x).toString(16).padStart(2, '0')).join('');
    }
  }
  
  const alphaVal = Math.max(0, Math.min(1, typeof opacity === 'string' ? parseFloat(opacity) : opacity));
  const alphaHex = Math.round(alphaVal * 255).toString(16).padStart(2, '0').toUpperCase();
  return '#' + alphaHex + hex.slice(1).toUpperCase();
};

const parseSvgTransform = (transformStr: string | null): Matrix => {
  let matrix = new Matrix();
  if (!transformStr) return matrix;
  const regex = /(\w+)\s*\(([^)]+)\)/g;
  let match;
  while ((match = regex.exec(transformStr)) !== null) {
    const type = match[1];
    const args = match[2].split(/[ ,]+/).filter(x => x).map(parseFloat);
    switch (type) {
      case 'translate': matrix = matrix.multiply(new Matrix(1, 0, 0, 1, args[0] || 0, args[1] || 0)); break;
      case 'rotate':
        const angle = (args[0] || 0) * Math.PI / 180;
        const cx = args[1] || 0; const cy = args[2] || 0;
        const cos = Math.cos(angle); const sin = Math.sin(angle);
        if (cx !== 0 || cy !== 0) {
          matrix = matrix.multiply(new Matrix(1, 0, 0, 1, cx, cy)).multiply(new Matrix(cos, sin, -sin, cos, 0, 0)).multiply(new Matrix(1, 0, 0, 1, -cx, -cy));
        } else matrix = matrix.multiply(new Matrix(cos, sin, -sin, cos, 0, 0));
        break;
      case 'scale': matrix = matrix.multiply(new Matrix(args[0] || 1, 0, 0, args[1] ?? args[0] ?? 1, 0, 0)); break;
      case 'matrix': if (args.length === 6) matrix = matrix.multiply(new Matrix(args[0], args[1], args[2], args[3], args[4], args[5])); break;
    }
  }
  return matrix;
};

const PATH_TOKEN_REGEX = /[+-]?[0-9]*\.?[0-9]+(?:[eE][+-]?[0-9]+)?|[a-zA-Z]/g;

const transformPath = (d: string, matrix: Matrix): { pathData: string, bbox: { minX: number, minY: number, maxX: number, maxY: number } } => {
  const tokens = d.match(PATH_TOKEN_REGEX) || [];
  let result = ''; let i = 0; let curX = 0, curY = 0; let startX = 0, startY = 0; let cmd = '';
  const fmt = (num: number) => parseFloat(num.toFixed(3)).toString();
  
  let prevCx = 0, prevCy = 0;
  let prevCmdWasCubic = false;

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const updateBBox = (x: number, y: number) => {
    const p = matrix.apply(x, y);
    minX = Math.min(minX, p.x); minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y);
  };

  while (i < tokens.length) {
    const token = tokens[i];
    if (/[a-zA-Z]/.test(token)) { cmd = token; i++; }
    const isRel = cmd === cmd.toLowerCase();
    const upperCmd = cmd.toUpperCase();
    
    switch (upperCmd) {
      case 'M': {
        if (i + 1 >= tokens.length) { i = tokens.length; break; }
        let x = parseFloat(tokens[i++]), y = parseFloat(tokens[i++]);
        if (isRel) { x += curX; y += curY; }
        const p = matrix.apply(x, y); result += `M${fmt(p.x)},${fmt(p.y)}`;
        updateBBox(x, y); curX = x; curY = y; startX = x; startY = y; 
        cmd = isRel ? 'l' : 'L';
        prevCmdWasCubic = false;
        break;
      }
      case 'L': {
        if (i + 1 >= tokens.length) { i = tokens.length; break; }
        let x = parseFloat(tokens[i++]), y = parseFloat(tokens[i++]);
        if (isRel) { x += curX; y += curY; }
        const p = matrix.apply(x, y); result += `L${fmt(p.x)},${fmt(p.y)}`;
        updateBBox(x, y); curX = x; curY = y;
        prevCmdWasCubic = false;
        break;
      }
      case 'H': {
        if (i >= tokens.length) { i = tokens.length; break; }
        let x = parseFloat(tokens[i++]);
        if (isRel) { x += curX; }
        const p = matrix.apply(x, curY); result += `L${fmt(p.x)},${fmt(p.y)}`;
        updateBBox(x, curY); curX = x;
        prevCmdWasCubic = false;
        break;
      }
      case 'V': {
        if (i >= tokens.length) { i = tokens.length; break; }
        let y = parseFloat(tokens[i++]);
        if (isRel) { y += curY; }
        const p = matrix.apply(curX, y); result += `L${fmt(p.x)},${fmt(p.y)}`;
        updateBBox(curX, y); curY = y;
        prevCmdWasCubic = false;
        break;
      }
      case 'C': {
        if (i + 5 >= tokens.length) { i = tokens.length; break; }
        let x1 = parseFloat(tokens[i++]), y1 = parseFloat(tokens[i++]), 
            x2 = parseFloat(tokens[i++]), y2 = parseFloat(tokens[i++]), 
            x = parseFloat(tokens[i++]), y = parseFloat(tokens[i++]);
        if (isRel) { x1 += curX; y1 += curY; x2 += curX; y2 += curY; x += curX; y += curY; }
        const p1 = matrix.apply(x1, y1), p2 = matrix.apply(x2, y2), p = matrix.apply(x, y);
        result += `C${fmt(p1.x)},${fmt(p1.y)} ${fmt(p2.x)},${fmt(p2.y)} ${fmt(p.x)},${fmt(p.y)}`;
        updateBBox(x1, y1); updateBBox(x2, y2); updateBBox(x, y);
        curX = x; curY = y;
        prevCx = x2; prevCy = y2;
        prevCmdWasCubic = true;
        break;
      }
      case 'S': {
        if (i + 3 >= tokens.length) { i = tokens.length; break; }
        let x2 = parseFloat(tokens[i++]), y2 = parseFloat(tokens[i++]), 
            x = parseFloat(tokens[i++]), y = parseFloat(tokens[i++]);
        if (isRel) { x2 += curX; y2 += curY; x += curX; y += curY; }
        let x1 = curX, y1 = curY;
        if (prevCmdWasCubic) {
            x1 = 2 * curX - prevCx;
            y1 = 2 * curY - prevCy;
        }
        const p1 = matrix.apply(x1, y1), p2 = matrix.apply(x2, y2), p = matrix.apply(x, y);
        result += `C${fmt(p1.x)},${fmt(p1.y)} ${fmt(p2.x)},${fmt(p2.y)} ${fmt(p.x)},${fmt(p.y)}`;
        updateBBox(x1, y1); updateBBox(x2, y2); updateBBox(x, y);
        curX = x; curY = y;
        prevCx = x2; prevCy = y2;
        prevCmdWasCubic = true;
        break;
      }
      case 'Q': {
        if (i + 3 >= tokens.length) { i = tokens.length; break; }
        let x1 = parseFloat(tokens[i++]), y1 = parseFloat(tokens[i++]), 
            x = parseFloat(tokens[i++]), y = parseFloat(tokens[i++]);
        if (isRel) { x1 += curX; y1 += curY; x += curX; y += curY; }
        const p1 = matrix.apply(x1, y1), p = matrix.apply(x, y);
        result += `Q${fmt(p1.x)},${fmt(p1.y)} ${fmt(p.x)},${fmt(p.y)}`;
        updateBBox(x1, y1); updateBBox(x, y);
        curX = x; curY = y;
        prevCmdWasCubic = false;
        break;
      }
      case 'A': {
        if (i + 6 >= tokens.length) { i = tokens.length; break; }
        let rx = parseFloat(tokens[i++]), ry = parseFloat(tokens[i++]), rot = parseFloat(tokens[i++]), laf = tokens[i++], swf = tokens[i++], x = parseFloat(tokens[i++]), y = parseFloat(tokens[i++]);
        if (isRel) { x += curX; y += curY; }
        const p = matrix.apply(x, y); const arc = matrix.applyToArc(rx, ry, rot);
        const newSwf = (matrix.a * matrix.d - matrix.b * matrix.c) < 0 ? (swf === '1' ? '0' : '1') : swf;
        result += `A${fmt(arc.rx)},${fmt(arc.ry)} ${fmt(arc.rotation)} ${laf},${newSwf} ${fmt(p.x)},${fmt(p.y)}`;
        updateBBox(x, y); curX = x; curY = y;
        prevCmdWasCubic = false;
        break;
      }
      case 'Z': result += 'Z'; curX = startX; curY = startY; prevCmdWasCubic = false; break;
      default: i++; prevCmdWasCubic = false;
    }
  }
  return { pathData: result.trim(), bbox: { minX, minY, maxX, maxY } };
};

export const svgToAndroidXml = (svgString: string): string => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgString, 'image/svg+xml');
  const svg = doc.querySelector('svg');
  if (!svg) throw new Error('Invalid SVG');
  
  const viewBoxStr = svg.getAttribute('viewBox') || `0 0 ${svg.getAttribute('width') || 24} ${svg.getAttribute('height') || 24}`;
  const viewBox = viewBoxStr.split(/[ ,]+/).map(Number);
  const vbX = viewBox[0] || 0;
  const vbY = viewBox[1] || 0;
  const vbW = viewBox[2] || 24; 
  const vbH = viewBox[3] || 24;
  const globalMatrix = new Matrix(1, 0, 0, 1, -vbX, -vbY);

  const classStyles: Record<string, Record<string, string>> = {};
  const styleEl = doc.querySelector('style');
  if (styleEl) {
    const css = styleEl.textContent || '';
    const rules = css.split('}');
    rules.forEach(rule => {
      const parts = rule.split('{');
      if (parts.length === 2) {
        const selectors = parts[0].trim().split(',');
        const declarations = parts[1].trim().split(';');
        const styleMap: Record<string, string> = {};
        declarations.forEach(decl => {
          const [prop, val] = decl.split(':');
          if (prop && val) styleMap[prop.trim()] = val.trim();
        });
        selectors.forEach(sel => {
          const className = sel.trim().startsWith('.') ? sel.trim().slice(1) : sel.trim();
          classStyles[className] = styleMap;
        });
      }
    });
  }

  const gradients: Record<string, GradientData> = {};
  const gradientElements = doc.querySelectorAll('linearGradient, radialGradient');
  gradientElements.forEach(g => {
    const id = g.getAttribute('id');
    if (!id) return;
    const stops = Array.from(g.querySelectorAll('stop')).map(s => ({
      offset: s.getAttribute('offset') || '0',
      color: s.getAttribute('stop-color') || '#000',
      opacity: s.getAttribute('stop-opacity') || '1'
    }));
    const type = g.tagName.toLowerCase() === 'lineargradient' ? 'linear' : 'radial';
    const href = g.getAttribute('xlink:href') || g.getAttribute('href');
    const gradData: GradientData = {
      id, type, stops,
      units: g.getAttribute('gradientUnits') as any || undefined,
      href: href ? href.substring(1) : undefined
    };
    if (type === 'linear') {
      gradData.x1 = g.getAttribute('x1') || undefined;
      gradData.y1 = g.getAttribute('y1') || undefined;
      gradData.x2 = g.getAttribute('x2') || undefined;
      gradData.y2 = g.getAttribute('y2') || undefined;
    } else {
      gradData.cx = g.getAttribute('cx') || undefined;
      gradData.cy = g.getAttribute('cy') || undefined;
      gradData.r = g.getAttribute('r') || undefined;
    }
    gradients[id] = gradData;
  });

  const resolvedGradients: Record<string, GradientData> = {};
  Object.keys(gradients).forEach(id => {
    const chain: GradientData[] = [];
    let curr: GradientData | undefined = gradients[id];
    const visited = new Set<string>();
    while (curr) {
      chain.push(curr);
      visited.add(curr.id);
      if (curr.href && gradients[curr.href] && !visited.has(curr.href)) {
        curr = gradients[curr.href];
      } else {
        curr = undefined;
      }
    }
    const leaf = chain[0];
    const merged: any = { stops: [], units: undefined };
    for (let i = chain.length - 1; i >= 0; i--) {
        const node = chain[i];
        if (node.stops && node.stops.length > 0) merged.stops = node.stops;
        if (node.units) merged.units = node.units;
        ['x1', 'y1', 'x2', 'y2', 'cx', 'cy', 'r'].forEach(k => {
            if ((node as any)[k] !== undefined) merged[k] = (node as any)[k];
        });
    }
    resolvedGradients[id] = {
        id: leaf.id,
        type: leaf.type,
        stops: merged.stops || [],
        units: merged.units,
        x1: merged.x1, y1: merged.y1, x2: merged.x2, y2: merged.y2,
        cx: merged.cx, cy: merged.cy, r: merged.r
    };
  });
  Object.assign(gradients, resolvedGradients);

  let xml = `<vector xmlns:android="http://schemas.android.com/apk/res/android"\n    xmlns:aapt="http://schemas.android.com/aapt"\n    android:width="${svg.getAttribute('width')?.replace('px', '') || vbW}dp"\n    android:height="${svg.getAttribute('height')?.replace('px', '') || vbH}dp"\n    android:viewportWidth="${vbW}"\n    android:viewportHeight="${vbH}">\n`;

  const processNode = (el: Element, currentMatrix: Matrix): string => {
    const tag = el.tagName.toLowerCase();
    const elClass = el.getAttribute('class');
    const mergedStyles: Record<string, string> = {};
    if (elClass && classStyles[elClass]) Object.assign(mergedStyles, classStyles[elClass]);
    Array.from(el.attributes).forEach(attr => mergedStyles[attr.name] = attr.value);
    
    const inlineStyle = el.getAttribute('style');
    if (inlineStyle) {
      inlineStyle.split(';').forEach(s => {
        const [k, v] = s.split(':');
        if (k && v) mergedStyles[k.trim()] = v.trim();
      });
    }

    const opacity = mergedStyles['opacity'];
    if (opacity === '0' || mergedStyles['display'] === 'none') return '';

    const transform = mergedStyles['transform'];
    const nodeMatrix = currentMatrix.multiply(parseSvgTransform(transform));
    if (tag === 'g') return Array.from(el.children).map(child => processNode(child, nodeMatrix)).join('');
    
    let d = '';
    if (tag === 'path') d = mergedStyles['d'] || '';
    else if (tag === 'rect') {
      const x = parseFloat(mergedStyles['x'] || '0'), y = parseFloat(mergedStyles['y'] || '0'), w = parseFloat(mergedStyles['width'] || '0'), h = parseFloat(mergedStyles['height'] || '0');
      const rx = parseFloat(mergedStyles['rx'] || '0'), ry = parseFloat(mergedStyles['ry'] || '0') || rx;
      if (rx === 0 && ry === 0) d = `M${x},${y}h${w}v${h}h${-w}z`;
      else {
        d = `M${x + rx},${y} L${x + w - rx},${y} A${rx},${ry} 0 0 1 ${x + w},${y + ry} L${x + w},${y + h - ry} A${rx},${ry} 0 0 1 ${x + w - rx},${y + h} L${x + rx},${y + h} A${rx},${ry} 0 0 1 ${x},${y + h - ry} L${x},${y + ry} A${rx},${ry} 0 0 1 ${x + rx},${y} z`;
      }
    } else if (tag === 'circle') {
      const cx = parseFloat(mergedStyles['cx'] || '0'), cy = parseFloat(mergedStyles['cy'] || '0'), r = parseFloat(mergedStyles['r'] || '0');
      d = `M${cx - r},${cy} a${r},${r} 0 1,0 ${r * 2},0 a${r},${r} 0 1,0 ${-r * 2},0`;
    } else if (tag === 'ellipse') {
      const cx = parseFloat(mergedStyles['cx'] || '0'), cy = parseFloat(mergedStyles['cy'] || '0'), rx = parseFloat(mergedStyles['rx'] || '0'), ry = parseFloat(mergedStyles['ry'] || '0');
      d = `M${cx - rx},${cy} a${rx},${ry} 0 1,0 ${rx * 2},0 a${rx},${ry} 0 1,0 ${-rx * 2},0`;
    } else if (tag === 'line') {
      const x1 = parseFloat(mergedStyles['x1'] || '0'), y1 = parseFloat(mergedStyles['y1'] || '0'), x2 = parseFloat(mergedStyles['x2'] || '0'), y2 = parseFloat(mergedStyles['y2'] || '0');
      d = `M${x1},${y1} L${x2},${y2}`;
    } else if (tag === 'polyline' || tag === 'polygon') {
      const points = mergedStyles['points']?.trim().split(/[ ,]+/).map(parseFloat) || [];
      if (points.length >= 2) {
        d = `M${points[0]},${points[1]}`;
        for (let i = 2; i < points.length; i += 2) d += ` L${points[i]},${points[i+1]}`;
        if (tag === 'polygon') d += ' Z';
      }
    }

    if (d) {
      const res = transformPath(d, nodeMatrix);
      if (!res.pathData) return '';
      const { pathData, bbox } = res;
      
      const fill = mergedStyles['fill'];
      const fillOpacity = mergedStyles['fill-opacity'] || opacity || '1';
      const stroke = mergedStyles['stroke'];
      const strokeWidth = mergedStyles['stroke-width']?.replace('px', '');
      const strokeOpacity = mergedStyles['stroke-opacity'] || opacity || '1';
      const lineCap = mergedStyles['stroke-linecap'];
      const lineJoin = mergedStyles['stroke-linejoin'];

      if ((!fill || fill === 'none' || fillOpacity === '0') && (!stroke || stroke === 'none' || strokeOpacity === '0')) return '';

      let pathXml = `  <path\n      android:pathData="${pathData}"`;
      
      if (fill?.startsWith('url(#')) {
        const gradId = fill!.substring(5, fill!.length - 1);
        const grad = gradients[gradId];
        if (grad) {
          if (fillOpacity !== '1') pathXml += `\n      android:fillAlpha="${fillOpacity}"`;
          pathXml += `>\n    <aapt:attr name="android:fillColor">\n      <gradient`;
          const units = grad.units || 'objectBoundingBox';
          const parseCoord = (val: string | undefined, size: number, min: number, def: string) => {
            const v = val ?? def;
            if (v.endsWith('%')) return min + (parseFloat(v) / 100) * size;
            const num = parseFloat(v);
            if (units === 'objectBoundingBox') return min + num * size;
            return num;
          };
          const applyGlobal = (val: number, isX: boolean) => val + (isX ? globalMatrix.e : globalMatrix.f);
          if (grad.type === 'linear') {
            const w = isFinite(bbox.maxX) ? bbox.maxX - bbox.minX : 0;
            const h = isFinite(bbox.maxY) ? bbox.maxY - bbox.minY : 0;
            let x1 = parseCoord(grad.x1, w, bbox.minX, '0'), y1 = parseCoord(grad.y1, h, bbox.minY, '0');
            let x2 = parseCoord(grad.x2, w, bbox.minX, '1'), y2 = parseCoord(grad.y2, h, bbox.minY, '0');
            if (units === 'userSpaceOnUse') { x1 = applyGlobal(x1, true); y1 = applyGlobal(y1, false); x2 = applyGlobal(x2, true); y2 = applyGlobal(y2, false); }
            pathXml += ` \n          android:startX="${x1.toFixed(3)}"\n          android:startY="${y1.toFixed(3)}"\n          android:endX="${x2.toFixed(3)}"\n          android:endY="${y2.toFixed(3)}"\n          android:type="linear">`;
          } else {
            const w = isFinite(bbox.maxX) ? bbox.maxX - bbox.minX : 0, h = isFinite(bbox.maxY) ? bbox.maxY - bbox.minY : 0;
            let cx = parseCoord(grad.cx, w, bbox.minX, '0.5'), cy = parseCoord(grad.cy, h, bbox.minY, '0.5'), r = parseCoord(grad.r, Math.sqrt(w*w + h*h), 0, '0.5');
            if (units === 'userSpaceOnUse') { cx = applyGlobal(cx, true); cy = applyGlobal(cy, false); }
            pathXml += ` \n          android:centerX="${cx.toFixed(3)}"\n          android:centerY="${cy.toFixed(3)}"\n          android:gradientRadius="${r.toFixed(3)}"\n          android:type="radial">`;
          }
          grad.stops.forEach(s => {
            const offset = s.offset.includes('%') ? parseFloat(s.offset) / 100 : parseFloat(s.offset);
            pathXml += `\n        <item android:offset="${offset}" android:color="${parseColor(s.color, s.opacity)}"/>`;
          });
          pathXml += `\n      </gradient>\n    </aapt:attr>\n  </path>\n`;
        } else pathXml += `\n      android:fillColor="#000000"/>\n`;
      } else {
        pathXml += `\n      android:fillColor="${parseColor(fill || (stroke ? 'none' : '#000000'), fillOpacity)}"`;
        if (stroke && stroke !== 'none') {
          pathXml += `\n      android:strokeColor="${parseColor(stroke, strokeOpacity)}"`;
          if (strokeWidth) pathXml += `\n      android:strokeWidth="${strokeWidth}"`;
          if (lineCap) pathXml += `\n      android:strokeLineCap="${lineCap}"`;
          if (lineJoin) pathXml += `\n      android:strokeLineJoin="${lineJoin}"`;
        }
        pathXml += `/>\n`;
      }
      return pathXml;
    }
    return '';
  };

  Array.from(svg.children).forEach(child => { if (!['defs', 'style', 'metadata'].includes(child.tagName.toLowerCase())) xml += processNode(child, globalMatrix); });
  return xml + '</vector>';
};

export const svgToSimplifiedSvg = (svgString: string): string => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgString, 'image/svg+xml');
  const svg = doc.querySelector('svg');
  if (!svg) throw new Error('Invalid SVG');
  
  const viewBoxStr = svg.getAttribute('viewBox') || `0 0 ${svg.getAttribute('width') || 24} ${svg.getAttribute('height') || 24}`;
  const viewBox = viewBoxStr.split(/[ ,]+/).map(Number);
  const vbX = viewBox[0] || 0;
  const vbY = viewBox[1] || 0;
  const vbW = viewBox[2] || 24; 
  const vbH = viewBox[3] || 24;
  const globalMatrix = new Matrix(1, 0, 0, 1, -vbX, -vbY);

  const paths: string[] = [];

  const processNode = (el: Element, currentMatrix: Matrix) => {
    const tag = el.tagName.toLowerCase();
    const style = el.getAttribute('style') || '';
    const mergedStyles: Record<string, string> = {};
    Array.from(el.attributes).forEach(attr => mergedStyles[attr.name] = attr.value);
    style.split(';').forEach(s => {
      const [k, v] = s.split(':');
      if (k && v) mergedStyles[k.trim()] = v.trim();
    });

    if (mergedStyles['opacity'] === '0' || mergedStyles['display'] === 'none') return;

    const nodeMatrix = currentMatrix.multiply(parseSvgTransform(mergedStyles['transform']));
    if (tag === 'g') {
      Array.from(el.children).forEach(child => processNode(child, nodeMatrix));
      return;
    }

    let d = '';
    if (tag === 'path') d = mergedStyles['d'] || '';
    else if (tag === 'rect') {
      const x = parseFloat(mergedStyles['x'] || '0'), y = parseFloat(mergedStyles['y'] || '0'), w = parseFloat(mergedStyles['width'] || '0'), h = parseFloat(mergedStyles['height'] || '0');
      const rx = parseFloat(mergedStyles['rx'] || '0'), ry = parseFloat(mergedStyles['ry'] || '0') || rx;
      if (rx === 0 && ry === 0) d = `M${x},${y}h${w}v${h}h${-w}z`;
      else {
        d = `M${x + rx},${y} L${x + w - rx},${y} A${rx},${ry} 0 0 1 ${x + w},${y + ry} L${x + w},${y + h - ry} A${rx},${ry} 0 0 1 ${x + w - rx},${y + h} L${x + rx},${y + h} A${rx},${ry} 0 0 1 ${x},${y + h - ry} L${x},${y + ry} A${rx},${ry} 0 0 1 ${x + rx},${y} z`;
      }
    } else if (tag === 'circle') {
      const cx = parseFloat(mergedStyles['cx'] || '0'), cy = parseFloat(mergedStyles['cy'] || '0'), r = parseFloat(mergedStyles['r'] || '0');
      d = `M${cx - r},${cy} a${r},${r} 0 1,0 ${r * 2},0 a${r},${r} 0 1,0 ${-r * 2},0`;
    } else if (tag === 'line') {
      const x1 = parseFloat(mergedStyles['x1'] || '0'), y1 = parseFloat(mergedStyles['y1'] || '0'), x2 = parseFloat(mergedStyles['x2'] || '0'), y2 = parseFloat(mergedStyles['y2'] || '0');
      d = `M${x1},${y1} L${x2},${y2}`;
    }

    if (d) {
      const res = transformPath(d, nodeMatrix);
      const fill = mergedStyles['fill'] || 'black';
      const stroke = mergedStyles['stroke'] || 'none';
      const strokeWidth = mergedStyles['stroke-width']?.replace('px', '') || '1';
      const strokeCap = mergedStyles['stroke-linecap'] || 'butt';
      
      let p = `<path d="${res.pathData}" fill="${fill}"`;
      if (stroke !== 'none') {
        p += ` stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linecap="${strokeCap}"`;
      }
      p += '/>';
      paths.push(p);
    }
  };

  Array.from(svg.children).forEach(child => { if (!['defs', 'style', 'metadata'].includes(child.tagName.toLowerCase())) processNode(child, globalMatrix); });
  
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${vbW} ${vbH}">\n  ${paths.join('\n  ')}\n</svg>`;
};

export const getKotlinConverterLogic = (): string => {
  return `import kotlin.math.*
import net.devrieze.xmlutil.XmlStreaming
import net.devrieze.xmlutil.EventType

/**
 * Professional KMP Compatible SVG to Android VectorDrawable XML Converter.
 */

interface SvgNode {
    val tagName: String
    val attributes: Map<String, String>
    val children: List<Any>
    fun getAttribute(name: String): String? = attributes[name]
}

data class SvgElement(
    override val tagName: String,
    override val attributes: Map<String, String>,
    override val children: MutableList<Any> = mutableListOf()
) : SvgNode

data class GradientStop(val offset: Double, val color: String, val opacity: Double)

data class GradientData(
    val id: String,
    val type: String,
    val stops: List<GradientStop>,
    val coords: Map<String, String>,
    val units: String? = null,
    val href: String? = null
)

data class BBox(val minX: Double, val minY: Double, val maxX: Double, val maxY: Double)

data class Matrix(
    val a: Double = 1.0, val b: Double = 0.0,
    val c: Double = 0.0, val d: Double = 1.0,
    val e: Double = 0.0, val f: Double = 0.0
) {
    fun multiply(m: Matrix) = Matrix(
        a * m.a + c * m.b, b * m.a + d * m.b,
        a * m.c + c * m.d, b * m.c + d * m.d,
        a * m.e + c * m.f + e, b * m.e + d * m.f + f
    )
    fun apply(x: Double, y: Double): Pair<Double, Double> = Pair(x * a + y * c + e, x * b + y * d + f)
    fun applyToArc(rx: Double, ry: Double, rotDeg: Double): Triple<Double, Double, Double> {
        val rad = rotDeg * PI / 180.0
        val cosA = cos(rad); val sinA = sin(rad)
        val tv1x = (rx * cosA) * a + (rx * sinA) * c
        val tv1y = (rx * cosA) * b + (rx * sinA) * d
        val tv2x = (-ry * sinA) * a + (ry * cosA) * c
        val tv2y = (-ry * sinA) * b + (ry * cosA) * d
        return Triple(sqrt(tv1x * tv1x + tv1y * tv1y), sqrt(tv2x * tv2x + tv2y * tv2y), atan2(tv1y, tv1x) * 180.0 / PI)
    }
}

class SvgToAndroidConverter {
    private val transformRegex = Regex("(\\\\w+)\\\\s*\\\\(([^)]+)\\\\)")
    private val tokenRegex = Regex("[+-]?[0-9]*\\\\.?[0-9]+(?:[eE][+-]?[0-9]+)?|[a-zA-Z]")
    private val gradients = mutableMapOf<String, GradientData>()
    private val classStyles = mutableMapOf<String, Map<String, String>>()

    fun convert(svgString: String): String {
        gradients.clear()
        classStyles.clear()
        val root = createDocument(svgString)
        analyzeDefinitions(root)
        resolveGradients()
        val vbAttr = root.getAttribute("viewBox") ?: "0 0 24 24"
        val vb = vbAttr.split(Regex("[ ,]+")).map { it.toDoubleOrNull() ?: 0.0 }
        val vbW = vb.getOrElse(2) { 24.0 }; val vbH = vb.getOrElse(3) { 24.0 }
        val vbX = vb.getOrElse(0) { 0.0 }; val vbY = vb.getOrElse(1) { 0.0 }
        val globalMatrix = Matrix(e = -vbX, f = -vbY)
        val res = StringBuilder("<vector xmlns:android=\\"http://schemas.android.com/apk/res/android\\"\\n")
        res.append("    xmlns:aapt=\\"http://schemas.android.com/aapt\\"\\n")
        res.append("    android:width=\\"\${fmt(vbW)}dp\\" android:height=\\"\${fmt(vbH)}dp\\"\\n")
        res.append("    android:viewportWidth=\\"\${fmt(vbW)}\\" android:viewportHeight=\\"\${fmt(vbH)}\\">\\n")
        root.children.forEach { if (it is SvgNode) processNode(it, globalMatrix, res, globalMatrix) }
        res.append("</vector>")
        return res.toString()
    }

    private fun analyzeDefinitions(node: SvgNode) {
        when (node.tagName) {
            "style" -> {
                val css = node.children.filterIsInstance<String>().joinToString("")
                css.split("}").forEach { rule ->
                    val parts = rule.split("{")
                    if (parts.size == 2) {
                        val selectors = parts[0].split(","); val styleMap = parts[1].split(";").filter { it.contains(":") }.associate {
                            val kv = it.split(":")
                            kv[0].trim() to kv[1].trim()
                        }
                        selectors.forEach { classStyles[it.trim().removePrefix(".")] = styleMap }
                    }
                }
            }
            "linearGradient", "radialGradient" -> {
                val id = node.getAttribute("id") ?: return
                val stops = node.children.filterIsInstance<SvgNode>().filter { it.tagName == "stop" }.map {
                    val off = it.getAttribute("offset") ?: "0"
                    GradientStop(
                        if (off.endsWith("%")) (off.removeSuffix("%").toDoubleOrNull() ?: 0.0) / 100.0 else off.toDoubleOrNull() ?: 0.0,
                        it.getAttribute("stop-color") ?: "#000",
                        it.getAttribute("stop-opacity")?.toDoubleOrNull() ?: 1.0
                    )
                }
                gradients[id] = GradientData(id, if (node.tagName == "linearGradient") "linear" else "radial", stops, node.attributes, 
                    node.getAttribute("gradientUnits"), 
                    (node.getAttribute("xlink:href") ?: node.getAttribute("href"))?.removePrefix("#"))
            }
        }
        node.children.forEach { if (it is SvgNode) analyzeDefinitions(it) }
    }

    private fun resolveGradients() {
        val resolved = mutableMapOf<String, GradientData>()
        gradients.keys.forEach { id ->
            val chain = mutableListOf<GradientData>(); var curr: GradientData? = gradients[id]; val seen = mutableSetOf<String>()
            while (curr != null) { chain.add(curr); seen.add(curr.id); curr = if (curr.href != null && gradients.containsKey(curr.href) && !seen.contains(curr.href)) gradients[curr.href] else null }
            val leaf = chain.first(); var finalStops = emptyList<GradientStop>(); var finalUnits: String? = null; val finalCoords = mutableMapOf<String, String>()
            for (i in chain.indices.reversed()) { val node = chain[i]; if (node.stops.isNotEmpty()) finalStops = node.stops; if (node.units != null) finalUnits = node.units; finalCoords.putAll(node.coords) }
            resolved[id] = leaf.copy(stops = finalStops, units = finalUnits, coords = finalCoords)
        }
        gradients.putAll(resolved)
    }

    private fun processNode(node: SvgNode, matrix: Matrix, res: StringBuilder, globalMatrix: Matrix) {
        val styles = mutableMapOf<String, String>(); node.getAttribute("class")?.let { classStyles[it]?.let { s -> styles.putAll(s) } }; styles.putAll(node.attributes)
        
        node.getAttribute("style")?.let {
           it.split(";").forEach { s ->
               val kv = s.split(":")
               if (kv.size == 2) styles[kv[0].trim()] = kv[1].trim()
           }
        }

        val opacityAttr = styles["opacity"] ?: "1"
        if (opacityAttr == "0" || styles["display"] == "none") return
        
        val nodeMatrix = matrix.multiply(parseTransform(styles["transform"]))
        when (val tag = node.tagName.lowercase()) {
            "g" -> node.children.forEach { if (it is SvgNode) processNode(it, nodeMatrix, res, globalMatrix) }
            "path", "rect", "circle", "ellipse", "line", "polyline", "polygon" -> {
                val d = when(tag) {
                    "path" -> styles["d"] ?: ""
                    "rect" -> {
                        val x = styles["x"]?.toDoubleOrNull() ?: 0.0; val y = styles["y"]?.toDoubleOrNull() ?: 0.0
                        val w = styles["width"]?.toDoubleOrNull() ?: 0.0; val h = styles["height"]?.toDoubleOrNull() ?: 0.0
                        val rx = styles["rx"]?.toDoubleOrNull() ?: 0.0; val ry = styles["ry"]?.toDoubleOrNull() ?: rx
                        if (rx == 0.0 && ry == 0.0) "M \${fmt(x)} \${fmt(y)} h \${fmt(w)} v \${fmt(h)} h \${fmt(-w)} z"
                        else "M \${fmt(x+rx)} \${fmt(y)} L \${fmt(x+w-rx)} \${fmt(y)} A \${fmt(rx)} \${fmt(ry)} 0 0 1 \${fmt(x+w)} \${fmt(y+ry)} L \${fmt(x+w)} \${fmt(y+h-ry)} A \${fmt(rx)} \${fmt(ry)} 0 0 1 \${fmt(x+w-rx)} \${fmt(y+h)} L \${fmt(x+rx)} \${fmt(y+h)} A \${fmt(rx)} \${fmt(ry)} 0 0 1 \${fmt(x)} \${fmt(y+h-ry)} L \${fmt(x)} \${fmt(y+ry)} A \${fmt(rx)} \${fmt(y+ry)} 0 0 1 \${fmt(x+rx)} \${fmt(y)} z"
                    }
                    "line" -> {
                        val x1 = styles["x1"]?.toDoubleOrNull() ?: 0.0; val y1 = styles["y1"]?.toDoubleOrNull() ?: 0.0
                        val x2 = styles["x2"]?.toDoubleOrNull() ?: 0.0; val y2 = styles["y2"]?.toDoubleOrNull() ?: 0.0
                        "M \${fmt(x1)} \${fmt(y1)} L \${fmt(x2)} \${fmt(y2)}"
                    }
                    "circle", "ellipse" -> { 
                        val cx = styles["cx"]?.toDoubleOrNull() ?: 0.0; val cy = styles["cy"]?.toDoubleOrNull() ?: 0.0; 
                        val rx = styles["rx"]?.toDoubleOrNull() ?: styles["r"]?.toDoubleOrNull() ?: 0.0
                        val ry = styles["ry"]?.toDoubleOrNull() ?: styles["r"]?.toDoubleOrNull() ?: 0.0
                        "M \${fmt(cx-rx)} \${fmt(cy)} a \${fmt(rx)} \${fmt(ry)} 0 1,0 \${fmt(rx*2)} 0 a \${fmt(rx)} \${fmt(ry)} 0 1,0 \${fmt(-rx*2)} 0"
                    }
                    "polyline", "polygon" -> {
                        val pts = styles["points"]?.split(Regex("[ ,]+"))?.filter { it.isNotEmpty() }?.map { it.toDoubleOrNull() ?: 0.0 } ?: emptyList()
                        if (pts.size >= 2) {
                            val sb = StringBuilder("M \${fmt(pts[0])} \${fmt(pts[1])}")
                            for (j in 2 until pts.size step 2) sb.append(" L \${fmt(pts[j])} \${fmt(pts[j+1])}")
                            if (tag == "polygon") sb.append(" Z")
                            sb.toString()
                        } else ""
                    }
                    else -> ""
                }
                if (d.isNotEmpty()) appendPath(d, styles, nodeMatrix, res, globalMatrix)
            }
        }
    }

    private fun appendPath(d: String, styles: Map<String, String>, matrix: Matrix, res: StringBuilder, globalMatrix: Matrix) {
        val (pathData, bbox) = flattenPath(d, matrix); if (pathData.isEmpty()) return
        val fill = styles["fill"]; val stroke = styles["stroke"]
        val opacity = styles["opacity"] ?: "1"
        val fillAlpha = styles["fill-opacity"]?.toDoubleOrNull() ?: opacity.toDoubleOrNull() ?: 1.0
        val strokeAlpha = styles["stroke-opacity"]?.toDoubleOrNull() ?: opacity.toDoubleOrNull() ?: 1.0
        
        if ((fill == "none" || fillAlpha == 0.0) && (stroke == null || stroke == "none" || strokeAlpha == 0.0)) return

        res.append("  <path android:pathData=\\"\${pathData}\\"")
        
        if (fill != null && fill.startsWith("url(#")) {
            val gradId = fill.substring(5, fill.length - 1); val grad = gradients[gradId]
            if (grad != null) {
                if (fillAlpha != 1.0) res.append(" android:fillAlpha=\\"\${fmt(fillAlpha)}\\"")
                res.append(">\\n    <aapt:attr name=\\"android:fillColor\\">\\n      <gradient ")
                val w = bbox.maxX - bbox.minX; val h = bbox.maxY - bbox.minY; val units = grad.units ?: "objectBoundingBox"
                fun resolve(k: String, size: Double, min: Double, def: String): Double {
                    val v = grad.coords[k] ?: def
                    return if (v.endsWith("%")) min + (v.removeSuffix("%").toDoubleOrNull()?.let { it / 100.0 } ?: 0.0) * size
                    else if (units == "objectBoundingBox") min + (v.toDoubleOrNull() ?: 0.0) * size
                    else v.toDoubleOrNull() ?: 0.0
                }
                fun applyGlobal(v: Double, isX: Boolean) = v + if(isX) globalMatrix.e else globalMatrix.f
                if (grad.type == "linear") {
                    var x1 = resolve("x1", w, bbox.minX, "0"); var y1 = resolve("y1", h, bbox.minY, "0"); var x2 = resolve("x2", w, bbox.minX, "1"); var y2 = resolve("y2", h, bbox.minY, "0")
                    if (units == "userSpaceOnUse") { x1 = applyGlobal(x1, true); y1 = applyGlobal(y1, false); x2 = applyGlobal(x2, true); y2 = applyGlobal(y2, false) }
                    res.append("android:startX=\\"\${fmt(x1)}\\" android:startY=\\"\${fmt(y1)}\\" android:endX=\\"\${fmt(x2)}\\" android:endY=\\"\${fmt(y2)}\\" android:type=\\"linear\\">\\n")
                } else {
                    var cx = resolve("cx", w, bbox.minX, "0.5"); var cy = resolve("cy", h, bbox.minY, "0.5"); val r = resolve("r", sqrt(w*w + h*h), 0.0, "0.5")
                    if (units == "userSpaceOnUse") { cx = applyGlobal(cx, true); cy = applyGlobal(cy, false) }
                    res.append("android:centerX=\\"\${fmt(cx)}\\" android:centerY=\\"\${fmt(cy)}\\" android:gradientRadius=\\"\${fmt(r)}\\" android:type=\\"radial\\">\\n")
                }
                grad.stops.forEach { res.append("        <item android:offset=\\"\${fmt(it.offset)}\\" android:color=\\"\${parseColor(it.color, it.opacity)}\\"/>\\n") }
                res.append("      </gradient>\\n    </aapt:attr>\\n  </path>\\n"); return
            }
        }
        
        val finalFill = fill ?: (if (stroke != null) "none" else "#000000")
        res.append(" android:fillColor=\\"\${parseColor(finalFill, fillAlpha)}\\"")
        
        if (stroke != null && stroke != "none") {
            res.append(" android:strokeColor=\\"\${parseColor(stroke, strokeAlpha)}\\"")
            styles["stroke-width"]?.let { res.append(" android:strokeWidth=\\"\${it.replace("px", "")}\\"") }
            styles["stroke-linecap"]?.let { res.append(" android:strokeLineCap=\\"\${it}\\"") }
            styles["stroke-linejoin"]?.let { res.append(" android:strokeLineJoin=\\"\${it}\\"") }
        }
        
        res.append("/>\\n")
    }
    
    private fun fmt(d: Double): String {
        if (d.isNaN() || d.isInfinite()) return "0"
        val s = ((d * 1000.0).roundToLong() / 1000.0).toString()
        return if (s.endsWith(".0")) s.substring(0, s.length - 2) else s
    }

    private fun parseColor(color: String, opacity: Double): String {
        if (color == "none") return "#00000000"
        var c = color.removePrefix("#").uppercase()
        if (c.length == 3) c = "" + c[0] + c[0] + x[1] + c[1] + c[2] + c[2]
        val alpha = (opacity * 255.0).roundToInt().coerceIn(0, 255).toString(16).padStart(2, '0').uppercase()
        return "#" + alpha + (if (c.length == 6) c else "000000")
    }

    private fun parseTransform(s: String?): Matrix {
        if (s.isNullOrEmpty()) return Matrix(); var m = Matrix()
        transformRegex.findAll(s).forEach { match ->
            val type = match.groupValues[1]; val args = match.groupValues[2].split(Regex("[ ,]+")).filter { it.isNotEmpty() }.map { it.toDoubleOrNull() ?: 0.0 }
            when (type) {
                "translate" -> m = m.multiply(Matrix(e = args.getOrElse(0) { 0.0 }, f = args.getOrElse(1) { 0.0 }))
                "rotate" -> { val angle = (args.getOrNull(0) ?: 0.0) * PI / 180.0; val cosA = cos(angle); val sinA = sin(angle); m = m.multiply(Matrix(cosA, sinA, -sinA, cosA)) }
                "scale" -> m = m.multiply(Matrix(a = args.getOrElse(0) { 1.0 }, d = args.getOrElse(1) { args.getOrElse(0) { 1.0 } }))
                "matrix" -> if (args.size == 6) m = m.multiply(Matrix(args[0], args[1], args[2], args[3], args[4], args[5]))
            }
        }
        return m
    }

    private fun flattenPath(d: String, matrix: Matrix): Pair<String, BBox> {
        val tokens = tokenRegex.findAll(d).map { it.value }.toList(); var i = 0; var curX = 0.0; var curY = 0.0; var startX = 0.0; var startY = 0.0
        var cmd = ""; val res = StringBuilder(); var minX = Double.MAX_VALUE; var minY = Double.MAX_VALUE; var maxX = -Double.MAX_VALUE; var maxY = -Double.MAX_VALUE
        var prevCx = 0.0; var prevCy = 0.0; var prevCmdWasCubic = false
        fun update(x: Double, y: Double) { val p = matrix.apply(x, y); minX = min(minX, p.first); minY = min(minY, p.second); maxX = max(maxX, p.first); maxY = max(maxY, p.second) }
        while (i < tokens.size) {
            val token = tokens[i]; if (token.length == 1 && token[0].isLetter()) { cmd = token; i++ }
            val isRel = cmd[0].isLowerCase(); val upper = cmd.uppercase()
            when (upper) {
                "M" -> { if (i + 1 < tokens.size) { var x = tokens[i++].toDoubleOrNull() ?: 0.0; var y = tokens[i++].toDoubleOrNull() ?: 0.0; if (isRel) { x += curX; y += curY }; val p = matrix.apply(x, y); res.append("M\${fmt(p.first)},\${fmt(p.second)} "); curX = x; curY = y; startX = x; startY = y; update(x, y); cmd = if (isRel) "l" else "L"; prevCmdWasCubic = false } else i++ }
                "L" -> { if (i + 1 < tokens.size) { var x = tokens[i++].toDoubleOrNull() ?: 0.0; var y = tokens[i++].toDoubleOrNull() ?: 0.0; if (isRel) { x += curX; y += curY }; val p = matrix.apply(x, y); res.append("L\${fmt(p.first)},\${fmt(p.second)} "); curX = x; curY = y; update(x, y); prevCmdWasCubic = false } else i++ }
                "H" -> { if (i < tokens.size) { var x = tokens[i++].toDoubleOrNull() ?: 0.0; if (isRel) x += curX; val p = matrix.apply(x, curY); res.append("L\${fmt(p.first)},\${fmt(p.second)} "); curX = x; update(x, curY); prevCmdWasCubic = false } else i++ }
                "V" -> { if (i < tokens.size) { var y = tokens[i++].toDoubleOrNull() ?: 0.0; if (isRel) y += curY; val p = matrix.apply(curX, y); res.append("L\${fmt(p.first)},\${fmt(p.second)} "); curY = y; update(curX, y); prevCmdWasCubic = false } else i++ }
                "Q" -> { if (i + 3 < tokens.size) { var x1 = tokens[i++].toDoubleOrNull() ?: 0.0; var y1 = tokens[i++].toDoubleOrNull() ?: 0.0; var x = tokens[i++].toDoubleOrNull() ?: 0.0; var y = tokens[i++].toDoubleOrNull() ?: 0.0; if (isRel) { x1 += curX; y1 += curY; x += curX; y += curY }; val p1 = matrix.apply(x1, y1); val p = matrix.apply(x, y); res.append("Q\${fmt(p1.first)},\${fmt(p1.second)} \${fmt(p.first)},\${fmt(p.second)} "); curX = x; curY = y; update(x1, y1); update(x, y); prevCmdWasCubic = false } else i++ }
                "C" -> { if (i + 5 < tokens.size) { var x1 = tokens[i++].toDoubleOrNull() ?: 0.0; var y1 = tokens[i++].toDoubleOrNull() ?: 0.0; var x2 = tokens[i++].toDoubleOrNull() ?: 0.0; var y2 = tokens[i++].toDoubleOrNull() ?: 0.0; var x = tokens[i++].toDoubleOrNull() ?: 0.0; var y = tokens[i++].toDoubleOrNull() ?: 0.0; if (isRel) { x1 += curX; y1 += curY; x2 += curX; y2 += curY; x += curX; y += curY }; val p1 = matrix.apply(x1, y1); val p2 = matrix.apply(x2, y2); val p = matrix.apply(x, y); res.append("C\${fmt(p1.first)},\${fmt(p1.second)} \${fmt(p2.first)},\${fmt(p2.second)} \${fmt(p.first)},\${fmt(p.second)} "); curX = x; curY = y; update(x1, y1); update(x2, y2); update(x, y); prevCx = x2; prevCy = y2; prevCmdWasCubic = true } else i++ }
                "S" -> { if (i + 3 < tokens.size) { var x2 = tokens[i++].toDoubleOrNull() ?: 0.0; var y2 = tokens[i++].toDoubleOrNull() ?: 0.0; var x = tokens[i++].toDoubleOrNull() ?: 0.0; var y = tokens[i++].toDoubleOrNull() ?: 0.0; if (isRel) { x2 += curX; y2 += curY; x += curX; y += curY }; var x1 = if (prevCmdWasCubic) 2 * curX - prevCx else curX; var y1 = if (prevCmdWasCubic) 2 * curY - prevCy else curY; val p1 = matrix.apply(x1, y1); val p2 = matrix.apply(x2, y2); val p = matrix.apply(x, y); res.append("C\${fmt(p1.first)},\${fmt(p1.second)} \${fmt(p2.first)},\${fmt(p2.second)} \${fmt(p.first)},\${fmt(p.second)} "); curX = x; curY = y; update(x1, y1); update(x2, y2); update(x, y); prevCx = x2; prevCy = y2; prevCmdWasCubic = true } else i++ }
                "A" -> { if (i + 6 < tokens.size) { val rx = tokens[i++].toDoubleOrNull() ?: 0.0; val ry = tokens[i++].toDoubleOrNull() ?: 0.0; val rot = tokens[i++].toDoubleOrNull() ?: 0.0; val laf = tokens[i++]; val swf = tokens[i++]
                    var x = tokens[i++].toDoubleOrNull() ?: 0.0; var y = tokens[i++].toDoubleOrNull() ?: 0.0; if (isRel) { x += curX; y += curY }; val p = matrix.apply(x, y); val arc = matrix.applyToArc(rx, ry, rot)
                    val nswf = if ((matrix.a * matrix.d - matrix.b * matrix.c) < 0) (if (swf.startsWith("1")) "0" else "1") else swf.take(1); res.append("A\${fmt(arc.first)},\${fmt(arc.second)} \${fmt(arc.third)} \$laf,\$nswf \${fmt(p.first)},\${fmt(p.second)} "); curX = x; curY = y; update(x, y); prevCmdWasCubic = false } else i++ }
                "Z" -> { res.append("Z "); curX = startX; curY = startY; prevCmdWasCubic = false }
                else -> i++
            }
        }
        return Pair(res.toString().trim(), BBox(minX, minY, maxX, maxY))
    }

    private fun createDocument(xml: String): SvgNode {
        val reader = XmlStreaming.newReader(xml); val stack = mutableListOf<SvgElement>(); var root: SvgElement? = null
        while (reader.hasNext()) {
            when (reader.next()) {
                EventType.START_ELEMENT -> { val attrs = (0 until reader.attributeCount).associate { reader.getAttributeLocalName(it) to reader.getAttributeValue(it) }; val el = SvgElement(reader.localName, attrs); if (stack.isEmpty()) root = el else (stack.last().children as MutableList<Any>).add(el); stack.add(el) }
                EventType.TEXT -> if (stack.isNotEmpty()) (stack.last().children as MutableList<Any>).add(reader.text)
                EventType.END_ELEMENT -> if (stack.isNotEmpty()) stack.removeAt(stack.size - 1)
                else -> {}
            }
        }
        return root ?: throw IllegalArgumentException("Invalid XML")
    }
}
`;
};
