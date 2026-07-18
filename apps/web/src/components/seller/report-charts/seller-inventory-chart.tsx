"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export default function SellerInventoryChart({
  data,
}: {
  data: Array<{ name: string; units: number; revenue: number }>;
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        data={data}
        margin={{ top: 5, right: 20, bottom: 40, left: 0 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
        <XAxis
          dataKey="name"
          tick={{ fontSize: 11 }}
          angle={-30}
          textAnchor="end"
        />
        <YAxis tick={{ fontSize: 12 }} />
        <Tooltip
          formatter={(value, name) => [
            name === "revenue" ? `INR ${value}` : value,
            name === "revenue" ? "Revenue" : "Units Sold",
          ]}
        />
        <Bar dataKey="units" radius={[4, 4, 0, 0]}>
          {data.map((item, index) => (
            <Cell
              key={`${item.name}-${index}`}
              fill={index % 2 === 0 ? "#163B5C" : "#ED3500"}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
