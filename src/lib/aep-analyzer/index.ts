// ─── AEP Binary Analyzer ────────────────────────────────
// Reads an After Effects Project (.aep) binary buffer and extracts
// compositions, controllers, effects, footage items, and fonts
// using string-scanning heuristics on the RIFX binary format.

// ─── Types ──────────────────────────────────────────────

export interface AepComposition {
  name: string;
}

export interface AepEffect {
  name: string;
  type: "Slider" | "Checkbox" | string;
}

export interface AepController {
  layerName: string;
  effects: AepEffect[];
}

export interface AepFootageItem {
  name: string;
  folderPath: string;
}

export interface AepAnalysis {
  compositions: AepComposition[];
  controllers: AepController[];
  footageItems: AepFootageItem[];
  fonts: string[];
}

// ─── Known Effect Patterns ──────────────────────────────

const EFFECT_PATTERNS: { pattern: string; type: AepEffect["type"] }[] = [
  { pattern: "Slider Control", type: "Slider" },
  { pattern: "Checkbox Control", type: "Checkbox" },
  { pattern: "Color Control", type: "Color" },
  { pattern: "Point Control", type: "Point" },
  { pattern: "Layer Control", type: "Layer" },
  { pattern: "Angle Control", type: "Angle" },
  { pattern: "Dropdown Menu Control", type: "Dropdown" },
];

// Known AE built-in effect names that appear in binary data.
// These are used to associate effects with nearby controller layers.
const KNOWN_EFFECT_NAMES = [
  "Fill",
  "Fast Box Blur",
  "Set Matte",
  "Gaussian Blur",
  "Drop Shadow",
  "Stroke",
  "Glow",
  "Tint",
  "Levels",
  "Curves",
  "Hue/Saturation",
  "CC Composite",
  "Compositing Options",
];

// Common footage file extensions
const FOOTAGE_EXTENSIONS = [
  ".png",
  ".jpg",
  ".jpeg",
  ".psd",
  ".ai",
  ".tif",
  ".tiff",
  ".bmp",
  ".gif",
  ".mp4",
  ".mov",
  ".avi",
  ".wav",
  ".mp3",
  ".aif",
  ".svg",
  ".eps",
  ".pdf",
];

// ─── Internal AE Identifier Blacklist ───────────────────
// These are AE internal binary markers, chunk IDs, and effect type identifiers
// that should NEVER appear as user-visible names for controllers, effects, etc.

const INTERNAL_AE_PREFIXES = ["ADBE "];

const INTERNAL_AE_EXACT = new Set([
  "Utf8",
  "tdgp",
  "tdsn",
  "tdsb",
  "tdbs",
  "sspc",
  "CdHd",
  "cdta",
  "LIST",
  "RIFX",
  "RIFF",
  "CompH",
  "Layr",
  "LCmd",
  "fnam",
  "tdbf",
  "ldta",
  "idta",
  "lhd3",
  "ldat",
  "opti",
  "btdk",
  "NmHd",
  "CLst",
  "GCst",
  "GCky",
  "Fold",
  "Item",
  "StVS",
  "PPST",
  "ADBF",
  "ppSn",
  "pSiz",
  "alas",
  "foac",
  "tdum",
  "tdb4",
  "tdmn",
  "sfdt",
  "tdps",
  "ewin",
  "CPTm",
  "tdpi",
  "pgui",
  "pard",
  "parT",
  "Tparn",
  "tpar",
  "NmHd",
  "cdat",
  "cdat ",
]);

// Known binary suffixes that get appended to real strings in ASCII extraction.
// E.g., "controler domaciLIST" — the "LIST" is a RIFX chunk marker.
const BINARY_SUFFIXES = [
  "LIST",
  "Utf8",
  "tdum",
  "tdb4",
  "tdmn",
  "sfdt",
  "CPTm",
  "ldta",
  "sspc",
  "foac",
  "tdpi",
  "pgui",
  "tdsb",
  "tdsn",
  "tdgp",
  "tdps",
  "fnam",
  "ewin",
  "cdat",
];

// Known binary prefixes that get prepended to real strings.
const BINARY_PREFIXES = [
  "sspc",
  "fnam",
  "tdgp",
  "tdsn",
  "tpar",
  "Tparn",
];

/**
 * Clean a string by stripping known binary suffixes/prefixes that get
 * concatenated during ASCII extraction from binary data.
 */
