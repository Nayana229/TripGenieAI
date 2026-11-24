'use client';

import { AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import { CURRENCY_SYMBOLS, type BudgetAnalysis, type CurrencyCode } from '../types/travel';

interface SmartBudgetPanelProps {
  budgetAnalysis: BudgetAnalysis;
  currency: CurrencyCode;
}

export function formatMoney(amount: number, currency: CurrencyCode): string {
  const sym = CURRENCY_SYMBOLS[currency] || `${currency} `;
  const rounded = Math.round(amount || 0).toLocaleString('en-US');
  return `${sym}${rounded}`;
}

export function SmartBudgetPanel({ budgetAnalysis, currency }: SmartBudgetPanelProps) {
  const { realismStatus, warningMessage, estimatedTotal, userBudget, breakdown, savingTips } =
    budgetAnalysis;

  const categories = [
    {
      key: 'transportation',
      label: 'Transportation',
      color: 'bg-[#0B1D3A]',
      data: breakdown.transportation,
    },
    {
      key: 'accommodation',
      label: 'Accommodation',
      color: 'bg-sky-500',
      data: breakdown.accommodation,
    },
    {
      key: 'food',
      label: 'Food & Dining',
      color: 'bg-sky-300',
      data: breakdown.food,
    },
    {
      key: 'activities',
      label: 'Activities & Entry',
      color: 'bg-slate-400',
      data: breakdown.activities,
    },
  ];

  const delta = userBudget - estimatedTotal;

  return (
    <section
      aria-labelledby="smart-budget-heading"
      className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-7 space-y-6"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
        <div>
          <h2 id="smart-budget-heading" className="text-xl font-bold font-display text-[#0B1D3A]">
            Smart Budget Planner
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Estimated planning ranges only — not verified live booking prices or airfare
          </p>
        </div>
        <div className="text-left sm:text-right tabular-nums">
          <div className="text-xs text-slate-500">Estimated Total vs. Your Budget</div>
          <div className="text-base font-bold font-mono text-[#0B1D3A]">
            ~{formatMoney(estimatedTotal, currency)}{' '}
            <span className="text-slate-400 font-normal">/</span>{' '}
            {formatMoney(userBudget, currency)}
          </div>
        </div>
      </div>

      {/* Budget Realism Warning / Confirmation (Icon + Text Label + Semantic Tone) */}
      {realismStatus === 'unrealistic' ? (
        <div
          role="alert"
          className="flex items-start gap-3 p-4 rounded-xl bg-red-50 border border-red-200 text-red-900"
        >
          <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold">Budget Warning: Target budget appears unrealistic</p>
            <p className="mt-1 text-red-800 leading-relaxed">{warningMessage}</p>
          </div>
        </div>
      ) : realismStatus === 'tight' ? (
        <div
          role="status"
          className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-950"
        >
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold">Tight Budget Advisory</p>
            <p className="mt-1 text-amber-900 leading-relaxed">{warningMessage}</p>
          </div>
        </div>
      ) : (
        <div
          role="status"
          className="flex items-start gap-3 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-950"
        >
          <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold">Realistic Budget Fit</p>
            <p className="mt-1 text-emerald-900 leading-relaxed">{warningMessage}</p>
          </div>
        </div>
      )}

      {/* Proportional Distribution Bar */}
      <div>
        <div className="h-3 w-full rounded-full overflow-hidden flex bg-slate-100">
          {categories.map((cat) => (
            <div
              key={cat.key}
              className={`${cat.color} h-full`}
              style={{ width: `${Math.max(4, cat.data.percentage)}%` }}
              title={`${cat.label}: ${cat.data.percentage}%`}
            />
          ))}
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-xs text-slate-500">
                <th className="py-2.5 pr-4 font-medium">Category</th>
                <th className="py-2.5 px-3 font-medium">Planning Note</th>
                <th className="py-2.5 px-3 font-medium text-right">Share</th>
                <th className="py-2.5 pl-3 font-medium text-right">Estimated Cost</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {categories.map((cat) => (
                <tr key={cat.key}>
                  <td className="py-3 pr-4 font-medium text-[#0B1D3A] whitespace-nowrap">
                    <span className="inline-flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-xs ${cat.color}`} aria-hidden="true" />
                      {cat.label}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-slate-600 text-xs sm:text-sm">{cat.data.note}</td>
                  <td className="py-3 px-3 text-right font-mono text-xs text-slate-600 tabular-nums whitespace-nowrap">
                    {cat.data.percentage}%
                  </td>
                  <td className="py-3 pl-3 text-right font-mono font-medium text-[#0B1D3A] tabular-nums whitespace-nowrap">
                    ~{formatMoney(cat.data.amount, currency)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-slate-200 text-sm font-semibold text-[#0B1D3A]">
                <td colSpan={3} className="py-3 pr-4">
                  Estimated Balance vs. Your Budget
                </td>
                <td
                  className={`py-3 pl-3 text-right font-mono tabular-nums whitespace-nowrap ${
                    delta < 0 ? 'text-red-700' : 'text-emerald-700'
                  }`}
                >
                  {delta >= 0
                    ? `+${formatMoney(delta, currency)} buffer`
                    : `${formatMoney(Math.abs(delta), currency)} over`}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Cost Optimization Tips */}
      {savingTips && savingTips.length > 0 && (
        <div className="pt-4 border-t border-slate-100">
          <div className="flex items-center gap-2 text-xs font-semibold text-[#0B1D3A] mb-2">
            <Info className="w-4 h-4 text-sky-600" />
            <span>Budget Optimization Notes</span>
          </div>
          <ul className="space-y-1.5 text-sm text-slate-600 list-disc pl-5">
            {savingTips.map((tip) => (
              <li key={tip}>{tip}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
