// services/replicateService.ts
// ═══════════════════════════════════════════════════════════════════════════════
// DESIGNORA — 2-STAGE PIPELINE: DEPTH-PRO → KONTEXT-PRO
//
// Stage 1: flux-depth-pro (photorealistic room generation)
//   Takes user's photo → extracts depth map (room skeleton)
//   Generates photorealistic room with new style, materials, lighting
//   Strength: amazing realism, real materials, correct perspective
//   guidance=25, steps=50, jpg output
//
// Stage 2: flux-kontext-pro (furniture verification & correction)
//   Takes Stage 1's photorealistic output as input_image
//   Checks for missing mandatory furniture (bed, cabinets, sofa, etc.)
//   Adds any missing items while preserving Stage 1's photorealistic quality
//   Removes any wrong-room-type furniture (bed in kitchen, etc.)
//
// WHY THIS ORDER:
//   depth-pro = best photorealism (its core strength)
//   kontext-pro = best at understanding "add X, remove Y" instructions
//   Each model does what it's best at
//   Stage 2 input is already photorealistic → Kontext preserves that quality
//
// Cost: ~$0.09/variant ($0.05 depth-pro + $0.04 kontext-pro)
// Time: ~20-30 seconds per variant (two model calls)
// ═══════════════════════════════════════════════════════════════════════════════

const PROXY_BASE = `${import.meta.env?.VITE_API_BASE ?? 'http://localhost:3001'}/api/replicate`;

async function pollPrediction(id: string): Promise<string> {
  for (let i = 0; i < 80; i++) {
    await new Promise(r => setTimeout(r, 5000));
    const res = await fetch(`${PROXY_BASE}/predictions/${id}`);
    if (!res.ok) throw new Error(`Poll failed: ${res.statusText}`);
    const p = await res.json();
    if (p.status === 'succeeded') {
      const out = p.output;
      return Array.isArray(out) ? out[0] : out;
    }
    if (p.status === 'failed' || p.status === 'canceled')
      throw new Error(`Generation ${p.status}: ${p.error || 'unknown'}`);
  }
  throw new Error('Timed out after 6 minutes');
}