function cleanBinaryArtifacts(s: string): string {
  let cleaned = s;
  // Strip known binary suffixes
  for (const suffix of BINARY_SUFFIXES) {
    if (cleaned.endsWith(suffix) && cleaned.length > suffix.length) {
      cleaned = cleaned.slice(0, -suffix.length);
    }
  }
  // Strip known binary prefixes
  for (const prefix of BINARY_PREFIXES) {
    if (cleaned.startsWith(prefix) && cleaned.length > prefix.length) {
      cleaned = cleaned.slice(prefix.length);
    }
  }
  return cleaned.trim();
}

/**
 * Check if a string is an internal AE identifier that should not be shown
 * as a user-visible name.
 */
function isInternalString(s: string): boolean {
  const trimmed = s.trim();
  // Too short to be a meaningful name
  if (trimmed.length < 3) return true;
  // Exact match against known internal identifiers
  if (INTERNAL_AE_EXACT.has(trimmed)) return true;
  // Starts with known internal prefix
  if (INTERNAL_AE_PREFIXES.some((p) => trimmed.startsWith(p))) return true;
  // Starts with "(" followed by internal prefix (e.g., "(ADBE")
  if (trimmed.startsWith("(") && INTERNAL_AE_PREFIXES.some((p) => trimmed.slice(1).startsWith(p))) return true;
  // Concatenation of internal markers (e.g., "sspcfnam", "8sspcfnam", "jsspcfnam")
  if (/^.{0,2}sspc/.test(trimmed) || /^.{0,2}fnam/.test(trimmed)) return true;
  // Strings that are concatenations of binary markers (e.g., "tparTparn", "parTparn")
  if (/^(par[dT]|tpar|Tparn)+/.test(trimmed) && trimmed.length < 15) return true;
  // Path-like garbage from binary: e.g., "-_0_/-tdmn"
  if (/^[-_0-9./]+$/.test(trimmed.replace(/[a-z]{3,4}$/, ""))) return true;
  // All-uppercase 4-char codes are likely chunk IDs
  if (trimmed.length === 4 && /^[A-Z][A-Za-z]{3}$/.test(trimmed)) return true;
  // Short strings that look like binary data (non-word chars, single chars repeated)
  if (trimmed.length <= 5 && !/^[a-zA-Z0-9_\- ]+$/.test(trimmed)) return true;
  return false;
}

/**
 * Check if a string looks like an AE expression (JavaScript code).
 */
function isExpression(s: string): boolean {
  return (
    s.includes("thisComp.layer") ||
    s.includes("effect(") ||
    s.includes("endVal") ||
    s.includes("toFixed(") ||
    s.includes("toString()") ||
    s.includes("linear(") ||
    s.includes("comp(") ||
    s.includes("== 0 ? 1 : value")
  );
}

/**
 * Check if a string looks like a valid filename (not binary garbage).
 */
function isValidFilename(name: string): boolean {
  if (name.length < 2 || name.length > 200) return false;
  // Must contain at least one letter
  if (!/[a-zA-Z]/.test(name)) return false;
  // Must not contain control characters or non-printable chars
  if (/[\x00-\x1f\x7f]/.test(name)) return false;
  // Must not start with internal AE identifiers
  if (isInternalString(name)) return false;
  // Must not contain too many consecutive non-alphanumeric chars (garbage sign)
  if (/[^a-zA-Z0-9\s._\-()]{4,}/.test(name)) return false;
  return true;
}

// ─── String Extraction Helpers ──────────────────────────

/**
 * Extract readable ASCII strings from a buffer.
 * Finds sequences of printable ASCII characters of at least `minLength`.
 */
function extractAsciiStrings(buffer: Buffer, minLength = 4): string[] {
  const strings: string[] = [];
  let current = "";
  for (let i = 0; i < buffer.length; i++) {
    const byte = buffer[i];
    // Printable ASCII range (space through tilde)
    if (byte >= 0x20 && byte <= 0x7e) {
      current += String.fromCharCode(byte);
    } else {
      if (current.length >= minLength) {
        strings.push(current);
      }
      current = "";
    }
  }
  if (current.length >= minLength) {
    strings.push(current);
  }
  return strings;
}

/**
 * Extract UTF-16LE encoded strings from a buffer.
 * AEP files often store layer/comp names in UTF-16LE format.
 */
