'use client';

import React from 'react';
import type { Complex } from '@/wallpaper/conformal/mobius';
import {
  type Card,
  type PrimitiveType,
  PRIMITIVE_SPECS,
  PRIMITIVE_ORDER,
  isDegenerate,
} from '@/wallpaper/conformal/primitives';
import { MAX_CARDS } from '@/wallpaper/conformal/pipeline';
import { PRESETS, hasSpiralSeam } from '@/wallpaper/conformal/presets';

type Props = {
  cards: Card[];
  onChange: (cards: Card[]) => void;
  baseLabel: string;
};

// Read/write a complex param by key on a card (the union's complex fields are keyed by the
// primitive's param spec). Pure: returns a new card.
const setParam = (
  card: Card,
  key: string,
  part: 're' | 'im',
  value: number,
): Card => {
  const prev = (card as unknown as Record<string, Complex>)[key];
  return {
    ...card,
    [key]: { ...prev, [part]: value },
  } as Card;
};

export default function WarpControls({ cards, onChange, baseLabel }: Props) {
  const add = (type: PrimitiveType) => {
    if (cards.length >= MAX_CARDS) return;
    onChange([...cards, PRIMITIVE_SPECS[type].create()]);
  };
  const remove = (i: number) => onChange(cards.filter((_, k) => k !== i));
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= cards.length) return;
    const next = [...cards];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  const editParam = (i: number, key: string, part: 're' | 'im', v: number) =>
    onChange(cards.map((c, k) => (k === i ? setParam(c, key, part, v) : c)));

  return (
    <div className="flex flex-col gap-3 p-3 rounded-xl bg-white/6 border border-white/10">
      <div className="text-[11px] leading-relaxed opacity-75">
        Warping: <span className="font-mono">{baseLabel}</span>
        <br />
        <span className="opacity-60">
          Raster stage (WebGL). Change the base from the tabs above.
        </span>
      </div>

      {/* Presets */}
      <div className="flex flex-col gap-1.5">
        <span className="text-[10px] uppercase tracking-wide opacity-50">Presets</span>
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              title={p.note}
              onClick={() => onChange(p.cards.map((c) => ({ ...c })))}
              className="rounded px-2 py-1 text-[11px] bg-white/85 text-black hover:bg-white transition-colors"
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Pipeline */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-wide opacity-50">
            Pipeline · applied top → bottom
          </span>
          <span className="text-[10px] opacity-40">
            {cards.length}/{MAX_CARDS}
          </span>
        </div>

        {cards.length === 0 && (
          <p className="text-[11px] italic opacity-40">
            Empty — the pattern is shown unwarped. Add a transform or pick a preset.
          </p>
        )}

        {cards.map((card, i) => {
          const spec = PRIMITIVE_SPECS[card.type];
          const degenerate = isDegenerate(card);
          return (
            <div
              key={i}
              className="rounded-md bg-white/6 ring-1 ring-white/10 p-2 flex flex-col gap-1.5"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-mono opacity-80">
                  {i + 1}. {spec.label}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => move(i, -1)}
                    disabled={i === 0}
                    aria-label="Move up"
                    className="rounded px-1.5 py-0.5 text-[11px] bg-white/10 hover:bg-white/20 disabled:opacity-25"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => move(i, 1)}
                    disabled={i === cards.length - 1}
                    aria-label="Move down"
                    className="rounded px-1.5 py-0.5 text-[11px] bg-white/10 hover:bg-white/20 disabled:opacity-25"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(i)}
                    aria-label="Remove"
                    className="rounded px-1.5 py-0.5 text-[11px] bg-white/10 hover:bg-white/20"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {spec.params.length > 0 && (
                <div className="grid grid-cols-2 gap-1.5">
                  {spec.params.map(({ key, label }) => {
                    const value = (card as unknown as Record<string, Complex>)[key];
                    return (
                      <div key={key} className="flex flex-col gap-0.5">
                        <span className="text-[10px] font-mono opacity-60">
                          {label} = Re + Im·i
                        </span>
                        <div className="flex gap-1">
                          <input
                            type="number"
                            step={0.1}
                            value={value.re}
                            onChange={(e) =>
                              editParam(i, key, 're', Number(e.target.value))
                            }
                            aria-label={`${label} real part`}
                            className="w-full bg-white/10 rounded px-1 py-0.5 text-xs tabular-nums"
                          />
                          <input
                            type="number"
                            step={0.1}
                            value={value.im}
                            onChange={(e) =>
                              editParam(i, key, 'im', Number(e.target.value))
                            }
                            aria-label={`${label} imaginary part`}
                            className="w-full bg-white/10 rounded px-1 py-0.5 text-xs tabular-nums"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {degenerate && (
                <p className="text-[10px] leading-relaxed rounded bg-amber-400/10 ring-1 ring-amber-300/30 text-amber-100 px-1.5 py-1">
                  Degenerate (no inverse) — this card is skipped. Adjust a parameter.
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* Add transform */}
      <div className="flex flex-col gap-1.5">
        <span className="text-[10px] uppercase tracking-wide opacity-50">
          Add transform
        </span>
        <div className="flex flex-wrap gap-1.5">
          {PRIMITIVE_ORDER.map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => add(type)}
              disabled={cards.length >= MAX_CARDS}
              className="rounded px-2 py-1 text-[11px] bg-white/10 text-white/80 hover:bg-white/20 disabled:opacity-25 transition-colors"
            >
              + {PRIMITIVE_SPECS[type].label.split(' ·')[0]}
            </button>
          ))}
        </div>
      </div>

      {hasSpiralSeam(cards) && (
        <p className="text-[10px] leading-relaxed opacity-60">
          Spiral maps (log / exp / power) are seamless around the circle only when Scale tunes
          one turn to a whole number of pattern periods; otherwise a faint angular seam shows —
          inherent to the warp.
        </p>
      )}
    </div>
  );
}
