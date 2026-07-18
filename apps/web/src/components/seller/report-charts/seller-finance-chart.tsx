"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export default function SellerFinanceChart({
  data,
  currencySymbol,
}: {
  data: Array<{ name: string; gross: number; net: number }>;
  currencySymbol: string;
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        data={data}
        margin={{ top: 5, right: 20, bottom: 5, left: 0 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
        <XAxis dataKey="name" tick={{ fontSize: 12 }} />
        <YAxis
          tick={{ fontSize: 12 }}
          tickFormatter={(value) => `${currencySymbol}${value}`}
        />
        <Tooltip formatter={(value) => [`${currencySymbol}${value}`, undefined]} />
        <Bar
          dataKey="gross"
          name="Gross"
          fill="#163B5C"
          radius={[4, 4, 0, 0]}
        />
        <Bar
          dataKey="net"
          name="Net Payable"
          fill="#ED3500"
          radius={[4, 4, 0, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