function extractUtf16Strings(buffer: Buffer, minLength = 3): string[] {
  const strings: string[] = [];
  let current = "";
  let inUtf16 = false;

  for (let i = 0; i < buffer.length - 1; i++) {
    const lo = buffer[i];
    const hi = buffer[i + 1];

    // UTF-16LE: printable ASCII char followed by null byte
    if (lo >= 0x20 && lo <= 0x7e && hi === 0x00) {
      current += String.fromCharCode(lo);
      inUtf16 = true;
      i++; // skip the null byte
    } else {
      if (inUtf16 && current.length >= minLength) {
        strings.push(current);
      }
      current = "";
      inUtf16 = false;
    }
  }
  if (inUtf16 && current.length >= minLength) {
    strings.push(current);
  }
  return strings;
}

/**
 * Deduplicate an array of strings, preserving first occurrence order.
 */
function unique(arr: string[]): string[] {
  const seen = new Set<string>();
  return arr.filter((s) => {
    if (seen.has(s)) return false;
    seen.add(s);
    return true;
  });
}

/**
 * Find all positions of a substring in the buffer (as ASCII).
 */
function findAllPositions(buffer: Buffer, search: string): number[] {
  const positions: number[] = [];
  const searchBuf = Buffer.from(search, "ascii");
  let pos = 0;
  while (pos < buffer.length) {
    const idx = buffer.indexOf(searchBuf, pos);
    if (idx === -1) break;
    positions.push(idx);
    pos = idx + 1;
  }
  return positions;
}

/**
 * Extract the nearest readable string in the vicinity of a buffer position.
 * Scans backward and forward to find a bounded string context.
 */
function extractNearbyString(
  buffer: Buffer,
  position: number,
  direction: "before" | "after",
  maxDistance = 512,
  excludeInternal = true
): string | null {
  if (direction === "before") {
    const start = Math.max(0, position - maxDistance);
    const slice = buffer.subarray(start, position);
    // Prefer UTF-16LE strings (real layer/effect names are UTF-16LE)
    const utf16 = extractUtf16Strings(slice, 3);
    const asciiStrs = extractAsciiStrings(slice, 3);
    // Search from the end (closest to position) for a valid string
    const candidates = [
      ...utf16.reverse().map((s) => s),
      ...asciiStrs.reverse().map((s) => s),
    ];
    for (const s of candidates) {
      if (!excludeInternal || !isInternalString(s)) return s;
    }
  } else {
    const end = Math.min(buffer.length, position + maxDistance);
    const slice = buffer.subarray(position, end);
    const utf16 = extractUtf16Strings(slice, 3);
    const asciiStrs = extractAsciiStrings(slice, 3);
    const candidates = [...utf16, ...asciiStrs];
    for (const s of candidates) {
      if (!excludeInternal || !isInternalString(s)) return s;
    }
  }
  return null;
}

// ─── Composition Detection ──────────────────────────────

/**
 * Identify composition names from extracted strings.
 * Compositions in AEP tend to be near RIFX chunk markers like "CdHd", "Layr", "tdgp".
 * We look for strings that appear as comp names by heuristic: they contain typical
 * naming patterns (underscores, specific prefixes) and are NOT file paths or effect names.
 */
function findCompositions(
  allStrings: string[],
  buffer: Buffer
): AepComposition[] {
  const comps: AepComposition[] = [];
  const seen = new Set<string>();

  // Strategy 1: Look for strings near RIFX composition markers.
  // The "cdta" chunk (composition data) and "CdHd" are markers for compositions.
  const compMarkers = ["cdta", "CdHd", "CompH"];
  for (const marker of compMarkers) {
    const positions = findAllPositions(buffer, marker);
    for (const pos of positions) {
      // Scan nearby for UTF-16 strings (comp names are often UTF-16 in AEP)
      const end = Math.min(buffer.length, pos + 1024);
      const slice = buffer.subarray(pos, end);
      const utf16Names = extractUtf16Strings(slice, 3);
      for (const rawName of utf16Names) {
        const name = cleanBinaryArtifacts(rawName);
        if (
          name.length >= 3 &&
          !seen.has(name) &&
          isLikelyCompName(name) &&
          !isInternalString(name) &&
          !isExpression(name)
        ) {
          seen.add(name);
          comps.push({ name });
        }
      }
    }
  }

  // Strategy 2: Look for strings that match common AE composition naming patterns.
  // E.g., prefixed with underscores, contain "export", "Slide", "Ovladani", etc.
  for (const rawS of allStrings) {
    const s = cleanBinaryArtifacts(rawS);
    if (seen.has(s)) continue;
    if (
      isLikelyCompName(s) &&
      !isFilePath(s) &&
      !isEffectName(s) &&
      !isInternalString(s) &&
      !isExpression(s)
    ) {
      // Validate: comp names typically start with letters/underscores, contain mostly word chars
      if (/^[_a-zA-Z]/.test(s) && s.length >= 3 && s.length <= 200 && /^[_a-zA-Z0-9\s\-.()]+$/.test(s)) {
        seen.add(s);
        comps.push({ name: s });
      }
    }
  }

  return comps;
}

