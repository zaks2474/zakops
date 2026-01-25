'use client';

import * as React from 'react';

type AspectRatioProps = React.HTMLAttributes<HTMLDivElement> & {
  /**
   * width / height ratio (e.g., 16/9).
   */
  ratio?: number;
};

function AspectRatio({ ratio = 1, style, children, ...props }: AspectRatioProps) {
  const safeRatio = ratio > 0 ? ratio : 1;
  const paddingBottom = `${100 / safeRatio}%`;
  return (
    <div
      data-slot='aspect-ratio'
      style={{
        position: 'relative',
        width: '100%',
        paddingBottom,
        ...style,
      }}
      {...props}
    >
      <div style={{ position: 'absolute', inset: 0 }}>{children}</div>
    </div>
  );
}

export { AspectRatio, type AspectRatioProps };
