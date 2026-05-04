const SYMBOL_BASE_URL = 'https://svgs.scryfall.io/card-symbols';

const MONO_NAME_TO_CODE: Record<string, string> = {
  White: 'W',
  Blue: 'U',
  Black: 'B',
  Red: 'R',
  Green: 'G',
  Colorless: 'C',
};

function extractColorCode(label: string): string | null {
  if (MONO_NAME_TO_CODE[label]) {
    return MONO_NAME_TO_CODE[label];
  }
  const match = label.match(/^([WUBRG]{1,5})(?:\s|\(|$)/);
  return match ? match[1] : null;
}

function symbolUrl(symbol: string): string {
  return `${SYMBOL_BASE_URL}/${symbol}.svg`;
}

type GroupHeadingLabelProps = {
  label: string;
};

export function GroupHeadingLabel({ label }: GroupHeadingLabelProps) {
  const colorCode = extractColorCode(label);
  if (!colorCode) {
    return <>{label}</>;
  }

  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="inline-flex items-center gap-0.5">
        {colorCode.split('').map((symbol) => (
          <img
            key={`${label}-${symbol}`}
            src={symbolUrl(symbol)}
            alt={symbol}
            className="h-3.5 w-3.5"
            loading="lazy"
            decoding="async"
          />
        ))}
      </span>
      <span>{label}</span>
    </span>
  );
}