function isLikelyCompName(s: string): boolean {
  // Comp names in AE projects often have these patterns.
  // Removed overly broad patterns like /comp/i and /main/i to reduce false positives.
  const compPatterns = [
    /^_{2,3}[A-Za-z]/, // starts with 2-3 underscores + letter like ___Fotbal_Chance_export
    /export/i,
    /\bslide[_\s]/i, // "Slide_1", "SLIDE 1" but NOT "Slider"
    /ovladani/i,
    /chance/i,
    /^pre-?comp/i,
    /render/i,
  ];
  return compPatterns.some((p) => p.test(s));
}

function isFilePath(s: string): boolean {
  return (
    s.includes("/") ||
    s.includes("\\") ||
    FOOTAGE_EXTENSIONS.some((ext) => s.toLowerCase().endsWith(ext))
  );
}

function isEffectName(s: string): boolean {
  return (
    KNOWN_EFFECT_NAMES.includes(s) ||
    EFFECT_PATTERNS.some((e) => s === e.pattern)
  );
}

// ─── Controller Detection ───────────────────────────────

/**
 * Find controller layers. These are layers whose names contain "control"
 * (case insensitive), including the Czech spelling "controler".
 */
function findControllers(
  allStrings: string[],
  buffer: Buffer
): AepController[] {
  const controllerPattern = /control/i;
  const controllerNames = unique(
    allStrings
      .map(cleanBinaryArtifacts)
      .filter(
        (s) =>
          controllerPattern.test(s) &&
          !isEffectName(s) &&
          !isInternalString(s) &&
          !isExpression(s) &&
          !s.startsWith("ADBE") &&
          // Exclude effect type names like "Slider Control", "Checkbox Control"
          !EFFECT_PATTERNS.some((ep) => s.includes(ep.pattern)) &&
          !s.includes("()") &&
          !s.includes("(\"") &&
          !s.includes("= ") &&
          s.length < 150 &&
          s.length >= 5
      )
  );

  const controllers: AepController[] = [];

  for (const layerName of controllerNames) {
    const effects = findEffectsForController(layerName, buffer, allStrings);
    controllers.push({ layerName, effects });
  }

  return controllers;
}

/**
 * For a given controller layer name, find effects that are associated with it.
 * We look for effect type patterns (Slider Control, Checkbox Control, etc.)
 * in proximity to the controller name in the binary.
 */
