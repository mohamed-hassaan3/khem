"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { adjustInventory, receiveStock } from "@/src/actions/admin/inventory";
import { FIELD_CLASS } from "@/src/components/admin/fields";
import { useDictionary } from "@/src/providers/i18n-provider";

export default function InventoryEditor({
  slug,
  inventoryOnline,
  inventoryOffline,
}: {
  slug: string;
  inventoryOnline: number;
  inventoryOffline: number;
}) {
  return (
    <div className="flex flex-col gap-3">
      <ChannelField slug={slug} channel="ONLINE" inventory={inventoryOnline} />
      <ChannelField slug={slug} channel="OFFLINE" inventory={inventoryOffline} />
    </div>
  );
}

function ChannelField({
  slug,
  channel,
  inventory,
}: {
  slug: string;
  channel: "ONLINE" | "OFFLINE";
  inventory: number;
}) {
  const router = useRouter();
  const dictionary = useDictionary().adminInventory;
  const [quantity, setQuantity] = useState("");
  const [correction, setCorrection] = useState(String(inventory));
  const [correcting, setCorrecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const label = channel === "ONLINE" ? dictionary.online : dictionary.offline;

  function add() {
    setError(null);
    if (!/^[1-9]\d*$/.test(quantity)) {
      setError(dictionary.quantityPositive);
      return;
    }
    startTransition(async () => {
      const outcome = await receiveStock({ slug, channel, quantity, reason: "restock" });
      if (!outcome.ok) {
        setError(outcome.fieldErrors?.quantity ?? dictionary.failed);
        return;
      }
      setQuantity("");
      router.refresh();
    });
  }

  function correct() {
    setError(null);
    if (!/^(0|[1-9]\d*)$/.test(correction)) {
      setError(dictionary.quantityNonNegative);
      return;
    }
    startTransition(async () => {
      const outcome = await adjustInventory({ slug, channel, inventory: correction });
      if (!outcome.ok) {
        setError(outcome.fieldErrors?.inventory ?? dictionary.failed);
        return;
      }
      setCorrecting(false);
      router.refresh();
    });
  }

  return (
    <div className="min-w-48 space-y-2">
      <div className="flex items-center gap-2">
        <label
          className="w-16 shrink-0 text-[12px] text-ground-muted"
          htmlFor={`add-stock-${channel}-${slug}`}
        >
          {dictionary.addStock}
        </label>
        <input
          id={`add-stock-${channel}-${slug}`}
          type="number"
          min={1}
          step={1}
          inputMode="numeric"
          placeholder={dictionary.quantityToAdd}
          aria-label={`${dictionary.addStock}: ${label}`}
          value={quantity}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `stock-error-${channel}-${slug}` : undefined}
          disabled={isPending}
          onChange={(event) => setQuantity(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              add();
            }
          }}
          className={`${FIELD_CLASS} min-w-0 flex-1 px-3 py-2 text-[12px]`}
        />
        <button
          type="button"
          onClick={add}
          disabled={isPending}
          className="h-10 rounded-lg border border-ground-border px-3 text-[12px] text-ground transition-colors duration-300 hover:border-gold/40 hover:text-ground-accent disabled:opacity-40"
        >
          {label}
        </button>
      </div>

      <button
        type="button"
        onClick={() => {
          setError(null);
          setCorrection(String(inventory));
          setCorrecting((value) => !value);
        }}
        className="ms-18 min-h-9 text-[12px] text-ground-accent transition-colors duration-300 hover:text-ground"
      >
        {dictionary.correctStock}
      </button>

      {correcting ? (
        <div className="flex items-center gap-2 ps-18">
          <input
            type="number"
            min={0}
            step={1}
            inputMode="numeric"
            aria-label={`${dictionary.correctStock}: ${label}`}
            value={correction}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `stock-error-${channel}-${slug}` : undefined}
            disabled={isPending}
            onChange={(event) => setCorrection(event.target.value)}
            className={`${FIELD_CLASS} w-20 px-3 py-2 text-[12px]`}
          />
          <button
            type="button"
            onClick={correct}
            disabled={isPending}
            className="h-10 rounded-lg border border-ground-border px-3 text-[12px] text-ground transition-colors duration-300 hover:border-gold/40 hover:text-ground-accent disabled:opacity-40"
          >
            {dictionary.saveCorrection}
          </button>
        </div>
      ) : null}

      {error ? (
        <p id={`stock-error-${channel}-${slug}`} className="ps-18 text-[10px] text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