async function runModel(body: object): Promise<string> {
  const res = await fetch(`${PROXY_BASE}/predictions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e.detail || `Error: ${res.statusText}`);
  }
  const pred = await res.json();
  if (pred.status === 'succeeded') {
    const out = pred.output;
    return Array.isArray(out) ? out[0] : out;
  }
  return pollPrediction(pred.id);
}

export async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ── Budget tier ───────────────────────────────────────────────────────────────
function getTier(budgetValue: number): number {
  if (budgetValue <= 150000) return 1;
  if (budgetValue <= 500000) return 2;
  if (budgetValue <= 1000000) return 3;
  if (budgetValue <= 2500000) return 4;
  return 5;
}

function getBudgetSeed(budgetValue: number, style: string, roomType: string, variant: 'A' | 'B'): number {
  const tier = getTier(budgetValue);
  let hash = tier * 100_000;
  for (let i = 0; i < style.length; i++) hash += style.charCodeAt(i) * (i + 7);
  for (let i = 0; i < roomType.length; i++) hash += roomType.charCodeAt(i) * (i + 13);
  // Variant B uses a completely different hash to avoid correlated colour artifacts
  if (variant === 'B') {
    hash = hash * 7 + 123_456_789;
  }
  return ((hash % 2_000_000_000) + 1);
}

// ═══════════════════════════════════════════════════════════════════════════════
// KONTEXT PROMPT BUILDER
//
// Kontext prompts are EDIT INSTRUCTIONS, not image descriptions.
// Format: "Transform this room into X. Add Y. Place Z against the wall.
//          Keep the same walls, windows, and room proportions."
//
// This is fundamentally different from flux-depth-pro prompts which describe
// a photograph. Kontext understands verbs like "add", "remove", "replace",
// "transform", "change", "keep".
// ═══════════════════════════════════════════════════════════════════════════════

export function buildDesignPrompt(
  userPrompt: string,
  style: string,
  roomType: string,
  budgetValue = 300000,
  variant: 'A' | 'B' = 'A'
): { prompt: string; seed: number } {

  const tier = getTier(budgetValue);

  // Tier-specific material descriptions
  const tierMats: Record<number, { floor: string; walls: string; furniture: string; lighting: string; accents: string }> = {
    1: { floor: 'white vinyl plank flooring', walls: 'plain white painted walls', furniture: 'white MDF furniture with chrome handles', lighting: 'flush-mount LED ceiling panel', accents: 'minimal decor, simple white curtains' },
    2: { floor: 'cream vitrified floor tiles', walls: 'white walls with a grey textured accent wall', furniture: 'light walnut veneer furniture', lighting: 'recessed LED downlights and a fabric floor lamp', accents: 'off-white curtains, small terracotta plant' },
    3: { floor: 'oak herringbone parquet flooring', walls: 'lime-wash walls with fluted oak panel accent', furniture: 'solid sheesham teak furniture with brass hardware', lighting: 'brass track lighting with warm LED spots', accents: 'linen curtains, bouclé cushions, fiddle-leaf fig plant' },
    4: { floor: 'Carrara marble-look porcelain slab floor', walls: 'charcoal fluted wood wall panelling', furniture: 'dark walnut furniture with brushed gold hardware', lighting: 'LED cove lighting and a brushed-gold pendant', accents: 'bouclé upholstery, cashmere throw, framed artwork, ceramic vase' },
    5: { floor: 'Calacatta Gold marble slab flooring', walls: 'Venetian plaster walls with gilded cornice', furniture: 'Italian bespoke leather and rosewood furniture', lighting: 'Swarovski crystal chandelier', accents: 'oil painting, Murano glass sculpture, antique silk rug' },
  };

  const styleVibe: Record<string, string> = {
    Modern:       'crisp white and charcoal palette, matte black hardware, LED cove lighting, geometric rug, handleless cabinetry',
    Scandinavian: 'pale birch, sage green, oat beige, rattan pendant, chunky knit throw, terracotta pots, sheer linen curtains',
    Industrial:   'charcoal, rust, aged leather, exposed brick wall, black steel frames, Edison filament pendants, concrete ceiling',
    Bohemian:     'terracotta, mustard, teal, layered Persian rugs, macrame wall hanging, rattan chairs, trailing plants, Moroccan lanterns',
    Luxury:       'champagne, ivory, charcoal, brushed gold, crystal chandelier, herringbone parquet, bouclé sofa, velvet cushions',
    Farmhouse:    'white, linen, reclaimed wood, antique iron, white shiplap wall, oak beams, brass fixtures, open wooden shelving',
    'Art Deco':   'emerald, gold, black, ivory, plum, geometric brass inlay, velvet curved sofa, chevron parquet, fluted mirror glass',
    Japandi:      'moss green, ash beige, stone grey, off-white, low pale-ash furniture, linen textiles, ceramic vases, washi paper lamp',
  };

  // Room-specific furniture with EXACT placement instructions
  const roomFurniture: Record<string, { A: string; B: string }> = {
    'Living Room': {
      A: 'Add a large L-shaped sectional sofa against the left wall with accent cushions. Place a rectangular wooden coffee table on a geometric area rug in the centre. Add an arc floor lamp in the far corner. Mount a TV unit on the opposite wall with a flat-screen TV. Hang floor-length curtains on the window.',
      B: 'Add two matching 3-seater sofas facing each other with a round marble coffee table between them on a large area rug. Place a tall bookshelf filled with books against the far wall. Add a reading floor lamp in the corner. Hang floor-length curtains on the window.',
    },
    'Bedroom': {
      A: 'Add a large queen-size bed with a tall upholstered headboard centred against the main wall. Place two matching bedside tables with glowing ceramic table lamps on each side of the bed. Add a full-height sliding-door wardrobe along the side wall. Lay a soft area rug at the foot of the bed. Hang floor-length curtains on the window. Add layered linen bedding with throw cushions.',
      B: 'Add a king-size platform bed with a wide wooden headboard against the longest wall. Place a single bedside table with a brass lamp on one side. Add a freestanding open wardrobe on the far wall. Put a reading bench at the foot of the bed. Lean a full-length mirror against the side wall. Hang layered floor-length curtains on the window.',
    },
    'Kitchen': {
      A: 'Add full L-shaped modular kitchen cabinets (upper and lower) along two walls with a stone countertop. Place a stainless-steel sink under the window. Add an induction hob with a chimney range hood above. Integrate a tall refrigerator into the cabinetry. Add a kitchen island with two bar stools in the centre. Install pendant lights above the island. Add a tiled backsplash.',
      B: 'Add floor-to-ceiling single-wall kitchen cabinetry spanning the back wall. Place a large kitchen island with butcher-block countertop and three bar stools in the centre. Integrate an oven column and a farmhouse sink under the window. Add open floating wooden shelves on one side wall. Hang three pendant lights above the island.',
    },
    'Bathroom': {
      A: 'Add a frameless glass walk-in shower enclosure in the corner with a rainfall showerhead. Place a wall-hung floating double vanity with two ceramic basins against the far wall. Mount a large backlit LED mirror above the vanity. Tile the floor and walls with large-format grey porcelain tiles. Add a heated towel rail on the side wall. Place a small plant on the vanity counter.',
      B: 'Add a floating single vanity with a vessel basin and a round backlit LED mirror on the main wall. Create a wet-room shower area in the far corner with a full-height glass partition. Add large white rectangular wall tiles on every wall. Place a tall narrow storage cabinet beside the vanity. Add chrome fixtures throughout.',
    },
    'Office': {
      A: 'Add a wide solid-wood desk against the far wall with a monitor, task lamp, and stationery. Place a high-back ergonomic chair behind the desk. Add floor-to-ceiling bookshelves on both sides of the desk, filled with books. Add a tall storage cabinet. Hang floor-length curtains on the window. Place a small plant on the desk.',
      B: 'Add an L-shaped corner desk spanning two walls with dual monitors and cable management underneath. Place an ergonomic mesh chair on castors. Add a long low credenza along the opposite wall. Mount a large pegboard with shelves above the desk. Add a compact sofa on the far side. Place a tall floor plant in the corner.',
    },
    'Dining Room': {
      A: 'Add a large solid-wood rectangular 6-seater dining table in the exact centre of the room. Place six upholstered dining chairs around it — two on each long side, one at each end. Hang an oversized pendant chandelier directly above the table centre. Add a slim sideboard buffet cabinet against the back wall. Place a decorative centrepiece on the table.',
      B: 'Add a large round solid-wood dining table in the centre of the room with six evenly-spaced upholstered chairs around it. Hang a cluster of three pendant lights at staggered heights above the table. Place a tall glass-front display cabinet against the far wall. Add a bar trolley in the corner. Place a decorative centrepiece on the table.',
    },
  };

  const m = tierMats[tier];
  const vibe = styleVibe[style] || style;
  const furniture = roomFurniture[roomType]?.[variant] || roomFurniture[roomType]?.A || '';
  const extra = userPrompt ? ` Also: ${userPrompt}.` : '';

  // Lighting description — both use natural daylight, B uses slightly different angle
  const lightDesc = variant === 'A'
    ? 'Bright natural daylight streaming through the windows, casting crisp soft shadows on the floor. Warm white ambient light at 5000K.'
    : 'Soft natural afternoon sunlight from the windows, warm golden ambient light at 4000K, gentle diffused shadows.';

  // KONTEXT EDIT INSTRUCTION with strong photorealism enforcement
  const prompt =
    `Transform this room into a fully furnished ${style} style ${roomType}. ` +
    `Remove all existing furniture and objects completely. ` +
    `${furniture} ` +
    `Materials: flooring is ${m.floor}, walls are ${m.walls}, furniture is ${m.furniture}, lighting is ${m.lighting}, accents are ${m.accents}. ` +
    `${style} design: ${vibe}. ` +
    `${extra} ` +
    `Keep the exact same room shape, wall positions, window positions, doors, ceiling height, and camera angle. ` +
    `${lightDesc} ` +
    `IMPORTANT: The output must look like a REAL photograph taken with a professional DSLR camera — not a painting, not a 3D render, not CGI, not an illustration. ` +
    `Real physical materials with visible texture: wood grain, fabric weave, stone veining, metal reflections. ` +
    `Accurate natural colours with neutral white balance — no purple tint, no blue cast, no colour distortion. ` +
    `Shot on Canon EOS R5, 24mm lens, f/8, sharp focus. Looks like a photo from Architectural Digest magazine.`;

  return { prompt, seed: getBudgetSeed(budgetValue, style, roomType, variant) };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 2-STAGE PIPELINE: DEPTH-PRO (photorealism) → KONTEXT-PRO (furniture fix)
//
// Stage 1: flux-depth-pro
//   Takes user's photo, extracts depth map (room skeleton)
//   Generates photorealistic room with new style + materials + lighting
//   Strength: amazing photorealism, real materials, correct perspective
//   Weakness: may leave floor empty or miss some furniture items
//
// Stage 2: flux-kontext-pro
//   Takes Stage 1's photorealistic output + furniture edit instruction
//   Checks and adds any missing mandatory furniture
//   Strength: understands "add a bed" / "add cabinets" as edit instructions
//   Preserves Stage 1's photorealistic quality while fixing furniture gaps
//
// WHY THIS ORDER WORKS:
//   depth-pro's photorealism is its #1 strength — let it handle the look
//   kontext-pro's edit intelligence is its #1 strength — let it fix furniture
//   Stage 2 input is ALREADY photorealistic, so Kontext preserves that quality
// ═══════════════════════════════════════════════════════════════════════════════

// Stage 1 prompt — photorealistic room generation (for depth-pro)
function buildStage1Prompt(
  style: string,
  roomType: string,
  budgetValue: number,
  variant: 'A' | 'B',
  userPrompt: string
): string {
  const tier = getTier(budgetValue);

  const tierMats: Record<number, { floor: string; walls: string; furniture: string; lighting: string; accents: string }> = {
    1: { floor: 'white vinyl plank flooring', walls: 'plain white painted walls', furniture: 'white MDF furniture with chrome handles', lighting: 'flush-mount LED ceiling panel', accents: 'minimal decor, simple white curtains' },
    2: { floor: 'cream vitrified floor tiles', walls: 'white walls with a grey textured accent wall', furniture: 'light walnut veneer furniture', lighting: 'recessed LED downlights and a fabric floor lamp', accents: 'off-white curtains, small terracotta plant' },
    3: { floor: 'oak herringbone parquet flooring', walls: 'lime-wash walls with fluted oak panel accent', furniture: 'solid sheesham teak furniture with brass hardware', lighting: 'brass track lighting with warm LED spots', accents: 'linen curtains, bouclé cushions, fiddle-leaf fig plant' },
    4: { floor: 'Carrara marble-look porcelain slab floor', walls: 'charcoal fluted wood wall panelling', furniture: 'dark walnut furniture with brushed gold hardware', lighting: 'LED cove lighting and a brushed-gold pendant', accents: 'bouclé upholstery, cashmere throw, framed artwork, ceramic vase' },
    5: { floor: 'Calacatta Gold marble slab flooring', walls: 'Venetian plaster walls with gilded cornice', furniture: 'Italian bespoke leather and rosewood furniture', lighting: 'Swarovski crystal chandelier', accents: 'oil painting, Murano glass sculpture, antique silk rug' },
  };

  const styleVibe: Record<string, string> = {
    Modern:       'Crisp white and charcoal palette, matte black hardware, LED cove lighting, geometric rug, handleless cabinetry.',
    Scandinavian: 'Pale birch, sage green, oat beige, rattan pendant, chunky knit throw, terracotta pots, sheer linen curtains.',
    Industrial:   'Charcoal, rust, aged leather, exposed brick wall, black steel frames, Edison filament pendants, concrete ceiling.',
    Bohemian:     'Terracotta, mustard, teal, layered Persian rugs, macrame wall hanging, rattan chairs, trailing plants, Moroccan lanterns.',
    Luxury:       'Champagne, ivory, charcoal, brushed gold, crystal chandelier, herringbone parquet, bouclé sofa, velvet cushions.',
    Farmhouse:    'White, linen, reclaimed wood, antique iron, white shiplap wall, oak beams, brass fixtures, open wooden shelving.',
    'Art Deco':   'Emerald, gold, black, ivory, plum, geometric brass inlay, velvet curved sofa, chevron parquet, fluted mirror glass.',
    Japandi:      'Moss green, ash beige, stone grey, off-white, low pale-ash furniture, linen textiles, ceramic vases, washi paper lamp.',
  };

  const roomLayouts: Record<string, { A: string; B: string }> = {
    'Living Room': {
      A: 'Large L-shaped sectional sofa against the left wall with accent cushions. Rectangular coffee table on an area rug in the centre. Arc floor lamp in the far corner. TV unit on the opposite wall. Floor-length curtains on the window.',
      B: 'Two matching 3-seater sofas facing each other with a round marble coffee table between them on a large area rug. Tall bookshelf filled with books against the far wall. Reading floor lamp in the corner. Floor-length curtains.',
    },
    'Bedroom': {
      A: 'Queen-size bed with tall upholstered headboard centred against the main wall. Two matching bedside tables with ceramic table lamps. Full-height sliding-door wardrobe along the side wall. Soft area rug at the foot of the bed. Floor-length curtains. Layered linen bedding with throw cushions.',
      B: 'King-size platform bed with wide wooden headboard against the longest wall. Single bedside table with brass lamp. Freestanding open wardrobe on the far wall. Reading bench at the foot of the bed. Full-length mirror leaning against the side wall. Layered curtains.',
    },
    'Kitchen': {
      A: 'Full L-shaped modular kitchen cabinets (upper and lower) along two walls with stone countertop. Stainless-steel sink under the window. Induction hob with chimney range hood. Tall refrigerator in the cabinetry. Kitchen island with two bar stools in the centre. Pendant lights above the island. Tiled backsplash.',
      B: 'Floor-to-ceiling single-wall kitchen cabinetry spanning the back wall. Large kitchen island with butcher-block countertop and three bar stools. Integrated oven column and farmhouse sink under the window. Open floating wooden shelves on one side. Three pendant lights above the island.',
    },
    'Bathroom': {
      A: 'Frameless glass walk-in shower in the corner with rainfall showerhead. Wall-hung floating double vanity with two ceramic basins. Large backlit LED mirror above the vanity. Large-format grey porcelain tiles on floor and walls. Heated towel rail on the side wall. Small plant on the vanity.',
      B: 'Floating single vanity with vessel basin and round backlit LED mirror. Wet-room shower area in the far corner with glass partition. Large white rectangular wall tiles. Tall narrow storage cabinet beside the vanity. Chrome fixtures throughout.',
    },
    'Office': {
      A: 'Wide solid-wood desk against the far wall with monitor, task lamp, stationery. High-back ergonomic chair. Floor-to-ceiling bookshelves on both sides of the desk filled with books. Tall storage cabinet. Floor-length curtains. Small plant on the desk.',
      B: 'L-shaped corner desk spanning two walls with dual monitors. Ergonomic mesh chair on castors. Long low credenza along the opposite wall. Large pegboard with shelves above the desk. Compact sofa on the far side. Tall floor plant in the corner.',
    },
    'Dining Room': {
      A: 'Large solid-wood rectangular 6-seater dining table centred in the room. Six upholstered dining chairs — two on each long side, one at each end. Oversized pendant chandelier directly above the table centre. Slim sideboard buffet cabinet against the back wall. Decorative centrepiece on the table.',
      B: 'Large round solid-wood dining table in the centre with six evenly-spaced upholstered chairs. Cluster of three pendant lights at staggered heights above the table. Tall glass-front display cabinet against the far wall. Bar trolley in the corner. Decorative centrepiece on the table.',
    },
  };

  const m = tierMats[tier];
  const vibe = styleVibe[style] || style;
  const layout = roomLayouts[roomType]?.[variant] || roomLayouts[roomType]?.A || roomType;
  const extra = userPrompt ? ` ${userPrompt}.` : '';

  return (
    `Hyperrealistic interior design photograph of a fully furnished ${style} style ${roomType}. ` +
    `Layout: ${layout} ` +
    `Flooring: ${m.floor}. Walls: ${m.walls}. Furniture: ${m.furniture}. Lighting: ${m.lighting}. Decor: ${m.accents}. ` +
    `Style: ${vibe} ` +
    `${extra} ` +
    `Bright natural daylight from windows, warm ambient fill, soft realistic shadows. Neutral white balance, no colour cast. ` +
    `Camera: Phase One IQ4 150MP, 23mm tilt-shift lens, f/8, ISO 64. Pin-sharp focus. ` +
    `Real photograph for Architectural Digest India. NOT CGI, NOT 3D render. No people, no text, no watermarks. 8K.`
  );
}

// Stage 2 prompt — Kontext edit instruction to verify and fix furniture
function buildStage2KontextPrompt(
  style: string,
  roomType: string,
  variant: 'A' | 'B'
): string {
  // Mandatory items that MUST be in the final image
  const mandatory: Record<string, string> = {
    'Bedroom':     'a large bed with headboard and pillows against the main wall, a wardrobe, bedside tables with lamps, curtains on the window',
    'Kitchen':     'kitchen cabinets along the walls with countertop, a sink, a stove with range hood, a refrigerator, an island or counter space',
    'Living Room': 'a large sofa with cushions, a coffee table, a TV unit, curtains on the window, a floor lamp or arc lamp',
    'Bathroom':    'a shower area with glass partition, a wash basin with mirror, storage, wall and floor tiles throughout',
    'Dining Room': 'a large dining table in the centre, chairs evenly placed around the table, a pendant light above the table, a sideboard',
    'Office':      'a desk with a chair, bookshelves or storage, a desk lamp, curtains on the window',
  };

  const items = mandatory[roomType] || '';

  return (
    `Look at this ${style} ${roomType} photograph carefully. ` +
    `Verify it contains ALL of these items: ${items}. ` +
    `If any item is missing or too small, add it in the correct position. ` +
    `If any item from a DIFFERENT room type is present (like a bed in a kitchen), remove it. ` +
    `Make sure the room looks completely furnished and professionally styled. ` +
    `Keep the photorealistic quality — real materials, natural lighting, visible textures. ` +
    `Keep the same camera angle, room shape, and colour palette. Do not change the overall look.`
  );
}

export async function redesignRoom(
  imageBase64: string,
  prompt: string,
  style: string,
  roomType: string,
  budgetValue = 300000,
  variant: 'A' | 'B' = 'A'
): Promise<string> {
  const seed = getBudgetSeed(budgetValue, style, roomType, variant);
  const stage1Prompt = buildStage1Prompt(style, roomType, budgetValue, variant, prompt);

  // ── STAGE 1: Depth-Pro generates photorealistic room ──────────────────────
  // Uses depth map from user's photo to preserve room structure
  // Generates with photorealistic materials, lighting, textures
  const stage1Url = await runModel({
    model: 'black-forest-labs/flux-depth-pro',
    input: {
      control_image: imageBase64,
      prompt: stage1Prompt,
      seed,
      guidance: 25,
      num_inference_steps: 50,
      output_format: 'jpg',
      output_quality: 95,
      safety_tolerance: 2,
    },
  });

  // ── STAGE 2: Kontext-Pro verifies and fixes furniture ─────────────────────
  // Takes depth-pro's photorealistic output and checks for missing furniture
  // Adds any missing items while preserving the photorealistic quality
  const stage2Prompt = buildStage2KontextPrompt(style, roomType, variant);

  const stage2Url = await runModel({
    model: 'black-forest-labs/flux-kontext-pro',
    input: {
      input_image: stage1Url,
      prompt: stage2Prompt,
      seed: seed + 42,
      aspect_ratio: 'match_input_image',
      output_format: 'jpg',
      safety_tolerance: 2,
    },
  });

  return stage2Url;
}

export async function generateRoomFromText(
  prompt: string,
  style: string,
  roomType: string,
  budgetValue = 300000,
  variant: 'A' | 'B' = 'A'
): Promise<string> {
  const seed = getBudgetSeed(budgetValue, style, roomType, variant);
  const stage1Prompt = buildStage1Prompt(style, roomType, budgetValue, variant, prompt);

  // Stage 1: flux-1.1-pro generates from text (no image to extract depth from)
  const stage1Url = await runModel({
    model: 'black-forest-labs/flux-1.1-pro',
    input: {
      prompt: stage1Prompt,
      seed,
      aspect_ratio: '4:3',
      output_format: 'jpg',
      output_quality: 95,
      safety_tolerance: 2,
      prompt_upsampling: true,
    },
  });

  // Stage 2: Kontext-Pro verifies and fixes furniture
  const stage2Prompt = buildStage2KontextPrompt(style, roomType, variant);

  return runModel({
    model: 'black-forest-labs/flux-kontext-pro',
    input: {
      input_image: stage1Url,
      prompt: stage2Prompt,
      seed: seed + 42,
      aspect_ratio: 'match_input_image',
      output_format: 'jpg',
      safety_tolerance: 2,
    },
  });
}

export async function generateBothDesigns(
  prompt: string,
  style: string,
  roomType: string,
  budgetValue: number,
  imageBase64?: string
): Promise<[string, string]> {
  if (imageBase64) {
    return Promise.all([
      redesignRoom(imageBase64, prompt, style, roomType, budgetValue, 'A'),
      redesignRoom(imageBase64, prompt, style, roomType, budgetValue, 'B'),
    ]);
  }
  return Promise.all([
    generateRoomFromText(prompt, style, roomType, budgetValue, 'A'),
    generateRoomFromText(prompt, style, roomType, budgetValue, 'B'),
  ]);
}

// ── Change category detection ─────────────────────────────────────────────────
type ChangeCategory =
  | 'flooring' | 'walls' | 'ceiling'
  | 'sofa' | 'bed' | 'chair' | 'table' | 'wardrobe' | 'desk'
  | 'lighting' | 'rug' | 'curtains' | 'plants' | 'decor' | 'full';

export function detectChangeCategory(instruction: string): ChangeCategory {
  const t = instruction.toLowerCase();
  if (/floor|flooring|tile|tiles|hardwood|parquet|laminate|vinyl|carpet|marble floor/.test(t)) return 'flooring';
  if (/wall|walls|paint|painted|wallpaper|paneling|panelling|plaster/.test(t)) return 'walls';
  if (/ceiling|celing/.test(t)) return 'ceiling';
  if (/sofa|couch|sectional|settee/.test(t)) return 'sofa';
  if (/\bbed\b|headboard|mattress/.test(t)) return 'bed';
  if (/\bchair|armchair|recliner/.test(t)) return 'chair';
  if (/\btable\b|countertop|island/.test(t)) return 'table';
  if (/wardrobe|almirah|closet|cupboard|cabinet/.test(t)) return 'wardrobe';
  if (/\bdesk\b|workstation/.test(t)) return 'desk';
  if (/light|lighting|lamp|pendant|chandelier|sconce/.test(t)) return 'lighting';
  if (/\brug\b|runner/.test(t)) return 'rug';
  if (/curtain|drape|blind|shutter/.test(t)) return 'curtains';
  if (/plant|greenery|foliage|botanical/.test(t)) return 'plants';
  if (/decor|decoration|artwork|art|mirror|vase|cushion|pillow/.test(t)) return 'decor';
  return 'full';
}

// ── Surgical change (Kontext-native — just describe the edit) ────────────────
export async function applyDesignChange(
  changeInstruction: string,
  style: string,
  roomType: string,
  budgetValue: number,
  originalImageBase64?: string
): Promise<string> {
  const category = detectChangeCategory(changeInstruction);

  // Kontext prompt for surgical changes — simply describe what to change
  let editPrompt: string;
  if (category === 'full') {
    editPrompt = `Completely redesign this ${roomType} in ${style} style. Replace all furniture with new ${style} furniture. Keep the same room shape, walls, and windows.`;
  } else {
    editPrompt = `In this ${style} ${roomType}, ${changeInstruction}. Keep everything else exactly the same — same walls, floor, other furniture, lighting, and room layout. Only change the ${category}.`;
  }

  let hash = budgetValue % 1000;
  for (let i = 0; i < changeInstruction.length; i++) hash += changeInstruction.charCodeAt(i) * (i + 3);
  const seed = (Math.abs(hash) % 2_147_483_647) + 1;

  if (originalImageBase64) {
    return runModel({
      model: 'black-forest-labs/flux-kontext-pro',
      input: {
        input_image: originalImageBase64,
        prompt: editPrompt,
        seed,
        aspect_ratio: 'match_input_image',
        output_format: 'jpg',
        safety_tolerance: 2,
      },
    });
  }

  // No image — just generate from text
  return runModel({
    model: 'black-forest-labs/flux-kontext-pro',
    input: {
      prompt: editPrompt,
      seed,
      aspect_ratio: '4:3',
      output_format: 'jpg',
      safety_tolerance: 2,
    },
  });
}

// ── Budget breakdown ──────────────────────────────────────────────────────────
export interface BudgetItem { item: string; estimatedCost: number; }

export function generateBudgetBreakdown(roomType: string, _style: string, totalBudget: number): BudgetItem[] {
  const alloc: Record<string, Record<string, number>> = {
    'Living Room': { 'Sofa & Seating': 0.30, 'Coffee & Side Tables': 0.12, 'Area Rug': 0.10, 'Lighting': 0.10, 'Window Treatments': 0.08, 'Wall Decor': 0.08, 'Storage': 0.12, 'Accents': 0.10 },
    'Bedroom': { 'Bed Frame & Headboard': 0.28, 'Mattress': 0.20, 'Bedding & Linens': 0.10, 'Wardrobe': 0.18, 'Nightstands': 0.08, 'Lighting': 0.08, 'Decor': 0.08 },
    'Kitchen': { 'Cabinetry': 0.35, 'Countertops': 0.20, 'Appliances': 0.25, 'Backsplash': 0.10, 'Lighting': 0.05, 'Hardware': 0.05 },
    'Bathroom': { 'Vanity & Sink': 0.25, 'Shower / Bath': 0.30, 'Tiles & Flooring': 0.20, 'Fixtures': 0.10, 'Lighting & Mirror': 0.10, 'Accessories': 0.05 },
    'Office': { 'Desk': 0.25, 'Ergonomic Chair': 0.20, 'Shelving': 0.15, 'Lighting': 0.12, 'Tech': 0.18, 'Decor': 0.10 },
    'Dining Room': { 'Dining Table': 0.35, 'Chairs': 0.25, 'Pendant Light': 0.15, 'Sideboard': 0.15, 'Decor': 0.10 },
  };
  const a = alloc[roomType] || alloc['Living Room'];
  return Object.entries(a).map(([item, ratio]) => ({ item, estimatedCost: Math.round(totalBudget * ratio) }));
}

// ── Scanned products ──────────────────────────────────────────────────────────
export interface ScannedProduct {
  name: string;
  description: string;
  priceRange: string;
  category: string;
  stores: { name: string; url: string; logo: string }[];
}

export function getScannedProducts(
  roomType: string,
  style: string,
  budgetValue = 300000,
  changeInstruction?: string
): ScannedProduct[] {

  const q = (s: string) => encodeURIComponent(s);
  const tier = getTier(budgetValue);

  function priceBand(ratio: number): { low: number; high: number; label: string } {
    const total = budgetValue * ratio;
    const low = Math.round((total * 0.85) / 500) * 500;
    const high = Math.round((total * 1.15) / 500) * 500;
    const fmt = (n: number) =>
      n >= 100000
        ? '\u20B9' + (n / 100000).toFixed(1).replace(/\.0$/, '') + ' L'
        : '\u20B9' + (n / 1000).toFixed(0) + 'K';
    return { low, high, label: fmt(low) + ' \u2013 ' + fmt(high) };
  }

  function pick(arr: string[]): string { return arr[tier - 1]; }

  const allocation: Record<string, Record<string, number>> = {
    'Living Room': { 'Sectional Sofa': 0.30, 'Coffee Table': 0.10, 'Area Rug': 0.08, 'Pendant Lamp': 0.08, 'Floating Shelf': 0.07 },
    'Bedroom': { 'Bed Frame & Headboard': 0.28, 'Mattress': 0.18, 'Wardrobe': 0.20, 'Bedside Table Set': 0.10, 'Bedside Lamp': 0.07 },
    'Kitchen': { 'Modular Cabinets': 0.35, 'Countertop / Island': 0.22, 'Range Hood': 0.15, 'Bar Stool Set (x2)': 0.08 },
    'Bathroom': { 'Floating Vanity': 0.25, 'Shower Enclosure': 0.28, 'Floor Tiles': 0.18, 'Backlit LED Mirror': 0.10 },
    'Office': { 'Work Desk': 0.25, 'Ergonomic Chair': 0.22, 'Bookshelf Unit': 0.18, 'Task Lamp': 0.10 },
    'Dining Room': { 'Dining Table': 0.35, 'Dining Chairs (x4)': 0.25, 'Pendant Light': 0.15, 'Sideboard Cabinet': 0.15 },
  };

  type Meta = { desc: string; cat: string; search: string };

  // Style-aware search helper: the style modifier makes product searches match visual output
  // e.g. Modern bedroom = white sliding wardrobe; Japandi = pale ash wardrobe
  const styleMod = style === 'Modern' ? 'modern white' :
    style === 'Scandinavian' ? 'scandinavian pine birch' :
      style === 'Industrial' ? 'industrial metal black' :
        style === 'Bohemian' ? 'bohemian rattan wicker' :
          style === 'Luxury' ? 'luxury velvet brass' :
            style === 'Farmhouse' ? 'farmhouse rustic wood' :
              style === 'Art Deco' ? 'art deco gold geometric' :
                style === 'Japandi' ? 'japandi ash wood minimal' :
                  style.toLowerCase();

  const metaMap: Record<string, Record<string, Meta>> = {
    'Living Room': {
      'Sectional Sofa': {
        desc: pick([
          'White MDF-frame 3-seater fabric sofa',
          'Light-walnut rubberwood L-shape fabric sectional sofa',
          'Solid sheesham-leg fabric sectional sofa',
          'Velvet bouclé sectional sofa solid hardwood legs',
          'Italian bespoke leather sectional sofa',
        ]),
        cat: 'Seating',
        search: pick([
          styleMod + ' fabric L shape sofa MDF frame 3 seater',
          styleMod + ' fabric sectional sofa rubberwood legs',
          styleMod + ' solid sheesham sectional sofa upholstered',
          styleMod + ' velvet bouclé sectional sofa solid wood',
          styleMod + ' Italian leather bespoke sectional sofa luxury',
        ]),
      },
      'Coffee Table': {
        desc: pick([
          'White MDF laminate rectangular coffee table',
          'Engineered wood veneer coffee table with shelf',
          'Solid sheesham wood coffee table with storage',
          'Marble-top brass-leg coffee table',
          'Calacatta marble bespoke coffee table',
        ]),
        cat: 'Tables',
        search: pick([
          styleMod + ' MDF white coffee table rectangular',
          styleMod + ' engineered wood coffee table with shelf',
          styleMod + ' solid sheesham coffee table with storage',
          styleMod + ' marble top coffee table brass legs',
          styleMod + ' Italian marble luxury coffee table',
        ]),
      },
      'Area Rug': {
        desc: pick([
          'Polypropylene flatweave area rug',
          'Cotton geometric flatweave area rug',
          'Wool-blend geometric area rug',
          'Hand-knotted wool area rug',
          'Handmade silk luxury area rug',
        ]),
        cat: 'Flooring',
        search: pick([
          styleMod + ' polypropylene flatweave area rug living room',
          styleMod + ' cotton geometric area rug',
          styleMod + ' wool blend geometric area rug',
          styleMod + ' hand knotted wool area rug',
          styleMod + ' handmade silk luxury area rug',
        ]),
      },
      'Pendant Lamp': {
        desc: pick([
          'White plastic flush-mount ceiling pendant',
          'Brushed-metal shade pendant ceiling lamp',
          'Rattan woven designer pendant lamp',
          'Brass statement chandelier pendant',
          'Swarovski crystal chandelier pendant',
        ]),
        cat: 'Lighting',
        search: pick([
          styleMod + ' white plastic flush mount pendant ceiling light',
          styleMod + ' metal shade pendant ceiling lamp',
          styleMod + ' rattan woven pendant lamp ceiling',
          styleMod + ' brass statement pendant chandelier',
          styleMod + ' crystal luxury chandelier pendant',
        ]),
      },
      'Floating Shelf': {
        desc: pick([
          'White MDF floating wall shelf',
          'Pine wood floating wall shelf',
          'Solid teak floating wall shelf',
          'Solid dark walnut floating shelf',
          'Italian bespoke solid hardwood wall shelf',
        ]),
        cat: 'Storage',
        search: pick([
          styleMod + ' white MDF floating wall shelf',
          styleMod + ' pine wood floating wall shelf',
          styleMod + ' solid teak floating wall shelf',
          styleMod + ' solid walnut floating shelf wall mounted',
          styleMod + ' bespoke solid wood luxury wall shelf',
        ]),
      },
    },

    'Bedroom': {
      'Bed Frame & Headboard': {
        desc: pick([
          'White MDF platform bed with padded fabric headboard',
          'Engineered-wood upholstered bed with tall headboard',
          'Solid sheesham platform bed with upholstered headboard',
          'Solid walnut bed with tall leather-padded headboard',
          'Italian bespoke bed with custom upholstered headboard',
        ]),
        cat: 'Beds',
        search: pick([
          styleMod + ' white MDF bed frame padded fabric headboard',
          styleMod + ' engineered wood upholstered bed tall headboard',
          styleMod + ' solid sheesham platform bed upholstered headboard',
          styleMod + ' solid walnut bed frame leather headboard',
          styleMod + ' Italian bespoke luxury bed custom headboard',
        ]),
      },
      'Mattress': {
        desc: pick([
          'Basic foam mattress double/queen',
          'Orthopaedic rebonded foam mattress',
          'Memory foam pocket spring mattress',
          'Latex hybrid premium mattress',
          'Natural latex ultra-luxury mattress',
        ]),
        cat: 'Mattress',
        search: pick([
          'basic foam mattress double queen size',
          'orthopaedic rebonded foam mattress double queen',
          'memory foam pocket spring mattress queen size',
          'latex hybrid premium mattress queen size',
          'natural latex luxury mattress queen king',
        ]),
      },
      'Wardrobe': {
        desc: pick([
          'White MDF 3-door sliding wardrobe',
          'Engineered wood sliding-door wardrobe with mirror',
          'Solid wood floor-to-ceiling wardrobe with mirror panel',
          'Solid walnut wardrobe with integrated LED strip',
          'Italian bespoke fitted walk-in wardrobe',
        ]),
        cat: 'Storage',
        search: pick([
          styleMod + ' white MDF 3 door sliding wardrobe bedroom',
          styleMod + ' engineered wood sliding wardrobe with mirror',
          styleMod + ' solid wood floor to ceiling wardrobe mirror',
          styleMod + ' solid walnut wardrobe LED strip lighting',
          styleMod + ' Italian bespoke fitted wardrobe luxury bedroom',
        ]),
      },
      'Bedside Table Set': {
        desc: pick([
          'White MDF bedside table set of 2',
          'Engineered-wood nightstand pair',
          'Solid wood bedside table pair with drawer',
          'Solid walnut bedside table pair with drawer',
          'Marble-top bedside table pair luxury',
        ]),
        cat: 'Tables',
        search: pick([
          styleMod + ' white MDF bedside table set 2 bedroom',
          styleMod + ' engineered wood nightstand pair bedroom',
          styleMod + ' solid wood bedside table set 2 with drawer',
          styleMod + ' solid walnut bedside table pair drawer',
          styleMod + ' marble top bedside table pair luxury',
        ]),
      },
      'Bedside Lamp': {
        desc: pick([
          'White plastic table lamp for bedside',
          'Fabric-shade bedside table lamp',
          'Ceramic designer bedside lamp',
          'Brass designer bedside table lamp',
          'Luxury bespoke designer bedside lamp',
        ]),
        cat: 'Lighting',
        search: pick([
          styleMod + ' white plastic bedside table lamp bedroom',
          styleMod + ' fabric shade bedside table lamp',
          styleMod + ' ceramic designer bedside table lamp',
          styleMod + ' brass designer bedside lamp',
          styleMod + ' luxury bespoke designer bedside lamp',
        ]),
      },
    },

    'Kitchen': {
      'Modular Cabinets': {
        desc: pick([
          'Budget white laminate modular kitchen cabinets',
          'Engineered wood modular kitchen unit light walnut',
          'Acrylic-finish handleless modular kitchen',
          'PU lacquer handleless modular kitchen premium',
          'Italian bespoke kitchen cabinetry luxury',
        ]),
        cat: 'Cabinetry',
        search: pick([
          styleMod + ' white laminate modular kitchen cabinet budget',
          styleMod + ' engineered wood modular kitchen unit',
          styleMod + ' acrylic finish handleless modular kitchen',
          styleMod + ' PU lacquer modular kitchen premium',
          styleMod + ' Italian bespoke kitchen cabinetry luxury',
        ]),
      },
      'Countertop / Island': {
        desc: pick([
          'Granite-look laminate kitchen countertop',
          'Quartz composite kitchen countertop',
          'Engineered quartz waterfall island countertop',
          'Imported Carrara marble kitchen countertop',
          'Calacatta marble waterfall island luxury',
        ]),
        cat: 'Counters',
        search: pick([
          styleMod + ' granite laminate kitchen countertop',
          styleMod + ' quartz composite kitchen countertop',
          styleMod + ' engineered quartz waterfall island countertop',
          styleMod + ' imported Carrara marble kitchen countertop',
          styleMod + ' Calacatta marble waterfall island luxury',
        ]),
      },
      'Range Hood': {
        desc: pick([
          'Basic wall-mounted kitchen chimney',
          'Stainless steel kitchen chimney',
          'Curved glass kitchen chimney',
          'Pyramid glass chimney hood premium',
          'Bespoke designer range hood luxury',
        ]),
        cat: 'Appliance',
        search: pick([
          styleMod + ' wall mounted kitchen chimney basic',
          styleMod + ' stainless steel kitchen chimney',
          styleMod + ' curved glass kitchen chimney',
          styleMod + ' pyramid glass chimney hood premium',
          styleMod + ' bespoke designer range hood luxury',
        ]),
      },
      'Bar Stool Set (x2)': {
        desc: pick([
          'Plastic bar stools pair',
          'Powder-coated metal counter stools pair',
          'Solid wood upholstered bar stools pair',
          'Velvet upholstered solid-wood bar stools pair',
          'Italian leather bar stools pair luxury',
        ]),
        cat: 'Seating',
        search: pick([
          styleMod + ' plastic bar stool set 2 counter height',
          styleMod + ' metal counter height bar stool set 2',
          styleMod + ' solid wood upholstered bar stool set 2',
          styleMod + ' velvet solid wood bar stool pair premium',
          styleMod + ' Italian leather bar stool pair luxury',
        ]),
      },
    },

    'Bathroom': {
      'Floating Vanity': {
        desc: pick([
          'White MDF wall-hung vanity with rectangular basin',
          'Engineered-wood floating vanity with undermount sink',
          'Solid-wood floating vanity with double basin',
          'Solid-teak floating double vanity premium',
          'Italian marble floating double vanity luxury',
        ]),
        cat: 'Vanity',
        search: pick([
          styleMod + ' white MDF wall hung bathroom vanity basin',
          styleMod + ' engineered wood floating bathroom vanity undermount sink',
          styleMod + ' solid wood floating double vanity basin',
          styleMod + ' solid teak floating double vanity premium',
          styleMod + ' Italian marble bathroom vanity luxury',
        ]),
      },
      'Shower Enclosure': {
        desc: pick([
          'Basic framed aluminium shower cubicle',
          'Semi-frameless glass shower enclosure',
          'Frameless glass walk-in shower enclosure',
          'Frameless walk-in shower with rain-head premium',
          'Custom frameless glass walk-in shower luxury',
        ]),
        cat: 'Shower',
        search: pick([
          styleMod + ' framed aluminium shower cubicle',
          styleMod + ' semi frameless glass shower enclosure',
          styleMod + ' frameless glass walk-in shower enclosure',
          styleMod + ' frameless walk-in shower rain-head premium',
          styleMod + ' custom frameless glass walk-in shower luxury',
        ]),
      },
      'Floor Tiles': {
        desc: pick([
          'White ceramic floor tiles 300x300mm',
          'Cream vitrified floor tiles 600x600mm',
          'Large-format porcelain floor tiles 800x800mm',
          'Marble-look large-format porcelain slab tiles',
          'Book-matched Calacatta marble slab floor tiles',
        ]),
        cat: 'Tiles',
        search: pick([
          styleMod + ' white ceramic floor tile 300x300 bathroom',
          styleMod + ' cream vitrified floor tile 600x600',
          styleMod + ' large format porcelain floor tile 800x800 bathroom',
          styleMod + ' marble look large format porcelain slab tile',
          styleMod + ' book matched Calacatta marble slab floor tile luxury',
        ]),
      },
      'Backlit LED Mirror': {
        desc: pick([
          'Basic rectangular LED bathroom mirror',
          'Frameless LED bathroom mirror wall-mounted',
          'Sensor-touch LED bathroom mirror with demister',
          'Anti-fog sensor LED bathroom mirror premium',
          'Smart full-width backlit LED bathroom mirror',
        ]),
        cat: 'Mirror',
        search: pick([
          styleMod + ' rectangular LED bathroom mirror wall mounted',
          styleMod + ' frameless LED bathroom mirror',
          styleMod + ' sensor touch LED bathroom mirror demister',
          styleMod + ' anti fog sensor LED bathroom mirror premium',
          styleMod + ' smart backlit full width LED bathroom mirror luxury',
        ]),
      },
    },

    'Office': {
      'Work Desk': {
        desc: pick([
          'White MDF computer desk with cable management',
          'Engineered-wood home office desk with drawer',
          'Solid wood floating wall-mounted executive desk',
          'Solid walnut executive desk with metal frame',
          'Italian bespoke solid rosewood executive desk',
        ]),
        cat: 'Desk',
        search: pick([
          styleMod + ' white MDF computer desk cable management',
          styleMod + ' engineered wood home office desk with drawer',
          styleMod + ' solid wood floating wall mounted executive desk',
          styleMod + ' solid walnut executive desk metal frame',
          styleMod + ' Italian rosewood bespoke executive desk luxury',
        ]),
      },
      'Ergonomic Chair': {
        desc: pick([
          'Basic mesh office chair',
          'Mid-back ergonomic mesh chair with lumbar',
          'High-back ergonomic chair with adjustable lumbar',
          'Premium full-back ergonomic chair with headrest',
          'Italian leather executive ergonomic chair',
        ]),
        cat: 'Seating',
        search: pick([
          styleMod + ' basic mesh office chair',
          styleMod + ' mid back ergonomic mesh office chair lumbar',
          styleMod + ' high back ergonomic office chair adjustable lumbar',
          styleMod + ' premium full back ergonomic chair headrest',
          styleMod + ' Italian leather executive ergonomic office chair',
        ]),
      },
      'Bookshelf Unit': {
        desc: pick([
          'White MDF bookshelf unit floor-standing',
          'Engineered-wood open bookcase',
          'Solid wood floor-to-ceiling open bookshelf',
          'Solid walnut built-in floor-to-ceiling bookshelf',
          'Italian bespoke library shelving system',
        ]),
        cat: 'Storage',
        search: pick([
          styleMod + ' white MDF bookshelf unit floor standing',
          styleMod + ' engineered wood open bookcase',
          styleMod + ' solid wood floor to ceiling open bookshelf',
          styleMod + ' solid walnut floor to ceiling bookshelf',
          styleMod + ' Italian bespoke library shelving luxury',
        ]),
      },
      'Task Lamp': {
        desc: pick([
          'White plastic adjustable LED desk lamp',
          'Metal arm adjustable LED desk lamp',
          'Architect-style adjustable LED task lamp',
          'Brass designer architect LED task lamp',
          'Italian luxury designer LED task lamp',
        ]),
        cat: 'Lighting',
        search: pick([
          styleMod + ' white plastic adjustable LED desk lamp',
          styleMod + ' metal arm adjustable LED desk lamp',
          styleMod + ' architect adjustable LED task lamp',
          styleMod + ' brass designer architect LED task lamp',
          styleMod + ' Italian luxury designer LED desk lamp',
        ]),
      },
    },

    'Dining Room': {
      'Dining Table': {
        desc: pick([
          'White MDF rectangular dining table 6-seater',
          'Engineered-wood dining table 6-seater',
          'Solid sheesham rectangular dining table 6-seater',
          'Solid walnut dining table with tapered metal legs',
          'Italian marble-top dining table luxury 6-seater',
        ]),
        cat: 'Tables',
        search: pick([
          styleMod + ' white MDF rectangular dining table 6 seater',
          styleMod + ' engineered wood dining table 6 seater',
          styleMod + ' solid sheesham rectangular dining table 6 seater',
          styleMod + ' solid walnut dining table tapered metal legs',
          styleMod + ' Italian marble top dining table luxury 6 seater',
        ]),
      },
      'Dining Chairs (x4)': {
        desc: pick([
          'White plastic dining chairs set of 4',
          'Fabric upholstered dining chairs set of 4',
          'Solid wood upholstered dining chairs set of 4',
          'Velvet upholstered solid wood dining chairs set of 4',
          'Italian leather dining chairs set of 4 luxury',
        ]),
        cat: 'Seating',
        search: pick([
          styleMod + ' white plastic dining chair set 4',
          styleMod + ' fabric upholstered dining chair set 4',
          styleMod + ' solid wood upholstered dining chair set 4',
          styleMod + ' velvet solid wood dining chair set 4',
          styleMod + ' Italian leather dining chair set 4 luxury',
        ]),
      },
      'Pendant Light': {
        desc: pick([
          'Basic metal pendant light for dining room',
          'Industrial metal pendant light',
          'Designer sculptural pendant lamp dining room',
          'Brushed brass statement pendant dining room',
          'Crystal chandelier pendant dining room luxury',
        ]),
        cat: 'Lighting',
        search: pick([
          styleMod + ' metal pendant light dining room',
          styleMod + ' industrial metal pendant light dining',
          styleMod + ' designer sculptural pendant lamp dining room',
          styleMod + ' brushed brass statement pendant dining room',
          styleMod + ' crystal chandelier pendant dining room luxury',
        ]),
      },
      'Sideboard Cabinet': {
        desc: pick([
          'White MDF sideboard buffet cabinet',
          'Engineered-wood buffet sideboard',
          'Solid sheesham sideboard cabinet',
          'Solid walnut sideboard with brass handles',
          'Italian bespoke sideboard cabinet luxury',
        ]),
        cat: 'Storage',
        search: pick([
          styleMod + ' white MDF sideboard buffet cabinet dining',
          styleMod + ' engineered wood buffet sideboard',
          styleMod + ' solid sheesham sideboard cabinet',
          styleMod + ' solid walnut sideboard brass handles',
          styleMod + ' Italian bespoke sideboard luxury dining',
        ]),
      },
    },
  }
  const alloc = allocation[roomType] || allocation['Living Room'];
  const items = metaMap[roomType] || metaMap['Living Room'];

  const catToProduct: Partial<Record<ChangeCategory, string>> = {
    flooring: 'Area Rug', sofa: 'Sectional Sofa',
    bed: 'Bed Frame & Headboard', lighting: 'Pendant Lamp',
    wardrobe: 'Wardrobe', desk: 'Work Desk',
    table: 'Coffee Table', rug: 'Area Rug',
  };
  const changedCat = changeInstruction ? detectChangeCategory(changeInstruction) : null;
  const changedName = changedCat ? catToProduct[changedCat] : null;

  const products: ScannedProduct[] = Object.entries(alloc).map(([name, ratio]) => {
    const m = items[name] || { desc: name, cat: 'Furniture', search: name };
    const { low, high, label } = priceBand(ratio);

    const amazonUrl = 'https://www.amazon.in/s?k=' + q(m.search) + '&rh=p_36%3A' + (low * 100) + '-' + (high * 100) + '&s=review-rank';
    const flipkartUrl = 'https://www.flipkart.com/search?q=' + q(m.search) + '&p%5B%5D=facets.price_range.from%3D' + low + '&p%5B%5D=facets.price_range.to%3D' + high + '&sort=popularity_desc';
    const ikeaUrl = 'https://www.ikea.com/in/en/search/?q=' + q(m.search);

    return {
      name,
      description: m.desc,
      priceRange: label,
      category: m.cat,
      stores: [
        { name: 'Amazon', logo: '\uD83D\uDED2', url: amazonUrl },
        { name: 'Flipkart', logo: '\uD83D\uDECD\uFE0F', url: flipkartUrl },
        { name: 'IKEA', logo: '\uD83D\uDECB\uFE0F', url: ikeaUrl },
      ],
    };
  });

  if (changedName) {
    const idx = products.findIndex(p => p.name === changedName);
    if (idx > 0) products.unshift(...products.splice(idx, 1));
  }

  return products;
}

// ── Change agent: image + products ───────────────────────────────────────────
export interface ChangeResult {
  newImageUrl: string;
  updatedProducts: ScannedProduct[];
  changeCategory: string;
}

export async function applyDesignChangeWithProducts(
  changeInstruction: string,
  style: string,
  roomType: string,
  budgetValue: number,
  originalImageBase64?: string
): Promise<ChangeResult> {
  const category = detectChangeCategory(changeInstruction);
  const [newImageUrl, updatedProducts] = await Promise.all([
    applyDesignChange(changeInstruction, style, roomType, budgetValue, originalImageBase64),
    Promise.resolve(getScannedProducts(roomType, style, budgetValue, changeInstruction)),
  ]);
  return { newImageUrl, updatedProducts, changeCategory: category };
}


// ── Inpainting (Feature 2) ─────────────────────────────────────────────────
export async function applyInpaintDesign(
  imageBase64: string,
  maskBase64: string,
  instruction: string,
  style: string
): Promise<string> {
  const instructionPart = instruction ? `${instruction}. ` : '';
  const prompt =
    `${instructionPart}Hyperrealistic ${style} style interior design. ` +
    `Ultra-photorealistic professional interior photography, 8K quality. ` +
    `Seamlessly blend with surrounding areas. No people, no text.`;

  // Use FLUX Fill Pro — actively maintained inpainting model on Replicate
  return runModel({
    model: 'black-forest-labs/flux-fill-pro',
    input: {
      image: imageBase64,
      mask: maskBase64,
      prompt,
      num_inference_steps: 28,
      guidance: 30,
      output_format: 'jpg',
      output_quality: 95,
      safety_tolerance: 2,
    },
  });
}
// ── Chat ──────────────────────────────────────────────────────────────────────
// Detects which product category the user is asking about
function detectChatProductCategory(userText: string): string | null {
  const t = userText.toLowerCase();
  if (/sofa|couch|seating/.test(t)) return 'Sectional Sofa';
  if (/rug|carpet|flooring/.test(t)) return 'Area Rug';
  if (/light|lamp|lighting|pendant/.test(t)) return 'Pendant Lamp';
  if (/shelf|shelv|bookcase|storage/.test(t)) return 'Floating Shelf';
  if (/coffee table|side table|table/.test(t)) return 'Coffee Table';
  if (/bed|mattress/.test(t)) return 'Bed Frame & Headboard';
  if (/wardrobe|closet|cabinet/.test(t)) return 'Wardrobe';
  if (/desk|chair|office|work/.test(t)) return 'Work Desk';
  if (/curtain|blind|window/.test(t)) return null; // no match
  return null; // show all products
}

export async function sendChatMessage(
  messages: { role: 'user' | 'assistant'; content: string }[],
  designContext: { roomType: string; style: string; budget: string; prompt: string; imageUrl?: string; budgetValue?: number }
): Promise<{ reply: string; changeDetected?: boolean; changePrompt?: string; products?: ScannedProduct[] }> {
  const API_BASE = import.meta.env?.VITE_API_BASE ?? 'http://localhost:3001';
  const res = await fetch(`${API_BASE}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, designContext }),
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e.detail || 'Chat error');
  }
  const data = await res.json();
  
  // Generate relevant products with store links based on last user message
  const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
  const userText = lastUserMsg?.content || '';
  const budgetValue = designContext.budgetValue || 300000;
  
  // Get products filtered to what the user is asking about
  const allProducts = getScannedProducts(designContext.roomType, designContext.style, budgetValue);
  const focusCategory = detectChatProductCategory(userText);
  
  let relevantProducts: ScannedProduct[];
  if (focusCategory) {
    // Put the matching product first, include all for context
    const idx = allProducts.findIndex(p => p.name === focusCategory || p.name.toLowerCase().includes(focusCategory.toLowerCase().split(' ')[0]));
    if (idx >= 0) {
      relevantProducts = [allProducts[idx], ...allProducts.filter((_, i) => i !== idx)].slice(0, 4);
    } else {
      relevantProducts = allProducts.slice(0, 4);
    }
  } else {
    // General question — show all products
    relevantProducts = allProducts.slice(0, 5);
  }
  
  return { 
    reply: data.reply, 
    changeDetected: false, 
    changePrompt: undefined,
    products: relevantProducts,
  };
}