function findEffectsForController(
  layerName: string,
  buffer: Buffer,
  allStrings: string[]
): AepEffect[] {
  const effects: AepEffect[] = [];
  const seen = new Set<string>();

  // Find positions of this controller name in the buffer (try both ASCII and UTF-16)
  const asciiPositions = findAllPositions(buffer, layerName);
  const utf16Buf = Buffer.alloc(layerName.length * 2);
  for (let i = 0; i < layerName.length; i++) {
    utf16Buf[i * 2] = layerName.charCodeAt(i);
    utf16Buf[i * 2 + 1] = 0;
  }
  const utf16Positions: number[] = [];
  let searchPos = 0;
  while (searchPos < buffer.length) {
    const idx = buffer.indexOf(utf16Buf, searchPos);
    if (idx === -1) break;
    utf16Positions.push(idx);
    searchPos = idx + 1;
  }

  const allPositions = [...asciiPositions, ...utf16Positions];

  for (const pos of allPositions) {
    // Scan a region after the controller name for effect patterns.
    // Effects on a layer appear after the layer name in the binary data,
    // typically within a few kilobytes.
    const scanEnd = Math.min(buffer.length, pos + 4096);
    const region = buffer.subarray(pos, scanEnd);
    const regionStrings = [
      ...extractAsciiStrings(region, 3),
      ...extractUtf16Strings(region, 3),
    ];

    for (const ep of EFFECT_PATTERNS) {
      if (regionStrings.some((s) => s.includes(ep.pattern))) {
        // Found an effect type. Try to find its specific name/label nearby.
        const effectPositions = findAllPositions(region, ep.pattern);
        for (const effectPos of effectPositions) {
          // The effect instance name often precedes the effect type in the binary.
          // It could be something like "kurz" for a Slider Control.
          // Use excludeInternal=true to skip ADBE/Utf8/etc. identifiers
          const nearbyBefore = extractNearbyString(
            region,
            effectPos,
            "before",
            256,
            true // excludeInternal
          );

          // Clean and validate the found name
          const cleanedName = nearbyBefore ? cleanBinaryArtifacts(nearbyBefore) : null;
          const isValidName =
            cleanedName &&
            cleanedName.length >= 3 &&
            cleanedName !== layerName &&
            cleanedName !== ep.pattern &&
            !isInternalString(cleanedName) &&
            !isEffectName(cleanedName) &&
            !EFFECT_PATTERNS.some((p) => cleanedName.includes(p.pattern)) &&
            // Filter truncated effect type names like "heckbox Control"
            !EFFECT_PATTERNS.some((p) => p.pattern.includes(cleanedName)) &&
            cleanedName.length < 100;

          const effectName = isValidName ? cleanedName : ep.pattern;

          const key = `${effectName}:${ep.type}`;
          if (!seen.has(key)) {
            seen.add(key);
            effects.push({ name: effectName, type: ep.type });
          }
        }
      }
    }
  }

  // If no effects were found through proximity, fall back to checking if common
  // effect type strings exist near any occurrence of the layer name.
  if (effects.length === 0) {
    // Check for generic presence of effect types in the whole buffer
    for (const ep of EFFECT_PATTERNS) {
      if (buffer.includes(Buffer.from(ep.pattern, "ascii"))) {
        // Effect type exists in file; heuristically associate with controllers
        // that match naming conventions (e.g., "controler hoste" likely has Slider)
        if (
          layerName.toLowerCase().includes("checkbox") ||
          layerName.toLowerCase().includes("logo") ||
          layerName.toLowerCase().includes("avatar")
        ) {
          if (ep.type === "Checkbox") {
            effects.push({ name: ep.pattern, type: ep.type });
          }
        }
        if (
          layerName.toLowerCase().includes("hoste") ||
          layerName.toLowerCase().includes("sirka") ||
          layerName.toLowerCase().includes("slider")
        ) {
          if (ep.type === "Slider") {
            effects.push({ name: ep.pattern, type: ep.type });
          }
        }
      }
    }
  }

  return effects;
}

// ─── Text Layer Detection ────────────────────────────────

/**
 * Find text layers in the AEP file.
 * Text layers are identified by "Layrldta" followed by a layer name
 * and then "(ADBE Text Properties)" nearby in the binary.
 * The real layer name (including diacritics) is extracted from the
 * UTF-8 encoded section after the "Utf8" marker.
 * Layers whose Source Text is driven by an expression are excluded
 * (they get their values from controllers, not user input).
 * Each text layer is returned as a controller with a single "Source Text" effect of type "Text".
 */
function findTextLayers(buffer: Buffer): AepController[] {
  const textLayers: AepController[] = [];
  const seen = new Set<string>();

  const textPropsBuf = Buffer.from("(ADBE Text Properties", "ascii");
  const layrLdtaBuf = Buffer.from("Layrldta", "ascii");
  const utf8Buf = Buffer.from("Utf8", "ascii");
  let pos = 0;

  while (pos < buffer.length) {
    const idx = buffer.indexOf(textPropsBuf, pos);
    if (idx === -1) break;

    // Check if this text layer is expression-driven (skip it if so)
    const afterEnd = Math.min(buffer.length, idx + 2048);
    const afterRegion = buffer.subarray(idx, afterEnd).toString("ascii");
    const hasExpression =
      afterRegion.includes("thisComp") ||
      afterRegion.includes("effect(") ||
      afterRegion.includes("toFixed(") ||
      afterRegion.includes("linear(") ||
      afterRegion.includes("toString()");

    if (!hasExpression) {
      // Find the Layrldta marker before this text props occurrence
      const scanStart = Math.max(0, idx - 500);
      const region = buffer.subarray(scanStart, idx);
      const layrPos = region.lastIndexOf(layrLdtaBuf);

      if (layrPos !== -1) {
        // Find the first Utf8 marker after Layrldta
        const afterLayr = region.subarray(layrPos + 8);
        const utf8Pos = afterLayr.indexOf(utf8Buf);

        if (utf8Pos !== -1) {
          // Read the UTF-8 encoded layer name after the Utf8 marker.
          // Skip any leading non-printable bytes, then read until
          // a null byte or "LIST" marker.
          let nameStart = utf8Pos + 4;
          while (
            nameStart < afterLayr.length &&
            afterLayr[nameStart] < 0x20
          ) {
            nameStart++;
          }
          let nameEnd = nameStart;
          while (nameEnd < afterLayr.length) {
            if (afterLayr[nameEnd] === 0x00) break;
            if (
              nameEnd + 4 <= afterLayr.length &&
              afterLayr.subarray(nameEnd, nameEnd + 4).toString("ascii") ===
                "LIST"
            ) {
              break;
            }
            nameEnd++;
          }

          const name = afterLayr
            .subarray(nameStart, nameEnd)
            .toString("utf-8")
            .trim();

          if (
            name.length >= 2 &&
            name.length < 100 &&
            !seen.has(name)
          ) {
            seen.add(name);
            textLayers.push({
              layerName: name,
              effects: [{ name: "Source Text", type: "Text" }],
            });
          }
        }
      }
    }

    pos = idx + 1;
  }

  return textLayers;
}

