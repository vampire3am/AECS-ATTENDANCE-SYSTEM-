'use client';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
export function Trend({ data }: { data: { date: string; percentage: number | null }[] }) {
  return data.length ? (
    <div className="mt-6 h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef1f5" />
          <XAxis
            dataKey="date"
            tickFormatter={(v) => String(v).slice(5)}
            tick={{ fontSize: 12 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
          <Tooltip formatter={(v) => [`${v}%`, 'Attendance']} />
          <Area
            type="monotone"
            dataKey="percentage"
            stroke="#3854AC"
            fill="#eaf0f9"
            strokeWidth={2.5}
            connectNulls={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  ) : (
    <p className="empty">Your attendance trend will appear after the first submitted class.</p>
  );
}
