const { useState, useMemo, useEffect, useCallback } = React;

// 增加安全防御，防止 Recharts 未加载时直接抛出致命错误
const { 
  LineChart = () => null, 
  Line = () => null, 
  BarChart = () => null, 
  Bar = () => null, 
  XAxis = () => null, 
  YAxis = () => null, 
  CartesianGrid = () => null, 
  Tooltip = () => null, 
  Legend = () => null, 
  ResponsiveContainer = ({ children }) => <div>{children}</div>, 
  AreaChart = () => null, 
  Area = () => null 
} = window.Recharts || {};