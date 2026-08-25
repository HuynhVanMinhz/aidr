import { useEffect, useMemo, useState } from 'react';
import Chart from 'react-apexcharts';
import type { ApexOptions } from 'apexcharts';

type AdminApexChartProps = {
  type: 'line' | 'area' | 'bar' | 'pie' | 'donut' | 'radialBar' | 'heatmap' | 'radar';
  series: ApexOptions['series'];
  options: ApexOptions;
  height?: number | string;
  className?: string;
};

/** ApexCharts wrapper matching Larkon theme markup (`dir=ltr` + `.apex-charts`). */
export function AdminApexChart({
  type,
  series,
  options,
  height = 320,
  className = '',
}: AdminApexChartProps) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(true);
  }, []);

  const mergedOptions = useMemo<ApexOptions>(
    () => ({
      ...options,
      chart: {
        fontFamily: 'inherit',
        foreColor: '#6c757d',
        zoom: { enabled: false },
        parentHeightOffset: 0,
        redrawOnParentResize: true,
        redrawOnWindowResize: true,
        width: '100%',
        ...options.chart,
        toolbar: { show: false, ...options.chart?.toolbar },
      },
      grid: {
        borderColor: '#f1f3fa',
        padding: { bottom: 5, left: 8, right: 12 },
        ...options.grid,
      },
    }),
    [options],
  );

  if (!ready) {
    return (
      <div dir="ltr">
        <div
          className={`apex-charts aidr-apex-chart ${className}`.trim()}
          style={{
            minHeight: typeof height === 'number' ? height : 280,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <span className="text-muted">Loading chart…</span>
        </div>
      </div>
    );
  }

  return (
    <div dir="ltr">
      <div className={`apex-charts aidr-apex-chart ${className}`.trim()}>
        <Chart type={type} series={series} options={mergedOptions} height={height} width="100%" />
      </div>
    </div>
  );
}