// ─── Footage Detection ──────────────────────────────────

/**
 * Find footage items referenced in the AEP file.
 * Looks for file paths and filenames with known extensions.
 */
function findFootageItems(allStrings: string[]): AepFootageItem[] {
  const items: AepFootageItem[] = [];
  const seen = new Set<string>();

  for (const s of allStrings) {
    const lower = s.toLowerCase();

    // Check if this string ends with a known footage extension
    const hasExtension = FOOTAGE_EXTENSIONS.some((ext) =>
      lower.endsWith(ext)
    );

    if (hasExtension) {
      // Extract filename and folder path
      let name: string;
      let folderPath: string;

      // Normalize path separators
      const normalized = s.replace(/\\/g, "/");

      if (normalized.includes("/")) {
        const lastSlash = normalized.lastIndexOf("/");
        folderPath = normalized.substring(0, lastSlash);
        name = normalized.substring(lastSlash + 1);
      } else {
        name = normalized;
        folderPath = "";
      }

      // Validate filename is not binary garbage
      if (!isValidFilename(name)) continue;

      // Deduplicate by full path
      const key = `${folderPath}/${name}`;
      if (!seen.has(key) && name.length > 1) {
        seen.add(key);
        items.push({ name, folderPath });
      }
    }

    // Also look for folder path patterns common in AE projects
    // e.g., "PODKLADY_CHL/LOGA/", "SLIDE 1/", etc.
    if (
      s.includes("/") &&
      !hasExtension &&
      !s.startsWith("http") &&
      !s.includes("://")
    ) {
      // This might be a folder reference; we only record it if it looks like
      // a footage folder path (short, no special chars)
      const normalized = s.replace(/\\/g, "/").replace(/\/$/, "");
      if (
        normalized.length < 200 &&
        normalized.length >= 5 &&
        /^[a-zA-Z0-9_\-\s./]+$/.test(normalized)
      ) {
        // Check if this path contains footage-like folder names
        const parts = normalized.split("/").filter(Boolean);
        // Each folder segment must be at least 2 chars and contain letters
        if (
          parts.length >= 2 &&
          parts.every((p) => p.length >= 2 && p.length < 80 && /[a-zA-Z]/.test(p)) &&
          // No segment should be an internal AE identifier
          !parts.some((p) => isInternalString(p))
        ) {
          // Store as a folder reference (no filename)
          const key = `${normalized}/`;
          if (!seen.has(key)) {
            seen.add(key);
            // Only add if it looks like a footage folder, not a system path
            const isFootageFolder =
              !normalized.startsWith("/usr") &&
              !normalized.startsWith("/System") &&
              !normalized.includes("node_modules") &&
              !normalized.startsWith("/Applications");
            if (isFootageFolder) {
              items.push({ name: "", folderPath: normalized });
            }
          }
        }
      }
    }
  }

  return items;
}

// ─── Font Detection ─────────────────────────────────────

