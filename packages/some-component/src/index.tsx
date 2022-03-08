import * as React from "react";
export function Theme({ children }: React.PropsWithChildren<{}>) {
  return (
    <div>
      <div>{children}</div>
    </div>
  );
}
