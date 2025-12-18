
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

interface GradientStop {
  offset: string;
  color: string;
  opacity?: string;
}

interface GradientData {
  id: string;
  type: 'linear' | 'radial';
  stops: GradientStop[];
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

const transformPath = (d: string, matrix: Matrix): { pathData: string, bbox: { minX: number, minY: number, maxX: number, maxY: number } } => {
  const tokens = d.match(/[a-df-z]|[+-]?\d*\.?\d+(?:[eE][+-]?\d+)?/gi) || [];
  let result = ''; let i = 0; let curX = 0, curY = 0; let startX = 0, startY = 0; let cmd = '';
  const fmt = (num: number) => parseFloat(num.toFixed(3)).toString();
  
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const updateBBox = (x: number, y: number) => {
    const p = matrix.apply(x, y);
    minX = Math.min(minX, p.x); minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y);
  };

  while (i < tokens.length) {
    const token = tokens[i];
    if (/[a-df-z]/i.test(token)) { cmd = token; i++; }
    const isRel = cmd === cmd.toLowerCase();
    const upperCmd = cmd.toUpperCase();
    
    switch (upperCmd) {
      case 'M': {
        if (i + 1 >= tokens.length) { i = tokens.length; break; }
        let x = parseFloat(tokens[i++]), y = parseFloat(tokens[i++]);
        if (isRel) { x += curX; y += curY; }
        const p = matrix.apply(x, y); result += `M${fmt(p.x)},${fmt(p.y)}`;
        updateBBox(x, y); curX = x; curY = y; startX = x; startY = y; cmd = isRel ? 'l' : 'L';
        break;
      }
      case 'L': {
        if (i + 1 >= tokens.length) { i = tokens.length; break; }
        let x = parseFloat(tokens[i++]), y = parseFloat(tokens[i++]);
        if (isRel) { x += curX; y += curY; }
        const p = matrix.apply(x, y); result += `L${fmt(p.x)},${fmt(p.y)}`;
        updateBBox(x, y); curX = x; curY = y;
        break;
      }
      case 'H': {
        if (i >= tokens.length) { i = tokens.length; break; }
        let x = parseFloat(tokens[i++]);
        if (isRel) { x += curX; }
        const p = matrix.apply(x, curY); result += `L${fmt(p.x)},${fmt(p.y)}`;
        updateBBox(x, curY); curX = x;
        break;
      }
      case 'V': {
        if (i >= tokens.length) { i = tokens.length; break; }
        let y = parseFloat(tokens[i++]);
        if (isRel) { y += curY; }
        const p = matrix.apply(curX, y); result += `L${fmt(p.x)},${fmt(p.y)}`;
        updateBBox(curX, y); curY = y;
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
        break;
      }
      case 'Z': result += 'Z'; curX = startX; curY = startY; break;
      default: i++;
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
      units: (g.getAttribute('gradientUnits') as any) || 'objectBoundingBox',
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

  Object.keys(gradients).forEach(id => {
    let current = gradients[id];
    let visited = new Set([id]);
    while (current.href && gradients[current.href]) {
      if (visited.has(current.href)) break; 
      const parent = gradients[current.href];
      if (current.stops.length === 0) current.stops = [...parent.stops];
      if (current.type === 'linear') {
        if (current.x1 === undefined) current.x1 = parent.x1;
        if (current.y1 === undefined) current.y1 = parent.y1;
        if (current.x2 === undefined) current.x2 = parent.x2;
        if (current.y2 === undefined) current.y2 = parent.y2;
      } else {
        if (current.cx === undefined) current.cx = parent.cx;
        if (current.cy === undefined) current.cy = parent.cy;
        if (current.r === undefined) current.r = parent.r;
      }
      visited.add(current.href);
      current = parent;
    }
  });

  let xml = `<vector xmlns:android="http://schemas.android.com/apk/res/android"\n    xmlns:aapt="http://schemas.android.com/aapt"\n    android:width="${svg.getAttribute('width')?.replace('px', '') || vbW}dp"\n    android:height="${svg.getAttribute('height')?.replace('px', '') || vbH}dp"\n    android:viewportWidth="${vbW}"\n    android:viewportHeight="${vbH}">\n`;

  const processNode = (el: Element, currentMatrix: Matrix): string => {
    if (el.getAttribute('opacity') === '0' || el.getAttribute('display') === 'none') return '';
    const tag = el.tagName.toLowerCase();
    
    const elClass = el.getAttribute('class');
    const mergedStyles: Record<string, string> = {};
    if (elClass && classStyles[elClass]) Object.assign(mergedStyles, classStyles[elClass]);
    Array.from(el.attributes).forEach(attr => mergedStyles[attr.name] = attr.value);

    const transform = mergedStyles['transform'];
    const nodeMatrix = currentMatrix.multiply(parseSvgTransform(transform));
    
    if (tag === 'g') {
      return Array.from(el.children).map(child => processNode(child, nodeMatrix)).join('');
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
    }

    if (d) {
      const res = transformPath(d, nodeMatrix);
      if (!res.pathData) return '';
      const { pathData, bbox } = res;
      const fill = mergedStyles['fill'];
      const fillOpacity = mergedStyles['fill-opacity'] || mergedStyles['opacity'] || '1';
      const stroke = mergedStyles['stroke'];
      const strokeWidth = mergedStyles['stroke-width'];
      const strokeOpacity = mergedStyles['stroke-opacity'] || mergedStyles['opacity'] || '1';
      
      let pathXml = `  <path\n      android:pathData="${pathData}"`;
      const isGradient = fill?.startsWith('url(#');
      
      if (isGradient) {
        const gradId = fill!.substring(5, fill!.length - 1);
        const grad = gradients[gradId];
        if (grad) {
          if (fillOpacity !== '1') pathXml += `\n      android:fillAlpha="${fillOpacity}"`;
          pathXml += `>\n    <aapt:attr name="android:fillColor">\n      <gradient`;
          
          const parseCoord = (val: string | undefined, size: number, min: number, def: string) => {
            const v = val ?? def;
            if (v.endsWith('%')) return min + (parseFloat(v) / 100) * size;
            const num = parseFloat(v);
            if (grad.units === 'objectBoundingBox') return min + num * size;
            // For userSpaceOnUse, we still need to apply globalMatrix offset (vbX, vbY)
            return num + (size === 0 ? 0 : 0); // Logic: userSpace is absolute but relative to viewBox origin
          };

          const applyGlobal = (val: number, isX: boolean) => val + (isX ? globalMatrix.e : globalMatrix.f);

          if (grad.type === 'linear') {
            const w = isFinite(bbox.maxX) ? bbox.maxX - bbox.minX : 0;
            const h = isFinite(bbox.maxY) ? bbox.maxY - bbox.minY : 0;
            let x1 = parseCoord(grad.x1, w, bbox.minX, '0');
            let y1 = parseCoord(grad.y1, h, bbox.minY, '0');
            let x2 = parseCoord(grad.x2, w, bbox.minX, '1');
            let y2 = parseCoord(grad.y2, h, bbox.minY, '0');

            if (grad.units === 'userSpaceOnUse') {
               x1 = applyGlobal(x1, true); y1 = applyGlobal(y1, false);
               x2 = applyGlobal(x2, true); y2 = applyGlobal(y2, false);
            }
            pathXml += ` \n          android:startX="${x1.toFixed(3)}"\n          android:startY="${y1.toFixed(3)}"\n          android:endX="${x2.toFixed(3)}"\n          android:endY="${y2.toFixed(3)}"\n          android:type="linear">`;
          } else {
            const w = isFinite(bbox.maxX) ? bbox.maxX - bbox.minX : 0;
            const h = isFinite(bbox.maxY) ? bbox.maxY - bbox.minY : 0;
            let cx = parseCoord(grad.cx, w, bbox.minX, '0.5');
            let cy = parseCoord(grad.cy, h, bbox.minY, '0.5');
            let r = parseCoord(grad.r, Math.sqrt(w*w + h*h), 0, '0.5');

            if (grad.units === 'userSpaceOnUse') {
               cx = applyGlobal(cx, true); cy = applyGlobal(cy, false);
            }
            pathXml += ` \n          android:centerX="${cx.toFixed(3)}"\n          android:centerY="${cy.toFixed(3)}"\n          android:gradientRadius="${r.toFixed(3)}"\n          android:type="radial">`;
          }
          grad.stops.forEach(s => {
            const offset = s.offset.includes('%') ? parseFloat(s.offset) / 100 : parseFloat(s.offset);
            pathXml += `\n        <item android:offset="${offset}" android:color="${parseColor(s.color, s.opacity)}"/>`;
          });
          pathXml += `\n      </gradient>\n    </aapt:attr>\n  </path>\n`;
        } else {
           pathXml += `\n      android:fillColor="#000000"/>\n`;
        }
      } else {
        pathXml += `\n      android:fillColor="${parseColor(fill || '#000000', fillOpacity)}"`;
        if (stroke && stroke !== 'none') {
          pathXml += `\n      android:strokeColor="${parseColor(stroke, strokeOpacity)}"`;
          if (strokeWidth) pathXml += `\n      android:strokeWidth="${strokeWidth}"`;
        }
        pathXml += `/>\n`;
      }
      return pathXml;
    }
    return '';
  };

  Array.from(svg.children).forEach(child => { 
    if (!['defs', 'style', 'metadata'].includes(child.tagName.toLowerCase())) {
      xml += processNode(child, globalMatrix); 
    }
  });

  return xml + '</vector>';
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
    val units: String = "objectBoundingBox",
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
    private val tokenRegex = Regex("[a-df-z]|[+-]?\\\\d*\\\\.?\\\\d+(?:[eE][+-]?\\\\d+)?", RegexOption.IGNORE_CASE)
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
        res.append("    android:width=\\"\${vbW}dp\\" android:height=\\"\${vbH}dp\\"\\n")
        res.append("    android:viewportWidth=\\"\${vbW}\\" android:viewportHeight=\\"\${vbH}\\">\\n")

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
                        if (off.endsWith("%")) off.removeSuffix("%").toDouble() / 100.0 else off.toDouble(),
                        it.getAttribute("stop-color") ?: "#000",
                        it.getAttribute("stop-opacity")?.toDoubleOrNull() ?: 1.0
                    )
                }
                gradients[id] = GradientData(id, if (node.tagName == "linearGradient") "linear" else "radial", stops, node.attributes, 
                    node.getAttribute("gradientUnits") ?: "objectBoundingBox", 
                    (node.getAttribute("xlink:href") ?: node.getAttribute("href"))?.removePrefix("#"))
            }
        }
        node.children.forEach { if (it is SvgNode) analyzeDefinitions(it) }
    }

    private fun resolveGradients() {
        gradients.keys.forEach { id ->
            var curr = gradients[id]!!; val seen = mutableSetOf(id)
            while (curr.href != null && gradients.containsKey(curr.href)) {
                if (seen.contains(curr.href)) break; val parent = gradients[curr.href]!!
                gradients[id] = curr.copy(stops = if (curr.stops.isEmpty()) parent.stops else curr.stops, coords = parent.coords + curr.coords)
                seen.add(curr.href!!); curr = parent
            }
        }
    }

    private fun processNode(node: SvgNode, matrix: Matrix, res: StringBuilder, globalMatrix: Matrix) {
        val styles = mutableMapOf<String, String>()
        node.getAttribute("class")?.let { classStyles[it]?.let { s -> styles.putAll(s) } }
        styles.putAll(node.attributes)

        if (styles["opacity"] == "0" || styles["display"] == "none") return
        val nodeMatrix = matrix.multiply(parseTransform(styles["transform"]))
        
        when (val tag = node.tagName.lowercase()) {
            "g" -> node.children.forEach { if (it is SvgNode) processNode(it, nodeMatrix, res, globalMatrix) }
            "path", "rect", "circle" -> {
                val d = when(tag) {
                    "path" -> styles["d"] ?: ""
                    "rect" -> {
                        val x = styles["x"]?.toDouble() ?: 0.0; val y = styles["y"]?.toDouble() ?: 0.0
                        val w = styles["width"]?.toDouble() ?: 0.0; val h = styles["height"]?.toDouble() ?: 0.0
                        val rx = styles["rx"]?.toDouble() ?: 0.0; val ry = styles["ry"]?.toDouble() ?: rx
                        if (rx == 0.0) "M\$x,\$y h\$w v\$h h-\$w z"
                        else "M\${x+rx},\$y L\${x+w-rx},\$y A\$rx,\$ry 0 0 1 \${x+w},\${y+ry} L\${x+w},\${y+h-ry} A\$rx,\$ry 0 0 1 \${x+w-rx},\${y+h} L\${x+rx},\$y+h A\$rx,\$ry 0 0 1 \$x,\${y+h-ry} L\$x,\${y+ry} A\$rx,\$ry 0 0 1 \${x+rx},\$y z"
                    }
                    else -> { // circle
                        val cx = styles["cx"]?.toDouble() ?: 0.0; val cy = styles["cy"]?.toDouble() ?: 0.0; val r = styles["r"]?.toDouble() ?: 0.0
                        "M\${cx-r},\$cy a\$r,\$r 0 1,0 \${r*2},0 a\$r,\$r 0 1,0 \${-r*2},0"
                    }
                }
                appendPath(d, styles, nodeMatrix, res, globalMatrix)
            }
        }
    }

    private fun appendPath(d: String, styles: Map<String, String>, matrix: Matrix, res: StringBuilder, globalMatrix: Matrix) {
        val (pathData, bbox) = flattenPath(d, matrix)
        if (pathData.isEmpty()) return
        val fill = styles["fill"] ?: "#000000"; val fillAlpha = styles["fill-opacity"] ?: styles["opacity"] ?: "1.0"
        res.append("  <path android:pathData=\\"\${pathData}\\"")
        
        if (fill.startsWith("url(#")) {
            val gradId = fill.substring(5, fill.length - 1); val grad = gradients[gradId]
            if (grad != null) {
                if (fillAlpha != "1.0") res.append(" android:fillAlpha=\\"\${fillAlpha}\\"")
                res.append(">\\n    <aapt:attr name=\\"android:fillColor\\">\\n      <gradient ")
                val w = bbox.maxX - bbox.minX; val h = bbox.maxY - bbox.minY
                fun resolve(k: String, size: Double, min: Double, def: String): Double {
                    val v = grad.coords[k] ?: def
                    return if (v.endsWith("%")) min + (v.removeSuffix("%").toDouble() / 100.0) * size
                    else if (grad.units == "objectBoundingBox") min + v.toDouble() * size
                    else v.toDouble()
                }
                if (grad.type == "linear") {
                    var x1 = resolve("x1", w, bbox.minX, "0"); var y1 = resolve("y1", h, bbox.minY, "0")
                    var x2 = resolve("x2", w, bbox.minX, "1"); var y2 = resolve("y2", h, bbox.minY, "0")
                    if (grad.units == "userSpaceOnUse") {
                        x1 += globalMatrix.e; y1 += globalMatrix.f; x2 += globalMatrix.e; y2 += globalMatrix.f
                    }
                    res.append("android:startX=\\"\${x1}\\" android:startY=\\"\${y1}\\" android:endX=\\"\${x2}\\" android:endY=\\"\${y2}\\" android:type=\\"linear\\">\\n")
                } else {
                    var cx = resolve("cx", w, bbox.minX, "0.5"); var cy = resolve("cy", h, bbox.minY, "0.5"); val r = resolve("r", sqrt(w*w + h*h), 0.0, "0.5")
                    if (grad.units == "userSpaceOnUse") {
                        cx += globalMatrix.e; cy += globalMatrix.f
                    }
                    res.append("android:centerX=\\"\${cx}\\" android:centerY=\\"\${cy}\\" android:gradientRadius=\\"\${r}\\" android:type=\\"radial\\">\\n")
                }
                grad.stops.forEach { res.append("        <item android:offset=\\"\${it.offset}\\" android:color=\\"\${parseColor(it.color, it.opacity)}\\"/>\\n") }
                res.append("      </gradient>\\n    </aapt:attr>\\n  </path>\\n")
                return
            }
        }
        res.append(" android:fillColor=\\"\${parseColor(fill, fillAlpha.toDouble())}\\"/>\\n")
    }

    private fun parseColor(color: String, opacity: Double): String {
        var c = color.removePrefix("#").uppercase()
        if (c.length == 3) c = "" + c[0] + c[0] + c[1] + c[1] + c[2] + c[2]
        val alpha = (opacity * 255).toInt().toString(16).padStart(2, '0').uppercase()
        return "#" + alpha + (if (c.length == 6) c else "000000")
    }

    private fun parseTransform(s: String?): Matrix {
        if (s.isNullOrEmpty()) return Matrix()
        var m = Matrix()
        transformRegex.findAll(s).forEach { match ->
            val type = match.groupValues[1]; val args = match.groupValues[2].split(Regex("[ ,]+")).filter { it.isNotEmpty() }.map { it.toDouble() }
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
        fun update(x: Double, y: Double) { val p = matrix.apply(x, y); minX = min(minX, p.first); minY = min(minY, p.second); maxX = max(maxX, p.first); maxY = max(maxY, p.second) }
        while (i < tokens.size) {
            val token = tokens[i]; if (token[0].isLetter()) { cmd = token; i++ }; val isRel = cmd[0].isLowerCase()
            when (cmd.uppercase()) {
                "M" -> { if (i + 1 >= tokens.size) break; var x = tokens[i++].toDouble(); var y = tokens[i++].toDouble(); if (isRel) { x += curX; y += curY }; val p = matrix.apply(x, y); res.append("M\${p.first},\${p.second} "); curX = x; curY = y; startX = x; startY = y; update(x, y); cmd = if (isRel) "l" else "L" }
                "L" -> { if (i + 1 >= tokens.size) break; var x = tokens[i++].toDouble(); var y = tokens[i++].toDouble(); if (isRel) { x += curX; y += curY }; val p = matrix.apply(x, y); res.append("L\${p.first},\${p.second} "); curX = x; curY = y; update(x, y) }
                "H" -> { if (i >= tokens.size) break; var x = tokens[i++].toDouble(); if (isRel) x += curX; val p = matrix.apply(x, curY); res.append("L\${p.first},\${p.second} "); curX = x; update(x, curY) }
                "V" -> { if (i >= tokens.size) break; var y = tokens[i++].toDouble(); if (isRel) y += curY; val p = matrix.apply(curX, y); res.append("L\${p.first},\${p.second} "); curY = y; update(curX, y) }
                "Q" -> { if (i + 3 >= tokens.size) break; var x1 = tokens[i++].toDouble(); var y1 = tokens[i++].toDouble(); var x = tokens[i++].toDouble(); var y = tokens[i++].toDouble(); if (isRel) { x1 += curX; y1 += curY; x += curX; y += curY }; val p1 = matrix.apply(x1, y1); val p = matrix.apply(x, y); res.append("Q\${p1.first},\${p1.second} \${p.first},\${p.second} "); curX = x; curY = y; update(x1, y1); update(x, y) }
                "A" -> { 
                    if (i + 6 >= tokens.size) break; val rx = tokens[i++].toDouble(); val ry = tokens[i++].toDouble(); val rot = tokens[i++].toDouble(); val laf = tokens[i++]; val swf = tokens[i++]
                    var x = tokens[i++].toDouble(); var y = tokens[i++].toDouble(); if (isRel) { x += curX; y += curY }; val p = matrix.apply(x, y); val arc = matrix.applyToArc(rx, ry, rot)
                    val nswf = if ((matrix.a * matrix.d - matrix.b * matrix.c) < 0) (if (swf == "1") "0" else "1") else swf
                    res.append("A\${arc.first},\${arc.second} \${arc.third} \$laf,\$nswf \${p.first},\${p.second} "); curX = x; curY = y; update(x, y)
                }
                "Z" -> { res.append("Z "); curX = startX; curY = startY }
                else -> i++
            }
        }
        return Pair(res.toString().trim(), BBox(minX, minY, maxX, maxY))
    }

    private fun createDocument(xml: String): SvgNode {
        val reader = XmlStreaming.newReader(xml); val stack = mutableListOf<SvgElement>(); var root: SvgElement? = null
        while (reader.hasNext()) {
            when (reader.next()) {
                EventType.START_ELEMENT -> {
                    val attrs = (0 until reader.attributeCount).associate { reader.getAttributeLocalName(it) to reader.getAttributeValue(it) }
                    val el = SvgElement(reader.localName, attrs); if (stack.isEmpty()) root = el else (stack.last().children as MutableList<Any>).add(el)
                    stack.add(el)
                }
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
