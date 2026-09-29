import React from 'react';
import Svg, { Path, Circle, Rect, Polyline, Line } from 'react-native-svg';
export type IconName = 'bluetooth' | 'arrow' | 'scan' | 'read' | 'send' | 'spark' | 'check' | 'close' | 'info' | 'file' | 'flask' | 'link' | 'copy' | 'power' | 'chevron';
export function Icon({ name, size = 22, color = '#152440' }: { name: IconName; size?: number; color?: string }) {
  const paths: Record<IconName, React.ReactNode> = {
    bluetooth: <Path d="M7 7l10 10-5 5V2l5 5L7 17" />,
    arrow: <Path d="M5 12h14m-6-6l6 6-6 6" />,
    scan: <><Path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5" /><Circle cx="12" cy="12" r="4" /></>,
    read: <><Path d="M12 3v12m-5-5l5 5 5-5M4 16v5h16v-5" /></>,
    send: <><Path d="M22 2L9 15M22 2l-8 20-5-7-7-5 20-8z" /></>,
    spark: <><Path d="M12 3l2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3zM21 2v4m-2-2h4" /></>,
    check: <Path d="M5 12l4 4L19 6" />,
    close: <Path d="M6 6l12 12M18 6L6 18" />,
    info: <><Circle cx="12" cy="12" r="9" /><Path d="M12 11v6m0-10v.1" /></>,
    file: <><Path d="M14 2H5v20h14V7l-5-5v5h5M8 12h8m-8 4h8" /></>,
    flask: <><Path d="M9 3h6m-5 0v6L4 19q-1 2 2 2h12q3 0 2-2L14 9V3M7 14h10" /></>,
    link: <><Path d="M10 13a5 5 0 007 0l3-3a5 5 0 00-7-7l-2 2M14 11a5 5 0 00-7 0l-3 3a5 5 0 007 7l2-2" /></>,
    copy: <><Rect x="8" y="8" width="12" height="13" rx="2" /><Path d="M15 5V3H3v12h2" /></>,
    power: <><Path d="M12 2v10M6 5a9 9 0 1012 0" /></>,
    chevron: <Path d="M9 5l7 7-7 7" />,
  };
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">{paths[name]}</Svg>;
}
