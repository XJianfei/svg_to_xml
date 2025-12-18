
/**
 * Utility to convert SVG to Android VectorDrawable XML by flattening transforms.
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

  // Accurate arc radius and rotation transformation
  applyToArc(rx: number, ry: number, xAxisRotation: number) {
    const rad = (xAxisRotation * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);

    const v1 = { x: rx * cos, y: rx * sin };
    const v2 = { x: -ry * sin, y: ry * cos };

    const tv1 = { x: v1.x * this.a + v1.y * this.c, y: v1.x * this.b + v1.y * this.d };
    const tv2 = { x: v2.x * this.a + v2.y * this.c, y: v2.x * this.b + v2.y * this.d };

    const nrx = Math.sqrt(tv1.x * tv1.x + tv1.y * tv1.y);
    const nry = Math.sqrt(tv2.x * tv2.x + tv2.y * tv2.y);
    const nrot = (Math.atan2(tv1.y, tv1.x) * 180) / Math.PI;

    return { rx: nrx, ry: nry, rotation: nrot };
  }
}

const parseSvgTransform = (transformStr: string | null): Matrix => {
  let matrix = new Matrix();
  if (!transformStr) return matrix;

  const regex = /(\w+)\s*\(([^)]+)\)/g;
  let match;
  while ((match = regex.exec(transformStr)) !== null) {
    const type = match[1];
    const args = match[2].split(/[ ,]+/).filter(x => x).map(parseFloat);

    switch (type) {
      case 'translate':
        matrix = matrix.multiply(new Matrix(1, 0, 0, 1, args[0] || 0, args[1] || 0));
        break;
      case 'rotate':
        const angle = (args[0] || 0) * Math.PI / 180;
        const cx = args[1] || 0;
        const cy = args[2] || 0;
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        if (cx !== 0 || cy !== 0) {
          matrix = matrix.multiply(new Matrix(1, 0, 0, 1, cx, cy))
                         .multiply(new Matrix(cos, sin, -sin, cos, 0, 0))
                         .multiply(new Matrix(1, 0, 0, 1, -cx, -cy));
        } else {
          matrix = matrix.multiply(new Matrix(cos, sin, -sin, cos, 0, 0));
        }
        break;
      case 'scale':
        const sx = args[0] || 1;
        const sy = args[1] !== undefined ? args[1] : sx;
        matrix = matrix.multiply(new Matrix(sx, 0, 0, sy, 0, 0));
        break;
      case 'matrix':
        if (args.length === 6) {
          matrix = matrix.multiply(new Matrix(args[0], args[1], args[2], args[3], args[4], args[5]));
        }
        break;
    }
  }
  return matrix;
};

const transformPath = (d: string, matrix: Matrix): string => {
  const tokens = d.match(/[a-df-z]|[+-]?\d*\.?\d+(?:[eE][+-]?\d+)?/gi) || [];
  let result = '';
  let i = 0;
  let curX = 0, curY = 0;
  let startX = 0, startY = 0;
  let cmd = '';

  const fmt = (num: number) => parseFloat(num.toFixed(3)).toString();

  while (i < tokens.length) {
    const token = tokens[i];
    if (/[a-df-z]/i.test(token)) {
      cmd = token;
      i++;
    }

    const isRel = cmd === cmd.toLowerCase();
    const upperCmd = cmd.toUpperCase();

    switch (upperCmd) {
      case 'M': {
        let x = parseFloat(tokens[i++]), y = parseFloat(tokens[i++]);
        if (isRel) { x += curX; y += curY; }
        const p = matrix.apply(x, y);
        result += `M${fmt(p.x)},${fmt(p.y)} `;
        curX = x; curY = y;
        startX = x; startY = y;
        cmd = isRel ? 'l' : 'L';
        break;
      }
      case 'L': {
        let x = parseFloat(tokens[i++]), y = parseFloat(tokens[i++]);
        if (isRel) { x += curX; y += curY; }
        const p = matrix.apply(x, y);
        result += `L${fmt(p.x)},${fmt(p.y)} `;
        curX = x; curY = y;
        break;
      }
      case 'H': {
        let x = parseFloat(tokens[i++]);
        if (isRel) x += curX;
        const p = matrix.apply(x, curY);
        result += `L${fmt(p.x)},${fmt(p.y)} `;
        curX = x;
        break;
      }
      case 'V': {
        let y = parseFloat(tokens[i++]);
        if (isRel) y += curY;
        const p = matrix.apply(curX, y);
        result += `L${fmt(p.x)},${fmt(p.y)} `;
        curY = y;
        break;
      }
      case 'C': {
        let x1 = parseFloat(tokens[i++]), y1 = parseFloat(tokens[i++]);
        let x2 = parseFloat(tokens[i++]), y2 = parseFloat(tokens[i++]);
        let x = parseFloat(tokens[i++]), y = parseFloat(tokens[i++]);
        if (isRel) { x1 += curX; y1 += curY; x2 += curX; y2 += curY; x += curX; y += curY; }
        const p1 = matrix.apply(x1, y1), p2 = matrix.apply(x2, y2), p = matrix.apply(x, y);
        result += `C${fmt(p1.x)},${fmt(p1.y)} ${fmt(p2.x)},${fmt(p2.y)} ${fmt(p.x)},${fmt(p.y)} `;
        curX = x; curY = y;
        break;
      }
      case 'S': {
        let x2 = parseFloat(tokens[i++]), y2 = parseFloat(tokens[i++]);
        let x = parseFloat(tokens[i++]), y = parseFloat(tokens[i++]);
        if (isRel) { x2 += curX; y2 += curY; x += curX; y += curY; }
        const p2 = matrix.apply(x2, y2), p = matrix.apply(x, y);
        result += `S${fmt(p2.x)},${fmt(p2.y)} ${fmt(p.x)},${fmt(p.y)} `;
        curX = x; curY = y;
        break;
      }
      case 'Q': {
        let x1 = parseFloat(tokens[i++]), y1 = parseFloat(tokens[i++]);
        let x = parseFloat(tokens[i++]), y = parseFloat(tokens[i++]);
        if (isRel) { x1 += curX; y1 += curY; x += curX; y += curY; }
        const p1 = matrix.apply(x1, y1), p = matrix.apply(x, y);
        result += `Q${fmt(p1.x)},${fmt(p1.y)} ${fmt(p.x)},${fmt(p.y)} `;
        curX = x; curY = y;
        break;
      }
      case 'T': {
        let x = parseFloat(tokens[i++]), y = parseFloat(tokens[i++]);
        if (isRel) { x += curX; y += curY; }
        const p = matrix.apply(x, y);
        result += `T${fmt(p.x)},${fmt(p.y)} `;
        curX = x; curY = y;
        break;
      }
      case 'A': {
        let rx = parseFloat(tokens[i++]), ry = parseFloat(tokens[i++]);
        let xAxisRot = parseFloat(tokens[i++]);
        let largeArc = tokens[i++], sweep = tokens[i++];
        let x = parseFloat(tokens[i++]), y = parseFloat(tokens[i++]);
        if (isRel) { x += curX; y += curY; }
        const p = matrix.apply(x, y);
        const arc = matrix.applyToArc(rx, ry, xAxisRot);
        const det = matrix.a * matrix.d - matrix.b * matrix.c;
        const newSweep = det < 0 ? (sweep === '1' ? '0' : '1') : sweep;
        result += `A${fmt(arc.rx)},${fmt(arc.ry)} ${fmt(arc.rotation)} ${largeArc},${newSweep} ${fmt(p.x)},${fmt(p.y)} `;
        curX = x; curY = y;
        break;
      }
      case 'Z': {
        result += 'Z ';
        curX = startX; curY = startY;
        break;
      }
      default: i++;
    }
  }
  return result.trim();
};

const formatColor = (color: string | null): string => {
  if (!color || color === 'none' || color === 'transparent') return '#00000000';
  if (color.startsWith('rgba')) {
    const match = color.match(/rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)/);
    if (match) {
      const a = Math.round(parseFloat(match[4]) * 255).toString(16).padStart(2, '0');
      const r = parseInt(match[1]).toString(16).padStart(2, '0');
      const g = parseInt(match[2]).toString(16).padStart(2, '0');
      const b = parseInt(match[3]).toString(16).padStart(2, '0');
      return `#${a}${r}${g}${b}`;
    }
  }
  return color.toLowerCase();
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

  let xml = `<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="${svg.getAttribute('width')?.replace('px', '') || vbW}dp"
    android:height="${svg.getAttribute('height')?.replace('px', '') || vbH}dp"
    android:viewportWidth="${vbW}"
    android:viewportHeight="${vbH}">\n`;

  const processNode = (el: Element, currentMatrix: Matrix): string => {
    const opacity = el.getAttribute('opacity');
    if (opacity === '0') return ''; // Skip invisible elements

    const tag = el.tagName.toLowerCase();
    const nodeMatrix = currentMatrix.multiply(parseSvgTransform(el.getAttribute('transform')));
    const id = el.getAttribute('id') || el.getAttribute('data-name');
    
    if (tag === 'g') {
      return Array.from(el.children).map(child => processNode(child, nodeMatrix)).join('');
    }

    let pathData = '';
    if (tag === 'path') {
      pathData = el.getAttribute('d') || '';
    } else if (tag === 'rect') {
      const x = parseFloat(el.getAttribute('x') || '0'), y = parseFloat(el.getAttribute('y') || '0');
      const w = parseFloat(el.getAttribute('width') || '0'), h = parseFloat(el.getAttribute('height') || '0');
      pathData = `M${x},${y}h${w}v${h}h${-w}z`;
    } else if (tag === 'circle') {
      const cx = parseFloat(el.getAttribute('cx') || '0'), cy = parseFloat(el.getAttribute('cy') || '0'), r = parseFloat(el.getAttribute('r') || '0');
      pathData = `M${cx-r},${cy}a${r},${r} 0 1,0 ${r*2},0a${r},${r} 0 1,0 ${-r*2},0`;
    } else if (tag === 'polygon' || tag === 'polyline') {
      const pts = (el.getAttribute('points') || '').trim().split(/[ ,]+/).map(parseFloat);
      if (pts.length >= 4) {
        pathData = `M${pts[0]},${pts[1]}`;
        for (let i = 2; i < pts.length; i += 2) pathData += `L${pts[i]},${pts[i+1]}`;
        if (tag === 'polygon') pathData += 'Z';
      }
    }

    if (pathData) {
      const fillAttr = el.getAttribute('fill');
      const fill = formatColor(fillAttr || (el.getAttribute('stroke') ? 'none' : '#000000'));
      const stroke = formatColor(el.getAttribute('stroke') || 'none');
      const fillOpacity = el.getAttribute('fill-opacity');

      // Skip if completely transparent fill and no stroke
      if (fill === '#00000000' && stroke === '#00000000') return '';

      const flattenedData = transformPath(pathData, nodeMatrix);
      let pathXml = `  <path
      android:pathData="${flattenedData}"
      android:fillColor="${fill}"`;
      if (id) pathXml += `\n      android:name="${id}"`;
      if (stroke !== '#00000000') {
        pathXml += `\n      android:strokeColor="${stroke}"`;
        pathXml += `\n      android:strokeWidth="${el.getAttribute('stroke-width')?.replace('px', '') || '1'}"`;
      }
      if (fillOpacity !== null && fillOpacity !== '1') pathXml += `\n      android:fillAlpha="${fillOpacity}"`;
      if (opacity !== null && opacity !== '1') pathXml += `\n      android:alpha="${opacity}"`;
      pathXml += '/>\n';
      return pathXml;
    }
    return '';
  };

  Array.from(svg.children).forEach(child => {
    if (!['defs', 'style', 'title', 'desc', 'metadata'].includes(child.tagName.toLowerCase())) {
      xml += processNode(child, globalMatrix);
    }
  });

  xml += '</vector>';
  return xml;
};
