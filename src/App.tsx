/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { ALL_DATA } from './data';
import {
  ComposedChart, Line, Scatter, AreaChart, Area, BarChart, Bar, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';

const BUY_FEE_RATE = 0.00035625;
const SELL_FEE_TAX_RATE = 0.00335625;
const UNITS = 100;

function getRangeData(range: string) {
  const last = ALL_DATA[ALL_DATA.length - 1].d;
  let from = '2025-01-01';
  let to = '2025-12-31';
  
  if (range === 'all') { from = '2025-01-01'; to = '2025-12-31'; }
  else if (range === 'q1') { from = '2025-01-01'; to = '2025-03-31'; }
  else if (range === 'q2') { from = '2025-04-01'; to = '2025-06-30'; }
  else if (range === 'q3') { from = '2025-07-01'; to = '2025-09-30'; }
  else if (range === 'q4') { from = '2025-10-01'; to = '2025-12-31'; }
  else if (range === 'h1') { from = '2025-01-01'; to = '2025-06-30'; }
  else if (range === 'h2') { from = '2025-07-01'; to = '2025-12-31'; }
  else if (range === '3m') {
    const idx = ALL_DATA.length - 1;
    from = ALL_DATA[Math.max(0, idx - 65)].d;
    to = last;
  }
  else if (range === '6m') {
    const idx = ALL_DATA.length - 1;
    from = ALL_DATA[Math.max(0, idx - 130)].d;
    to = last;
  }
  
  return ALL_DATA.filter(x => x.d >= from && x.d <= to);
}

function MetricCard({ label, value, sub, color = 'text-slate-900' }: { label: string, value: string, sub?: string, color?: string }) {
  return (
    <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
      <div className="text-xs text-slate-500 mb-1">{label}</div>
      <div className={`text-base font-medium ${color}`}>
        {value}
        {sub && <span className="text-xs ml-1 font-normal">{sub}</span>}
      </div>
    </div>
  );
}

export default function App() {
  const [range, setRange] = useState('all');
  const [buyThreshold, setBuyThreshold] = useState(0.01);
  const [sellThreshold, setSellThreshold] = useState(0.01);

  const simResult = useMemo(() => {
    const rangeData = getRangeData(range);
    if (rangeData.length < 2) return null;

    const baseIdx = ALL_DATA.findIndex(x => x.d === rangeData[0].d);
    const base = baseIdx > 0 ? ALL_DATA[baseIdx - 1] : ALL_DATA[0];
    
    let positions: any[] = [];
    let completedPos: any[] = [];
    let dailyLog: any[] = [];
    let holdSeries: any[] = [];
    let buyPts: any[] = [];
    let sellPts: any[] = [];
    
    let posId = 0;
    let lastBuyRef = base.p;
    let noPosiHighWater = base.p;
    let totalRealized = 0;
    let totalCostPaid = 0;

    for (let i = 0; i < rangeData.length; i++) {
      const { d, p } = rangeData[i];
      let dayBuys: number[] = [];
      let daySells: any[] = [];
      let dayNotes: string[] = [];
      let stepPnl = 0;

      const hasPos = positions.length > 0;
      if (!hasPos) {
        noPosiHighWater = Math.max(noPosiHighWater, p);
        const drop = (noPosiHighWater - p) / noPosiHighWater;
        if (drop >= buyThreshold) {
          positions.push({ id: ++posId, buyDate: d, buyPrice: p, units: UNITS });
          lastBuyRef = p;
          noPosiHighWater = p;
          dayBuys.push(p);
          buyPts.push({ x: i, y: p, d });
          dayNotes.push('空倉高點回跌觸發');
        }
      } else {
        const drop = (lastBuyRef - p) / lastBuyRef;
        if (drop >= buyThreshold) {
          positions.push({ id: ++posId, buyDate: d, buyPrice: p, units: UNITS });
          lastBuyRef = p;
          dayBuys.push(p);
          buyPts.push({ x: i, y: p, d });
          dayNotes.push('跌幅達門檻加碼');
        }
      }

      let kept: any[] = [];
      for (const pos of positions) {
        const gain = (p - pos.buyPrice) / pos.buyPrice;
        if (gain >= sellThreshold) {
          const grossPnl = (p - pos.buyPrice) * pos.units;
          const buyFee = pos.buyPrice * pos.units * BUY_FEE_RATE;
          const sellFee = p * pos.units * SELL_FEE_TAX_RATE;
          const netPnl = grossPnl - buyFee - sellFee;
          
          totalRealized += netPnl;
          stepPnl += netPnl;
          totalCostPaid += (buyFee + sellFee);
          
          const pct = (netPnl / (pos.buyPrice * pos.units) * 100).toFixed(2);
          
          completedPos.push({ ...pos, sellDate: d, sellPrice: p, pnl: netPnl, pct, buyFee, sellFee });
          daySells.push({ price: p, pos });
          sellPts.push({ x: i, y: p, d });
          dayNotes.push(`#${pos.id} 買@${pos.buyDate.substring(5)}$${pos.buyPrice.toFixed(2)} → 賣$${p.toFixed(2)} +${pct}% +$${Math.round(netPnl)}`);
        } else {
          kept.push(pos);
        }
      }
      positions = kept;
      
      if (positions.length > 0) {
        lastBuyRef = Math.min(...positions.map(x => x.buyPrice));
      } else {
        noPosiHighWater = p;
        lastBuyRef = p;
      }

      holdSeries.push({ d, n: positions.length });

      if (dayBuys.length > 0 || daySells.length > 0) {
        const avgBuy = dayBuys.length > 0 ? dayBuys.reduce((a, b) => a + b, 0) / dayBuys.length : null;
        const avgSell = daySells.length > 0 ? daySells.reduce((a, b) => a + b.price, 0) / daySells.length : null;
        const action = dayBuys.length > 0 && daySells.length > 0 ? '買+賣' : dayBuys.length > 0 ? '買入' : '賣出';
        
        dailyLog.push({
          d, p, action, 
          buyUnits: dayBuys.length * UNITS, 
          sellUnits: daySells.length * UNITS,
          avgBuy, avgSell, stepPnl, cumPnl: totalRealized, 
          holdUnits: positions.length * UNITS, 
          notes: dayNotes.join(' | ')
        });
      }
    }

    const finalP = rangeData[rangeData.length - 1].p;
    const unrealizedFinal = positions.reduce((sum, pos) => {
      const gross = (finalP - pos.buyPrice) * pos.units;
      const buyFee = pos.buyPrice * pos.units * BUY_FEE_RATE;
      const estSellFee = finalP * pos.units * SELL_FEE_TAX_RATE;
      return sum + gross - buyFee - estSellFee;
    }, 0);
    
    const totalPnL = totalRealized + unrealizedFinal;
    const totalInvested = positions.reduce((s, pos) => pos.buyPrice * pos.units + s, 0);
    const totalCostRealized = completedPos.reduce((s, c) => s + c.buyPrice * c.units, 0);
    const realizedPct = totalCostRealized > 0 ? ((totalRealized / totalCostRealized) * 100).toFixed(2) + '%' : '—';
    const totalCostAll = totalCostRealized + totalInvested;
    const totalPnLPct = totalCostAll > 0 ? ((totalPnL / totalCostAll) * 100).toFixed(2) + '%' : '—';

    const metrics = {
      basePrice: base.p,
      finalPrice: finalP,
      totalRealized,
      realizedPct,
      unrealizedFinal,
      unrealizedPct: totalInvested > 0 ? ((unrealizedFinal / totalInvested) * 100).toFixed(2) + '%' : '—',
      totalPnL,
      totalPnLPct,
      completedCount: completedPos.length,
      currentPositions: positions.length,
      totalInvested,
      totalCostPaid
    };

    const priceChartData = rangeData.map((d, i) => {
      const isBuy = buyPts.find(b => b.x === i);
      const isSell = sellPts.find(s => s.x === i);
      return {
        name: d.d,
        price: d.p,
        buy: isBuy ? d.p : null,
        sell: isSell ? d.p : null,
      };
    });

    const monthPnL: Record<string, number> = {};
    completedPos.forEach(c => {
      const m = c.sellDate.substring(0, 7);
      monthPnL[m] = (monthPnL[m] || 0) + c.pnl;
    });
    const monthlyData = Object.keys(monthPnL).sort().map(k => ({
      month: k.substring(5) + '月',
      pnl: monthPnL[k]
    }));

    const allPos = [
      ...completedPos,
      ...positions.map(p => ({ ...p, sellDate: null, sellPrice: null, pnl: null, pct: null }))
    ].sort((a, b) => a.buyDate.localeCompare(b.buyDate));

    return { metrics, priceChartData, holdSeries, monthlyData, allPos, dailyLog: dailyLog.reverse(), finalP };
  }, [range, buyThreshold, sellThreshold]);

  if (!simResult) return <div className="p-8 text-center text-slate-500">資料不足</div>;

  const { metrics, priceChartData, holdSeries, monthlyData, allPos, dailyLog } = simResult;

  return (
    <div className="p-4 max-w-7xl mx-auto space-y-6 text-slate-800 font-sans">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-xl font-medium mb-1">00631L 網格交易回測 v3 (含交易成本)</h1>
          <p className="text-sm text-slate-500">每單位100股 · 基準 2024/12/31 收盤 $247.85 · 總成本率 0.37125%</p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <select className="px-3 py-1.5 border border-slate-300 rounded-md text-sm bg-white" value={range} onChange={e => setRange(e.target.value)}>
            <option value="all">全年 2025</option>
            <option value="q1">Q1 (1–3月)</option>
            <option value="q2">Q2 (4–6月)</option>
            <option value="q3">Q3 (7–9月)</option>
            <option value="q4">Q4 (10–12月)</option>
            <option value="h1">上半年 (1–6月)</option>
            <option value="h2">下半年 (7–12月)</option>
            <option value="3m">最近3個月</option>
            <option value="6m">最近6個月</option>
          </select>
          <select className="px-3 py-1.5 border border-slate-300 rounded-md text-sm bg-white" value={buyThreshold} onChange={e => setBuyThreshold(parseFloat(e.target.value))}>
            <option value="0.01">跌1%買入</option>
            <option value="0.02">跌2%買入</option>
            <option value="0.03">跌3%買入</option>
            <option value="0.05">跌5%買入</option>
          </select>
          <select className="px-3 py-1.5 border border-slate-300 rounded-md text-sm bg-white" value={sellThreshold} onChange={e => setSellThreshold(parseFloat(e.target.value))}>
            <option value="0.01">漲1%賣出</option>
            <option value="0.02">漲2%賣出</option>
            <option value="0.03">漲3%賣出</option>
            <option value="0.05">漲5%賣出</option>
          </select>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
        <MetricCard label="基準價" value={`$${metrics.basePrice.toFixed(2)}`} />
        <MetricCard label="期末收盤" value={`$${metrics.finalPrice.toFixed(2)}`} />
        <MetricCard label="已實現損益" value={`$${Math.round(metrics.totalRealized).toLocaleString()}`} sub={`(${metrics.realizedPct})`} color={metrics.totalRealized >= 0 ? 'text-[#a32d2d]' : 'text-[#0f6e56]'} />
        <MetricCard label="未實現損益" value={`$${Math.round(metrics.unrealizedFinal).toLocaleString()}`} sub={`(${metrics.unrealizedPct})`} color={metrics.unrealizedFinal >= 0 ? 'text-[#a32d2d]' : 'text-[#0f6e56]'} />
        <MetricCard label="總損益" value={`$${Math.round(metrics.totalPnL).toLocaleString()}`} sub={`(${metrics.totalPnLPct})`} color={metrics.totalPnL >= 0 ? 'text-[#a32d2d]' : 'text-[#0f6e56]'} />
        <MetricCard label="完成筆數" value={`${metrics.completedCount} 筆`} />
        <MetricCard label="期末持倉" value={`${metrics.currentPositions} 單位`} />
        <MetricCard label="佔用資金" value={`$${Math.round(metrics.totalInvested).toLocaleString()}`} />
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <h3 className="text-sm font-medium text-slate-500 mb-4">價格走勢 + 進出場</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={priceChartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" tickFormatter={d => d.substring(5)} tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} minTickGap={20} />
                <YAxis domain={['auto', 'auto']} tickFormatter={v => `$${v}`} tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ fontSize: '12px', borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                <Line type="monotone" dataKey="price" stroke="#378add" strokeWidth={1.5} dot={false} isAnimationActive={false} />
                <Scatter dataKey="buy" fill="#e24b4a" shape="triangle" isAnimationActive={false} />
                <Scatter dataKey="sell" fill="#0f6e56" shape="square" isAnimationActive={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <h3 className="text-sm font-medium text-slate-500 mb-4">持倉單位數</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={holdSeries} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="d" tickFormatter={d => d.substring(5)} tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} minTickGap={20} />
                <YAxis tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ fontSize: '12px', borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                <Area type="step" dataKey="n" stroke="#ba7517" fill="rgba(186,117,23,0.1)" strokeWidth={1.5} isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col">
          <h3 className="text-sm font-medium text-slate-500 mb-4">倉位明細</h3>
          <div className="overflow-y-auto flex-1 max-h-80">
            <table className="w-full text-xs text-left whitespace-nowrap">
              <thead className="sticky top-0 bg-white text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="py-2 px-2 font-medium">買入日</th>
                  <th className="py-2 px-2 font-medium">買價</th>
                  <th className="py-2 px-2 font-medium">成本</th>
                  <th className="py-2 px-2 font-medium">賣出日</th>
                  <th className="py-2 px-2 font-medium">賣價</th>
                  <th className="py-2 px-2 font-medium">賣出額</th>
                  <th className="py-2 px-2 font-medium">已實現損益</th>
                  <th className="py-2 px-2 font-medium">狀態</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {allPos.map((pos, i) => {
                  const cost = pos.buyPrice * pos.units;
                  const sellAmt = pos.sellPrice ? pos.sellPrice * pos.units : null;
                  const isClosed = pos.sellDate !== null;
                  
                  let pnlTxt;
                  if (isClosed) {
                    const pnlColor = pos.pnl >= 0 ? 'text-[#a32d2d]' : 'text-[#0f6e56]';
                    const sign = pos.pnl >= 0 ? '+' : '';
                    pnlTxt = <span className={pnlColor}>{sign}${Math.round(pos.pnl).toLocaleString()} <span className="text-[10px]">({pos.pct}%)</span></span>;
                  } else {
                    const estGross = (metrics.finalPrice - pos.buyPrice) * pos.units;
                    const estBuyFee = pos.buyPrice * pos.units * BUY_FEE_RATE;
                    const estSellFee = metrics.finalPrice * pos.units * SELL_FEE_TAX_RATE;
                    const estNetPnl = estGross - estBuyFee - estSellFee;
                    const estPct = (estNetPnl / cost * 100).toFixed(2);
                    const sign = estNetPnl >= 0 ? '+' : '';
                    pnlTxt = <span className="text-slate-500">浮{sign}${Math.round(estNetPnl).toLocaleString()} <span className="text-[10px]">({estPct}%)</span></span>;
                  }

                  return (
                    <tr key={i} className="hover:bg-slate-50">
                      <td className="py-2 px-2">{pos.buyDate.substring(5)}</td>
                      <td className="py-2 px-2">${pos.buyPrice.toFixed(2)}</td>
                      <td className="py-2 px-2">${Math.round(cost).toLocaleString()}</td>
                      <td className="py-2 px-2">{isClosed ? pos.sellDate.substring(5) : <span className="text-slate-400">—</span>}</td>
                      <td className="py-2 px-2">{isClosed ? `$${pos.sellPrice.toFixed(2)}` : <span className="text-slate-400">—</span>}</td>
                      <td className="py-2 px-2">{isClosed ? `$${Math.round(sellAmt!).toLocaleString()}` : <span className="text-slate-400">—</span>}</td>
                      <td className="py-2 px-2">{pnlTxt}</td>
                      <td className="py-2 px-2">
                        {isClosed ? 
                          <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-[#fcebeb] text-[#a32d2d]">已平倉</span> : 
                          <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-[#eaf3de] text-[#3b6d11]">持倉中</span>
                        }
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
        
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col">
          <h3 className="text-sm font-medium text-slate-500 mb-4">月損益</h3>
          <div className="flex-1 min-h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={v => `$${Math.round(v/1000)}k`} tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{ fontSize: '12px', borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                <Bar dataKey="pnl" radius={[4, 4, 0, 0]} isAnimationActive={false}>
                  {monthlyData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.pnl >= 0 ? 'rgba(163,45,45,0.8)' : 'rgba(15,110,86,0.8)'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Log Table */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
        <h3 className="text-sm font-medium text-slate-500 mb-4">每日事件日誌</h3>
        <div className="overflow-y-auto max-h-64">
          <table className="w-full text-xs text-left whitespace-nowrap">
            <thead className="sticky top-0 bg-white text-slate-500 border-b border-slate-200">
              <tr>
                <th className="py-2 px-2 font-medium">日期</th>
                <th className="py-2 px-2 font-medium">收盤價</th>
                <th className="py-2 px-2 font-medium">動作</th>
                <th className="py-2 px-2 font-medium">股數</th>
                <th className="py-2 px-2 font-medium">成交均價</th>
                <th className="py-2 px-2 font-medium">本次損益</th>
                <th className="py-2 px-2 font-medium">累計損益</th>
                <th className="py-2 px-2 font-medium">持倉(股)</th>
                <th className="py-2 px-2 font-medium">備註</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {dailyLog.map((l, i) => {
                const isB = l.action.includes('買');
                const isS = l.action.includes('賣');
                
                let actionTag;
                if (l.action === '買入') actionTag = <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-[#e6f1fb] text-[#185fa5]">買入</span>;
                else if (l.action === '賣出') actionTag = <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-[#fcebeb] text-[#a32d2d]">賣出</span>;
                else actionTag = <><span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-[#e6f1fb] text-[#185fa5]">買</span> <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-[#fcebeb] text-[#a32d2d]">賣</span></>;

                const units = isB && !isS ? `+${l.buyUnits}` : !isB && isS ? `-${l.sellUnits}` : `+${l.buyUnits}/-${l.sellUnits}`;
                const avgP = l.avgBuy && l.avgSell ? `買$${l.avgBuy.toFixed(2)}/賣$${l.avgSell.toFixed(2)}` : l.avgBuy ? `$${l.avgBuy.toFixed(2)}` : `$${l.avgSell.toFixed(2)}`;
                
                const stepPnlColor = l.stepPnl > 0 ? 'text-[#a32d2d]' : l.stepPnl < 0 ? 'text-[#0f6e56]' : '';
                const cumPnlColor = l.cumPnl >= 0 ? 'text-[#a32d2d]' : 'text-[#0f6e56]';
                
                let stepPct = '';
                if (l.stepPnl && l.avgSell) {
                   const grossRev = l.avgSell * l.sellUnits;
                   const costBasis = grossRev - l.stepPnl; 
                   if (costBasis > 0) stepPct = ` (${(l.stepPnl / costBasis * 100).toFixed(2)}%)`;
                }

                return (
                  <tr key={i} className="hover:bg-slate-50">
                    <td className="py-2 px-2">{l.d}</td>
                    <td className="py-2 px-2">${l.p.toFixed(2)}</td>
                    <td className="py-2 px-2">{actionTag}</td>
                    <td className="py-2 px-2 text-slate-500">{units}</td>
                    <td className="py-2 px-2">{avgP}</td>
                    <td className={`py-2 px-2 ${stepPnlColor}`}>{l.stepPnl ? `${l.stepPnl > 0 ? '+' : ''}$${Math.round(l.stepPnl).toLocaleString()}${stepPct}` : '—'}</td>
                    <td className={`py-2 px-2 ${cumPnlColor}`}>${Math.round(l.cumPnl).toLocaleString()}</td>
                    <td className="py-2 px-2">{l.holdUnits}</td>
                    <td className="py-2 px-2 text-[11px] text-slate-500 truncate max-w-[200px]" title={l.notes}>{l.notes}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      
      <div className="text-[11px] text-slate-400 mt-2">
        每單位=100股。總交易成本率 0.37125% (買進 0.035625% + 賣出 0.035625% + 證交稅 0.3%)。價格為近似重建值，僅供策略邏輯驗證，非投資建議。
      </div>
    </div>
  );
}

