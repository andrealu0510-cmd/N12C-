'use strict';
/* CAYA 6.2: visual-only repair. No price, promotion, login or release data is changed.
   The existing authenticated image is repaired in memory; no source assets are fetched. */
(() => {
  const VERSION = '6.2-motion';
  const ORIGINAL_GIF_SHA = '9a9517344bc8e16983d9731e36396ccf0b52669f2011657a8068717297b76a4c';
  const PREFERENCE = 'caya_motion_paused_v1';
  const converted = new Map();
  const STYLE = `
    #cayaLaunch{background:linear-gradient(145deg,#ffffff,#f1fbf7);border-color:#badbd4;box-shadow:0 4px 12px #14494014!important}
    #cayaPanel{box-shadow:0 8px 24px #163f481f!important;border-color:#c1dbd5}
    #cayaLaunch img,#cayaPanel>.caya-head>img{filter:none!important;box-shadow:none!important;text-shadow:none!important}
    html.caya-motion-ready #cayaLaunch .caya-still{display:none!important}
    html.caya-motion-ready #cayaLaunch .caya-animated{display:block!important}
    html.caya-motion-paused #cayaLaunch .caya-still{display:block!important}
    html.caya-motion-paused #cayaLaunch .caya-animated{display:none!important}
    #cayaMotionToggle{font-size:11px!important;line-height:1.4;padding:5px 7px!important;border:1px solid #bcd8d0!important;border-radius:8px;min-height:32px;white-space:nowrap;color:#225e53;background:#ffffffb8!important}
    #cayaMotionToggle[aria-pressed="true"]{color:#62766f;background:#f5f7f6!important}
    @media(max-width:480px){#cayaPanel>.caya-head{gap:6px}#cayaMotionToggle{font-size:10px!important;padding:4px 5px!important}#cayaPanel>.caya-head>img{width:43px;height:48px}}
    @media print{#cayaMotionToggle{display:none!important}}
  `;
  function savedPreference() {
    try { const v = localStorage.getItem(PREFERENCE); return v === null ? null : v === 'true'; }
    catch { return null; }
  }
  async function cleanGif(source) {
    if (converted.has(source)) return converted.get(source);
    const task = (async () => {
      if (!/^data:image\/gif;base64,/i.test(source)) return { source, frames: 0 };
      const binary = atob(source.slice(source.indexOf(',') + 1));
      const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
      const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), v => v.toString(16).padStart(2, '0')).join('');
      // Only repair the known defective mascot. Future artwork is not rewritten.
      if (digest !== ORIGINAL_GIF_SHA) return { source, frames: 0 };
      let pos = 13 + ((bytes[10] & 128) ? 3 * (1 << ((bytes[10] & 7) + 1)) : 0);
      let frames = 0, controls = 0;
      const delays = [55, 12, 12, 16, 12, 12, 55]; // hundredths of a second
      const skipBlocks = () => {
        while (pos < bytes.length) {
          const length = bytes[pos++];
          if (!length) return;
          pos += length;
          if (pos > bytes.length) throw Error('Truncated GIF block');
        }
        throw Error('Missing GIF block terminator');
      };
      while (pos < bytes.length) {
        const type = bytes[pos++];
        if (type === 0x3b) break;
        if (type === 0x21) {
          const label = bytes[pos++];
          if (label === 0xf9) {
            if (bytes[pos] !== 4 || pos + 5 >= bytes.length) throw Error('Invalid GIF control');
            // Restore background before every full frame, instead of accumulating poses.
            bytes[pos + 1] = (bytes[pos + 1] & ~0x1c) | 0x08;
            bytes[pos + 2] = delays[controls] || 12;
            bytes[pos + 3] = 0;
            controls++;
          }
          skipBlocks();
        } else if (type === 0x2c) {
          if (pos + 9 > bytes.length) throw Error('Invalid GIF image descriptor');
          const flags = bytes[pos + 8];
          pos += 9;
          if (flags & 128) pos += 3 * (1 << ((flags & 7) + 1));
          pos++; // LZW minimum code size
          skipBlocks();
          frames++;
        } else throw Error('Unknown GIF block');
      }
      if (frames !== 7 || controls !== 7) throw Error('Unexpected mascot frame count');
      let output = '';
      for (let i = 0; i < bytes.length; i += 8192) output += String.fromCharCode(...bytes.subarray(i, i + 8192));
      return { source: 'data:image/gif;base64,' + btoa(output), frames };
    })();
    converted.set(source, task);
    return task;
  }
  async function install(doc) {
    const launch = doc?.getElementById('cayaLaunch');
    const panel = doc?.getElementById('cayaPanel');
    if (!launch || !panel || doc.documentElement.dataset.cayaMotion === VERSION) return;
    const animated = launch.querySelector('.caya-animated');
    const still = launch.querySelector('.caya-still');
    const header = panel.querySelector('.caya-head');
    const portrait = header?.querySelector('img');
    if (!animated || !still || !header || !portrait) return;
    doc.documentElement.dataset.cayaMotion = VERSION;
    const root = doc.documentElement, w = doc.defaultView;
    const original = animated.getAttribute('src');
    const staticSource = still.getAttribute('src');
    const style = doc.createElement('style');
    style.id = 'cayaMotionPolish'; style.textContent = STYLE; doc.head.append(style);
    // Immediately replace the defective GIF while its small in-memory repair finishes.
    animated.src = staticSource; portrait.src = staticSource;
    const motion = w.matchMedia('(prefers-reduced-motion: reduce)');
    let preference = savedPreference(), paused = preference ?? motion.matches;
    const button = doc.createElement('button');
    button.id = 'cayaMotionToggle'; button.type = 'button';
    header.insertBefore(button, doc.getElementById('cayaClear'));
    let cleaned;
    try { cleaned = await cleanGif(original); }
    catch (error) {
      // A visual repair must never stop workbook loading or affect lookup behavior.
      console.warn('CAYA mascot repair unavailable', error.message);
      animated.src = original;
      button.remove(); root.removeAttribute('data-caya-motion'); return;
    }
    if (!doc.isConnected || !launch.isConnected) return;
    const apply = () => {
      root.classList.add('caya-motion-ready');
      root.classList.toggle('caya-motion-paused', paused);
      animated.src = paused ? staticSource : cleaned.source;
      portrait.src = paused ? staticSource : cleaned.source;
      button.textContent = paused ? '動畫：關' : '動畫：開';
      button.setAttribute('aria-pressed', String(paused));
      button.setAttribute('aria-label', paused ? '播放 CAYA 跑跳動畫' : '暫停 CAYA 跑跳動畫');
      button.title = paused ? '點擊恢復跑跳' : '只暫停角色動畫，不影響查價';
      w.__cayaMotion = { version: VERSION, correctedFrames: cleaned.frames, paused };
    };
    button.addEventListener('click', () => {
      paused = !paused; preference = paused;
      try { localStorage.setItem(PREFERENCE, String(paused)); } catch {}
      apply();
    });
    const reduced = () => { if (preference === null) { paused = motion.matches; apply(); } };
    motion.addEventListener('change', reduced);
    w.addEventListener('pagehide', () => motion.removeEventListener('change', reduced), { once: true });
    apply();
  }
  function start() {
    const frame = document.getElementById('appFrame');
    if (!frame) { install(document); return; }
    // Permit the local CAYA submit handler; the portal CSP still blocks native form navigation.
    frame.sandbox.add('allow-forms');
    const error = document.getElementById('loadError');
    const update = document.getElementById('excelOpen');
    const sync = () => { if (update) update.disabled = frame.hidden; };
    if (error) new MutationObserver(sync).observe(error, { attributes: true, attributeFilter: ['hidden'] });
    new MutationObserver(sync).observe(frame, { attributes: true, attributeFilter: ['hidden'] });
    const attach = () => { try { install(frame.contentDocument); } catch {} };
    frame.addEventListener('load', attach);
    attach(); sync();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
