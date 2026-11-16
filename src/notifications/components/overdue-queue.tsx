"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { WhatsAppButton } from "@/notifications/components/whatsapp-button";

export interface QueueEntry {
  membershipId: string;
  fullName: string;
  memberCode: string;
  summary: string;
  whatsAppLink: string;
}

/**
 * "Remind all overdue" (brief §4.6). Browsers open one WhatsApp chat per
 * tap, so this steps through the list: send, and the next one comes up.
 * The list is fixed when the run starts; the page refreshing behind it as
 * each send is logged doesn't move anyone's place.
 */
export function OverdueQueue({ entries }: { entries: QueueEntry[] }) {
  const [queue, setQueue] = useState<QueueEntry[] | null>(null);
  const [position, setPosition] = useState(0);

  if (!queue) {
    if (entries.length === 0) return null;
    return (
      <Button
        onClick={() => {
          setQueue(entries);
          setPosition(0);
        }}
      >
        Remind all overdue · {entries.length}
      </Button>
    );
  }

  const stop = () => setQueue(null);

  const current = queue[position];
  if (!current) {
    return (
      <div className="card p-5">
        <p className="text-lg font-semibold">
          All done. Everyone overdue has a WhatsApp.
        </p>
        <Button variant="outline-dark" className="mt-4" onClick={stop}>
          Close
        </Button>
      </div>
    );
  }

  const next = () => setPosition((value) => value + 1);
  return (
    <div className="card p-5" aria-live="polite">
      <p className="text-sm font-medium text-muted">
        {position + 1} of {queue.length}
      </p>
      <p className="mt-2 section-title">{current.fullName}</p>
      <p className="text-muted">
        <span className="font-mono">{current.memberCode}</span> ·{" "}
        {current.summary}
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        <WhatsAppButton
          key={current.membershipId}
          href={current.whatsAppLink}
          membershipId={current.membershipId}
          label="Open WhatsApp"
          onSent={next}
        />
        <Button variant="outline-dark" onClick={next}>
          Skip
        </Button>
        <Button variant="outline-dark" onClick={stop}>
          Stop
        </Button>
      </div>
    </div>
  );
}
