
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

const transformPath = (d: string, matrix: Matrix): string => {
  const tokens = d.match(/[a-df-z]|[+-]?\d*\.?\d+(?:[eE][+-]?\d+)?/gi) || [];
  let result = ''; let i = 0; let curX = 0, curY = 0; let startX = 0, startY = 0; let cmd = '';
  const fmt = (num: number) => parseFloat(num.toFixed(3)).toString();
  while (i < tokens.length) {
    const token = tokens[i];
    if (/[a-df-z]/i.test(token)) { cmd = token; i++; }
    const isRel = cmd === cmd.toLowerCase();
    const upperCmd = cmd.toUpperCase();
    switch (upperCmd) {
      case 'M': {
        let x = parseFloat(tokens[i++]), y = parseFloat(tokens[i++]);
        if (isRel) { x += curX; y += curY; }
        const p = matrix.apply(x, y); result += `M${fmt(p.x)},${fmt(p.y)} `;
        curX = x; curY = y; startX = x; startY = y; cmd = isRel ? 'l' : 'L';
        break;
      }
      case 'L': {
        let x = parseFloat(tokens[i++]), y = parseFloat(tokens[i++]);
        if (isRel) { x += curX; y += curY; }
        const p = matrix.apply(x, y); result += `L${fmt(p.x)},${fmt(p.y)} `;
        curX = x; curY = y;
        break;
      }
      case 'A': {
        let rx = parseFloat(tokens[i++]), ry = parseFloat(tokens[i++]), rot = parseFloat(tokens[i++]), laf = tokens[i++], swf = tokens[i++], x = parseFloat(tokens[i++]), y = parseFloat(tokens[i++]);
        if (isRel) { x += curX; y += curY; }
        const p = matrix.apply(x, y); const arc = matrix.applyToArc(rx, ry, rot);
        const newSwf = (matrix.a * matrix.d - matrix.b * matrix.c) < 0 ? (swf === '1' ? '0' : '1') : swf;
        result += `A${fmt(arc.rx)},${fmt(arc.ry)} ${fmt(arc.rotation)} ${laf},${newSwf} ${fmt(p.x)},${fmt(p.y)} `;
        curX = x; curY = y;
        break;
      }
      case 'Z': result += 'Z '; curX = startX; curY = startY; break;
      default: i++;
    }
  }
  return result.trim();
};

export const svgToAndroidXml = (svgString: string): string => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgString, 'image/svg+xml');
  const svg = doc.querySelector('svg');
  if (!svg) throw new Error('Invalid SVG');
  const viewBoxStr = svg.getAttribute('viewBox') || `0 0 ${svg.getAttribute('width') || 24} ${svg.getAttribute('height') || 24}`;
  const viewBox = viewBoxStr.split(/[ ,]+/).map(Number);
  const vbW = viewBox[2] || 24; const vbH = viewBox[3] || 24;
  const globalMatrix = new Matrix(1, 0, 0, 1, -(viewBox[0] || 0), -(viewBox[1] || 0));
  let xml = `<vector xmlns:android="http://schemas.android.com/apk/res/android"\n    android:width="${svg.getAttribute('width')?.replace('px', '') || vbW}dp"\n    android:height="${svg.getAttribute('height')?.replace('px', '') || vbH}dp"\n    android:viewportWidth="${vbW}"\n    android:viewportHeight="${vbH}">\n`;
  const processNode = (el: Element, currentMatrix: Matrix): string => {
    if (el.getAttribute('opacity') === '0') return '';
    const tag = el.tagName.toLowerCase();
    const nodeMatrix = currentMatrix.multiply(parseSvgTransform(el.getAttribute('transform')));
    if (tag === 'g') return Array.from(el.children).map(child => processNode(child, nodeMatrix)).join('');
    let d = '';
    if (tag === 'path') d = el.getAttribute('d') || '';
    else if (tag === 'rect') {
      const x = parseFloat(el.getAttribute('x') || '0'), y = parseFloat(el.getAttribute('y') || '0'), w = parseFloat(el.getAttribute('width') || '0'), h = parseFloat(el.getAttribute('height') || '0');
      d = `M${x},${y}h${w}v${h}h${-w}z`;
    }
    if (d) {
      const flattenedData = transformPath(d, nodeMatrix);
      return `  <path\n      android:pathData="${flattenedData}"\n      android:fillColor="${el.getAttribute('fill') || '#000000'}"/>\n`;
    }
    return '';
  };
  Array.from(svg.children).forEach(child => { if (!['defs', 'style'].includes(child.tagName.toLowerCase())) xml += processNode(child, globalMatrix); });
  return xml + '</vector>';
};