// Common font family names that appear in AEP files.
// AEP stores font references with their PostScript or family names.
const KNOWN_FONT_PATTERNS: { pattern: RegExp; displayName: string }[] = [
  { pattern: /Stag\s*Sans/i, displayName: "Stag Sans" },
  { pattern: /Arial/i, displayName: "Arial" },
  { pattern: /Helvetica/i, displayName: "Helvetica" },
  { pattern: /Roboto/i, displayName: "Roboto" },
  { pattern: /Open\s*Sans/i, displayName: "Open Sans" },
  { pattern: /Montserrat/i, displayName: "Montserrat" },
  { pattern: /Lato/i, displayName: "Lato" },
  { pattern: /Futura/i, displayName: "Futura" },
  { pattern: /Gotham/i, displayName: "Gotham" },
  { pattern: /Proxima\s*Nova/i, displayName: "Proxima Nova" },
  { pattern: /Source\s*Sans/i, displayName: "Source Sans" },
  { pattern: /Noto\s*Sans/i, displayName: "Noto Sans" },
  { pattern: /Inter/i, displayName: "Inter" },
  { pattern: /Poppins/i, displayName: "Poppins" },
  { pattern: /Raleway/i, displayName: "Raleway" },
  { pattern: /Barlow/i, displayName: "Barlow" },
  { pattern: /Oswald/i, displayName: "Oswald" },
  { pattern: /Bebas/i, displayName: "Bebas" },
  { pattern: /DIN/i, displayName: "DIN" },
];

// Strings that appear near font markers but are NOT font names.
// Includes AE property names, ICC color profile terms, and content words.
const NON_FONT_STRINGS = new Set([
  // AE effect/property names
  "Slider Control",
  "Checkbox Control",
  "Color Control",
  "Point Control",
  "Layer Control",
  "Angle Control",
  "Dropdown Menu Control",
  "Compositing Options",
  "Compositing Option",
  "Take Matte From Layer",
  "Fill Mask",
  "Fill",
  "Blur Radius",
  "Blur Dimensions",
  "Fast Box Blur",
  "Gaussian Blur",
  "Drop Shadow",
  "Set Matte",
  "Invert Matte",
  "Stroke",
  "Glow",
  "Tint",
  "Levels",
  "Curves",
  "Color",
  "Slider",
  "Checkbox",
  "If Layer Sizes Differ",
  // ICC color profile / color management terms
  "Hewlett",
  "Packard",
  "Farge",
  "Kleuren",
  "Farb",
  // ICC color profile strings
  "LCDFarge",
  "LCDLCD",
  // Content words that appear in AEP data but are not fonts
  "Pardubice",
  "Liberec",
  "Slavia",
  "Slavie",
]);

/**
 * Check if a string is a plausible font name found near font markers.
 * Font names follow strict naming conventions: properly capitalized words
 * (e.g., "Stag Sans", "Myriad Pro") or CamelCase (e.g., "StagSans").
 */
function isLikelyFontName(s: string): boolean {
  const cleaned = cleanBinaryArtifacts(s).trim();
  if (cleaned.length < 4 || cleaned.length > 60) return false;
  if (isInternalString(cleaned)) return false;
  if (NON_FONT_STRINGS.has(cleaned)) return false;
  // Must start with uppercase
  if (!/^[A-Z]/.test(cleaned)) return false;
  // Must match one of these font-like patterns:
  // Must match one of these font-like patterns:
  const isProperWords = /^[A-Z][a-z]{2,}(\s[A-Z][a-z]{2,})*$/.test(cleaned); // "Myriad Pro", "Stag Sans"
  const isCamelCase = /^[A-Z][a-z]+([A-Z][a-z]+)+$/.test(cleaned); // "StagSans", "OpenSans"
  const isSingleWord = /^[A-Z][a-z]{3,}$/.test(cleaned); // "Myriad", "Inter", "Roboto"
  if (!isProperWords && !isCamelCase && !isSingleWord) return false;
  // Real font names contain vowels (filters garbage like "Ewstfvdv")
  if (!/[aeiouAEIOU]/.test(cleaned.slice(1))) return false;
  // Must not contain known binary marker substrings
  for (const marker of Array.from(INTERNAL_AE_EXACT)) {
    if (cleaned.includes(marker) && cleaned !== marker) return false;
  }
  return true;
}

/**
 * Find fonts used in the AEP file.
 * Font data in AEP is typically found near "tdbs" (text data) chunks
 * or as part of text layer properties.
 */
