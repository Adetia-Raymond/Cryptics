declare module 'react-native-gifted-charts' {
  import { ComponentType } from 'react';
  import { ViewProps } from 'react-native';

  export type ChartPoint = { value: number; label?: string };

  export interface LineChartProps extends ViewProps {
    data?: Array<ChartPoint | number>;
    areaChart?: boolean;
    hideDataPoints?: boolean;
    startFillColor?: string;
    endFillColor?: string;
    startOpacity?: number;
    endOpacity?: number;
    color?: string;
    backgroundColor?: string;
    thickness?: number;
    curved?: boolean;
    xAxisThickness?: number;
    yAxisThickness?: number;
    hideRules?: boolean;
    spacing?: number;
  }

  export const LineChart: ComponentType<LineChartProps>;

  export default {
    LineChart,
  };
}
