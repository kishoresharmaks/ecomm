"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export default function SellerSalesTrendChart({
  data,
  currencySymbol,
}: {
  data: Array<{ name: string; sales: number }>;
  currencySymbol: string;
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart
        data={data}
        margin={{ top: 5, right: 20, bottom: 5, left: 0 }}
      >
        <Line
          type="monotone"
          dataKey="sales"
          stroke="#ED3500"
          strokeWidth={3}
          dot={{ r: 4 }}
          activeDot={{ r: 6 }}
        />
        <CartesianGrid stroke="#ccc" strokeDasharray="5 5" />
        <XAxis dataKey="name" tick={{ fontSize: 12 }} />
        <YAxis
          tick={{ fontSize: 12 }}
          tickFormatter={(value) => `${currencySymbol}${value}`}
        />
        <Tooltip
          formatter={(value) => [`${currencySymbol}${value}`, "Sales"]}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
