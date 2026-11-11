// Text -> vector embeddings for semantic (meaning-based) search.
//
// Provider "transformers": all-MiniLM-L6-v2 sentence-transformer (384-d),
//   runs locally in Node via @huggingface/transformers (model is downloaded
//   once from Hugging Face and cached).
// Provider "local": an offline, dependency-free fallback.  It maps
//   maintenance vocabulary to shared concepts ("gets too hot" / "thermal" /
//   "overheating" -> THERMAL; "switches off" / "powers off" / "shuts down"
//   -> SHUTDOWN ...) and hashes concepts + words + bigrams into a 384-d
//   vector.  Less powerful than a neural model but works with no internet.
//
// EMBEDDING_PROVIDER = auto (default) | transformers | local
// Every stored vector records its `embedding_model`; only vectors from the
// same model are ever compared.  Run `npm run kb:sync` after switching.

export const DIM = 384;
const LOCAL_MODEL = 'labtrace-concept-hash-v1';
const HF_MODEL = 'Xenova/all-MiniLM-L6-v2';

// ---------------------------------------------------------------- local
const CONCEPTS = [
  ['THERMAL', ['hot', 'heat', 'heats', 'heating', 'overheat', 'overheats', 'overheating', 'thermal', 'temperature', 'temp', 'warm', 'burning', 'throttling', 'throttle', 'heatsink', 'cooling', 'cooler']],
  ['SHUTDOWN', ['switches off', 'switch off', 'turns off', 'turn off', 'turned off', 'powers off', 'power off', 'shuts down', 'shut down', 'shutdown', 'shutting down', 'reboots', 'reboot', 'restarts', 'restart', 'restarting', 'dies', 'goes off', 'crashes', 'crash']],
  ['FAN', ['fan', 'fans', 'noise', 'noisy', 'loud', 'grinding', 'rattling', 'rpm']],
  ['NOPOWER', ['does not turn on', 'not turning on', 'no power', 'dead', 'no lights', 'wont start', "won't start", 'not starting', 'burning smell', 'smps', 'psu', 'power supply']],
  ['DISPLAY', ['no display', 'black screen', 'blank', 'screen', 'monitor', 'display', 'flicker', 'flickers', 'flickering', 'artifacts', 'image', 'dim', 'dark']],
  ['MEMORY', ['ram', 'memory', 'dimm', 'beep', 'beeps', 'beeping', 'out of memory', 'ecc', 'memtest']],
  ['STORAGE', ['disk', 'hdd', 'ssd', 'drive', 'storage', 'raid', 'clicking', 'corrupted', 'sectors', 'slow boot', 'read errors']],
  ['SLOW', ['slow', 'slowly', 'lag', 'lagging', 'hang', 'hangs', 'freeze', 'freezes', 'frozen', 'stuck', 'takes long']],
  ['GPU', ['gpu', 'cuda', 'nvidia', 'nvidia-smi', 'graphics card', 'vram', 'training', 'pytorch', 'tensorflow', 'deep learning']],
  ['OS', ['blue screen', 'bsod', 'windows', 'ubuntu', 'driver', 'kernel', 'os', 'stop error', 'boot loop', 'update']],
  ['NETWORK', ['internet', 'network', 'lan', 'ethernet', 'switch', 'port', 'ports', 'router', 'offline', 'disconnect', 'disconnects', 'disconnecting', 'dropping', 'drops', 'unreachable', 'ssh', 'ping']],
  ['WIFI', ['wifi', 'wi-fi', 'wireless', 'access point', 'signal']],
  ['INPUT', ['keyboard', 'keys', 'mouse', 'cursor', 'usb', 'not detected', 'port not found']],
  ['BATTERY', ['battery', 'charging', 'charge', 'unplugged', 'cmos', 'clock resets', 'time resets']],
  ['SIGNAL', ['oscilloscope', 'probe', 'trace', 'waveform', 'channel', 'signal', 'output', 'function generator', 'amplitude', 'frequency']],
  ['VOLTAGE', ['voltage', 'current', 'fluctuates', 'fluctuating', 'unstable', 'fuse', 'bench supply']],
  ['PROJECTOR', ['projector', 'lamp', 'projection', 'projected', 'filter']],
  ['PRINTER3D', ['3d printer', 'filament', 'nozzle', 'extruder', 'extruding', 'bed', 'print', 'layer']],
  ['BOARD', ['arduino', 'raspberry', 'pi', 'esp32', 'board', 'sd card', 'upload code', 'microcontroller']],
  ['PCDEVICE', ['computer', 'pc', 'desktop', 'workstation', 'cpu', 'cabinet', 'system', 'machine', 'laptop']],
  ['HEAVYLOAD', ['heavy', 'load', 'processing', 'compiling', 'compile', 'running for some time', 'after some time', 'long', 'full load', 'under load']],
];
const STOP = new Set('the a an is are was were be been it its this that and or of to in on at for with by from my our your after when while very so too then there has have had not no but some any all can cannot could will would should about into during gets get got becomes become lab'.split(' '));

