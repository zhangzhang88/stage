import { gradientColors, GradientKey } from './gradient-colors';
import { SolidColorKey, solidColors } from './solid-colors';

export type BackgroundType = 'gradient' | 'solid' | 'image';

export interface BackgroundConfig {
  type: BackgroundType;
  value: GradientKey | SolidColorKey | string;
  opacity?: number;
}

export const getBackgroundStyle = (config: BackgroundConfig): string => {
  const { type, value, opacity = 1 } = config;

  switch (type) {
    case 'gradient':
      return gradientColors[value as GradientKey];

    case 'solid':
      const color = solidColors[value as SolidColorKey];
      return color;

    case 'image':
      return `url(${value})`;

    default:
      return gradientColors.sunset_vibes;
  }
};

export const getBackgroundCSS = (
  config: BackgroundConfig
): React.CSSProperties => {
  const { type, value, opacity = 1 } = config;

  switch (type) {
    case 'gradient':
      const gradient = gradientColors[value as GradientKey] || gradientColors.sunset_vibes;
      return {
        background: gradient,
        opacity,
      };

    case 'solid':
      const color = solidColors[value as SolidColorKey] || '#ffffff';
      return {
        backgroundColor: color,
        opacity,
      };

    case 'image':
      return {
        backgroundImage: `url(${value})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        opacity,
      };

    default:
      return {
        background: gradientColors.sunset_vibes,
        opacity,
      };
  }
};
