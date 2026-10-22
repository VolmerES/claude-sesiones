import React from 'react';
import { Box, Text } from 'ink';
import type { Line } from './theme.js';

// Pinta líneas ya cortadas al ancho; nunca deja que Ink las vuelva a partir
export const Lines: React.FC<{ lines: Line[] }> = ({ lines }) => (
  <Box flexDirection="column">
    {lines.map((l, i) => (
      <Text key={i} wrap="truncate">
        {l.length === 0
          ? ' '
          : l.map((s, j) => (
              <Text key={j} color={s.color} bold={s.bold} dimColor={s.dim} italic={s.italic}>
                {s.t}
              </Text>
            ))}
      </Text>
    ))}
  </Box>
);
