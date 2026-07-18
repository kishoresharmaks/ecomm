"use client";

import {
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

const pieColors = ["#163B5C", "#ED3500", "#3B82F6", "#F59E0B", "#10B981"];

export default function SellerTaxChart({
  data,
  currencySymbol,
}: {
  data: Array<{ name: string; value: number }>;
  currencySymbol: string;
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          outerRadius={100}
          label={(entry: { name?: string; percent?: number }) =>
            `${(entry.name ?? "").split(" ")[0]} ${((entry.percent ?? 0) * 100).toFixed(0)}%`
          }
        >
          {data.map((item, index) => (
            <Cell
              key={`${item.name}-${index}`}
              fill={pieColors[index % pieColors.length] ?? "#163B5C"}
            />
          ))}
        </Pie>
        <Tooltip formatter={(value) => [`${currencySymbol}${value}`, undefined]} />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}
