/* 인라인 SVG 아이콘 (이모지 미지원 환경에서도 동일하게 보이도록) */
const svg = (inner, vb = '0 0 24 24') =>
  `<svg viewBox="${vb}" fill="none" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;

export const WEATHER_ICON = {
  clear: svg(`<circle cx="12" cy="12" r="4.2" fill="#ffd166" stroke="#ffd166" stroke-width="1.4"/>
    <g stroke="#ffd166" stroke-width="1.8"><path d="M12 2.4v2.2M12 19.4v2.2M2.4 12h2.2M19.4 12h2.2M5.2 5.2l1.6 1.6M17.2 17.2l1.6 1.6M18.8 5.2l-1.6 1.6M6.8 17.2l-1.6 1.6"/></g>`),
  sun: svg(`<circle cx="12" cy="10.5" r="4.4" fill="#ff9a3d" stroke="#ffb347" stroke-width="1.4"/>
    <g stroke="#ffb347" stroke-width="1.9"><path d="M12 1.8v2.4M12 16.8v2.2M3.4 10.5h2.2M18.4 10.5h2.2M6 4.5l1.7 1.7M16.3 14.8l1.7 1.7M18 4.5l-1.7 1.7M7.7 14.8L6 16.5"/></g>
    <g stroke="#ff6a2b" stroke-width="1.6" opacity=".85"><path d="M5 20.4c1.6-1.4 3.2 1.2 4.8-.2s3.2 1.2 4.8-.2 3.2 1.2 4.4.2"/></g>`),
  rain: svg(`<path d="M6.6 14.4h10.2a3.3 3.3 0 0 0 .3-6.6 4.9 4.9 0 0 0-9.4-.5A3.6 3.6 0 0 0 6.6 14.4Z" fill="#4d8dff" fill-opacity=".22" stroke="#7fb3ff" stroke-width="1.7"/>
    <g stroke="#7fd0ff" stroke-width="1.9"><path d="M8.2 17.2 7 20.4M12 17.2l-1.2 3.2M15.8 17.2l-1.2 3.2"/></g>`),
  sand: svg(`<g stroke="#e6b877" stroke-width="1.9"><path d="M2.6 8.4c2.2-2 4.4 2 6.6 0s4.4 2 6.6 0 3.4 1.6 5.6 0"/><path d="M2.6 13.2c2.2-2 4.4 2 6.6 0s4.4 2 6.6 0 3.4 1.6 5.6 0"/><path d="M2.6 18c2.2-2 4.4 2 6.6 0s4.4 2 6.6 0 3.4 1.6 5.6 0"/></g>
    <circle cx="18.6" cy="5" r="1.5" fill="#f0c98a"/><circle cx="6" cy="5.4" r="1" fill="#f0c98a"/>`),
  hail: svg(`<g stroke="#8fe3ef" stroke-width="1.9"><path d="M12 2.6v18.8M4 7.4l16 9.2M4 16.6l16-9.2"/><path d="M9.8 4.4 12 6.6l2.2-2.2M9.8 19.6 12 17.4l2.2 2.2"/></g>`)
};

export const STAGE_ICON = {
  stadium: svg(`<ellipse cx="12" cy="15" rx="9.4" ry="5" stroke="#9fd8b0" stroke-width="1.7" fill="#2f7a52" fill-opacity=".35"/>
    <path d="M4.4 12.6 12 8.2l7.6 4.4" stroke="#cfe8ff" stroke-width="1.7"/><path d="M6.4 8.4 5 4.6M17.6 8.4 19 4.6" stroke="#ffe08a" stroke-width="1.7"/><circle cx="5" cy="4" r="1.4" fill="#ffe08a"/><circle cx="19" cy="4" r="1.4" fill="#ffe08a"/>`),
  beach: svg(`<circle cx="17.4" cy="6.6" r="2.8" fill="#ffd166" stroke="#ffd166"/>
    <path d="M2.6 15.4c2.2-1.8 4.4 1.8 6.6 0s4.4 1.8 6.6 0 4.4 1.8 5.6 0" stroke="#6fd0ff" stroke-width="1.9"/>
    <path d="M2.6 19.4h18.8" stroke="#e8c98a" stroke-width="1.9"/><path d="M5 12.6c1.4-.8 2.6 1.2 4 .4" stroke="#9fe4ff" stroke-width="1.5" opacity=".7"/>`),
  rock: svg(`<path d="M2.4 19.6 8.6 7.4l3.2 5.2 2.6-3.6 7.2 10.6Z" fill="#7a5747" fill-opacity=".35" stroke="#d8a86a" stroke-width="1.7"/>
    <path d="M7 10.4 8.6 7.4l1.8 2.9" stroke="#ffd8a8" stroke-width="1.5"/>`),
  snow: svg(`<path d="M2.4 19.6 8.6 6.6l3.4 6 2.4-3.4 7.2 10.4Z" fill="#bfe0f5" fill-opacity=".28" stroke="#cfe9ff" stroke-width="1.7"/>
    <path d="M6.4 11.4 8.6 6.6l2.2 4-1.6 1.4Z" fill="#ffffff" fill-opacity=".9"/>
    <g stroke="#9fe8ff" stroke-width="1.4"><path d="M17 4.2v3.6M15.4 5l3.2 2M18.6 5l-3.2 2"/></g>`),
  forest: svg(`<path d="M7.4 19.8v-6.2H4.2l3.2-5h-1l2-3.6 2 3.6h-1l3.2 5H9.4v6.2Z" fill="#2f7a45" fill-opacity=".55" stroke="#8fe0a0" stroke-width="1.5"/>
    <path d="M16.2 19.8v-4.4h-2.4l2.6-4.2h-.8l1.8-3 1.8 3h-.8l2.6 4.2h-2.4v4.4Z" fill="#2f7a45" fill-opacity=".35" stroke="#8fe0a0" stroke-width="1.4"/>`),
  volcano: svg(`<path d="M2.6 19.6 9 6.4h6l6.4 13.2Z" fill="#4a1d16" fill-opacity=".5" stroke="#ff8a5c" stroke-width="1.7"/>
    <path d="M9 6.4c1.2 1.6 4.8 1.6 6 0" stroke="#ffb347" stroke-width="1.7"/>
    <path d="M12.2 3.2c1.2-1.2 2.6-.4 2.6-1.4 1.6 1.4.4 3-1 3.2" stroke="#ffcf9a" stroke-width="1.4" opacity=".55"/>
    <path d="M9.6 14.4h4.8" stroke="#ff6a2b" stroke-width="1.8"/>`),
  city: svg(`<g stroke="#9fb4ff" stroke-width="1.6" fill="#2a3a72" fill-opacity=".35">
    <path d="M3 20V11h4v9M8.4 20V6.4h4V20M13.8 20V9.6h3.4V20M18.6 20v-6h2.6v6"/></g>
    <g fill="#ffe08a"><rect x="9.4" y="8.6" width="1.3" height="1.3"/><rect x="11.6" y="8.6" width="1.3" height="1.3"/><rect x="9.4" y="12" width="1.3" height="1.3"/><rect x="14.6" y="12" width="1.1" height="1.1"/><rect x="4" y="13.4" width="1.1" height="1.1"/></g>
    <path d="M17 5.4a2 2 0 1 0 .1 0Z" fill="#fff6d0" stroke="none"/>`),
  space: svg(`<circle cx="12" cy="12" r="5" fill="#6b3fd6" fill-opacity=".5" stroke="#b48cff" stroke-width="1.7"/>
    <ellipse cx="12" cy="12" rx="9.6" ry="3.2" transform="rotate(-22 12 12)" stroke="#c9b3ff" stroke-width="1.5"/>
    <g fill="#fff"><circle cx="4.4" cy="5" r=".9"/><circle cx="19.4" cy="6" r=".7"/><circle cx="17" cy="19" r=".8"/><circle cx="6.6" cy="18.2" r=".6"/></g>`),
  temple: svg(`<path d="M3.4 9 12 3.4 20.6 9" stroke="#d8c8ff" stroke-width="1.7"/>
    <g stroke="#b9a8e8" stroke-width="1.7"><path d="M5.4 10.4v8.2M9.6 10.4v8.2M14.4 10.4v8.2M18.6 10.4v8.2"/><path d="M3.4 20.6h17.2"/></g>
    <circle cx="12" cy="12.6" r="1.2" fill="#ffe08a" stroke="none"/>`),
  cave: svg(`<g stroke="#6fe0ff" stroke-width="1.6" fill="#4fd8ff" fill-opacity=".3">
    <path d="M7 20 5.4 11.4 8 9.6l2 10.4Z"/><path d="M11.4 20 12 8.2l2.6 1.6 1 10.2Z"/><path d="M16.6 20l1-6.2 2.2 1.4.6 4.8Z"/></g>
    <path d="M3.4 20.6h17.2" stroke="#9fe8ff" stroke-width="1.5"/>
    <g fill="#c9b3ff"><circle cx="17.8" cy="7" r=".9"/><circle cx="6.2" cy="6.4" r=".7"/></g>`),
  desert: svg(`<circle cx="17.6" cy="6.4" r="3" fill="#ffd166" stroke="#ffd166"/>
    <path d="M2.4 18.4c3-3.6 6-1 8.4-2.6s5.2 2.4 10.8-.6" stroke="#e6b877" stroke-width="1.9"/>
    <path d="M2.4 20.8h19.2" stroke="#c99a5c" stroke-width="1.7"/>
    <path d="M6 15.6v-3.2M6 14.2c-1.4 0-1.8-1.2-1.8-1.8M6 13.4c1.4 0 1.8-1.2 1.8-1.8" stroke="#5c8a4a" stroke-width="1.3"/>`)
};

export function weatherIcon(id) { return WEATHER_ICON[id] || WEATHER_ICON.clear; }
export function stageIcon(id) { return STAGE_ICON[id] || STAGE_ICON.stadium; }