export const getKotlinConverterLogic = (): string => {
  return `import kotlin.math.*
import net.devrieze.xmlutil.XmlStreaming
import net.devrieze.xmlutil.EventType

/**
 * KMP Compatible SVG to Android VectorDrawable XML Converter Logic.
 */

interface SvgNode {
    val tagName: String
    val attributes: Map<String, String>
    val children: List<SvgNode>
    fun getAttribute(name: String): String? = attributes[name]
}

data class SvgElement(
    override val tagName: String,
    override val attributes: Map<String, String>,
    override val children: MutableList<SvgNode> = mutableListOf()
) : SvgNode

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

    fun apply(x: Double, y: Double): Pair<Double, Double> =
        Pair(x * a + y * c + e, x * b + y * d + f)

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

    fun convert(svgString: String): String {
        val root = createDocument(svgString)
        val viewBoxAttr = root.getAttribute("viewBox") ?: "0 0 24 24"
        val vb = viewBoxAttr.split(Regex("[ ,]+")).map { it.toDoubleOrNull() ?: 0.0 }
        val vbW = vb.getOrElse(2) { 24.0 }
        val vbH = vb.getOrElse(3) { 24.0 }
        val vbX = vb.getOrElse(0) { 0.0 }
        val vbY = vb.getOrElse(1) { 0.0 }

        val globalMatrix = Matrix(e = -vbX, f = -vbY)
        val result = StringBuilder()
        result.append("<vector xmlns:android=\\"http://schemas.android.com/apk/res/android\\"\\n")
        result.append("    android:width=\\"\${vbW}dp\\"\\n")
        result.append("    android:height=\\"\${vbH}dp\\"\\n")
        result.append("    android:viewportWidth=\\"\${vbW}\\"\\n")
        result.append("    android:viewportHeight=\\"\${vbH}\\">\\n")

        root.children.forEach { processNode(it, globalMatrix, result) }

        result.append("</vector>")
        return result.toString()
    }

    private fun processNode(node: SvgNode, currentMatrix: Matrix, result: StringBuilder) {
        if (node.getAttribute("opacity") == "0") return
        val tag = node.tagName.lowercase()
        val nodeMatrix = currentMatrix.multiply(parseTransform(node.getAttribute("transform")))

        when (tag) {
            "g" -> node.children.forEach { processNode(it, nodeMatrix, result) }
            "path" -> appendPath(node.getAttribute("d") ?: "", node, nodeMatrix, result)
            "rect" -> {
                val x = node.getAttribute("x")?.toDoubleOrNull() ?: 0.0
                val y = node.getAttribute("y")?.toDoubleOrNull() ?: 0.0
                val w = node.getAttribute("width")?.toDoubleOrNull() ?: 0.0
                val h = node.getAttribute("height")?.toDoubleOrNull() ?: 0.0
                appendPath("M\$x,\$y h\$w v\$h h-\$w z", node, nodeMatrix, result)
            }
            "circle" -> {
                val cx = node.getAttribute("cx")?.toDoubleOrNull() ?: 0.0
                val cy = node.getAttribute("cy")?.toDoubleOrNull() ?: 0.0
                val r = node.getAttribute("r")?.toDoubleOrNull() ?: 0.0
                appendPath("M\${cx-r},\$cy a\$r,\$r 0 1,0 \${r*2},0 a\$r,\$r 0 1,0 \${-r*2},0", node, nodeMatrix, result)
            }
        }
    }

    private fun appendPath(d: String, node: SvgNode, matrix: Matrix, result: StringBuilder) {
        val flattened = flattenPath(d, matrix)
        val fill = node.getAttribute("fill") ?: "#000000"
        result.append("  <path android:pathData=\\"\${flattened}\\" android:fillColor=\\"\${fill}\\"/>\\n")
    }

    private fun parseTransform(transformStr: String?): Matrix {
        if (transformStr.isNullOrEmpty()) return Matrix()
        var m = Matrix()
        transformRegex.findAll(transformStr).forEach { match ->
            val type = match.groupValues[1]
            val args = match.groupValues[2].split(Regex("[ ,]+")).filter { it.isNotEmpty() }.map { it.toDouble() }
            when (type) {
                "translate" -> m = m.multiply(Matrix(e = args.getOrElse(0) { 0.0 }, f = args.getOrElse(1) { 0.0 }))
                "rotate" -> {
                    val angle = (args.getOrNull(0) ?: 0.0) * PI / 180.0
                    val cosA = cos(angle); val sinA = sin(angle)
                    m = m.multiply(Matrix(a = cosA, b = sinA, c = -sinA, d = cosA))
                }
                "scale" -> m = m.multiply(Matrix(a = args.getOrElse(0) { 1.0 }, d = args.getOrElse(1) { args.getOrElse(0) { 1.0 } }))
            }
        }
        return m
    }

    private fun flattenPath(d: String, matrix: Matrix): String {
        val tokens = tokenRegex.findAll(d).map { it.value }.toList()
        var i = 0; var curX = 0.0; var curY = 0.0; var startX = 0.0; var startY = 0.0
        var cmd = ""; val res = StringBuilder()
        
        fun fmt(v: Double) = String.format("%.3f", v)

        while (i < tokens.size) {
            val token = tokens[i]
            if (token[0].isLetter()) { cmd = token; i++ }
            val isRel = cmd[0].isLowerCase()
            when (cmd.uppercase()) {
                "M" -> {
                    if (i + 1 >= tokens.size) { i++; return@when }
                    var x = tokens[i++].toDouble(); var y = tokens[i++].toDouble()
                    if (isRel) { x += curX; y += curY }; val p = matrix.apply(x, y)
                    res.append("M\${fmt(p.first)},\${fmt(p.second)} "); curX = x; curY = y; startX = x; startY = y; cmd = if (isRel) "l" else "L"
                }
                "L" -> {
                    if (i + 1 >= tokens.size) { i++; return@when }
                    var x = tokens[i++].toDouble(); var y = tokens[i++].toDouble()
                    if (isRel) { x += curX; y += curY }; val p = matrix.apply(x, y)
                    res.append("L\${fmt(p.first)},\${fmt(p.second)} "); curX = x; curY = y
                }
                "H" -> {
                    if (i >= tokens.size) { i++; return@when }
                    var x = tokens[i++].toDouble(); if (isRel) x += curX; val p = matrix.apply(x, curY)
                    res.append("L\${fmt(p.first)},\${fmt(p.second)} "); curX = x
                }
                "V" -> {
                    if (i >= tokens.size) { i++; return@when }
                    var y = tokens[i++].toDouble(); if (isRel) y += curY; val p = matrix.apply(curX, y)
                    res.append("L\${fmt(p.first)},\${fmt(p.second)} "); curY = y
                }
                "A" -> {
                    if (i + 6 >= tokens.size) { i = tokens.size; return@when }
                    val rx = tokens[i++].toDouble(); val ry = tokens[i++].toDouble()
                    val rot = tokens[i++].toDouble(); val laf = tokens[i++]; val swf = tokens[i++]
                    var x = tokens[i++].toDouble(); var y = tokens[i++].toDouble()
                    if (isRel) { x += curX; y += curY }; val p = matrix.apply(x, y)
                    val arc = matrix.applyToArc(rx, ry, rot)
                    val det = matrix.a * matrix.d - matrix.b * matrix.c
                    val newSwf = if (det < 0) (if (swf == "1") "0" else "1") else swf
                    res.append("A\${fmt(arc.first)},\${fmt(arc.second)} \${fmt(arc.third)} \$laf,\$newSwf \${fmt(p.first)},\${fmt(p.second)} ")
                    curX = x; curY = y
                }
                "Z" -> { 
                    res.append("Z ")
                    curX = startX; curY = startY
                    // Ensure we don't loop if there are unexpected parameters after Z
                    if (i < tokens.size && !tokens[i][0].isLetter()) i++
                }
                else -> { i++ } // CRITICAL: Skip unhandled tokens to prevent infinite loop
            }
        }
        return res.toString().trim()
    }

    private fun createDocument(xml: String): SvgNode {
        val reader = XmlStreaming.newReader(xml)
        val stack = mutableListOf<SvgElement>()
        var root: SvgElement? = null

        while (reader.hasNext()) {
            when (reader.next()) {
                EventType.START_ELEMENT -> {
                    val attrs = mutableMapOf<String, String>()
                    for (k in 0 until reader.attributeCount) {
                        attrs[reader.getAttributeLocalName(k)] = reader.getAttributeValue(k)
                    }
                    val el = SvgElement(reader.localName, attrs)
                    if (stack.isEmpty()) root = el else stack.last().children.add(el)
                    stack.add(el)
                }
                EventType.END_ELEMENT -> if (stack.isNotEmpty()) stack.removeAt(stack.size - 1)
                else -> {}
            }
        }
        return root ?: throw IllegalArgumentException("Invalid SVG XML")
    }
}
`;
};
