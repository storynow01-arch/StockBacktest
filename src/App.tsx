/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { ALL_DATA } from './data';
import { INDICATOR_DATA } from './indicatorData';
import {
  ComposedChart, Line, Scatter, AreaChart, Area, BarChart, Bar, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';

const BUY_FEE_RATE = 0.00035625;
const SELL_FEE_TAX_RATE = 0.00335625;
const TOTAL_CAPITAL = 1000000;
const MAX_GRIDS = 100;
const CAPITAL_PER_GRID = TOTAL_CAPITAL / MAX_GRIDS;

function getRangeData(startYear: string, endYear: string) {
  const s = Math.min(parseInt(startYear), parseInt(endYear));
  const e = Math.max(parseInt(startYear), parseInt(endYear));
  const from = `${s}-01-01`;
  const to = `${e}-12-31`;
  return ALL_DATA.filter(x => x.d >= from && x.d <= to);
}

function MetricCard({ label, value, sub, color = 'text-slate-100' }: { label: string, value: string, sub?: string, color?: string }) {
  return (
    <div className="bg-slate-800 rounded-lg p-3 border border-slate-700">
      <div className="text-xs text-slate-400 mb-1">{label}</div>
      <div className={`text-base font-medium ${color}`}>
        {value}
        {sub && <span className="text-xs ml-1 font-normal">{sub}</span>}
      </div>
    </div>
  );
}

export default function App() {
  const [startYear, setStartYear] = useState('2020');
  const [endYear, setEndYear] = useState('2026');
  const [buyThreshold, setBuyThreshold] = useState(0.01);
  const [sellThreshold, setSellThreshold] = useState(0.01);

  const simResult = useMemo(() => {
    const rangeData = getRangeData(startYear, endYear);
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
    let maxInvestedCapital = 0; // Will be calculated differently now

    let indUnits = 0;
    let indAvgCost = 0;
    let indRealizedPnL = 0;
    let indBuyCount = 0;
    let indSellCount = 0;
    const indBuyPts: any[] = [];
    const indSellPts: any[] = [];
    let lastMonth = '';
    const indDailyLog: any[] = [];

    // Independent Blue Light Only Strategy
    let blueOnlyUnits = 0;
    let blueOnlyInvested = 0;
    let blueOnlyBuyCount = 0;
    const blueOnlyBuyPts: any[] = [];

    let availableCapital = TOTAL_CAPITAL;
    let minAvailableCapital = TOTAL_CAPITAL;

    for (let i = 0; i < rangeData.length; i++) {
      const { d, p } = rangeData[i];
      const currentMonth = d.substring(0, 7);
      
      if (lastMonth !== '' && currentMonth !== lastMonth) {
        const indicator = INDICATOR_DATA[lastMonth];
        if (indicator) {
          // Independent Blue Light Strategy Logic
          if (indicator.light === '藍燈') {
            const blueBuyAmount = 100000;
            const blueUnitsToBuy = Math.floor(blueBuyAmount / p);
            if (blueUnitsToBuy > 0) {
              const cost = blueUnitsToBuy * p;
              const fee = cost * BUY_FEE_RATE;
              blueOnlyUnits += blueUnitsToBuy;
              blueOnlyInvested += (cost + fee);
              blueOnlyBuyCount++;
              blueOnlyBuyPts.push({ x: i, y: p, d, units: blueUnitsToBuy });
            }
          }

          // Shared Capital Indicator Strategy Logic
          if (indicator.light === '藍燈') {
            const targetAmount = TOTAL_CAPITAL / 10;
            const costPerUnit = p * (1 + BUY_FEE_RATE);
            const maxUnitsCanBuy = Math.floor(availableCapital / costPerUnit);
            const targetUnits = Math.floor(targetAmount / p);
            const unitsToBuy = Math.min(maxUnitsCanBuy, targetUnits);
            
            if (unitsToBuy > 0) {
              const cost = unitsToBuy * p;
              const fee = cost * BUY_FEE_RATE;
              availableCapital -= (cost + fee);
              minAvailableCapital = Math.min(minAvailableCapital, availableCapital);
              
              const totalCostBefore = indUnits * indAvgCost;
              indUnits += unitsToBuy;
              indAvgCost = (totalCostBefore + cost + fee) / indUnits;
              indBuyCount++;
              indBuyPts.push({ x: i, y: p, d, units: unitsToBuy });
              
              indDailyLog.push({
                d, p, action: '買入', units: unitsToBuy,
                cost: cost + fee,
                realized: 0,
                cumPnl: indRealizedPnL,
                holdUnits: indUnits,
                notes: `燈號藍燈買入 (${unitsToBuy}股)`
              });
            } else {
               indDailyLog.push({
                d, p, action: '略過', units: 0,
                cost: 0, realized: 0, cumPnl: indRealizedPnL, holdUnits: indUnits,
                notes: `燈號藍燈觸發，但資金池不足`
              });
            }
          } else if (indicator.light === '紅燈') {
            if (indUnits > 0) {
              const unitsToSell = Math.floor(indUnits / 5);
              if (unitsToSell > 0) {
                const gross = unitsToSell * p;
                const fee = gross * SELL_FEE_TAX_RATE;
                const net = gross - fee;
                
                availableCapital += net;
                
                const costOfSold = unitsToSell * indAvgCost;
                const realized = net - costOfSold;
                indRealizedPnL += realized;
                indUnits -= unitsToSell;
                indSellCount++;
                indSellPts.push({ x: i, y: p, d, units: unitsToSell });
                
                indDailyLog.push({
                  d, p, action: '賣出', units: unitsToSell,
                  cost: costOfSold,
                  realized: realized,
                  cumPnl: indRealizedPnL,
                  holdUnits: indUnits,
                  notes: `燈號紅燈賣出 (${unitsToSell}股)`
                });
              }
            }
          }
        }
      }
      lastMonth = currentMonth;

      let dayBuys: {p: number, units: number}[] = [];
      let daySells: {price: number, pos: any}[] = [];
      let dayNotes: string[] = [];
      let dayBuyIds: number[] = [];
      let stepPnl = 0;

      const hasPos = positions.length > 0;
      if (!hasPos) {
        noPosiHighWater = Math.max(noPosiHighWater, p);
        const drop = (noPosiHighWater - p) / noPosiHighWater;
        if (drop >= buyThreshold && positions.length < MAX_GRIDS) {
          const costPerUnit = p * (1 + BUY_FEE_RATE);
          const maxUnitsCanBuy = Math.floor(availableCapital / costPerUnit);
          const targetUnits = Math.floor(CAPITAL_PER_GRID / p);
          const units = Math.min(maxUnitsCanBuy, targetUnits);
          
          if (units > 0) {
            const cost = units * p;
            const fee = cost * BUY_FEE_RATE;
            availableCapital -= (cost + fee);
            minAvailableCapital = Math.min(minAvailableCapital, availableCapital);
            
            const newPosId = ++posId;
            positions.push({ id: newPosId, buyDate: d, buyPrice: p, units });
            lastBuyRef = p;
            noPosiHighWater = p;
            dayBuys.push({p, units});
            dayBuyIds.push(newPosId);
            buyPts.push({ x: i, y: p, d });
            dayNotes.push(`空倉高點回跌觸發 (#${newPosId})`);
          } else {
            dayNotes.push(`空倉回跌觸發，但資金不足`);
          }
        }
      } else {
        const drop = (lastBuyRef - p) / lastBuyRef;
        if (drop >= buyThreshold && positions.length < MAX_GRIDS) {
          const costPerUnit = p * (1 + BUY_FEE_RATE);
          const maxUnitsCanBuy = Math.floor(availableCapital / costPerUnit);
          const targetUnits = Math.floor(CAPITAL_PER_GRID / p);
          const units = Math.min(maxUnitsCanBuy, targetUnits);
          
          if (units > 0) {
            const cost = units * p;
            const fee = cost * BUY_FEE_RATE;
            availableCapital -= (cost + fee);
            minAvailableCapital = Math.min(minAvailableCapital, availableCapital);
            
            const newPosId = ++posId;
            positions.push({ id: newPosId, buyDate: d, buyPrice: p, units });
            lastBuyRef = p;
            dayBuys.push({p, units});
            dayBuyIds.push(newPosId);
            buyPts.push({ x: i, y: p, d });
            dayNotes.push(`跌幅達門檻加碼 (#${newPosId})`);
          } else {
            dayNotes.push(`跌幅達門檻，但資金不足`);
          }
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
          
          const grossRev = p * pos.units;
          const netRev = grossRev - sellFee;
          availableCapital += netRev;
          
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
      
      maxInvestedCapital = TOTAL_CAPITAL - minAvailableCapital;
      
      if (positions.length > 0) {
        lastBuyRef = Math.min(...positions.map(x => x.buyPrice));
      } else {
        noPosiHighWater = p;
        lastBuyRef = p;
      }

      holdSeries.push({ d, n: positions.length });

      if (dayBuys.length > 0 || daySells.length > 0) {
        const avgBuy = dayBuys.length > 0 ? dayBuys.reduce((a, b) => a + b.p * b.units, 0) / dayBuys.reduce((a, b) => a + b.units, 0) : null;
        const avgSell = daySells.length > 0 ? daySells.reduce((a, b) => a + b.price * b.pos.units, 0) / daySells.reduce((a, b) => a + b.pos.units, 0) : null;
        const action = dayBuys.length > 0 && daySells.length > 0 ? '買+賣' : dayBuys.length > 0 ? '買入' : '賣出';
        
        dailyLog.push({
          d, p, action, 
          buyUnits: dayBuys.reduce((a, b) => a + b.units, 0), 
          sellUnits: daySells.reduce((a, b) => a + b.pos.units, 0),
          avgBuy, avgSell, stepPnl, cumPnl: totalRealized, 
          holdUnits: positions.reduce((a, b) => a + b.units, 0), 
          notes: dayNotes.join(' | '),
          buyPosIds: dayBuyIds
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
    
    const denom = TOTAL_CAPITAL;
    const realizedPct = ((totalRealized / denom) * 100).toFixed(2) + '%';
    const unrealizedPct = ((unrealizedFinal / denom) * 100).toFixed(2) + '%';
    const totalPnLPct = ((totalPnL / denom) * 100).toFixed(2) + '%';

    const bhUnits = TOTAL_CAPITAL / base.p;
    const bhBuyFee = TOTAL_CAPITAL * BUY_FEE_RATE;
    const bhGrossValue = bhUnits * finalP;
    const bhSellFee = bhGrossValue * SELL_FEE_TAX_RATE;
    const bhNetPnl = bhGrossValue - TOTAL_CAPITAL - bhBuyFee - bhSellFee;
    const bhPct = (bhNetPnl / TOTAL_CAPITAL) * 100;
    const bhPctStr = bhPct.toFixed(2) + '%';

    const openPosMap = new Map(positions.map(pos => {
      const gross = (finalP - pos.buyPrice) * pos.units;
      const buyFee = pos.buyPrice * pos.units * BUY_FEE_RATE;
      const estSellFee = finalP * pos.units * SELL_FEE_TAX_RATE;
      return [pos.id, gross - buyFee - estSellFee];
    }));

    const processedDailyLog = dailyLog.map(log => {
      if (log.buyPosIds && log.buyPosIds.length > 0) {
        const updatedNotes = log.notes.split(' | ').map((note: string) => {
          const match = note.match(/\(#(\d+)\)/);
          if (match) {
            const id = parseInt(match[1]);
            if (openPosMap.has(id)) {
              const pnl = openPosMap.get(id)!;
              const sign = pnl >= 0 ? '+' : '';
              return `${note.replace(` (#${id})`, '')} (目前未平倉損益: ${sign}$${Math.round(pnl)})`;
            } else {
              return note.replace(` (#${id})`, '');
            }
          }
          return note;
        }).join(' | ');
        return { ...log, notes: updatedNotes };
      }
      return log;
    }).reverse();

    const indFinalPrice = rangeData[rangeData.length - 1].p;
    const indUnrealizedGross = indUnits * indFinalPrice;
    const indUnrealizedFee = indUnrealizedGross * SELL_FEE_TAX_RATE;
    const indUnrealizedNet = indUnrealizedGross - indUnrealizedFee;
    const indUnrealizedPnL = indUnits > 0 ? indUnrealizedNet - (indUnits * indAvgCost) : 0;
    const indTotalPnL = indRealizedPnL + indUnrealizedPnL;
    
    const indMetrics = {
      units: indUnits,
      avgCost: indAvgCost,
      realizedPnL: indRealizedPnL,
      unrealizedPnL: indUnrealizedPnL,
      totalPnL: indTotalPnL,
      totalPnLPct: ((indTotalPnL / TOTAL_CAPITAL) * 100).toFixed(2) + '%',
      buyCount: indBuyCount,
      sellCount: indSellCount,
      invested: indUnits * indAvgCost,
    };

    // Blue Light Only Metrics
    const blueOnlyGrossValue = blueOnlyUnits * finalP;
    const blueOnlyEstSellFee = blueOnlyGrossValue * SELL_FEE_TAX_RATE;
    const blueOnlyNetValue = blueOnlyGrossValue - blueOnlyEstSellFee;
    const blueOnlyTotalPnL = blueOnlyNetValue - blueOnlyInvested;
    const blueOnlyRoi = blueOnlyInvested > 0 ? ((blueOnlyTotalPnL / blueOnlyInvested) * 100).toFixed(2) + '%' : '0.00%';

    const blueOnlyMetrics = {
      units: blueOnlyUnits,
      invested: blueOnlyInvested,
      buyCount: blueOnlyBuyCount,
      finalValue: blueOnlyNetValue,
      totalPnL: blueOnlyTotalPnL,
      roi: blueOnlyRoi
    };

    const metrics = {
      baseDate: base.d,
      basePrice: base.p,
      finalPrice: finalP,
      totalRealized,
      realizedPct,
      unrealizedFinal,
      unrealizedPct,
      totalPnL,
      totalPnLPct,
      completedCount: completedPos.length,
      currentPositions: positions.length,
      totalInvested,
      maxInvestedCapital,
      totalCostPaid,
      bhNetPnl,
      bhPctStr
    };

    const priceChartData = rangeData.map((d, i) => {
      const isBuy = buyPts.find(b => b.x === i);
      const isSell = sellPts.find(s => s.x === i);
      const isIndBuy = indBuyPts.find(b => b.x === i);
      const isIndSell = indSellPts.find(s => s.x === i);
      const isBlueOnlyBuy = blueOnlyBuyPts.find(b => b.x === i);
      return {
        name: d.d,
        price: d.p,
        buy: isBuy ? d.p : null,
        sell: isSell ? d.p : null,
        indBuy: isIndBuy ? d.p : null,
        indSell: isIndSell ? d.p : null,
        blueOnlyBuy: isBlueOnlyBuy ? d.p : null,
      };
    });

    const monthPnL: Record<string, number> = {};
    completedPos.forEach(c => {
      const m = c.sellDate.substring(0, 7);
      monthPnL[m] = (monthPnL[m] || 0) + c.pnl;
    });
    const monthlyData = Object.keys(monthPnL).sort().map(k => ({
      month: k,
      pnl: monthPnL[k]
    }));

    const allPos = [
      ...completedPos,
      ...positions.map(p => ({ ...p, sellDate: null, sellPrice: null, pnl: null, pct: null }))
    ].sort((a, b) => a.buyDate.localeCompare(b.buyDate));

    const indicatorRange = Object.keys(INDICATOR_DATA)
      .filter(k => k >= `${Math.min(parseInt(startYear), parseInt(endYear))}-01` && k <= `${Math.max(parseInt(startYear), parseInt(endYear))}-12`)
      .map(k => ({ month: k, ...INDICATOR_DATA[k] }));

    return { metrics, priceChartData, holdSeries, monthlyData, allPos, dailyLog: processedDailyLog, finalP, indicatorRange, indMetrics, indDailyLog: indDailyLog.reverse(), blueOnlyMetrics };
  }, [startYear, endYear, buyThreshold, sellThreshold]);

  if (!simResult) return <div className="p-8 text-center text-slate-400 min-h-screen bg-slate-900">資料不足</div>;

  const { metrics, priceChartData, holdSeries, monthlyData, allPos, dailyLog, indicatorRange, indMetrics, indDailyLog, blueOnlyMetrics } = simResult;

  return (
    <div className="min-h-screen bg-slate-900 text-slate-200 font-sans">
      <div className="p-4 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-xl font-medium mb-1">00631L 網格交易回測 v3 (含交易成本)</h1>
            <p className="text-sm text-slate-400">總資金 100萬 · 最大 100格 · 基準 {metrics.baseDate} 收盤 ${metrics.basePrice.toFixed(2)} · 總成本率 0.37125%</p>
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <div className="flex items-center gap-1 bg-slate-800 border border-slate-700 rounded-md px-2">
              <select className="py-1.5 text-sm bg-transparent outline-none cursor-pointer text-slate-200" value={startYear} onChange={e => setStartYear(e.target.value)}>
                {['2020','2021','2022','2023','2024','2025','2026'].map(y => <option key={y} value={y} className="bg-slate-800">{y}年</option>)}
              </select>
              <span className="text-slate-500 text-sm">至</span>
              <select className="py-1.5 text-sm bg-transparent outline-none cursor-pointer text-slate-200" value={endYear} onChange={e => setEndYear(e.target.value)}>
                {['2020','2021','2022','2023','2024','2025','2026'].map(y => <option key={y} value={y} className="bg-slate-800">{y}年</option>)}
              </select>
            </div>
            <select className="px-3 py-1.5 border border-slate-700 rounded-md text-sm bg-slate-800 text-slate-200" value={buyThreshold} onChange={e => setBuyThreshold(parseFloat(e.target.value))}>
              <option value="0.01">跌1%買入</option>
              <option value="0.02">跌2%買入</option>
              <option value="0.03">跌3%買入</option>
              <option value="0.05">跌5%買入</option>
            </select>
            <select className="px-3 py-1.5 border border-slate-700 rounded-md text-sm bg-slate-800 text-slate-200" value={sellThreshold} onChange={e => setSellThreshold(parseFloat(e.target.value))}>
              <option value="0.01">漲1%賣出</option>
              <option value="0.02">漲2%賣出</option>
              <option value="0.03">漲3%賣出</option>
              <option value="0.05">漲5%賣出</option>
            </select>
          </div>
        </div>

        {/* Grid Metrics */}
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 shadow-sm mb-4">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-sm font-medium text-slate-400">網格交易策略</h3>
            <div className="text-xs font-medium bg-slate-700 px-2 py-1 rounded text-slate-300">
              剩餘可用資金: <span className="text-white">${Math.round(TOTAL_CAPITAL - metrics.maxInvestedCapital).toLocaleString()}</span>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <MetricCard label="基準價" value={`$${metrics.basePrice.toFixed(2)}`} />
            <MetricCard label="期末收盤" value={`$${metrics.finalPrice.toFixed(2)}`} />
            <MetricCard label="總投入資金" value={`$${Math.round(TOTAL_CAPITAL).toLocaleString()}`} color="text-blue-400" />
            <MetricCard label="最大動用資金" value={`$${Math.round(metrics.maxInvestedCapital).toLocaleString()}`} />
            <MetricCard label="期末持倉" value={`${metrics.currentPositions} 格`} />
            <MetricCard label="期末佔用資金" value={`$${Math.round(metrics.totalInvested).toLocaleString()}`} />
            
            <MetricCard label="已實現損益" value={`$${Math.round(metrics.totalRealized).toLocaleString()}`} sub={`(${metrics.realizedPct})`} color={metrics.totalRealized >= 0 ? 'text-red-400' : 'text-green-400'} />
            <MetricCard label="未實現損益" value={`$${Math.round(metrics.unrealizedFinal).toLocaleString()}`} sub={`(${metrics.unrealizedPct})`} color={metrics.unrealizedFinal >= 0 ? 'text-red-400' : 'text-green-400'} />
            <MetricCard label="總損益" value={`$${Math.round(metrics.totalPnL).toLocaleString()}`} sub={`(${metrics.totalPnLPct})`} color={metrics.totalPnL >= 0 ? 'text-red-400' : 'text-green-400'} />
            <MetricCard label="完成筆數" value={`${metrics.completedCount} 筆`} />
            <MetricCard label="買進持有損益(對比)" value={`$${Math.round(metrics.bhNetPnl).toLocaleString()}`} sub={`(${metrics.bhPctStr})`} color={metrics.bhNetPnl >= 0 ? 'text-red-400' : 'text-green-400'} />
          </div>
        </div>

        {/* Indicator Metrics */}
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 shadow-sm mb-4">
          <h3 className="text-sm font-medium text-slate-400 mb-3">景氣燈號策略 (藍燈買10%、紅燈賣20%)</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
            <MetricCard label="期末持倉" value={`${indMetrics.units} 股`} />
            <MetricCard label="持倉均價" value={`$${indMetrics.avgCost.toFixed(2)}`} />
            <MetricCard label="期末佔用資金" value={`$${Math.round(indMetrics.invested).toLocaleString()}`} />
            <MetricCard label="已實現損益" value={`$${Math.round(indMetrics.realizedPnL).toLocaleString()}`} color={indMetrics.realizedPnL >= 0 ? 'text-red-400' : 'text-green-400'} />
            <MetricCard label="未實現損益" value={`$${Math.round(indMetrics.unrealizedPnL).toLocaleString()}`} color={indMetrics.unrealizedPnL >= 0 ? 'text-red-400' : 'text-green-400'} />
            <MetricCard label="總損益" value={`$${Math.round(indMetrics.totalPnL).toLocaleString()}`} sub={`(${indMetrics.totalPnLPct})`} color={indMetrics.totalPnL >= 0 ? 'text-red-400' : 'text-green-400'} />
            <MetricCard label="買入次數" value={`${indMetrics.buyCount} 次`} />
            <MetricCard label="賣出次數" value={`${indMetrics.sellCount} 次`} />
          </div>
        </div>

        {/* Blue Light Only Metrics */}
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 shadow-sm mb-4">
          <h3 className="text-sm font-medium text-slate-400 mb-3">純藍燈買進持有策略 (獨立資金：每次買10萬，不賣出)</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <MetricCard label="總投入資金" value={`$${Math.round(blueOnlyMetrics.invested).toLocaleString()}`} color="text-blue-400" />
            <MetricCard label="累積持倉" value={`${blueOnlyMetrics.units} 股`} />
            <MetricCard label="買入次數" value={`${blueOnlyMetrics.buyCount} 次`} />
            <MetricCard label="期末總值" value={`$${Math.round(blueOnlyMetrics.finalValue).toLocaleString()}`} />
            <MetricCard label="總損益" value={`$${Math.round(blueOnlyMetrics.totalPnL).toLocaleString()}`} color={blueOnlyMetrics.totalPnL >= 0 ? 'text-red-400' : 'text-green-400'} />
            <MetricCard label="報酬率" value={blueOnlyMetrics.roi} color={blueOnlyMetrics.totalPnL >= 0 ? 'text-red-400' : 'text-green-400'} />
          </div>
        </div>

        {/* Indicators */}
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 shadow-sm">
          <h3 className="text-sm font-medium text-slate-400 mb-4">景氣對策燈號 ({Math.min(parseInt(startYear), parseInt(endYear))} - {Math.max(parseInt(startYear), parseInt(endYear))})</h3>
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-slate-600 scrollbar-track-transparent">
            {indicatorRange.map(ind => (
              <div key={ind.month} className="flex flex-col items-center min-w-[60px] p-2 bg-slate-900 rounded-lg border border-slate-700 shrink-0">
                <span className="text-[10px] text-slate-400 mb-1">{ind.month.substring(2).replace('-', '/')}</span>
                <div className={`w-4 h-4 rounded-full ${ind.color} mb-1 shadow-sm`} title={ind.light}></div>
                <span className="text-xs font-medium text-slate-200">{ind.score}</span>
              </div>
            ))}
          </div>
        </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 shadow-sm">
          <h3 className="text-sm font-medium text-slate-400 mb-4">價格走勢 + 進出場</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={priceChartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" />
                <XAxis dataKey="name" tickFormatter={d => d.substring(2)} tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} minTickGap={20} />
                <YAxis domain={['auto', 'auto']} tickFormatter={v => `$${v}`} tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ backgroundColor: '#1e293b', color: '#f1f5f9', fontSize: '12px', borderRadius: '8px', border: '1px solid #334155', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                <Line type="monotone" dataKey="price" stroke="#60a5fa" strokeWidth={1.5} dot={false} isAnimationActive={false} />
                <Scatter dataKey="buy" fill="#f87171" shape="triangle" isAnimationActive={false} name="網格買" />
                <Scatter dataKey="sell" fill="#4ade80" shape="square" isAnimationActive={false} name="網格賣" />
                <Scatter dataKey="indBuy" fill="#3b82f6" shape="triangle" isAnimationActive={false} name="燈號買" />
                <Scatter dataKey="indSell" fill="#f97316" shape="square" isAnimationActive={false} name="燈號賣" />
                <Scatter dataKey="blueOnlyBuy" fill="#a855f7" shape="star" isAnimationActive={false} name="純藍燈買" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 shadow-sm">
          <h3 className="text-sm font-medium text-slate-400 mb-4">持倉單位數</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={holdSeries} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" />
                <XAxis dataKey="d" tickFormatter={d => d.substring(2)} tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} minTickGap={20} />
                <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ backgroundColor: '#1e293b', color: '#f1f5f9', fontSize: '12px', borderRadius: '8px', border: '1px solid #334155', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                <Area type="step" dataKey="n" stroke="#fbbf24" fill="rgba(251,191,36,0.1)" strokeWidth={1.5} isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-slate-800 border border-slate-700 rounded-xl p-4 shadow-sm flex flex-col">
          <h3 className="text-sm font-medium text-slate-400 mb-4">倉位明細</h3>
          <div className="overflow-y-auto flex-1 max-h-80">
            <table className="w-full text-xs text-left whitespace-nowrap">
              <thead className="sticky top-0 bg-slate-800 text-slate-400 border-b border-slate-700">
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
              <tbody className="divide-y divide-slate-700/50">
                {allPos.map((pos, i) => {
                  const cost = pos.buyPrice * pos.units;
                  const sellAmt = pos.sellPrice ? pos.sellPrice * pos.units : null;
                  const isClosed = pos.sellDate !== null;
                  
                  let pnlTxt;
                  if (isClosed) {
                    const pnlColor = pos.pnl >= 0 ? 'text-red-400' : 'text-green-400';
                    const sign = pos.pnl >= 0 ? '+' : '';
                    pnlTxt = <span className={pnlColor}>{sign}${Math.round(pos.pnl).toLocaleString()} <span className="text-[10px]">({pos.pct}%)</span></span>;
                  } else {
                    const estGross = (metrics.finalPrice - pos.buyPrice) * pos.units;
                    const estBuyFee = pos.buyPrice * pos.units * BUY_FEE_RATE;
                    const estSellFee = metrics.finalPrice * pos.units * SELL_FEE_TAX_RATE;
                    const estNetPnl = estGross - estBuyFee - estSellFee;
                    const estPct = (estNetPnl / cost * 100).toFixed(2);
                    const sign = estNetPnl >= 0 ? '+' : '';
                    pnlTxt = <span className="text-slate-400">浮{sign}${Math.round(estNetPnl).toLocaleString()} <span className="text-[10px]">({estPct}%)</span></span>;
                  }

                  return (
                    <tr key={i} className="hover:bg-slate-700/50">
                      <td className="py-2 px-2">{pos.buyDate.substring(5)}</td>
                      <td className="py-2 px-2">${pos.buyPrice.toFixed(2)}</td>
                      <td className="py-2 px-2">${Math.round(cost).toLocaleString()}</td>
                      <td className="py-2 px-2">{isClosed ? pos.sellDate.substring(5) : <span className="text-slate-500">—</span>}</td>
                      <td className="py-2 px-2">{isClosed ? `$${pos.sellPrice.toFixed(2)}` : <span className="text-slate-500">—</span>}</td>
                      <td className="py-2 px-2">{isClosed ? `$${Math.round(sellAmt!).toLocaleString()}` : <span className="text-slate-500">—</span>}</td>
                      <td className="py-2 px-2">{pnlTxt}</td>
                      <td className="py-2 px-2">
                        {isClosed ? 
                          <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-900/30 text-red-400">已平倉</span> : 
                          <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-900/30 text-green-400">持倉中</span>
                        }
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
        
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 shadow-sm flex flex-col">
          <h3 className="text-sm font-medium text-slate-400 mb-4">月損益</h3>
          <div className="flex-1 min-h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={v => `$${Math.round(v/1000)}k`} tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <Tooltip cursor={{fill: '#334155'}} contentStyle={{ backgroundColor: '#1e293b', color: '#f1f5f9', fontSize: '12px', borderRadius: '8px', border: '1px solid #334155', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                <Bar dataKey="pnl" radius={[4, 4, 0, 0]} isAnimationActive={false}>
                  {monthlyData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.pnl >= 0 ? '#f87171' : '#4ade80'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Log Table */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 shadow-sm">
          <h3 className="text-sm font-medium text-slate-400 mb-4">網格策略每日事件日誌</h3>
          <div className="overflow-y-auto max-h-64">
            <table className="w-full text-xs text-left whitespace-nowrap">
            <thead className="sticky top-0 bg-slate-800 text-slate-400 border-b border-slate-700">
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
            <tbody className="divide-y divide-slate-700/50">
              {dailyLog.map((l, i) => {
                const isB = l.action.includes('買');
                const isS = l.action.includes('賣');
                
                let actionTag;
                if (l.action === '買入') actionTag = <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-900/30 text-blue-400">買入</span>;
                else if (l.action === '賣出') actionTag = <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-900/30 text-red-400">賣出</span>;
                else actionTag = <><span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-900/30 text-blue-400">買</span> <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-900/30 text-red-400">賣</span></>;

                const units = isB && !isS ? `+${l.buyUnits}` : !isB && isS ? `-${l.sellUnits}` : `+${l.buyUnits}/-${l.sellUnits}`;
                const avgP = l.avgBuy && l.avgSell ? `買$${l.avgBuy.toFixed(2)}/賣$${l.avgSell.toFixed(2)}` : l.avgBuy ? `$${l.avgBuy.toFixed(2)}` : `$${l.avgSell.toFixed(2)}`;
                
                const stepPnlColor = l.stepPnl > 0 ? 'text-red-400' : l.stepPnl < 0 ? 'text-green-400' : '';
                const cumPnlColor = l.cumPnl >= 0 ? 'text-red-400' : 'text-green-400';
                
                let stepPct = '';
                if (l.stepPnl && l.avgSell) {
                   const grossRev = l.avgSell * l.sellUnits;
                   const costBasis = grossRev - l.stepPnl; 
                   if (costBasis > 0) stepPct = ` (${(l.stepPnl / costBasis * 100).toFixed(2)}%)`;
                }

                return (
                  <tr key={i} className="hover:bg-slate-700/50">
                    <td className="py-2 px-2">{l.d}</td>
                    <td className="py-2 px-2">${l.p.toFixed(2)}</td>
                    <td className="py-2 px-2">{actionTag}</td>
                    <td className="py-2 px-2 text-slate-400">{units}</td>
                    <td className="py-2 px-2">{avgP}</td>
                    <td className={`py-2 px-2 ${stepPnlColor}`}>{l.stepPnl ? `${l.stepPnl > 0 ? '+' : ''}$${Math.round(l.stepPnl).toLocaleString()}${stepPct}` : '—'}</td>
                    <td className={`py-2 px-2 ${cumPnlColor}`}>${Math.round(l.cumPnl).toLocaleString()}</td>
                    <td className="py-2 px-2">{l.holdUnits}</td>
                    <td className="py-2 px-2 text-[11px] text-slate-400 truncate max-w-[200px]" title={l.notes}>{l.notes}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 shadow-sm">
        <h3 className="text-sm font-medium text-slate-400 mb-4">景氣燈號策略交易日誌</h3>
        <div className="overflow-y-auto max-h-64">
          <table className="w-full text-xs text-left whitespace-nowrap">
            <thead className="sticky top-0 bg-slate-800 text-slate-400 border-b border-slate-700">
              <tr>
                <th className="py-2 px-2 font-medium">日期</th>
                <th className="py-2 px-2 font-medium">收盤價</th>
                <th className="py-2 px-2 font-medium">動作</th>
                <th className="py-2 px-2 font-medium">股數</th>
                <th className="py-2 px-2 font-medium">本次損益</th>
                <th className="py-2 px-2 font-medium">累計損益</th>
                <th className="py-2 px-2 font-medium">持倉(股)</th>
                <th className="py-2 px-2 font-medium">備註</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {indDailyLog.map((l, i) => {
                const actionTag = l.action === '買入' ? 
                  <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-900/30 text-blue-400">買入</span> : 
                  <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-900/30 text-red-400">賣出</span>;
                
                const stepPnlColor = l.realized > 0 ? 'text-red-400' : l.realized < 0 ? 'text-green-400' : '';
                const cumPnlColor = l.cumPnl >= 0 ? 'text-red-400' : 'text-green-400';
                
                return (
                  <tr key={i} className="hover:bg-slate-700/50">
                    <td className="py-2 px-2">{l.d.substring(5)}</td>
                    <td className="py-2 px-2">${l.p.toFixed(2)}</td>
                    <td className="py-2 px-2">{actionTag}</td>
                    <td className="py-2 px-2">{l.action === '買入' ? '+' : '-'}{l.units}</td>
                    <td className={`py-2 px-2 ${stepPnlColor}`}>{l.realized !== 0 ? (l.realized > 0 ? '+' : '') + Math.round(l.realized) : '—'}</td>
                    <td className={`py-2 px-2 ${cumPnlColor}`}>{l.cumPnl >= 0 ? '+' : ''}{Math.round(l.cumPnl)}</td>
                    <td className="py-2 px-2">{l.holdUnits}</td>
                    <td className="py-2 px-2 text-slate-400">{l.notes}</td>
                  </tr>
                );
              })}
              {indDailyLog.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-4 text-center text-slate-500">尚無交易紀錄</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
    
    <div className="text-[11px] text-slate-500 mt-2">
      每格資金約1萬元。總交易成本率 0.37125% (買進 0.035625% + 賣出 0.035625% + 證交稅 0.3%)。價格為近似重建值，僅供策略邏輯驗證，非投資建議。
    </div>
  </div>
</div>
  );
}