function findFonts(allStrings: string[], buffer: Buffer): string[] {
  const fonts: string[] = [];
  const seen = new Set<string>();

  // Strategy 1: Match against known font patterns in all extracted strings
  for (const rawS of allStrings) {
    const s = cleanBinaryArtifacts(rawS);
    for (const { pattern, displayName } of KNOWN_FONT_PATTERNS) {
      if (pattern.test(s)) {
        const lower = displayName.toLowerCase();
        if (!seen.has(lower) && !NON_FONT_STRINGS.has(displayName)) {
          seen.add(lower);
          // Also register no-space variant for dedup with Strategy 3
          seen.add(lower.replace(/\s+/g, ""));
          fonts.push(displayName);
        }
      }
    }
  }

  // Strategy 2: Look near font-related markers in the binary.
  // AEP stores font data near "fnam" (font name) and "tdbs" markers.
  const fontMarkers = ["fnam", "tdbs", "tdbf"];
  for (const marker of fontMarkers) {
    const positions = findAllPositions(buffer, marker);
    for (const pos of positions) {
      const end = Math.min(buffer.length, pos + 512);
      const slice = buffer.subarray(pos, end);
      const utf16Names = extractUtf16Strings(slice, 3);
      const asciiNames = extractAsciiStrings(slice, 3);

      for (const rawName of [...utf16Names, ...asciiNames]) {
        const name = cleanBinaryArtifacts(rawName);
        if (isLikelyFontName(name)) {
          const lower = name.toLowerCase().trim();
          if (!seen.has(lower)) {
            seen.add(lower);
            fonts.push(name.trim());
          }
        }
      }
    }
  }

  // Strategy 3: Look for PostScript-style font names (e.g., "StagSans-Book")
  const postScriptPattern = /[A-Z][a-zA-Z]{2,}[-][A-Za-z]{3,}/;
  for (const rawS of allStrings) {
    const s = cleanBinaryArtifacts(rawS);
    const match = s.match(postScriptPattern);
    if (match) {
      const fontName = match[0];
      // Validate it's not binary garbage or a non-font string
      if (isInternalString(fontName)) continue;
      // Convert PostScript name to readable: "StagSans-Book" -> "Stag Sans"
      const familyName = fontName
        .split("-")[0]
        .replace(/([a-z])([A-Z])/g, "$1 $2");
      const lower = familyName.toLowerCase();
      if (
        !seen.has(lower) &&
        familyName.length >= 3 &&
        familyName.length < 60 &&
        !NON_FONT_STRINGS.has(familyName) &&
        // Must contain a vowel (not random binary garbage)
        /[aeiouAEIOU]/.test(familyName.slice(1)) &&
        // No 3+ consecutive uppercase (rejects ICC/LCD profile artifacts)
        !/[A-Z]{3,}/.test(familyName)
      ) {
        seen.add(lower);
        fonts.push(familyName);
      }
    }
  }

  return fonts;
}

// ─── Main Analyzer ──────────────────────────────────────

/**
 * Analyze an After Effects Project (.aep) binary buffer.
 *
 * This does NOT implement a full RIFX parser. Instead, it uses a
 * string-scanning heuristic approach: it extracts all readable text
 * strings (both ASCII and UTF-16LE) from the binary and classifies
 * them into compositions, controllers, effects, footage items, and fonts.
 *
 * @param buffer - Raw binary content of the .aep file
 * @returns AepAnalysis with extracted project structure
 */
export function analyzeAep(buffer: Buffer): AepAnalysis {
  // Validate the buffer starts with RIFX (After Effects) or RIFF
  const header = buffer.subarray(0, 4).toString("ascii");
  if (header !== "RIFX" && header !== "RIFF") {
    // Some AEP files may be gzip-compressed or have a different wrapper.
    // Try to proceed anyway with a warning-style approach.
    console.warn(
      `AEP file does not start with RIFX/RIFF header (got "${header}"). ` +
        "Attempting to parse anyway."
    );
  }

  // Extract all readable strings from the binary
  const asciiStrings = extractAsciiStrings(buffer, 3);
  const utf16Strings = extractUtf16Strings(buffer, 3);
  const allStrings = unique([...asciiStrings, ...utf16Strings]);

  // Run each detector
  const compositions = findCompositions(allStrings, buffer);
  const controllers = findControllers(allStrings, buffer);
  const textLayers = findTextLayers(buffer);
  const footageItems = findFootageItems(allStrings);
  const fonts = findFonts(allStrings, buffer);

  // Merge text layers into controllers (skip duplicates)
  const controllerNames = new Set(controllers.map((c) => c.layerName));
  for (const tl of textLayers) {
    if (!controllerNames.has(tl.layerName)) {
      controllers.push(tl);
    }
  }

  return {
    compositions,
    controllers,
    footageItems,
    fonts,
  };
}
