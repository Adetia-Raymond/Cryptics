import React from 'react';

interface SparkAreaChartProps {
  data: Array<{ value: number }>;
  categories: string[];
  colors: string[];
  showGradient?: boolean;
  className?: string;
}

export const SparkAreaChart: React.FC<SparkAreaChartProps> = ({ 
  data, 
  categories, 
  colors, 
  showGradient = false, 
  className = "" 
}) => {
  if (!data.length) return null;

  const values = data.map(d => d.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min;

  // Create SVG path
  const width = 300;
  const height = 60;
  const padding = 4;

  const points = values.map((value, index) => {
    const x = (index / (values.length - 1)) * (width - padding * 2) + padding;
    const y = height - padding - ((value - min) / range) * (height - padding * 2);
    return `${x},${y}`;
  }).join(' L');

  const pathData = `M${points}`;
  const areaData = `${pathData} L${width - padding},${height - padding} L${padding},${height - padding} Z`;

  const color = colors[0];
  const colorMap: Record<string, string> = {
    emerald: '#10b981',
    red: '#ef4444',
    blue: '#3b82f6',
    purple: '#8b5cf6'
  };

  const strokeColor = colorMap[color] || '#10b981';
  const fillColor = `${strokeColor}20`;

  return (
    <div className={`w-full h-full ${className}`}>
      <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
        {showGradient && (
          <defs>
            <linearGradient id={`gradient-${color}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={strokeColor} stopOpacity="0.4"/>
              <stop offset="100%" stopColor={strokeColor} stopOpacity="0.0"/>
            </linearGradient>
          </defs>
        )}
        <path
          d={areaData}
          fill={showGradient ? `url(#gradient-${color})` : fillColor}
          stroke="none"
        />
        <path
          d={pathData}
          fill="none"
          stroke={strokeColor}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
};