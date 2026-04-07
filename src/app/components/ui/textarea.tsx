import * as React from "react";

import { cn } from "./utils";

function Textarea({ className, onKeyDown, ...props }: React.ComponentProps<"textarea">) {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Allow Enter key to create new lines
    if (e.key === 'Enter') {
      // Don't prevent default - allow natural line break behavior
      e.stopPropagation();
    }
    
    // Call the original onKeyDown if it exists
    if (onKeyDown) {
      onKeyDown(e);
    }
  };

  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "resize-y border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:bg-input/30 flex field-sizing-content min-h-16 w-full rounded-md border bg-input-background px-3 py-2 text-base transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 md:text-sm select-text whitespace-pre-wrap",
        className,
      )}
      onKeyDown={handleKeyDown}
      {...props}
    />
  );
}

export { Textarea };