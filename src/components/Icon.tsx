// Small stroke icon set (24px grid) so the UI has one consistent line weight.

const PATHS = {
  home: 'M3 11.5 12 4l9 7.5M5.5 9.5V20h13V9.5',
  plus: 'M12 5v14M5 12h14',
  map: 'M9 4 3 6.5v13.5L9 17.5l6 2.5 6-2.5V4l-6 2.5L9 4Zm0 0v13.5m6-11v13.5',
  bell: 'M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15L6 16Zm4 4a2 2 0 0 0 4 0',
  shield: 'M12 3 4.5 6v5.5c0 4.5 3.2 8.2 7.5 9.5 4.3-1.3 7.5-5 7.5-9.5V6L12 3Zm-3.5 9 2.5 2.5 4.5-5',
  book: 'M4 5.5C6.5 4 9.5 4 12 5.5 14.5 4 17.5 4 20 5.5V19c-2.5-1.5-5.5-1.5-8 0-2.5-1.5-5.5-1.5-8 0V5.5Zm8 0V19',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7.5 8c.8-3.5 3.8-5.5 7.5-5.5s6.7 2 7.5 5.5',
  arrowRight: 'M5 12h14m-5-5 5 5-5 5',
  arrowLeft: 'M19 12H5m5-5-5 5 5 5',
  check: 'm5 12.5 4.5 4.5L19 7.5',
  x: 'M6 6l12 12M18 6 6 18',
  pin: 'M12 21s-6.5-6-6.5-11a6.5 6.5 0 1 1 13 0c0 5-6.5 11-6.5 11Zm0-8.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z',
  camera: 'M4 8h3.5L9 5.5h6L16.5 8H20v11H4V8Zm8 8.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z',
  spark: 'M12 3v4m0 10v4M3 12h4m10 0h4M6 6l2.5 2.5m7 7L18 18M6 18l2.5-2.5m7-7L18 6',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-10v6m0-9.5v.5',
  alert: 'M12 4 2.5 20h19L12 4Zm0 6v4.5m0 2.5v.5',
  download: 'M12 4v11m-4.5-4.5L12 15l4.5-4.5M5 19.5h14',
  code: 'm8.5 8-4 4 4 4m7-8 4 4-4 4M13.5 5l-3 14',
  drop: 'M12 3.5s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11Z',
  rain: 'M7 15a4 4 0 0 1 .5-8 5.5 5.5 0 0 1 10.5 1.5A3.5 3.5 0 0 1 17.5 15H7Zm1 3-1 2m5-2-1 2m5-2-1 2',
  sun: 'M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm0-13v2m0 14v2M3 12h2m14 0h2M5.6 5.6 7 7m10 10 1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4',
  wave: 'M3 10c3-3 6 3 9 0s6 3 9 0M3 16c3-3 6 3 9 0s6 3 9 0',
  paw: 'M8 10.5a1.8 2.2 0 1 0 0-4.4 1.8 2.2 0 0 0 0 4.4Zm8 0a1.8 2.2 0 1 0 0-4.4 1.8 2.2 0 0 0 0 4.4ZM4.8 14a1.6 2 0 1 0 0-4 1.6 2 0 0 0 0 4Zm14.4 0a1.6 2 0 1 0 0-4 1.6 2 0 0 0 0 4ZM12 12.5c-3 0-5 3.5-5 5.5 0 1.5 1.5 2 2.5 2 1 0 1.5-.5 2.5-.5s1.5.5 2.5.5c1 0 2.5-.5 2.5-2 0-2-2-5.5-5-5.5Z',
  leaf: 'M5 19c0-8 5-13.5 14-14-.5 9-6 14-14 14Zm0 0 7-7',
  people: 'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm-6 9c.6-3 3-5 6-5s5.4 2 6 5m1-9a3 3 0 1 0 0-6m2.5 15c-.3-2-1.3-3.6-3-4.5',
  refresh: 'M4.5 12a7.5 7.5 0 0 1 13-5l2 2m0-4.5V9H15m4.5 3a7.5 7.5 0 0 1-13 5l-2-2m0 4.5V15H9',
  trophy: 'M8 4h8v5a4 4 0 0 1-8 0V4Zm0 1.5H4.5c0 3 1.5 4.5 3.5 4.5m8-4.5h3.5c0 3-1.5 4.5-3.5 4.5M12 13v4m-3.5 3h7l-.5-3h-6l-.5 3Z',
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 20, className = '', strokeWidth = 1.75 }: { name: IconName; size?: number; className?: string; strokeWidth?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