function hash32(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function addFeature(vec, feature, weight) {
  const h = hash32(feature);
  const h2 = hash32('#' + feature);
  vec[h % DIM] += (h2 & 1 ? 1 : -1) * weight;
  vec[h2 % DIM] += (h & 1 ? 1 : -1) * weight * 0.5;
}

function normalize(vec) {
  let n = 0;
  for (const v of vec) n += v * v;
  n = Math.sqrt(n) || 1;
  return vec.map((v) => v / n);
}

export function localEmbed(text) {
  const t = ' ' + String(text || '').toLowerCase().replace(/[^a-z0-9\s'-]/g, ' ').replace(/\s+/g, ' ') + ' ';
  const vec = new Array(DIM).fill(0);
  for (const [concept, phrases] of CONCEPTS) {
    let hits = 0;
    for (const p of phrases) if (t.includes(' ' + p + ' ')) hits++;
    if (hits) addFeature(vec, 'C:' + concept, 3 + Math.min(hits, 3));
  }
  const words = t.trim().split(' ').filter((w) => w.length > 2 && !STOP.has(w));
  for (const w of words) addFeature(vec, 'W:' + w.replace(/(ing|ed|es|s)$/, ''), 1);
  for (let i = 0; i < words.length - 1; i++) addFeature(vec, 'B:' + words[i] + '_' + words[i + 1], 0.7);
  return normalize(vec);
}

// ---------------------------------------------------------------- transformers
let extractorPromise = null;
async function getExtractor() {
  if (!extractorPromise) {
    extractorPromise = (async () => {
      // optional dependency: loaded at runtime only (not bundled), so the app builds without it
      const mod = '@huggingface/transformers';
      const { pipeline } = await import(/* webpackIgnore: true */ /* turbopackIgnore: true */ mod);
      return pipeline('feature-extraction', HF_MODEL, { dtype: 'fp32' });
    })().catch((e) => {
      extractorPromise = null;
      throw e;
    });
  }
  return extractorPromise;
}

let resolvedProvider = null; // cached decision for "auto"

export async function embed(text) {
  const wanted = (process.env.EMBEDDING_PROVIDER || 'auto').toLowerCase();
  if (wanted === 'local' || resolvedProvider === 'local') {
    return { vector: localEmbed(text), model: LOCAL_MODEL };
  }
  try {
    const extractor = await getExtractor();
    const out = await extractor(String(text || ''), { pooling: 'mean', normalize: true });
    resolvedProvider = 'transformers';
    return { vector: Array.from(out.data), model: HF_MODEL };
  } catch (e) {
    if (wanted === 'transformers') throw e;
    if (resolvedProvider !== 'local') console.warn('[embeddings] transformers unavailable, using local embeddings:', e.message);
    resolvedProvider = 'local';
    return { vector: localEmbed(text), model: LOCAL_MODEL };
  }
}

export function cosine(a, b) {
  let dot = 0, na = 0, nb = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) || 1);
}
